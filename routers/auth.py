"""
MVP authentication — email + bcrypt password stored in Lakebase auth_users table.
Issues a short-lived JWT. Replace with Hertz SSO when ready.
"""

import os
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from db import query

router = APIRouter()

JWT_SECRET = os.getenv("LEO_JWT_SECRET", "leo-mvp-secret-change-in-prod")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 8

_bearer = HTTPBearer(auto_error=False)


def _make_token(user: dict) -> str:
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def _user_profile(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "role": row["role"],
        "displayName": row["display_name"],
        "branch": row.get("branch"),
        "onboardingCompletedAt": row.get("onboarding_completed_at"),
    }


async def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict | None:
    token = None
    if creds is not None and creds.credentials:
        token = creds.credentials
    else:
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
        if not token:
            token = request.headers.get("x-leo-token")
        if not token:
            token = request.query_params.get("_token")

    if not token:
        return None
    payload = _decode_token(token)
    return payload


@router.post("/auth/login")
async def login(body: dict):
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password required")

    rows = query(
        "SELECT id, email, password_hash, role, display_name, branch, is_active, onboarding_completed_at FROM auth_users WHERE email = %s",
        (email,),
    )
    if not rows:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = rows[0]
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account disabled")

    if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _make_token(user)
    return {"token": token, "user": _user_profile(user)}


@router.get("/auth/me")
async def me(current_user: dict | None = Depends(get_current_user)):
    if current_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    rows = query(
        "SELECT id, email, role, display_name, branch, is_active, onboarding_completed_at FROM auth_users WHERE id = %s::uuid",
        (user_id,),
    )
    if not rows or not rows[0].get("is_active", True):
        raise HTTPException(status_code=401, detail="User not found or disabled")

    return {"user": _user_profile(rows[0])}


@router.post("/auth/onboarding/complete")
async def complete_onboarding(
    body: dict,
    current_user: dict | None = Depends(get_current_user),
):
    if current_user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_id = current_user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    completed_at = body.get("completedAt") or datetime.now(timezone.utc).isoformat()

    query(
        "UPDATE auth_users SET onboarding_completed_at = %s WHERE id = %s::uuid",
        (completed_at, user_id),
    )
    return {"ok": True}
