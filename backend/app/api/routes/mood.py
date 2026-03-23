"""
GET /api/mood — returns the latest market mood from cache,
or generates a fresh one if the cache is empty.
"""
import logging

from fastapi import APIRouter

from app.services.cache import get_cached
from app.services.mood import refresh_mood

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/mood")
async def get_mood():
    cached  = await get_cached("mood:latest")
    history = await get_cached("mood:history") or []

    if cached:
        return {**cached, "history": history}

    # Cache miss — generate fresh
    mood    = await refresh_mood()
    history = await get_cached("mood:history") or []
    return {**mood, "history": history}
