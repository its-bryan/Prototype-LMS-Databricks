import os
import jwt
from fastapi import APIRouter, HTTPException, Query, Request
from db import query, with_connection

router = APIRouter()


def _user_from_jwt(request: Request) -> dict | None:
    token = None
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.headers.get("x-leo-token")
    if not token:
        token = request.query_params.get("_token")
    if not token:
        return None
    secret = os.getenv("LEO_JWT_SECRET", "leo-mvp-secret-change-in-prod")
    try:
        return jwt.decode(token, secret, algorithms=["HS256"])
    except Exception:
        return None


def _require_user(request: Request) -> tuple[str, str]:
    payload = _user_from_jwt(request)
    user_id = payload.get("sub") if payload else None
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user_rows = query(
        "SELECT id::text AS id, display_name FROM auth_users WHERE id = %s::uuid AND is_active = true",
        (user_id,),
    )
    if user_rows:
        return user_rows[0]["id"], user_rows[0]["display_name"]
    fallback_name = payload.get("display_name") or payload.get("name") or payload.get("email") or "Unknown User"
    return user_id, fallback_name


def _mask_name_if_anonymous(row: dict) -> dict:
    if row.get("is_anonymous"):
        row["user_name"] = "Anonymous"
    return row


@router.get("/feedback/summary")
async def get_feedback_summary():
    agg_rows = query(
        """
        SELECT
          COUNT(*)::int AS total_feedback,
          COALESCE(AVG(rating)::numeric, 0) AS avg_rating,
          COUNT(*) FILTER (WHERE rating >= 4)::int AS promoters_count,
          COUNT(*) FILTER (WHERE rating <= 2)::int AS detractors_count
        FROM feedback
        """
    )
    stats = agg_rows[0] if agg_rows else {
        "total_feedback": 0,
        "avg_rating": 0,
        "promoters_count": 0,
        "detractors_count": 0,
    }
    total = int(stats.get("total_feedback") or 0)
    promoters = int(stats.get("promoters_count") or 0)
    detractors = int(stats.get("detractors_count") or 0)

    promoters_pct = round((promoters / total) * 100) if total else 0
    detractors_pct = round((detractors / total) * 100) if total else 0
    nps = promoters_pct - detractors_pct

    latest = query(
        """
        SELECT
          id, rating, feedback_text, comments, user_name, is_anonymous, created_at
        FROM feedback
        ORDER BY created_at DESC
        LIMIT 5
        """
    )
    latest = [_mask_name_if_anonymous(r) for r in latest]

    return {
        "nps": nps,
        "total_feedback": total,
        "avg_rating": round(float(stats.get("avg_rating") or 0), 1),
        "promoters_pct": promoters_pct,
        "detractors_pct": detractors_pct,
        "latest": latest,
    }


@router.get("/feedback")
async def get_feedback(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    count_rows = query("SELECT COUNT(*)::int AS total FROM feedback")
    total = count_rows[0]["total"] if count_rows else 0
    rows = query(
        """
        SELECT
          id, rating, feedback_text, comments, user_name, is_anonymous, created_at
        FROM feedback
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
        """,
        (limit, offset),
    )
    rows = [_mask_name_if_anonymous(r) for r in rows]
    return {
        "items": rows,
        "total": total,
        "limit": limit,
        "offset": offset,
        "has_next": (offset + limit) < total,
    }


@router.post("/feedback")
async def create_feedback(body: dict, request: Request):
    user_id, user_name = _require_user(request)
    rating = body.get("rating")
    feedback_text = (body.get("feedback_text") or "").strip()
    comments = (body.get("comments") or "").strip()
    is_anonymous = bool(body.get("is_anonymous", False))

    if not isinstance(rating, int) or rating < 1 or rating > 5:
        raise HTTPException(status_code=400, detail="rating must be an integer between 1 and 5")
    if not feedback_text and not comments:
        raise HTTPException(status_code=400, detail="feedback_text or comments is required")

    with with_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO feedback
                  (user_id, user_name, is_anonymous, rating, feedback_text, comments)
                VALUES (%s::uuid, %s, %s, %s, %s, %s)
                RETURNING id, rating, feedback_text, comments, user_name, is_anonymous, created_at
                """,
                (user_id, user_name, is_anonymous, rating, feedback_text or None, comments or None),
            )
            row = cur.fetchone()
    return _mask_name_if_anonymous(row) if row else {"ok": True}


@router.get("/feature-requests")
async def get_feature_requests(request: Request):
    user_id, _ = _require_user(request)
    rows = query(
        """
        SELECT
          fr.id,
          fr.requester_name,
          fr.title,
          fr.description,
          fr.current_process,
          fr.frequency,
          fr.time_spent,
          fr.created_at,
          COALESCE(v.vote_count, 0)::int AS upvote_count,
          EXISTS(
            SELECT 1
            FROM feature_request_upvotes me
            WHERE me.feature_request_id = fr.id
              AND me.user_id = %s::uuid
          ) AS user_has_upvoted
        FROM feature_requests fr
        LEFT JOIN (
          SELECT feature_request_id, COUNT(*)::int AS vote_count
          FROM feature_request_upvotes
          GROUP BY feature_request_id
        ) v ON v.feature_request_id = fr.id
        ORDER BY upvote_count DESC, fr.created_at DESC
        """,
        (user_id,),
    )
    total_rows = query("SELECT COUNT(*)::int AS total FROM feature_requests")
    total = total_rows[0]["total"] if total_rows else 0
    return {"items": rows, "total": total}


@router.post("/feature-requests")
async def create_feature_request(body: dict, request: Request):
    user_id, requester_name = _require_user(request)
    title = (body.get("title") or "").strip()
    description = (body.get("description") or "").strip()
    current_process = (body.get("current_process") or "").strip()
    frequency = (body.get("frequency") or "").strip()
    time_spent = (body.get("time_spent") or "").strip()

    if not title:
        raise HTTPException(status_code=400, detail="title is required")
    if not description:
        raise HTTPException(status_code=400, detail="description is required")

    with with_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO feature_requests
                  (user_id, requester_name, title, description, current_process, frequency, time_spent)
                VALUES (%s::uuid, %s, %s, %s, %s, %s, %s)
                RETURNING id, requester_name, title, description, current_process, frequency, time_spent, created_at
                """,
                (
                    user_id,
                    requester_name,
                    title,
                    description,
                    current_process or None,
                    frequency or None,
                    time_spent or None,
                ),
            )
            row = cur.fetchone()
    if not row:
        return {"ok": True}
    row["upvote_count"] = 0
    row["user_has_upvoted"] = False
    return row


@router.post("/feature-requests/{request_id}/upvote")
async def toggle_feature_request_upvote(request_id: int, request: Request):
    user_id, _ = _require_user(request)
    with with_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM feature_requests WHERE id = %s", (request_id,))
            target = cur.fetchone()
            if not target:
                raise HTTPException(status_code=404, detail="Feature request not found")

            cur.execute(
                """
                SELECT 1
                FROM feature_request_upvotes
                WHERE feature_request_id = %s AND user_id = %s::uuid
                """,
                (request_id, user_id),
            )
            existing = cur.fetchone()

            if existing:
                cur.execute(
                    "DELETE FROM feature_request_upvotes WHERE feature_request_id = %s AND user_id = %s::uuid",
                    (request_id, user_id),
                )
                user_has_upvoted = False
            else:
                cur.execute(
                    "INSERT INTO feature_request_upvotes (feature_request_id, user_id) VALUES (%s, %s::uuid)",
                    (request_id, user_id),
                )
                user_has_upvoted = True

            cur.execute(
                "SELECT COUNT(*)::int AS upvote_count FROM feature_request_upvotes WHERE feature_request_id = %s",
                (request_id,),
            )
            count_row = cur.fetchone()

    return {
        "request_id": request_id,
        "user_has_upvoted": user_has_upvoted,
        "upvote_count": (count_row or {}).get("upvote_count", 0),
    }
