"""Authentication helpers: bcrypt password hashing + JWT bearer tokens."""
import os
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import Request, HTTPException

from database import get_conn

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_DAYS = 7
ACCESS_TOKEN_MAX_AGE = ACCESS_TOKEN_DAYS * 24 * 60 * 60
COOKIE_NAME = "access_token"


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def _get_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: int, email: str) -> str:
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_DAYS),
        "type": "access",
    }
    return jwt.encode(payload, _get_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookie(response, token: str) -> None:
    # SameSite=None + Secure so the cookie is sent on credentialed XHR even when the
    # SPA origin and the API host are treated as cross-site (preview subdomains).
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=ACCESS_TOKEN_MAX_AGE,
        path="/",
    )


def clear_auth_cookie(response) -> None:
    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        httponly=True,
        secure=True,
        samesite="none",
    )


async def get_current_user(request: Request) -> dict:
    # Prefer the httpOnly cookie; fall back to Authorization header for tooling/tests.
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, _get_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    conn = get_conn()
    row = conn.execute(
        "SELECT user_id, full_name, email FROM users WHERE user_id = ?",
        (int(payload["sub"]),),
    ).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=401, detail="User not found")
    return dict(row)
