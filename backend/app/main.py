from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import health, sentiment, home, search, trending
from app.api.routes.deep_analysis import router as deep_analysis_router
from app.api.routes.price_history import router as price_history_router

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
