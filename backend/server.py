"""OdysAI FastAPI backend — travel itinerary organizer powered by Gemini 3 Flash."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv()

import logging
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Response
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

from database import init_db, get_conn
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    set_auth_cookie,
    clear_auth_cookie,
)
from llm_service import generate_itinerary

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("odysai")

app = FastAPI(title="OdysAI")
api_router = APIRouter(prefix="/api")


# ----------------------------- Models -----------------------------
class SignupRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(min_length=4)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Activity(BaseModel):
    title: str
    description: Optional[str] = ""
    time_slot: Optional[str] = ""
    estimated_cost: Optional[float] = 0
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    activity_type: str = "Activity"
    booking_reference_url: Optional[str] = ""


class Day(BaseModel):
    day_number: int
    weather_snapshot: Optional[str] = ""
    activities: List[Activity] = []


class ItineraryPayload(BaseModel):
    title: Optional[str] = ""
    destination: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    days: List[Day] = []


class ChatRequest(BaseModel):
    message: str = ""
    preferences: dict = {}
    current_itinerary: Optional[dict] = None
    history: List[dict] = []


# ----------------------------- Helpers -----------------------------
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _fetch_full_itinerary(conn, itinerary_id: int, user_id: int) -> Optional[dict]:
    it = conn.execute(
        "SELECT * FROM itineraries WHERE itinerary_id = ? AND user_id = ?",
        (itinerary_id, user_id),
    ).fetchone()
    if it is None:
        return None
    itinerary = dict(it)
    days = conn.execute(
        "SELECT * FROM itinerary_days WHERE itinerary_id = ? ORDER BY day_number",
        (itinerary_id,),
    ).fetchall()
    day_list = []
    for d in days:
        d = dict(d)
        acts = conn.execute(
            "SELECT * FROM activities WHERE day_id = ? ORDER BY activity_id",
            (d["day_id"],),
        ).fetchall()
        d["activities"] = [dict(a) for a in acts]
        day_list.append(d)
    itinerary["days"] = day_list
    return itinerary


def _insert_days(conn, itinerary_id: int, days: List[Day]):
    for day in days:
        cur = conn.execute(
            "INSERT INTO itinerary_days (itinerary_id, day_number, weather_snapshot) VALUES (?, ?, ?)",
            (itinerary_id, day.day_number, day.weather_snapshot),
        )
        day_id = cur.lastrowid
        for act in day.activities:
            atype = act.activity_type if act.activity_type in ("Flight", "Hotel", "Activity") else "Activity"
            conn.execute(
                """INSERT INTO activities
                   (day_id, title, description, time_slot, estimated_cost, latitude, longitude, activity_type, booking_reference_url)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (day_id, act.title, act.description, act.time_slot, act.estimated_cost,
                 act.latitude, act.longitude, atype, act.booking_reference_url),
            )


# ----------------------------- Auth routes -----------------------------
@api_router.post("/auth/signup")
async def signup(req: SignupRequest, response: Response):
    email = req.email.lower()
    conn = get_conn()
    existing = conn.execute("SELECT user_id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email already exists.")
    cur = conn.execute(
        "INSERT INTO users (full_name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
        (req.full_name, email, hash_password(req.password), _now()),
    )
    user_id = cur.lastrowid
    conn.commit()
    conn.close()
    token = create_access_token(user_id, email)
    set_auth_cookie(response, token)
    return {"user": {"user_id": user_id, "full_name": req.full_name, "email": email}}


@api_router.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    email = req.email.lower()
    conn = get_conn()
    row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    if row is None or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = create_access_token(row["user_id"], email)
    set_auth_cookie(response, token)
    return {"user": {"user_id": row["user_id"], "full_name": row["full_name"], "email": email}}


@api_router.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookie(response)
    return {"success": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ----------------------------- Chat / AI route -----------------------------
@api_router.post("/chat")
async def chat(req: ChatRequest, user: dict = Depends(get_current_user)):
    try:
        result = await generate_itinerary(
            req.message, req.preferences, req.current_itinerary, req.history
        )
        return result
    except Exception:
        logger.exception("Itinerary generation failed")
        raise HTTPException(
            status_code=500,
            detail="OdysAI couldn't generate an itinerary right now. Please try again in a moment.",
        )


# ----------------------------- Itinerary CRUD -----------------------------
@api_router.post("/itineraries")
async def create_itinerary(payload: ItineraryPayload, user: dict = Depends(get_current_user)):
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO itineraries (user_id, title, destination, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (user["user_id"], payload.title, payload.destination, payload.start_date, payload.end_date, _now()),
    )
    itinerary_id = cur.lastrowid
    _insert_days(conn, itinerary_id, payload.days)
    conn.commit()
    full = _fetch_full_itinerary(conn, itinerary_id, user["user_id"])
    conn.close()
    return full


@api_router.put("/itineraries/{itinerary_id}")
async def update_itinerary(itinerary_id: int, payload: ItineraryPayload, user: dict = Depends(get_current_user)):
    conn = get_conn()
    it = conn.execute(
        "SELECT itinerary_id FROM itineraries WHERE itinerary_id = ? AND user_id = ?",
        (itinerary_id, user["user_id"]),
    ).fetchone()
    if it is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Itinerary not found.")
    conn.execute(
        "UPDATE itineraries SET title = ?, destination = ?, start_date = ?, end_date = ? WHERE itinerary_id = ?",
        (payload.title, payload.destination, payload.start_date, payload.end_date, itinerary_id),
    )
    # Replace days/activities wholesale (cascade deletes activities)
    conn.execute("DELETE FROM itinerary_days WHERE itinerary_id = ?", (itinerary_id,))
    _insert_days(conn, itinerary_id, payload.days)
    conn.commit()
    full = _fetch_full_itinerary(conn, itinerary_id, user["user_id"])
    conn.close()
    return full


@api_router.get("/itineraries")
async def list_my_itineraries(user: dict = Depends(get_current_user)):
    conn = get_conn()
    rows = conn.execute(
        "SELECT itinerary_id, title, destination, start_date, end_date, created_at FROM itineraries WHERE user_id = ? ORDER BY created_at DESC",
        (user["user_id"],),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@api_router.get("/itineraries/{itinerary_id}")
async def get_itinerary(itinerary_id: int, user: dict = Depends(get_current_user)):
    conn = get_conn()
    full = _fetch_full_itinerary(conn, itinerary_id, user["user_id"])
    conn.close()
    if full is None:
        raise HTTPException(status_code=404, detail="Itinerary not found.")
    return full


@api_router.delete("/itineraries/{itinerary_id}")
async def delete_itinerary(itinerary_id: int, user: dict = Depends(get_current_user)):
    conn = get_conn()
    it = conn.execute(
        "SELECT itinerary_id FROM itineraries WHERE itinerary_id = ? AND user_id = ?",
        (itinerary_id, user["user_id"]),
    ).fetchone()
    if it is None:
        conn.close()
        raise HTTPException(status_code=404, detail="Itinerary not found.")
    conn.execute("DELETE FROM itineraries WHERE itinerary_id = ?", (itinerary_id,))
    conn.commit()
    conn.close()
    return {"success": True}


@api_router.get("/users/{user_id}/itineraries")
async def list_user_itineraries(user_id: int, user: dict = Depends(get_current_user)):
    if user_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not allowed.")
    conn = get_conn()
    rows = conn.execute(
        "SELECT itinerary_id, title, destination, start_date, end_date, created_at FROM itineraries WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@api_router.get("/")
async def root():
    return {"message": "OdysAI API is running"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=".*",
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    init_db()
    logger.info("OdysAI SQLite database initialized.")
