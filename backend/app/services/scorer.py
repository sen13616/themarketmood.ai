"""
Takes the raw signals dict from the aggregator, sends a structured context
to OpenAI GPT-4o-mini, and assembles the final SentimentResponse dict that
matches the schema defined in app/models/sentiment.py.
"""
import json
import logging
from datetime import datetime, timezone

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

_FALLBACK_INSIGHTS = {
    "summary": "Sentiment analysis temporarily unavailable.",
    "bull_case": None,
    "bear_case": None,
    "what_to_watch": None,
}

_FALLBACK_RESULT = {
    "market_mood_score": 50,
    "market_mood_label": "Neutral",
    "market_mood_confidence": "low",
    "ai_insights": _FALLBACK_INSIGHTS,
}


def _calc_52w_position(price: dict) -> str | None:
    """Calculate where current price sits in the 52-week range as a percentage string."""
    try:
        current = price.get("current_price")
        low     = price.get("week_52_low")
        high    = price.get("week_52_high")
        if None in (current, low, high) or high == low:
            return None
        position = ((current - low) / (high - low)) * 100
        return f"{position:.1f}% above 52w low"
    except Exception:
        return None


async def score_sentiment(ticker: str, signals: dict) -> dict:
    """Send aggregated signals for *ticker* to OpenAI GPT-4o-mini, parse the
    scored JSON response, then assemble and return the full SentimentResponse dict.
    Falls back to a neutral score on any OpenAI error without raising.
    """
    try:
        logger.info("Scoring sentiment for %s via OpenAI", ticker)

        # ── Extract signals ───────────────────────────────────────────────────
        yf = signals.get("yfinance", {})
        fg = signals.get("fear_greed", {})
        aw = signals.get("apewisdom", {})
        fh = signals.get("finnhub", {})
        av = signals.get("alpha_vantage", {})
        gt = signals.get("google_trends", {})

        price    = yf.get("price_data", {})
        analyst  = yf.get("analyst_data", {})
        technical = yf.get("technical_indicators", {})
        news     = av.get("news_sentiment", {})
        insider  = fh.get("insider_sentiment", {})
        earnings = fh.get("earnings_surprises", [])

        claude_context = {
            "ticker":                        ticker,
            "price_change_percent_today":    price.get("change_percent"),
            "week_52_position":              _calc_52w_position(price),
            "rsi_14":                        (av.get("technical_indicators") or {}).get("rsi_14"),
            "rsi_signal":                    (av.get("technical_indicators") or {}).get("rsi_signal"),
            "price_vs_50d_ma_percent":       technical.get("price_vs_50d_ma_percent"),
            "price_vs_200d_ma_percent":      technical.get("price_vs_200d_ma_percent"),
            "analyst_consensus":             analyst.get("consensus"),
            "analyst_mean_score":            analyst.get("mean_score"),
            "analyst_count":                 analyst.get("number_of_analysts"),
            "price_target_upside_percent":   analyst.get("upside_to_target_percent"),
            "news_avg_sentiment_score":      news.get("average_sentiment_score"),
            "news_avg_sentiment_label":      news.get("average_sentiment_label"),
            "news_bullish_count":            news.get("bullish_count"),
            "news_bearish_count":            news.get("bearish_count"),
            "news_articles_analyzed":        news.get("articles_analyzed"),
            "top_headlines":                 [a.get("title") for a in (news.get("articles") or [])[:3]],
            "reddit_rank":                   aw.get("current_rank"),
            "reddit_rank_change":            aw.get("rank_change"),
            "reddit_rank_direction":         aw.get("rank_change_direction"),
            "reddit_momentum_signal":        aw.get("momentum_signal"),
            "reddit_mention_change_percent": aw.get("mention_change_percent"),
            "google_trends_current":         gt.get("current_interest"),
            "google_trends_change_percent":  gt.get("interest_change_percent"),
            "google_trends_direction":       gt.get("trend_direction"),
            "insider_mspr":                  insider.get("latest_mspr"),
            "insider_signal":                insider.get("signal"),
            "insider_month":                 insider.get("latest_month"),
            "fear_greed_score":              fg.get("score"),
            "fear_greed_label":              fg.get("label"),
            "fear_greed_trend":              fg.get("trend"),
            "fear_greed_1w_ago":             fg.get("one_week_ago"),
            "fear_greed_1m_ago":             fg.get("one_month_ago"),
            "recent_earnings_surprises":     earnings[:3],
        }

        # ── Build prompt ──────────────────────────────────────────────────────
        prompt = f"""You are TheMarketMood.ai sentiment analyst. Analyze the following signals for {ticker} and return a structured sentiment assessment.

SCORING RULES:
- Score 0-100 where: 0-20=Bearish, 21-35=Somewhat Bearish, 36-49=Leaning Bearish, 50=Neutral, 51-64=Leaning Bullish, 65-79=Somewhat Bullish, 80-100=Bullish
- Never score above 75 during Extreme Fear market conditions unless the stock has exceptional isolated catalysts
- Never score above 60 if insider MSPR is below -50
- Never score below 30 based on news sentiment alone — require at least two confirming signals
- Weight recency: today's signals matter more than last week's
- If fewer than 3 high-relevance news articles are available keep score closer to 50 and set confidence to low
- The score reflects sentiment only — not a buy/sell recommendation

SIGNALS:
{json.dumps(claude_context, indent=2, default=str)}

Return ONLY valid JSON with no markdown, no code blocks, no explanation:
{{
  "market_mood_score": <integer 0-100>,
  "market_mood_label": <"Bearish"|"Somewhat Bearish"|"Leaning Bearish"|"Neutral"|"Leaning Bullish"|"Somewhat Bullish"|"Bullish">,
  "market_mood_confidence": <"low"|"medium"|"high">,
  "ai_insights": {{
    "summary": "<4-6 sentence plain English explanation of the score, covering the key signals that drove it, the market context, and what it means for the stock>",
    "bull_case": "<3-4 sentences on the strongest positive signals — be specific, reference actual data points from the signals provided>",
    "bear_case": "<3-4 sentences on the strongest negative signals — be specific, reference actual data points>",
    "what_to_watch": "<3-4 sentences on key upcoming catalysts, price levels, or signals to monitor — be specific and actionable>"
  }}
}}"""

        # ── Call OpenAI ───────────────────────────────────────────────────────
        try:
            client  = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            message = await client.chat.completions.create(
                model="gpt-4o-mini",
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}],
            )
            raw_json   = message.choices[0].message.content.strip()
            gpt_result = json.loads(raw_json)
        except Exception as exc:
            logger.error("OpenAI call failed for %s: %s", ticker, exc)
            gpt_result = _FALLBACK_RESULT.copy()
            gpt_result["ai_insights"] = _FALLBACK_INSIGHTS.copy()

        logger.info("Score for %s: %s", ticker, gpt_result.get("market_mood_score"))

        # ── Assemble full response ────────────────────────────────────────────
        now = datetime.now(timezone.utc).isoformat()

        response = {
            "ticker":       ticker,
            "company_name": yf.get("company_name"),
            "generated_at": now,
            "data_freshness": {
                "price":      now,
                "news":       now,
                "social":     now,
                "insider":    now,
                "fear_greed": now,
            },
            "market_mood_score":      gpt_result.get("market_mood_score"),
            "market_mood_label":      gpt_result.get("market_mood_label"),
            "market_mood_confidence": gpt_result.get("market_mood_confidence"),
            "ai_insights":            gpt_result.get("ai_insights"),
            "price_data":             yf.get("price_data"),
            "fundamentals":           yf.get("fundamentals"),
            "analyst_data": {
                **(yf.get("analyst_data") or {}),
                "earnings_surprises": fh.get("earnings_surprises", []),
            },
            "technical_indicators": {
                **(yf.get("technical_indicators") or {}),
                "rsi_14":     (av.get("technical_indicators") or {}).get("rsi_14"),
                "rsi_signal": (av.get("technical_indicators") or {}).get("rsi_signal"),
            },
            "news_sentiment": av.get("news_sentiment"),
            "social_sentiment": {
                "reddit": aw if aw else None,
                "search_trends": {
                    "source":                  "Google Trends",
                    "current_interest":        gt.get("current_interest"),
                    "interest_7d_ago":         gt.get("interest_7d_ago"),
                    "interest_change_percent": gt.get("interest_change_percent"),
                    "trend_direction":         gt.get("trend_direction"),
                    "related_rising_queries":  gt.get("related_rising_queries"),
                } if gt else None,
                "insider_sentiment": fh.get("insider_sentiment"),
            },
            "institutional_data": yf.get("institutional_data"),
            "fear_and_greed":     fg if fg else None,
        }

        return response

    except Exception as exc:
        logger.error("score_sentiment failed for %s: %s", ticker, exc)
        return {
            "ticker":                 ticker,
            "market_mood_score":      50,
            "market_mood_label":      "Neutral",
            "market_mood_confidence": "low",
            "ai_insights":            _FALLBACK_INSIGHTS.copy(),
        }
