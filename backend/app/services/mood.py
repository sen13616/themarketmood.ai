"""
Market Mood Service
Fetches macro signals every 15 minutes and uses GPT to generate
a single emotional state word describing the overall market mood.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone

from openai import AsyncOpenAI

from app.config import settings
from app.services.cache import get_cached, set_cached
from app.services.sources.yfinance import get_yfinance_data
from app.services.sources.fear_greed import get_fear_greed_data
from app.services.sources.apewisdom import get_trending_tickers
from app.services.sources.newsapi import get_newsapi_data

logger = logging.getLogger(__name__)

_FALLBACK_MOOD = {
    "emotion": "Uncertain",
    "rationale": "Market mood analysis temporarily unavailable.",
    "intensity": 5,
    "key_signals": [],
    "accent_color": "gray",
    "timestamp": None,
}

_SYSTEM_PROMPT = """You are a market sentiment analyst. You will be given a snapshot of macro market signals and must output a single emotional word that best describes the current market mood.

Permitted emotion words (use ONLY these):

# Extreme fear
Panicked, Desperate, Paralysed

# Nuanced fear
Anxious, Nervous, Uneasy, Wary

# Caution / uncertainty
Cautious, Uncertain, Indecisive, Hesitant

# Flat / disengaged
Numb, Exhausted, Complacent, Denial

# Behavioural / impulsive
FOMO, Impulsive, Defiant

# Recovery / stabilisation
Relieved, Recovering, Stabilising, Rebounding

# Positive / bullish
Hopeful, Optimistic, Confident, Buoyant

# Extreme greed
Exuberant, Euphoric

Accent color mapping (pick ONE based on emotion):
- "red"   → Panicked, Desperate, Paralysed
- "amber" → Anxious, Nervous, Uneasy, Wary, Cautious, Uncertain, Indecisive, Hesitant, FOMO, Exhausted, Impulsive
- "gray"  → Numb, Complacent, Denial, Defiant
- "blue"  → Relieved, Recovering, Rebounding, Stabilising
- "green" → Hopeful, Optimistic, Confident, Buoyant
- "teal"  → Exuberant, Euphoric

Rules:
1. Choose the single most accurate emotion word from the permitted list only
2. Write a rationale of exactly 2 sentences explaining the market's emotional state
3. Rate intensity 1-10 (1=barely present, 10=extreme)
4. List 3-5 key signals that drove your choice as short strings
5. Pick the accent color from the mapping above

IMPORTANT: Respond ONLY with valid JSON. No preamble, no markdown.
Schema:
{
  "emotion": string,
  "rationale": string,
  "intensity": integer,
  "key_signals": array of 3-5 strings,
  "accent_color": string
}"""


async def fetch_mood_signals() -> dict:
    """Fetch all macro signals needed for mood generation."""
    try:
        spy_data, fear_greed, ape, news = await asyncio.gather(
            get_yfinance_data('SPY'),
            get_fear_greed_data(),
            get_trending_tickers(10),
            get_newsapi_data(),
            return_exceptions=True,
        )

        # Normalise exceptions to empty defaults
        spy  = spy_data  if isinstance(spy_data,  dict) else {}
        fg   = fear_greed if isinstance(fear_greed, dict) else {}
        ape  = ape        if isinstance(ape,        list) else []
        news = news       if isinstance(news,       dict) else {}

        spy_price  = spy.get("price_data", {}).get("current_price")
        spy_vol    = spy.get("price_data", {}).get("volume")
        spy_avgvol = spy.get("price_data", {}).get("average_volume")
        spy_vol_ratio = (
            round(spy_vol / spy_avgvol, 2)
            if spy_vol and spy_avgvol and spy_avgvol > 0
            else None
        )

        snapshot = {
            "timestamp":            datetime.now(timezone.utc).isoformat(),
            "spy_price":            spy_price,
            "spy_change_percent":   spy.get("price_data", {}).get("change_percent"),
            "spy_vs_50d_ma":        spy.get("technical_indicators", {}).get("price_vs_50d_ma_percent"),
            "spy_vs_200d_ma":       spy.get("technical_indicators", {}).get("price_vs_200d_ma_percent"),
            "spy_volume_ratio":     spy_vol_ratio,
            "vix":                  None,   # filled below
            "vix_change_percent":   None,
            "fear_greed_score":     fg.get("score"),
            "fear_greed_label":     fg.get("label"),
            "fear_greed_trend":     fg.get("trend"),
            "fear_greed_1w_ago":    fg.get("one_week_ago"),
            "market_momentum":      (fg.get("sub_indicators") or {}).get("market_momentum", {}).get("score"),
            "stock_breadth":        (fg.get("sub_indicators") or {}).get("stock_price_breadth", {}).get("score"),
            "put_call_ratio":       (fg.get("sub_indicators") or {}).get("put_call_ratio", {}).get("score"),
            "junk_bond_demand":     (fg.get("sub_indicators") or {}).get("junk_bond_demand", {}).get("score"),
            "top_reddit_tickers":   [t.get("ticker") for t in ape[:5]],
            "reddit_momentum":      [t.get("momentum_signal") for t in ape[:5]],
            "news_sentiment_label": None,
            "top_headlines":        [a.get("title") for a in news.get("articles", [])[:3]],
        }

        # Fetch VIX separately (sequential, fast)
        try:
            vix_data = await get_yfinance_data('^VIX')
            snapshot["vix"]              = vix_data.get("price_data", {}).get("current_price")
            snapshot["vix_change_percent"] = vix_data.get("price_data", {}).get("change_percent")
        except Exception as exc:
            logger.warning("VIX fetch failed: %s", exc)

        return snapshot

    except Exception as exc:
        logger.error("fetch_mood_signals failed: %s", exc)
        return {}


async def generate_mood(snapshot: dict) -> dict:
    """Call GPT-4o-mini with the macro snapshot and return a structured mood object."""
    try:
        spy_change = snapshot.get('spy_change_percent') or 0
        spy_50d    = snapshot.get('spy_vs_50d_ma') or 0
        spy_200d   = snapshot.get('spy_vs_200d_ma') or 0
        vix_chg    = snapshot.get('vix_change_percent') or 0

        user_prompt = f"""MARKET SNAPSHOT ({snapshot.get('timestamp', 'now')}):

PRICE ACTION (SPY):
  SPY: ${snapshot.get('spy_price')} ({spy_change:+.2f}% today)
  SPY vs 50d MA: {spy_50d:+.1f}%
  SPY vs 200d MA: {spy_200d:+.1f}%
  VIX: {snapshot.get('vix')} ({vix_chg:+.1f}% today)

FEAR & GREED (CNN):
  Score: {snapshot.get('fear_greed_score')}/100 — {snapshot.get('fear_greed_label')}
  Last week: {snapshot.get('fear_greed_1w_ago')} → Trend: {snapshot.get('fear_greed_trend')}
  Market momentum: {snapshot.get('market_momentum')}
  Stock breadth: {snapshot.get('stock_breadth')}
  Put/call ratio score: {snapshot.get('put_call_ratio')}
  Junk bond demand: {snapshot.get('junk_bond_demand')}

RETAIL SENTIMENT (Reddit):
  Top tickers: {', '.join(t for t in snapshot.get('top_reddit_tickers', []) if t)}

TOP HEADLINES:
  {chr(10).join(f'- {h}' for h in snapshot.get('top_headlines', []) if h)}
"""

        client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=400,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
        )

        raw  = response.choices[0].message.content.strip()
        mood = json.loads(raw)
        mood["timestamp"] = snapshot.get("timestamp")
        mood["snapshot"]  = snapshot
        return mood

    except Exception as exc:
        logger.error("generate_mood failed: %s", exc)
        fallback = _FALLBACK_MOOD.copy()
        fallback["timestamp"] = datetime.now(timezone.utc).isoformat()
        return fallback


async def refresh_mood() -> dict:
    """Fetch signals, generate mood, store in Redis, return result."""
    logger.info("Refreshing market mood...")
    snapshot = await fetch_mood_signals()
    if not snapshot:
        logger.warning("Empty snapshot — skipping mood generation")
        return {}

    mood = await generate_mood(snapshot)

    # Store latest (20 min TTL — longer than 15 min refresh interval)
    await set_cached("mood:latest", mood, ttl=1200)

    # Append to history (keep last 5 entries)
    history_raw = await get_cached("mood:history")
    history = history_raw if isinstance(history_raw, list) else []
    history.append({
        "emotion":      mood.get("emotion"),
        "accent_color": mood.get("accent_color"),
        "timestamp":    mood.get("timestamp"),
        "intensity":    mood.get("intensity"),
    })
    history = history[-5:]
    await set_cached("mood:history", history, ttl=86400)

    logger.info("Market mood: %s (intensity: %s)", mood.get("emotion"), mood.get("intensity"))
    return mood
