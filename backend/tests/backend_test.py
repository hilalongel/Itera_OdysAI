"""OdysAI backend API regression tests (cookie-auth refactor).

Covers:
- Auth: signup/login set httpOnly access_token cookie; /auth/me works with cookie & 401 without;
        /auth/logout clears cookie; Bearer header fallback still works
- Chat: Gemini-powered itinerary generation
- Itineraries: CRUD + per-user list + 403/404 isolation
"""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://odyssey-planner.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---- shared session w/ cookie jar ----
@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def user_creds():
    uniq = uuid.uuid4().hex[:8]
    return {
        "full_name": f"TEST_User_{uniq}",
        "email": f"test_{uniq}@example.com",
        "password": "test123",
    }


@pytest.fixture(scope="session")
def auth(api_client, user_creds):
    """Sign up a fresh user — cookie is stored in the session jar.
       Also captures the cookie token for Bearer-fallback tests."""
    r = api_client.post(f"{API}/auth/signup", json=user_creds, timeout=30)
    assert r.status_code == 200, f"signup failed: {r.status_code} {r.text}"
    data = r.json()
    # New shape: {user: {...}} — NO token in body
    assert "user" in data
    assert "token" not in data, "token should not leak in response body (httpOnly cookie only)"
    assert data["user"]["email"] == user_creds["email"].lower()
    # httpOnly cookie must be set
    assert "access_token" in api_client.cookies, "access_token cookie not set on signup"
    token = api_client.cookies.get("access_token")
    return {"token": token, "user_id": data["user"]["user_id"]}


@pytest.fixture(scope="session")
def auth_headers(auth):
    """Bearer-fallback header (auth.py still supports Authorization: Bearer)."""
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}


# ---- Health ----
class TestHealth:
    def test_root(self, api_client):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200
        assert "running" in r.json().get("message", "").lower()


# ---- Auth (cookie-first) ----
class TestAuthCookies:
    def test_signup_sets_httponly_cookie(self, auth, api_client):
        # The cookie itself was set in the `auth` fixture; verify properties from raw header
        # by re-issuing a fresh signup on a one-off session.
        s = requests.Session()
        uniq = uuid.uuid4().hex[:8]
        r = s.post(
            f"{API}/auth/signup",
            json={"full_name": "TEST_Cookie", "email": f"test_cookie_{uniq}@example.com", "password": "test123"},
            timeout=15,
        )
        assert r.status_code == 200
        body = r.json()
        assert "token" not in body
        assert body["user"]["email"].startswith("test_cookie_")
        set_cookie = r.headers.get("set-cookie", "")
        assert "access_token=" in set_cookie, set_cookie
        assert "HttpOnly" in set_cookie, f"cookie must be HttpOnly: {set_cookie}"
        # belt-and-braces: jar has it
        assert "access_token" in s.cookies

    def test_login_sets_cookie_and_no_token_in_body(self, api_client, user_creds, auth):
        s = requests.Session()
        r = s.post(
            f"{API}/auth/login",
            json={"email": user_creds["email"], "password": user_creds["password"]},
            timeout=15,
        )
        assert r.status_code == 200
        data = r.json()
        assert "token" not in data
        assert data["user"]["email"] == user_creds["email"].lower()
        assert "access_token" in s.cookies

    def test_me_with_cookie(self, api_client, auth):
        # api_client already has cookie from `auth` fixture
        r = api_client.get(f"{API}/auth/me", timeout=15)
        assert r.status_code == 200
        assert r.json()["user_id"] == auth["user_id"]

    def test_me_with_bearer_fallback(self, auth):
        # No cookie, just Authorization header
        r = requests.get(
            f"{API}/auth/me",
            headers={"Authorization": f"Bearer {auth['token']}"},
            timeout=15,
        )
        assert r.status_code == 200
        assert r.json()["user_id"] == auth["user_id"]

    def test_me_no_cookie_no_token(self):
        r = requests.get(f"{API}/auth/me", timeout=10)
        assert r.status_code == 401

    def test_me_bad_token(self):
        r = requests.get(
            f"{API}/auth/me", headers={"Authorization": "Bearer not-a-real-token"}, timeout=10
        )
        assert r.status_code == 401

    def test_logout_clears_cookie(self, user_creds):
        # Login on fresh session, /me should succeed, logout, then /me should 401
        s = requests.Session()
        r = s.post(
            f"{API}/auth/login",
            json={"email": user_creds["email"], "password": user_creds["password"]},
            timeout=15,
        )
        assert r.status_code == 200
        assert "access_token" in s.cookies
        ok = s.get(f"{API}/auth/me", timeout=10)
        assert ok.status_code == 200
        out = s.post(f"{API}/auth/logout", timeout=10)
        assert out.status_code == 200
        assert out.json().get("success") is True
        # Cookie should be cleared (server sends expired set-cookie)
        post_me = s.get(f"{API}/auth/me", timeout=10)
        assert post_me.status_code == 401, "session must be invalid after logout"

    def test_logout_requires_auth(self):
        r = requests.post(f"{API}/auth/logout", timeout=10)
        assert r.status_code == 401

    def test_signup_duplicate(self, api_client, user_creds, auth):
        r = api_client.post(f"{API}/auth/signup", json=user_creds, timeout=15)
        assert r.status_code == 400
        assert "exists" in r.json().get("detail", "").lower()

    def test_login_wrong_password(self, user_creds, auth):
        r = requests.post(
            f"{API}/auth/login",
            json={"email": user_creds["email"], "password": "wrong-password"},
            timeout=15,
        )
        assert r.status_code == 401


# ---- Chat (Gemini) ----
@pytest.fixture(scope="session")
def chat_itinerary(api_client, auth):
    """Call /api/chat once and cache the generated itinerary. Uses cookie auth."""
    payload = {
        "message": "Plan a relaxed 2-day cultural trip.",
        "preferences": {
            "destination": "Lisbon, Portugal",
            "start_date": "2026-04-10",
            "end_date": "2026-04-11",
            "budget": "mid-range",
            "travel_style": "relaxed",
            "activity_types": ["culture", "food"],
            "walking_tolerance": 5,
            "num_travelers": "2",
        },
        "current_itinerary": None,
    }
    t0 = time.time()
    r = api_client.post(f"{API}/chat", json=payload, timeout=120)
    print(f"/chat took {time.time()-t0:.1f}s -> {r.status_code}")
    if r.status_code != 200:
        pytest.skip(f"Gemini chat failed ({r.status_code}): {r.text[:200]}")
    return r.json()


class TestChat:
    def test_chat_requires_auth(self):
        r = requests.post(f"{API}/chat", json={"message": "hi", "preferences": {}}, timeout=15)
        assert r.status_code == 401

    def test_chat_shape(self, chat_itinerary):
        data = chat_itinerary
        assert "reply" in data and isinstance(data["reply"], str) and len(data["reply"]) > 0
        assert "action" in data
        assert "itinerary" in data
        it = data["itinerary"]
        assert it is not None, "Gemini returned null itinerary for an explicit create request"
        assert isinstance(it.get("days"), list) and len(it["days"]) >= 1
        first_day = it["days"][0]
        assert "day_number" in first_day
        assert isinstance(first_day.get("activities"), list)
        for a in first_day["activities"]:
            assert a["activity_type"] in ("Flight", "Hotel", "Activity")


# ---- Itineraries CRUD (cookie-auth) ----
class TestItineraries:
    def test_create_save_and_get(self, api_client, chat_itinerary):
        it = chat_itinerary["itinerary"]
        payload = {
            "title": it.get("title") or "TEST_Trip",
            "destination": it.get("destination") or "Lisbon",
            "start_date": it.get("start_date") or "2026-04-10",
            "end_date": it.get("end_date") or "2026-04-11",
            "days": [
                {
                    "day_number": d["day_number"],
                    "weather_snapshot": d.get("weather_snapshot", ""),
                    "activities": [
                        {
                            "title": a["title"],
                            "description": a.get("description", ""),
                            "time_slot": a.get("time_slot", ""),
                            "estimated_cost": a.get("estimated_cost") or 0,
                            "latitude": a.get("latitude"),
                            "longitude": a.get("longitude"),
                            "activity_type": a.get("activity_type", "Activity"),
                            "booking_reference_url": a.get("booking_reference_url", ""),
                        }
                        for a in d.get("activities", [])
                    ],
                }
                for d in it["days"]
            ],
        }
        r = api_client.post(f"{API}/itineraries", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        created = r.json()
        assert "itinerary_id" in created
        assert created["destination"] == payload["destination"]
        assert len(created["days"]) == len(payload["days"])
        pytest.shared_itinerary_id = created["itinerary_id"]

        r2 = api_client.get(f"{API}/itineraries/{created['itinerary_id']}", timeout=15)
        assert r2.status_code == 200
        fetched = r2.json()
        assert fetched["itinerary_id"] == created["itinerary_id"]
        assert len(fetched["days"]) == len(payload["days"])

    def test_list_my_itineraries(self, api_client):
        r = api_client.get(f"{API}/itineraries", timeout=15)
        assert r.status_code == 200
        ids = [i["itinerary_id"] for i in r.json()]
        assert pytest.shared_itinerary_id in ids

    def test_user_itineraries_owner(self, api_client, auth):
        r = api_client.get(f"{API}/users/{auth['user_id']}/itineraries", timeout=15)
        assert r.status_code == 200
        assert any(i["itinerary_id"] == pytest.shared_itinerary_id for i in r.json())

    def test_user_itineraries_forbidden(self, api_client, auth):
        r = api_client.get(f"{API}/users/{auth['user_id'] + 99999}/itineraries", timeout=15)
        assert r.status_code == 403

    def test_update_itinerary_persists(self, api_client):
        iid = pytest.shared_itinerary_id
        cur = api_client.get(f"{API}/itineraries/{iid}", timeout=15).json()
        new_title = "TEST_Updated_Title"
        update_payload = {
            "title": new_title,
            "destination": cur["destination"],
            "start_date": cur["start_date"],
            "end_date": cur["end_date"],
            "days": [
                {
                    "day_number": d["day_number"],
                    "weather_snapshot": d.get("weather_snapshot", ""),
                    "activities": [
                        {
                            "title": a["title"],
                            "description": a.get("description", ""),
                            "time_slot": a.get("time_slot", ""),
                            "estimated_cost": a.get("estimated_cost") or 0,
                            "latitude": a.get("latitude"),
                            "longitude": a.get("longitude"),
                            "activity_type": a.get("activity_type") or "Activity",
                            "booking_reference_url": a.get("booking_reference_url", ""),
                        }
                        for a in d.get("activities", [])
                    ],
                }
                for d in cur["days"][:1]
            ],
        }
        r = api_client.put(f"{API}/itineraries/{iid}", json=update_payload, timeout=30)
        assert r.status_code == 200, r.text
        updated = r.json()
        assert updated["title"] == new_title
        assert len(updated["days"]) == 1
        verify = api_client.get(f"{API}/itineraries/{iid}", timeout=15).json()
        assert verify["title"] == new_title

    def test_get_not_owned_returns_404(self, api_client):
        r = api_client.get(f"{API}/itineraries/999999", timeout=15)
        assert r.status_code == 404

    def test_delete_itinerary(self, api_client):
        iid = pytest.shared_itinerary_id
        r = api_client.delete(f"{API}/itineraries/{iid}", timeout=15)
        assert r.status_code == 200
        r2 = api_client.get(f"{API}/itineraries/{iid}", timeout=15)
        assert r2.status_code == 404


# ---- Cross-user isolation w/ cookies ----
class TestUserIsolation:
    def test_other_user_cannot_see(self):
        sa, sb = requests.Session(), requests.Session()
        uniq_a, uniq_b = uuid.uuid4().hex[:8], uuid.uuid4().hex[:8]
        ra = sa.post(
            f"{API}/auth/signup",
            json={"full_name": "TEST_A", "email": f"test_a_{uniq_a}@example.com", "password": "test123"},
            timeout=15,
        )
        rb = sb.post(
            f"{API}/auth/signup",
            json={"full_name": "TEST_B", "email": f"test_b_{uniq_b}@example.com", "password": "test123"},
            timeout=15,
        )
        assert ra.status_code == 200 and rb.status_code == 200
        a_user = ra.json()["user"]
        created = sa.post(
            f"{API}/itineraries",
            json={
                "title": "TEST_Aonly",
                "destination": "Paris",
                "start_date": "2026-05-01",
                "end_date": "2026-05-02",
                "days": [{"day_number": 1, "weather_snapshot": "", "activities": []}],
            },
            timeout=15,
        ).json()
        b_list = sb.get(f"{API}/itineraries", timeout=15).json()
        assert all(i["itinerary_id"] != created["itinerary_id"] for i in b_list)
        r = sb.get(f"{API}/users/{a_user['user_id']}/itineraries", timeout=15)
        assert r.status_code == 403
        r2 = sb.get(f"{API}/itineraries/{created['itinerary_id']}", timeout=15)
        assert r2.status_code == 404
