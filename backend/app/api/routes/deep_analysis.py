import json
import logging

from fastapi import APIRouter
from pydantic import BaseModel
from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()


class DeepAnalysisRequest(BaseModel):
    ticker: str
    tab: str  # "summary" | "bull" | "bear" | "watch"
    signals: dict


_PROMPTS = {
    "summary": (
        "Write a comprehensive 6-8 sentence market sentiment analysis for {ticker}. "
        "Cover: overall sentiment direction, signal strength and reliability, how macro "
        "conditions are affecting the stock, near-term momentum, and any contradictions "
        "between signals. Reference actual numbers from the signals."
    ),
    "bull": (
        "Write a detailed 6-8 sentence bull case for {ticker}. "
        "Cover: strongest technical signals supporting upside, analyst conviction and "
        "price target implications, positive news catalysts, institutional behaviour, "
        "and what needs to happen for this bull case to play out. Reference actual numbers."
    ),
    "bear": (
        "Write a detailed 6-8 sentence bear case for {ticker}. "
        "Cover: significant technical warning signs, negative sentiment signals, macro "
        "risks, concerning insider or institutional behaviour, and what would confirm "
        "the bear case. Reference actual numbers."
    ),
    "watch": (
        "Write a detailed 6-8 sentence watchlist for {ticker}. "
        "Cover: specific price levels to monitor, upcoming catalysts, which signals to "
        "watch for confirmation or reversal, and what a trader should set alerts for. "
        "Be specific and actionable."
    ),
}


@router.post("/api/deep-analysis")
async def deep_analysis(req: DeepAnalysisRequest):
    try:
        template = _PROMPTS.get(req.tab)
        if not template:
            return {"tab": req.tab, "content": "Unknown analysis tab."}

        prompt = (
            template.format(ticker=req.ticker)
            + f"\n\nSIGNALS: {json.dumps(req.signals, default=str)}"
            + "\n\nReturn only the analysis text — no headers, no bullet points, no markdown."
        )

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        message = await client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        content = message.choices[0].message.content.strip()
        return {"tab": req.tab, "content": content}

    except Exception as exc:
        logger.error("deep_analysis failed for %s/%s: %s", req.ticker, req.tab, exc)
        return {"tab": req.tab, "content": "Deep analysis temporarily unavailable."}
