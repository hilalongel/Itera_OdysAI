"""Backend smoke tests for OdysAI: auth + chat + itinerary CRUD."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://5da0f8ec-f94f-4835-90f3-c4a5cf6f4f01.preview.emergentagent.com").rstrip("/")

UNIQUE = uuid.uuid4().hex[:8]
EMAIL = f"TEST_{UNIQUE}@odysai.com"
PASSWORD = "test123"
FULL_NAME = "Test User"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_signup(session):
    r = session.post(f"{BASE_URL}/api/auth/signup", json={
        "full_name": FULL_NAME, "email": EMAIL, "password": PASSWORD
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["email"] == EMAIL.lower()
    assert "user_id" in data["user"]


def test_me(session):
    r = session.get(f"{BASE_URL}/api/auth/me")
    assert r.status_code == 200, r.text
    assert r.json()["email"] == EMAIL.lower()


def test_login(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert r.status_code == 200, r.text


def test_login_invalid(session):
    s2 = requests.Session()
    r = s2.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": "wrong"})
    assert r.status_code == 401


def test_chat_with_prefs(session):
    payload = {
        "message": "Create a travel itinerary based on my preferences.",
        "preferences": {
            "destination": "Rome, Italy",
            "start_date": "2026-05-01",
            "end_date": "2026-05-04",
            "budget": "Mid-range",
            "num_travelers": "2",
            "travel_style": "Balanced",
            "activity_types": ["Food", "Culture"],
            "walking_tolerance": 5,
        },
        "current_itinerary": None,
        "history": [],
    }
    r = session.post(f"{BASE_URL}/api/chat", json=payload, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "reply" in data
    assert "action" in data
    assert "itinerary" in data
    it = data["itinerary"]
    assert it and "days" in it and len(it["days"]) >= 1
    # Save for downstream test
    pytest.itinerary_payload = it


def test_create_itinerary(session):
    it = getattr(pytest, "itinerary_payload", None)
    assert it is not None, "Chat must run first"
    payload = {
        "title": it.get("title") or "Rome trip",
        "destination": it.get("destination") or "Rome, Italy",
        "start_date": it.get("start_date") or "2026-05-01",
        "end_date": it.get("end_date") or "2026-05-04",
        "days": it.get("days", []),
    }
    r = session.post(f"{BASE_URL}/api/itineraries", json=payload)
    assert r.status_code == 200, r.text
    saved = r.json()
    assert "itinerary_id" in saved
    pytest.saved_id = saved["itinerary_id"]

    # Verify persistence via GET
    g = session.get(f"{BASE_URL}/api/itineraries/{saved['itinerary_id']}")
    assert g.status_code == 200
    assert g.json()["destination"] == payload["destination"]


def test_list_itineraries(session):
    r = session.get(f"{BASE_URL}/api/itineraries")
    assert r.status_code == 200
    arr = r.json()
    assert isinstance(arr, list) and len(arr) >= 1


def test_delete_itinerary(session):
    sid = getattr(pytest, "saved_id", None)
    assert sid is not None
    r = session.delete(f"{BASE_URL}/api/itineraries/{sid}")
    assert r.status_code == 200
    g = session.get(f"{BASE_URL}/api/itineraries/{sid}")
    assert g.status_code == 404
