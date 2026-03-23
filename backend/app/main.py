import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.api.routes import health, sentiment, home, search, trending
from app.api.routes.deep_analysis import router as deep_analysis_router
from app.api.routes.price_history import router as price_history_router
from app.api.routes.mood import router as mood_router
from app.services.mood import refresh_mood

logger = logging.getLogger(__name__)

app = FastAPI(title="TheMarketMood.ai API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

app.include_router(health.router)
app.include_router(sentiment.router)
app.include_router(home.router)
app.include_router(search.router)
app.include_router(trending.router)
app.include_router(deep_analysis_router)
app.include_router(price_history_router)
app.include_router(mood_router)

scheduler = AsyncIOScheduler()


@app.on_event("startup")
async def startup():
    scheduler.add_job(refresh_mood, "interval", minutes=15, id="mood_refresh")
    scheduler.start()
    logger.info("Mood scheduler started — refreshing every 15 minutes")
    # Generate initial mood on startup (don't block — run in background)
    import asyncio
    asyncio.create_task(refresh_mood())


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()
