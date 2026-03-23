"""
Fetches all yfinance data for a given ticker and returns it as a dict
whose keys and field names match the Pydantic models in app/models/sentiment.py.
yfinance is synchronous, so the network call is offloaded via asyncio.to_thread
to avoid blocking the event loop.
"""
import asyncio
import logging

import yfinance as yf

logger = logging.getLogger(__name__)


def _safe_pct(numerator, denominator) -> float | None:
    """Return (numerator / denominator) * 100, or None on any error."""
    try:
        if denominator is None or denominator == 0 or numerator is None:
            return None
        return (numerator / denominator) * 100
    except Exception:
        return None


def _safe_sub(a, b) -> float | None:
    try:
        if a is None or b is None:
            return None
        return a - b
    except Exception:
        return None


def detect_asset_type(info: dict) -> dict:
    """Detect asset type from yfinance info and return type + metadata."""
    quote_type = (info.get('quoteType') or '').upper()
    ticker_symbol = (info.get('symbol') or '').upper()

    # Map yfinance quoteType to our clean type system
    type_map = {
        'EQUITY': 'stock',
        'ETF': 'etf',
        'INDEX': 'index',
        'CRYPTOCURRENCY': 'crypto',
        'FUTURE': 'commodity',
        'CURRENCY': 'forex',
        'MUTUALFUND': 'etf',  # treat mutual funds like ETFs
    }

    asset_type = type_map.get(quote_type, 'stock')  # default to stock

    # Build metadata based on asset type
    meta = {
        'quote_type_raw': quote_type,
        'is_24h': asset_type in ('crypto', 'forex'),
        'has_fundamentals': asset_type == 'stock',
        'has_analyst': asset_type in ('stock', 'etf'),
        'has_institutional': asset_type in ('stock', 'etf'),
        'has_insider': asset_type == 'stock',
        'has_earnings': asset_type == 'stock',
        'has_reddit': asset_type in ('stock', 'etf', 'crypto'),
        'has_fear_greed': asset_type in ('stock', 'etf', 'index'),
        'has_index_comparison': asset_type in ('stock', 'etf'),
    }

    # Forex-specific metadata
    if asset_type == 'forex':
        # Parse EURUSD=X → base=EUR, quote=USD
        clean = ticker_symbol.replace('=X', '').replace('=', '')
        if len(clean) >= 6:
            meta['base_currency'] = clean[:3]
            meta['quote_currency'] = clean[3:6]
            meta['display_name'] = f"{clean[:3]} / {clean[3:6]}"
        else:
            meta['base_currency'] = clean
            meta['quote_currency'] = 'USD'
            meta['display_name'] = clean

        # Determine decimal precision
        # JPY pairs use 2 decimals, most others use 4
        quote_ccy = meta.get('quote_currency', '')
        meta['price_decimals'] = 2 if quote_ccy in ('JPY', 'KRW', 'CLP', 'HUF', 'IDR') else 4
        meta['pip_value'] = 0.01 if quote_ccy in ('JPY', 'KRW', 'CLP', 'HUF', 'IDR') else 0.0001

    # Crypto-specific metadata
    if asset_type == 'crypto':
        # BTC-USD → base=BTC, quote=USD
        parts = ticker_symbol.replace('-', '/').split('/')
        meta['base_currency'] = parts[0] if parts else ticker_symbol
        meta['quote_currency'] = parts[1] if len(parts) > 1 else 'USD'
        meta['display_name'] = f"{meta['base_currency']} / {meta['quote_currency']}"

    # Index-specific metadata
    if asset_type == 'index':
        meta['display_name'] = info.get('shortName') or info.get('longName') or ticker_symbol

    return {
        'asset_type': asset_type,
        'asset_meta': meta
    }


async def get_yfinance_data(ticker: str) -> dict:
    """Fetch price, fundamentals, analyst, technical, and institutional data
    from yfinance for *ticker*.  Returns an empty dict on any unhandled error.
    """
    try:
        # Offload the blocking .info fetch to a thread
        t = yf.Ticker(ticker)
        info = await asyncio.to_thread(lambda: t.info)

        # Detect asset type
        asset_info = detect_asset_type(info)

        # ── price_data ────────────────────────────────────────────────────────
        current_price = (
            info.get('regularMarketPrice') or
            info.get('currentPrice') or
            info.get('previousClose') or
            info.get('ask') or
            info.get('bid') or
            None
        )
        previous_close = info.get('previousClose') or info.get('regularMarketPreviousClose')
        day_low        = info.get('regularMarketDayLow')  or info.get('dayLow')
        day_high       = info.get('regularMarketDayHigh') or info.get('dayHigh')
        ftw_low        = info.get('fiftyTwoWeekLow')  or info.get('52WeekLow')
        ftw_high       = info.get('fiftyTwoWeekHigh') or info.get('52WeekHigh')

        raw_change = info.get('regularMarketChange')
        if raw_change is None:
            raw_change = _safe_sub(current_price, previous_close)

        raw_change_pct = info.get('regularMarketChangePercent')
        if raw_change_pct is None:
            raw_change_pct = _safe_pct(raw_change, previous_close)

        volume = info.get('regularMarketVolume') or info.get('volume')
        average_volume = (
            info.get('averageVolume') or
            info.get('averageDailyVolume3Month') or
            info.get('averageDailyVolume10Day')
        )

        price_data = {
            "current_price":              current_price,
            "open":                        info.get('regularMarketOpen') or info.get('open'),
            "high":                        day_high,
            "low":                         day_low,
            "previous_close":              previous_close,
            "change":                      raw_change,
            "change_percent":              raw_change_pct,
            "volume":                      volume,
            "average_volume":              average_volume,
            "pre_market_price":            info.get("preMarketPrice"),
            "post_market_price":           info.get("postMarketPrice") or None,
            "post_market_change_percent":  info.get("postMarketChangePercent"),
            "week_52_high":                ftw_high,
            "week_52_low":                 ftw_low,
            "day_range":                   f"{day_low} - {day_high}" if day_low is not None and day_high is not None else None,
            "week_52_range":               f"{ftw_low} - {ftw_high}" if ftw_low is not None and ftw_high is not None else None,
        }

        # ── fundamentals ──────────────────────────────────────────────────────
        fundamentals = {
            "market_cap":          info.get("marketCap"),
            "pe_ratio_trailing":   info.get("trailingPE"),
            "pe_ratio_forward":    info.get("forwardPE"),
            "eps_trailing":        info.get("trailingEps"),
            "eps_forward":         info.get("forwardEps"),
            "revenue_ttm":         info.get("totalRevenue"),
            "revenue_growth":      info.get("revenueGrowth"),
            "earnings_growth":     info.get("earningsGrowth"),
            "profit_margin":       info.get("profitMargins"),
            "operating_margin":    info.get("operatingMargins"),
            "gross_margin":        info.get("grossMargins"),
            "return_on_equity":    info.get("returnOnEquity"),
            "return_on_assets":    info.get("returnOnAssets"),
            "debt_to_equity":      info.get("debtToEquity"),
            "current_ratio":       info.get("currentRatio"),
            "free_cash_flow":      info.get("freeCashflow"),
            "dividend_yield":      info.get("dividendYield") / 100 if info.get("dividendYield") is not None else None,
            "beta":                info.get("beta"),
            "book_value":          info.get("bookValue"),
            "price_to_book":       info.get("priceToBook"),
            "price_to_sales":      info.get("priceToSalesTrailing12Months"),
        }

        # ── analyst_data ──────────────────────────────────────────────────────
        target_mean    = info.get("targetMeanPrice")
        recommendation = info.get("recommendationKey")

        # Earnings surprises from earnings_dates DataFrame
        earnings_surprises = []
        try:
            ed = await asyncio.to_thread(lambda: t.earnings_dates)
            if ed is not None and not ed.empty:
                ed = ed.dropna(subset=["EPS Estimate", "Reported EPS"]).head(4)
                for date, row in ed.iterrows():
                    actual   = row.get("Reported EPS")
                    estimate = row.get("EPS Estimate")
                    surprise_pct = _safe_pct(_safe_sub(actual, estimate), estimate)
                    earnings_surprises.append({
                        "period":           str(date.date()) if hasattr(date, "date") else str(date),
                        "actual":           float(actual)   if actual   is not None else None,
                        "estimate":         float(estimate) if estimate is not None else None,
                        "surprise_percent": float(surprise_pct) if surprise_pct is not None else None,
                    })
        except Exception as exc:
            logger.warning("earnings_dates unavailable for %s: %s", ticker, exc)

        analyst_data = {
            "consensus":             recommendation.capitalize() if recommendation else None,
            "mean_score":            info.get("recommendationMean"),
            "number_of_analysts":    info.get("numberOfAnalystOpinions"),
            # TODO: strong_buy / buy / hold / sell / strong_sell — needs analyst grades endpoint
            "strong_buy":            None,
            "buy":                   None,
            "hold":                  None,
            "sell":                  None,
            "strong_sell":           None,
            "price_target_mean":     target_mean,
            "price_target_high":     info.get("targetHighPrice"),
            "price_target_low":      info.get("targetLowPrice"),
            "price_target_median":   info.get("targetMedianPrice"),
            "upside_to_target_percent": _safe_pct(
                _safe_sub(target_mean, current_price), current_price
            ),
            "earnings_surprises":    earnings_surprises,
        }

        # ── technical_indicators ──────────────────────────────────────────────
        fifty_day_ma       = info.get("fiftyDayAverage")
        two_hundred_day_ma = info.get("twoHundredDayAverage")

        # Fetch recent history for short-term MA calculations
        hist = await asyncio.to_thread(lambda: t.history(period="1mo"))

        five_day_ma = None
        twenty_day_ma = None
        price_vs_5d_ma_percent = None
        price_vs_20d_ma_percent = None

        try:
            current = info.get('regularMarketPrice') or info.get('currentPrice')
            if not hist.empty and len(hist) >= 5:
                five_day_ma = round(float(hist['Close'].tail(5).mean()), 4)
                if current and five_day_ma:
                    price_vs_5d_ma_percent = round(((current - five_day_ma) / five_day_ma) * 100, 6)
            if not hist.empty and len(hist) >= 20:
                twenty_day_ma = round(float(hist['Close'].tail(20).mean()), 4)
                if current and twenty_day_ma:
                    price_vs_20d_ma_percent = round(((current - twenty_day_ma) / twenty_day_ma) * 100, 6)
        except Exception as e:
            logger.warning(f"Short-term MA calculation failed: {e}")

        technical_indicators = {
            # TODO: rsi_14 / rsi_signal — sourced from Alpha Vantage
            "rsi_14":                 None,
            "rsi_signal":             None,
            "five_day_ma":            five_day_ma,
            "twenty_day_ma":          twenty_day_ma,
            "fifty_day_ma":           fifty_day_ma,
            "two_hundred_day_ma":     two_hundred_day_ma,
            "price_vs_5d_ma_percent":    price_vs_5d_ma_percent,
            "price_vs_20d_ma_percent":   price_vs_20d_ma_percent,
            "price_vs_50d_ma_percent":   _safe_pct(_safe_sub(current_price, fifty_day_ma), fifty_day_ma),
            "price_vs_200d_ma_percent":  _safe_pct(_safe_sub(current_price, two_hundred_day_ma), two_hundred_day_ma),
            # TODO: macd / macd_signal / macd_histogram — sourced from Alpha Vantage
            "macd":           None,
            "macd_signal":    None,
            "macd_histogram": None,
        }

        # ── institutional_data ────────────────────────────────────────────────
        shares_short             = info.get("sharesShort")
        shares_short_prior_month = info.get("sharesShortPriorMonth")

        top_holders = []
        try:
            ih = await asyncio.to_thread(lambda: t.institutional_holders)
            if ih is not None and not ih.empty:
                for _, row in ih.head(5).iterrows():
                    top_holders.append({
                        "holder":         row.get("Holder"),
                        "percent_held":   float(row["pctHeld"]) * 100 if row.get("pctHeld") is not None else None,
                        "shares":         int(row["Shares"])          if row.get("Shares")   is not None else None,
                        "change_percent": float(row["pctChange"]) * 100 if row.get("pctChange") is not None else None,
                    })
        except Exception as exc:
            logger.warning("institutional_holders unavailable for %s: %s", ticker, exc)

        pct_institutions = info.get("heldPercentInstitutions")
        pct_insiders     = info.get("heldPercentInsiders")
        short_pct_float  = info.get("shortPercentOfFloat") or info.get("sharesPercentSharesOut")

        institutional_data = {
            "source":                        "yfinance",
            "percent_held_by_institutions":  pct_institutions * 100 if pct_institutions is not None else None,
            "percent_held_by_insiders":      pct_insiders     * 100 if pct_insiders     is not None else None,
            "short_ratio":                   info.get("shortRatio"),
            "short_percent_of_float":        short_pct_float  * 100 if short_pct_float  is not None else None,
            "shares_short":                  shares_short,
            "shares_short_prior_month":      shares_short_prior_month,
            "short_interest_change_percent": _safe_pct(
                _safe_sub(shares_short, shares_short_prior_month), shares_short_prior_month
            ),
            "top_holders": top_holders,
        }

        return {
            "asset_type":          asset_info['asset_type'],
            "asset_meta":          asset_info['asset_meta'],
            "company_name":        info.get("longName"),
            "price_data":          price_data,
            "fundamentals":        fundamentals,
            "analyst_data":        analyst_data,
            "technical_indicators": technical_indicators,
            "institutional_data":  institutional_data,
        }

    except Exception as exc:
        logger.error("get_yfinance_data failed for %s: %s", ticker, exc)
        return {}


async def get_price_history(ticker: str, period: str = "3mo") -> dict:
    """Fetch historical OHLCV price data and index comparison for charting."""
    try:
        stock = yf.Ticker(ticker)
        hist, info = await asyncio.gather(
            asyncio.to_thread(lambda: stock.history(period=period)),
            asyncio.to_thread(lambda: stock.info),
        )

        exchange      = (info.get("exchange")         or "").upper()
        full_exchange = (info.get("fullExchangeName") or "").upper()
        exchange_str  = f"{exchange} {full_exchange}"

        if any(x in exchange_str for x in ["NAS", "NGM", "NCM", "NASDAQ"]):
            index_ticker, index_name = "^IXIC",     "NASDAQ"
        elif any(x in exchange_str for x in ["NYQ", "NYSE", "NYS", "NEW YORK"]):
            index_ticker, index_name = "^NYA",      "NYSE Composite"
        elif any(x in exchange_str for x in ["PCX", "ARCA", "ASE", "AMEX"]):
            index_ticker, index_name = "^GSPC",     "S&P 500"
        elif any(x in exchange_str for x in ["LSE", "IOB", "LONDON"]):
            index_ticker, index_name = "^FTSE",     "FTSE 100"
        elif any(x in exchange_str for x in ["GER", "XETRA", "FRA", "FRANKFURT"]):
            index_ticker, index_name = "^GDAXI",    "DAX"
        elif any(x in exchange_str for x in ["PAR", "PARIS", "ENX"]):
            index_ticker, index_name = "^FCHI",     "CAC 40"
        elif any(x in exchange_str for x in ["TYO", "JPX", "TOKYO", "OSA"]):
            index_ticker, index_name = "^N225",     "Nikkei 225"
        elif any(x in exchange_str for x in ["HKG", "HONG KONG", "HKEX"]):
            index_ticker, index_name = "^HSI",      "Hang Seng"
        elif any(x in exchange_str for x in ["SHA", "SHE", "SHANGHAI", "SHENZHEN"]):
            index_ticker, index_name = "000001.SS", "Shanghai Composite"
        elif any(x in exchange_str for x in ["ASX", "AUSTRALIA"]):
            index_ticker, index_name = "^AXJO",     "ASX 200"
        elif any(x in exchange_str for x in ["TSX", "TOR", "TORONTO", "CNQ", "VAN"]):
            index_ticker, index_name = "^GSPTSE",   "TSX Composite"
        elif any(x in exchange_str for x in ["NSE", "BSE", "BOMBAY", "NATIONAL"]):
            index_ticker, index_name = "^BSESN",    "BSE Sensex"
        elif any(x in exchange_str for x in ["KSC", "KOE", "KOREA", "KRX"]):
            index_ticker, index_name = "^KS11",     "KOSPI"
        elif any(x in exchange_str for x in ["SWX", "VTX", "SWISS", "ZURICH"]):
            index_ticker, index_name = "^SSMI",     "SMI"
        elif any(x in exchange_str for x in ["AMS", "AMSTERDAM"]):
            index_ticker, index_name = "^AEX",      "AEX"
        elif any(x in exchange_str for x in ["MCE", "MADRID", "BME"]):
            index_ticker, index_name = "^IBEX",     "IBEX 35"
        elif any(x in exchange_str for x in ["MIL", "MILAN", "BIT"]):
            index_ticker, index_name = "FTSEMIB.MI","FTSE MIB"
        elif any(x in exchange_str for x in ["SAO", "BOVESPA", "B3"]):
            index_ticker, index_name = "^BVSP",     "Bovespa"
        elif any(x in exchange_str for x in ["MEX", "MEXICO", "BMV"]):
            index_ticker, index_name = "^MXX",      "IPC Mexico"
        elif any(x in exchange_str for x in ["SES", "SGX", "SINGAPORE"]):
            index_ticker, index_name = "^STI",      "STI"
        elif any(x in exchange_str for x in ["STO", "STOCKHOLM", "OMX"]):
            index_ticker, index_name = "^OMXS30",   "OMX Stockholm 30"
        elif any(x in exchange_str for x in ["OSL", "OSLO"]):
            index_ticker, index_name = "^OSEAX",    "Oslo All Share"
        elif any(x in exchange_str for x in ["CPH", "COPENHAGEN"]):
            index_ticker, index_name = "^OMXC25",   "OMX Copenhagen 25"
        elif any(x in exchange_str for x in ["HEL", "HELSINKI"]):
            index_ticker, index_name = "^OMXH25",   "OMX Helsinki 25"
        elif any(x in exchange_str for x in ["JSE", "JOHANNESBURG"]):
            index_ticker, index_name = "^J203.JO",  "JSE All Share"
        elif any(x in exchange_str for x in ["NZE", "NEW ZEALAND"]):
            index_ticker, index_name = "^NZ50",     "NZX 50"
        elif any(x in exchange_str for x in ["TAI", "TWO", "TAIWAN", "TWSE"]):
            index_ticker, index_name = "^TWII",     "Taiwan Weighted"
        elif any(x in exchange_str for x in ["TLV", "TEL AVIV"]):
            index_ticker, index_name = "^TA125.TA", "Tel Aviv 125"
        elif any(x in exchange_str for x in ["SAU", "TADAWUL", "SAUDI"]):
            index_ticker, index_name = "^TASI.SR",  "Tadawul All Share"
        elif any(x in exchange_str for x in ["DFM", "ADX", "DUBAI", "ABU DHABI"]):
            index_ticker, index_name = "^DFMGI",    "DFM General"
        else:
            index_ticker, index_name = "^GSPC",     "S&P 500"

        index_obj  = yf.Ticker(index_ticker)
        index_hist = await asyncio.to_thread(lambda: index_obj.history(period=period))

        def normalise(series):
            if series is None or series.empty:
                return []
            base = series.iloc[0]
            if base == 0:
                return []
            return [round(((v - base) / base) * 100, 4) for v in series]

        dates = [d.strftime("%Y-%m-%d") for d in hist.index]

        return {
            "ticker":               ticker,
            "index_ticker":         index_ticker,
            "index_name":           index_name,
            "period":               period,
            "dates":                dates,
            "stock_returns":        normalise(hist["Close"]),
            "index_returns":        normalise(index_hist["Close"]),
            "stock_prices":         [round(float(v), 4) for v in hist["Close"]],
            "index_prices":         [round(float(v), 4) for v in index_hist["Close"]],
            "period_return_stock":  round(float(((hist["Close"].iloc[-1] - hist["Close"].iloc[0]) / hist["Close"].iloc[0]) * 100), 2) if not hist.empty else None,
            "period_return_index":  round(float(((index_hist["Close"].iloc[-1] - index_hist["Close"].iloc[0]) / index_hist["Close"].iloc[0]) * 100), 2) if not index_hist.empty else None,
        }

    except Exception as exc:
        logger.error("get_price_history failed for %s: %s", ticker, exc)
        return {}


async def get_market_indices() -> dict:
    """Fetch current price and change data for major market indices."""
    _INDICES = {
        "sp500":  ("^GSPC", "S&P 500"),
        "nasdaq": ("^IXIC", "Nasdaq"),
        "dow":    ("^DJI",  "Dow Jones"),
        "vix":    ("^VIX",  "VIX"),
    }

    try:
        async def _fetch_info(symbol: str) -> dict:
            return await asyncio.to_thread(lambda: yf.Ticker(symbol).info)

        keys = list(_INDICES.keys())
        infos = await asyncio.gather(
            *[_fetch_info(sym) for sym, _ in _INDICES.values()],
            return_exceptions=True,
        )

        result = {}
        for key, info in zip(keys, infos):
            symbol, name = _INDICES[key]
            if isinstance(info, Exception):
                logger.warning("get_market_indices failed for %s: %s", symbol, info)
                result[key] = {"symbol": symbol, "name": name, "price": None, "change": None, "change_percent": None}
            else:
                result[key] = {
                    "symbol":         symbol,
                    "name":           name,
                    "price":          info.get("regularMarketPrice"),
                    "change":         info.get("regularMarketChange"),
                    "change_percent": info.get("regularMarketChangePercent"),
                }

        return result

    except Exception as exc:
        logger.error("get_market_indices failed: %s", exc)
        return {}
