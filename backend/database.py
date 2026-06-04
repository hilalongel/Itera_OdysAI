"""SQLite database setup and helpers for OdysAI."""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "odysai.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS itineraries (
    itinerary_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT,
    destination TEXT,
    start_date TEXT,
    end_date TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS itinerary_days (
    day_id INTEGER PRIMARY KEY AUTOINCREMENT,
    itinerary_id INTEGER NOT NULL,
    day_number INTEGER,
    weather_snapshot TEXT,
    FOREIGN KEY (itinerary_id) REFERENCES itineraries(itinerary_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activities (
    activity_id INTEGER PRIMARY KEY AUTOINCREMENT,
    day_id INTEGER NOT NULL,
    title TEXT,
    description TEXT,
    time_slot TEXT,
    estimated_cost REAL,
    latitude REAL,
    longitude REAL,
    activity_type TEXT CHECK(activity_type IN ('Flight', 'Hotel', 'Activity')),
    booking_reference_url TEXT,
    FOREIGN KEY (day_id) REFERENCES itinerary_days(day_id) ON DELETE CASCADE
);
"""


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_conn()
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()
