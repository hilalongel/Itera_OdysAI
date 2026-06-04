"""LLM service for OdysAI.

Generates structured travel itineraries via Groq's OpenAI-compatible API and
returns them in the exact shape the frontend (Dashboard.jsx) expects:

    {
        "reply": "<short chat message>",
        "action": "create" | "update",
        "itinerary": {
            "title": str,
            "destination": str,
            "start_date": "YYYY-MM-DD",
            "end_date": "YYYY-MM-DD",
            "days": [
                {
                    "day_number": int,
                    "weather_snapshot": str,
                    "activities": [
                        {
                            "title": str,
                            "description": str,
                            "time_slot": str,
                            "estimated_cost": float,
                            "latitude": float | None,
                            "longitude": float | None,
                            "activity_type": "Flight" | "Hotel" | "Activity",
                            "booking_reference_url": str
                        }
                    ]
                }
            ]
        }
    }
"""
import os
import json
import logging
from datetime import date

from openai import OpenAI

logger = logging.getLogger("odysai.llm")

# The committed key is a Groq key (gsk_...). Prefer GROQ_API_KEY, but fall back
# to the legacy XAI_API_KEY name that the project currently ships with.
_API_KEY = os.environ.get("GROQ_API_KEY") or os.environ.get("XAI_API_KEY")
_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.groq.com/openai/v1")
_MODEL = os.environ.get("LLM_MODEL", "llama-3.3-70b-versatile")

_ALLOWED_TYPES = ("Flight", "Hotel", "Activity")

_client = OpenAI(api_key=_API_KEY, base_url=_BASE_URL) if _API_KEY else None


SYSTEM_PROMPT = """You are OdysAI, an expert travel planner and friendly travel companion.

You ALWAYS reply with a single valid JSON object and nothing else (no markdown,
no code fences, no commentary outside the JSON). The JSON object must have
exactly these top-level keys:

- "reply": a short, friendly 1-2 sentence message to show in the chat.
- "action": one of three values:
    - "chat"   → you are having a conversation, asking questions, or greeting.
                 Use this when the user hasn't provided enough info to plan yet,
                 or is just chatting. Set "itinerary" to null.
    - "create" → generate a brand new itinerary. Only use this when you have
                 destination, dates, budget, and number of travelers.
    - "update" → the user is refining an existing itinerary.
- "itinerary": full trip object when action is "create" or "update", null otherwise.

When action is "chat", ONLY return:
    { "reply": "...", "action": "chat", "itinerary": null }

When action is "create" or "update", itinerary must have:
    - "title": a short evocative trip title.
    - "destination": the destination city/country.
    - "start_date": "YYYY-MM-DD".
    - "end_date": "YYYY-MM-DD".
    - "days": an array of day objects, one per day of the trip, each with:
        - "day_number": integer starting at 1.
        - "weather_snapshot": a short plausible weather note (e.g. "Sunny, 24C").
        - "activities": an array of activity objects, each with:
            - "title": short name of the activity.
            - "description": 1-2 sentence description. If applicable include
              what public transportation to use. Train/metro/bus line numbers.
            - "time_slot": e.g. "09:00 - 11:00" or "Morning".
            - "estimated_cost": a NUMBER in USD (0 if free). Never a string.
            - "latitude": decimal latitude as a number, or null if unknown.
            - "longitude": decimal longitude as a number, or null if unknown.
            - "activity_type": EXACTLY one of "Flight", "Hotel", or "Activity".
            - "booking_reference_url": a relevant URL, or "" if none.

Behavior rules:
- On the very first message, greet the user warmly and ask where they want to go.
- If the user hasn't provided destination, dates, budget, or number of travelers,
  ask for the missing info naturally — one question at a time. Use action "chat".
- Once you have enough to plan, generate the itinerary without being asked again.
- Give each day 3-6 realistic activities including meals and downtime.
- activity_type MUST be Flight, Hotel, or Activity only.
- Provide real-world latitude/longitude for known places when you can.
- Respect budget, travel style, walking tolerance, food/hotel preferences."""


def _days_between(start_date: str, end_date: str) -> int:
    """Inclusive day count between two YYYY-MM-DD strings; 0 if unparseable."""
    try:
        s = date.fromisoformat(start_date)
        e = date.fromisoformat(end_date)
        return max((e - s).days + 1, 0)
    except (ValueError, TypeError):
        return 0


def _coerce_float(value):
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (ValueError, TypeError):
        return None


def _normalize_itinerary(raw, preferences) -> dict:
    """Defensively coerce the model's JSON into the exact frontend schema."""
    prefs = preferences or {}
    raw = raw if isinstance(raw, dict) else {}

    days_out = []
    for i, day in enumerate(raw.get("days") or [], start=1):
        day = day if isinstance(day, dict) else {}
        activities_out = []
        for act in day.get("activities") or []:
            act = act if isinstance(act, dict) else {}
            atype = act.get("activity_type", "Activity")
            if atype not in _ALLOWED_TYPES:
                atype = "Activity"
            cost = _coerce_float(act.get("estimated_cost"))
            activities_out.append({
                "title": str(act.get("title") or "Untitled activity"),
                "description": str(act.get("description") or ""),
                "time_slot": str(act.get("time_slot") or ""),
                "estimated_cost": cost if cost is not None else 0.0,
                "latitude": _coerce_float(act.get("latitude")),
                "longitude": _coerce_float(act.get("longitude")),
                "activity_type": atype,
                "booking_reference_url": str(act.get("booking_reference_url") or ""),
            })
        try:
            day_number = int(day.get("day_number") or i)
        except (ValueError, TypeError):
            day_number = i
        days_out.append({
            "day_number": day_number,
            "weather_snapshot": str(day.get("weather_snapshot") or ""),
            "activities": activities_out,
        })

    return {
        "title": str(raw.get("title") or f"Trip to {prefs.get('destination', '')}".strip()),
        "destination": str(raw.get("destination") or prefs.get("destination") or ""),
        "start_date": str(raw.get("start_date") or prefs.get("start_date") or ""),
        "end_date": str(raw.get("end_date") or prefs.get("end_date") or ""),
        "days": days_out,
    }


async def generate_itinerary(message, preferences=None, current_itinerary=None, history=None):
    if _client is None:
        raise RuntimeError(
            "No LLM API key configured. Set GROQ_API_KEY (or XAI_API_KEY) in backend/.env"
        )

    prefs = preferences or {}
    num_days = _days_between(prefs.get("start_date", ""), prefs.get("end_date", ""))
    day_hint = f"The trip spans {num_days} day(s); produce exactly {num_days} day object(s)." if num_days else ""

    user_prompt = f"""User message: {message}

Traveler preferences (JSON): {json.dumps(prefs, ensure_ascii=False)}
{day_hint}

Existing itinerary to refine (JSON, null if none): {json.dumps(current_itinerary, ensure_ascii=False)}

Recent conversation history: {json.dumps(history or [], ensure_ascii=False)}

Return the JSON object now."""

    # response_format json_object forces Groq/OpenAI to emit valid JSON.
    response = _client.chat.completions.create(
        model=_MODEL,
        temperature=0.7,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
    )

    content = response.choices[0].message.content or "{}"
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        logger.error("Model returned non-JSON content: %s", content[:500])
        raise

    action = parsed.get("action")
    if action not in ("create", "update", "chat"):
        action = "update" if current_itinerary else "chat"

    return {
        "reply": str(parsed.get("reply") or "Here's your itinerary."),
        "action": action,
        "itinerary": _normalize_itinerary(parsed.get("itinerary"), prefs) if action != "chat" else None,
    }
