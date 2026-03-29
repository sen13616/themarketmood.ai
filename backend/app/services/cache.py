"""
Redis cache helpers. All operations are fire-and-forget safe — if Redis is
unavailable the caller receives None (on get) or a silent no-op (on set).
"""
import json
import logging
from typing import Optional

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

_client: Optional[aioredis.Redis] = None


def _get_client() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    return _client

async def get_cached(key: str) -> Optional[dict]:
    """Return the cached dict for *key*, or None if missing / Redis is down."""
    try:
        raw = await _get_client().get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.warning("Redis get failed for key=%s: %s", key, exc)
        return None


async def set_cached(key: str, value: dict, ttl: int) -> None:
    """Store *value* as JSON under *key* with an expiry of *ttl* seconds."""
    try:
        await _get_client().setex(key, ttl, json.dumps(value, default=str))
    except Exception as e:
        logger.warning(f"Cache SET failed for {key}: {type(e).__name__}: {e}")
