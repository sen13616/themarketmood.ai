from fastapi import APIRouter, HTTPException, Query

from app.services.sources.yfinance import get_price_history

router = APIRouter()

VALID_PERIODS = {"1mo": "1M", "3mo": "3M", "6mo": "6M", "1y": "1Y"}
FRONTEND_TO_YF = {"1M": "1mo", "3M": "3mo", "6M": "6mo", "1Y": "1y"}


@router.get("/api/price-history/{ticker}")
async def price_history(
    ticker: str,
    period: str = Query(default="3M"),
):
    yf_period = FRONTEND_TO_YF.get(period.upper())
    if not yf_period:
        raise HTTPException(status_code=400, detail=f"Invalid period '{period}'. Use 1M, 3M, 6M, or 1Y.")

    data = await get_price_history(ticker.upper(), period=yf_period)
    if not data:
        raise HTTPException(status_code=404, detail=f"No price history found for {ticker}")

    return data
