import { getSentiment } from '@/lib/api';
import styles from './page.module.css';
import Link from 'next/link';
import NavSearch from './NavSearch';
import InsightTabs from './InsightTabs';
import PriceChart from './PriceChart';
import FadeIn from '@/app/FadeIn';
import CountUp from './CountUp';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toFixed(decimals);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function fmtLargeNum(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(0)}`;
}

function fmtShares(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1e9)  return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6)  return `${(n / 1e6).toFixed(0)}M`;
  if (n >= 1e3)  return `${(n / 1e3).toFixed(0)}K`;
  return `${n}`;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function scoreColor(score: number | null | undefined): string {
  if (score == null) return 'var(--amber)';
  if (score >= 65) return 'var(--green)';
  if (score >= 50) return 'var(--amber)';
  return 'var(--red)';
}

function tagClass(signal: string | null | undefined): string {
  if (!signal) return styles.tNeu;
  const s = signal.toLowerCase();
  if (['bullish','rising','buy','strong','net buying','low','above','near highs','positive','calm','surging'].some(x => s.includes(x))) return styles.tBull;
  if (['bearish','falling','sell','net selling','high','below','near lows','negative','extreme fear','fear'].some(x => s.includes(x))) return styles.tBear;
  return styles.tNeu;
}


function fmtQuarter(period: string | null | undefined): string {
  if (!period) return '—';
  try {
    const d = new Date(period);
    const month = d.getMonth(); // 0-indexed
    const year  = d.getFullYear() % 100;
    // Apple fiscal quarters: Q1=Oct-Dec, Q2=Jan-Mar, Q3=Apr-Jun, Q4=Jul-Sep
    let q: number;
    if (month <= 2)       q = 2;  // Jan-Mar → Q2
    else if (month <= 5)  q = 3;  // Apr-Jun → Q3
    else if (month <= 8)  q = 4;  // Jul-Sep → Q4
    else                  q = 1;  // Oct-Dec → Q1
    const fy = month <= 8 ? year : year + 1;
    return `Q${q} FY${fy < 10 ? '0' + fy : fy}`;
  } catch { return period; }
}

function calcUpside(target: number | null | undefined, current: number | null | undefined): string {
  if (target == null || current == null || current === 0) return '—';
  const pct = ((target - current) / current) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function calcUpsideClass(target: number | null | undefined, current: number | null | undefined): string {
  if (target == null || current == null || current === 0) return '';
  return target >= current ? styles.pos : styles.neg;
}

function truncateTag(label: string | null | undefined): string {
  if (!label) return 'N/A';
  const l = label.toLowerCase();
  if (l.includes('approaching') && l.includes('oversold'))   return 'Near Oversold';
  if (l.includes('approaching') && l.includes('overbought')) return 'Near Overbought';
  if (l.includes('somewhat') && l.includes('bull')) return 'Bullish';
  if (l.includes('somewhat') && l.includes('bear')) return 'Bearish';
  return label;
}

function formatSentimentLabel(label: string | null | undefined): string {
  if (!label) return 'Neutral';
  const l = label.toLowerCase();
  if (l.includes('somewhat-bull') || l.includes('somewhat bull')) return 'Bullish';
  if (l.includes('somewhat-bear') || l.includes('somewhat bear')) return 'Bearish';
  if (l.includes('bull')) return 'Bullish';
  if (l.includes('bear')) return 'Bearish';
  return 'Neutral';
}


function fmtMillions(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  return n.toLocaleString();
}


// ── Page ─────────────────────────────────────────────────────────────────────

export default async function StockPage({ params }: { params: { ticker: string } }) {
  const data = await getSentiment(params.ticker);

  const ticker     = (params.ticker || '').toUpperCase();
  const price      = data.price_data       ?? {};
  const fund       = data.fundamentals     ?? {};
  const analyst    = data.analyst_data     ?? {};
  const tech       = data.technical_indicators ?? {};
  const inst       = data.institutional_data  ?? {};
  const fg         = data.fear_and_greed   ?? {};
  const aiIns      = data.ai_insights      ?? {};
  const news       = data.news_sentiment   ?? {};
  const social     = data.social_sentiment ?? {};
  const reddit     = social.reddit         ?? {};
  const insider    = social.insider_sentiment ?? {};

  const score    = data.market_mood_score ?? 50;
  const scoreCol = scoreColor(score);

  const articles = (news.articles ?? []).slice(0, 8);
  const priceHistory = (data as any).price_history ?? {};


  return (
    <div className={styles.page}>

      {/* ── 1. NAV ─────────────────────────────────────────────── */}
      <nav className={styles.navOuter}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoWord}>TheMarketMood</span>
            <span className={styles.logoTld}>.ai</span>
          </Link>
          <NavSearch />
          <button className={styles.btnPro}>Get Pro</button>
        </div>
      </nav>

      {/* ── 2. TOP SECTION — stock header + chart + gauge ─────────── */}
      <div className={styles.topSection}>

        {/* Stock header */}
        <div className={styles.stockHeader}>
          <div className={styles.stockTopRow}>
            <span className={styles.stockTicker}>{ticker}</span>
            <span className={styles.stockName}>{data.company_name ?? ticker}</span>
            <div className={styles.stockBadges}>
              {(data as any).exchange && (
                <span className={styles.stockBadge}>{(data as any).exchange}</span>
              )}
              {fund.sector && (
                <span className={styles.stockBadge}>{fund.sector}</span>
              )}
            </div>
          </div>
          <div className={styles.stockPriceRow}>
            <div className={styles.stockPrice}>
              <CountUp value={price.current_price} prefix="$" decimals={2} />
            </div>
            <div className={styles.stockChangeBlock}>
              <div className={styles.stockChange}>
                <span className={(price.change ?? 0) >= 0 ? styles.pos : styles.neg}>
                  {(price.change ?? 0) >= 0 ? '▲' : '▼'}
                </span>
                <span className={(price.change ?? 0) >= 0 ? styles.pos : styles.neg}>
                  ${Math.abs(price.change ?? 0).toFixed(2)}
                </span>
                <span className={(price.change ?? 0) >= 0 ? styles.pos : styles.neg}>
                  {fmtPct(price.change_percent)}
                </span>
                <span className={styles.changeLabel}>today</span>
              </div>
              {price.post_market_price != null && (
                <div className={styles.afterHours}>
                  <span className={styles.ahLabel}>After hours</span>
                  <span className={styles.ahPrice}>${fmt(price.post_market_price, 2)}</span>
                  <span className={(price.post_market_change_percent ?? 0) >= 0 ? styles.pos : styles.neg}>
                    {fmtPct(price.post_market_change_percent)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chart + Gauge grid — HTML order: chart left, gauge right */}
        <div className={styles.chartGaugeGrid}>

          {/* Chart pane (left on desktop, below on mobile) */}
          <div className={styles.chartPane}>
            {priceHistory.dates?.length > 0
              && priceHistory.stock_prices?.length > 0
              && priceHistory.index_prices?.length > 0 ? (
              <PriceChart
                ticker={ticker}
                indexName={priceHistory.index_name}
                dates={priceHistory.dates}
                stockPrices={priceHistory.stock_prices}
                indexPrices={priceHistory.index_prices}
              />
            ) : (
              <div className={styles.chartEmpty}>Chart data unavailable</div>
            )}
          </div>

          {/* Gauge pane (right on desktop, above on mobile via CSS order:-1) */}
          <div className={styles.gaugePane}>
            <div className={styles.gaugePaneLabel}>Mood score</div>
            <div className={styles.gaugeScoreBlock}>
              <div className={styles.gaugeScore}>
                <CountUp value={score} prefix="" decimals={0} />
              </div>
              <div className={styles.gaugeWord} style={{ color: scoreCol }}>
                {data.market_mood_label ?? 'Neutral'}
              </div>
              <div className={styles.gaugeConf}>
                {data.market_mood_confidence ?? 'medium'} confidence
              </div>
            </div>
            <div className={styles.gaugeSpectrum}>
              <div className={styles.specTrack}>
                <div
                  className={styles.specThumb}
                  style={{
                    left: `${score}%`,
                    boxShadow: `0 0 0 2px var(--bg), 0 0 0 3px ${scoreCol}`,
                  }}
                />
              </div>
              <div className={styles.specLabels}>
                <span>Bearish</span><span>Neutral</span><span>Bullish</span>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── 3. AI INSIGHTS ─────────────────────────────────────── */}
      <FadeIn>
      <div className={styles.aiCard}>
        <div className={styles.aiHeader}>
          <div className={styles.aiHeaderLeft}>
            <div className={styles.aiPip} />
            <span className={styles.aiHeaderLabel}>AI Insights</span>
          </div>
          <span className={`${styles.tag} ${styles.tBlue}`}>Pro</span>
        </div>
        <InsightTabs
          summary={aiIns.summary ?? null}
          bullCase={aiIns.bull_case ?? null}
          bearCase={aiIns.bear_case ?? null}
          whatToWatch={aiIns.what_to_watch ?? null}
        />
      </div>
      </FadeIn>

      {/* ── 4. SIGNAL BREAKDOWN ─────────────────────────────────── */}
      <FadeIn delay={60}>
      <div className={`${styles.section} ${styles.signalGridSection}`}>
        <div className={styles.secLabel}>Signal breakdown</div>
        <div className={styles.pillarsWrap}>

          {/* ── PILLAR 1 — TECHNICAL ── */}
          {(() => {
            // Derive bullish MA signal count
            const maScores = [
              tech.price_vs_5d_ma_percent,
              tech.price_vs_20d_ma_percent,
              tech.price_vs_50d_ma_percent,
              tech.price_vs_200d_ma_percent,
            ].filter((v): v is number => v != null);
            const technicalBullCount = maScores.filter(v => v > 0).length;
            const techTag = technicalBullCount >= 3 ? { label: 'Bullish', cls: styles.tBull }
              : technicalBullCount >= 1 ? { label: 'Mixed', cls: styles.tNeu }
              : { label: 'Bearish', cls: styles.tBear };

            // RSI calculations
            const rsi = tech.rsi_14 as number | null | undefined;
            const rsiZone = rsi == null ? 'No data'
              : rsi >= 70 ? 'Overbought'
              : rsi <= 30 ? 'Oversold'
              : 'Neutral zone';
            const rsiColor = rsi == null ? 'var(--tx2)'
              : rsi >= 70 ? 'var(--red)'
              : rsi <= 30 ? 'var(--green)'
              : 'var(--amber)';
            // SVG needle angle (0=oversold left, 180=overbought right)
            const rsiAngle = rsi != null ? (rsi / 100) * Math.PI : Math.PI / 2;
            const needleX = 48 + 32 * Math.cos(Math.PI - rsiAngle);
            const needleY = 52 - 32 * Math.sin(Math.PI - rsiAngle);
            // Dasharray for arc: total ~125.7, offset so filled portion = (rsi/100)*125.7
            const rsiDash = 125.7;
            const rsiOffset = rsiDash - (rsi != null ? (rsi / 100) * rsiDash : 0);

            // MA ladder: compute positions relative to all MA values
            const cur   = price.current_price as number | null | undefined;
            const ma5   = tech.five_day_ma as number | null | undefined;
            const ma20  = tech.twenty_day_ma as number | null | undefined;
            const ma50  = tech.fifty_day_ma as number | null | undefined;
            const ma200 = tech.two_hundred_day_ma as number | null | undefined;
            const low52  = price.week_52_low as number | null | undefined;
            const high52 = price.week_52_high as number | null | undefined;
            const meanPT = analyst.price_target_mean ?? analyst.mean_target;

            const allMAs = [ma5, ma20, ma50, ma200, cur, meanPT].filter((v): v is number => v != null);
            const ladderMin = allMAs.length > 0 ? Math.min(...allMAs) * 0.97 : 0;
            const ladderMax = allMAs.length > 0 ? Math.max(...allMAs) * 1.03 : 100;

            function toPos(val: number | null | undefined): number {
              if (val == null || ladderMax === ladderMin) return 50;
              return Math.min(100, Math.max(0, ((val - ladderMin) / (ladderMax - ladderMin)) * 100));
            }
            const curPct   = toPos(cur);
            const ma5Pct   = toPos(ma5);
            const ma20Pct  = toPos(ma20);
            const ma50Pct  = toPos(ma50);
            const ma200Pct = toPos(ma200);
            const ptPct    = toPos(meanPT);

            // 52W range
            const w52Pct = cur != null && low52 != null && high52 != null && high52 !== low52
              ? Math.round(((cur - low52) / (high52 - low52)) * 100)
              : null;
            const w52Tag = w52Pct == null ? 'Mid range'
              : w52Pct > 70 ? 'Near highs'
              : w52Pct > 40 ? 'Mid range'
              : 'Near lows';
            const w52TagCls = w52Tag === 'Near highs' ? styles.tBull
              : w52Tag === 'Near lows' ? styles.tBear : styles.tNeu;
            const w52Color = w52Tag === 'Near highs' ? 'var(--green)'
              : w52Tag === 'Near lows' ? 'var(--red)' : 'var(--amber)';

            // Volume
            const vol    = price.volume as number | null | undefined;
            const avgVol = price.average_volume as number | null | undefined;
            const volRatio = vol != null && avgVol != null && avgVol > 0 ? vol / avgVol : null;
            const volPct   = volRatio != null ? Math.min(100, (volRatio / 3) * 100) : 0;
            const avgPct   = 100 / 3;
            const volColor = volRatio == null ? 'var(--tx2)'
              : volRatio > 2 ? 'var(--red)'
              : volRatio > 1.3 ? 'var(--amber)'
              : 'var(--green)';
            const volTag = volRatio == null ? 'N/A'
              : volRatio > 2 ? 'Very High'
              : volRatio > 1.3 ? 'Elevated'
              : 'Normal';
            const volTagCls = volTag === 'Very High' ? styles.tBear
              : volTag === 'Elevated' ? styles.tNeu : styles.tBull;

            return (
              <div className={styles.pillar}>
                <div className={styles.pillarHeader}>
                  <span className={styles.pillarPip} style={{ background: 'var(--blue)', boxShadow: '0 0 6px var(--blue)' }} />
                  <span className={styles.pillarName}>Technical</span>
                  <span className={`${styles.tag} ${techTag.cls}`}>{techTag.label}</span>
                </div>
                <div className={styles.pillarBody}>

                  {/* Cell 1: RSI */}
                  <div className={styles.pCell}>
                    <div className={styles.pCellLabel}>RSI (14)</div>
                    <div className={styles.cellChart}>
                      <div className={styles.rsiLayout}>
                        <svg width="96" height="58" viewBox="0 0 96 58">
                          <defs>
                            <linearGradient id="rsiG" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%"   stopColor="#f06060" />
                              <stop offset="35%"  stopColor="#e0a030" />
                              <stop offset="100%" stopColor="#1dcc9a" />
                            </linearGradient>
                          </defs>
                          <path d="M 8 52 A 40 40 0 0 1 88 52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" strokeLinecap="round"/>
                          <path d="M 8 52 A 40 40 0 0 1 88 52" fill="none" stroke="url(#rsiG)" strokeWidth="7" strokeLinecap="round" strokeDasharray={rsiDash} strokeDashoffset={rsiOffset}/>
                          <line x1="48" y1="52" x2={needleX} y2={needleY} stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.6"/>
                          <circle cx="48" cy="52" r="4" fill="var(--surface-2)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
                          <text x="3" y="57" fontFamily="'Geist Mono'" fontSize="8" fill="#4a5568">OS</text>
                          <text x="77" y="57" fontFamily="'Geist Mono'" fontSize="8" fill="#4a5568">OB</text>
                        </svg>
                        <div>
                          <div className={styles.rsiNum} style={{ color: rsiColor }}>
                            {rsi != null ? rsi.toFixed(1) : '—'}
                          </div>
                          <div className={styles.rsiZone}>{rsiZone}</div>
                          <div className={styles.rsiBandsRow}>Bands: 30 / 70</div>
                          <span className={`${styles.tag} ${tagClass(tech.rsi_signal)}`}>{truncateTag(tech.rsi_signal)}</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.cellDivider}/>
                    <div className={styles.numTable}>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>RSI (14)</span>
                        <span className={styles.nrVal} style={{ color: rsiColor }}>{rsi != null ? rsi.toFixed(1) : '—'}</span>
                        <div className={styles.nrTag}><span className={`${styles.tag} ${tagClass(tech.rsi_signal)}`}>{truncateTag(tech.rsi_signal)}</span></div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Oversold threshold</span>
                        <span className={styles.nrVal}>30</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Overbought threshold</span>
                        <span className={styles.nrVal}>70</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Distance from oversold</span>
                        <span className={styles.nrVal} style={{ color: rsi != null && rsi - 30 > 0 ? 'var(--green)' : 'var(--red)' }}>
                          {rsi != null ? `${rsi - 30 >= 0 ? '+' : ''}${(rsi - 30).toFixed(0)}` : '—'}
                        </span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Distance from overbought</span>
                        <span className={styles.nrVal}>{rsi != null ? `${(rsi - 70).toFixed(0)}` : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                    </div>
                  </div>

                  {/* Cell 2: Moving averages */}
                  <div className={styles.pCell}>
                    <div className={styles.pCellLabel}>Moving averages — 5d · 20d · 50d · 200d</div>
                    <div className={styles.cellChart}>
                      <div className={styles.ladderTrack}>
                        {ma200 != null && (
                          <div className={styles.lm} style={{ left: `${ma200Pct}%`, background: (tech.price_vs_200d_ma_percent ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            <div className={styles.lmTop}>200d</div>
                            <div className={styles.lmBot} style={{ color: (tech.price_vs_200d_ma_percent ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>${ma200.toFixed(0)}</div>
                          </div>
                        )}
                        {ma50 != null && (
                          <div className={styles.lm} style={{ left: `${ma50Pct}%`, background: (tech.price_vs_50d_ma_percent ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            <div className={styles.lmTop}>50d</div>
                            <div className={styles.lmBot} style={{ color: (tech.price_vs_50d_ma_percent ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>${ma50.toFixed(0)}</div>
                          </div>
                        )}
                        {ma20 != null && (
                          <div className={styles.lm} style={{ left: `${ma20Pct}%`, background: (tech.price_vs_20d_ma_percent ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            <div className={styles.lmTop}>20d</div>
                            <div className={styles.lmBot} style={{ color: (tech.price_vs_20d_ma_percent ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>${ma20.toFixed(0)}</div>
                          </div>
                        )}
                        {ma5 != null && (
                          <div className={styles.lm} style={{ left: `${ma5Pct}%`, background: (tech.price_vs_5d_ma_percent ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            <div className={styles.lmTop}>5d</div>
                            <div className={styles.lmBot} style={{ color: (tech.price_vs_5d_ma_percent ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>${ma5.toFixed(0)}</div>
                          </div>
                        )}
                        {cur != null && (
                          <>
                            <div className={styles.nowPin} style={{ left: `${curPct}%` }}/>
                            <div className={styles.nowChip} style={{ left: `${curPct}%` }}>${cur.toFixed(2)} now</div>
                          </>
                        )}
                        {meanPT != null && (
                          <div className={styles.lm} style={{ left: `${ptPct}%`, background: 'var(--blue)' }}>
                            <div className={styles.lmTop} style={{ color: 'var(--blue)' }}>Mean PT</div>
                            <div className={styles.lmBot} style={{ color: 'var(--blue)' }}>${(meanPT as number).toFixed(0)}</div>
                          </div>
                        )}
                      </div>
                      <div className={styles.ladderAxis} style={{ marginTop: 28 }}>
                        <span>{allMAs.length > 0 ? `$${ladderMin.toFixed(0)}` : '—'}</span>
                        <span>{cur != null ? `$${cur.toFixed(0)} now` : '—'}</span>
                        <span>{allMAs.length > 0 ? `$${ladderMax.toFixed(0)}` : '—'}</span>
                      </div>
                    </div>
                    <div className={styles.cellDivider}/>
                    <div className={styles.numTable}>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Current price</span>
                        <span className={styles.nrVal}>{cur != null ? `$${cur.toFixed(2)}` : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>5-day MA</span>
                        <span className={styles.nrVal} style={{ color: (tech.price_vs_5d_ma_percent ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {ma5 != null ? `$${ma5.toFixed(2)}` : '—'}
                        </span>
                        <div className={styles.nrTag}>
                          {ma5 != null && <span className={`${styles.tag} ${(tech.price_vs_5d_ma_percent ?? 0) >= 0 ? styles.tBull : styles.tBear}`}>
                            {(tech.price_vs_5d_ma_percent ?? 0) >= 0 ? 'Above' : 'Below'}
                          </span>}
                        </div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>20-day MA</span>
                        <span className={styles.nrVal} style={{ color: (tech.price_vs_20d_ma_percent ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {ma20 != null ? `$${ma20.toFixed(2)}` : '—'}
                        </span>
                        <div className={styles.nrTag}>
                          {ma20 != null && <span className={`${styles.tag} ${(tech.price_vs_20d_ma_percent ?? 0) >= 0 ? styles.tBull : styles.tBear}`}>
                            {(tech.price_vs_20d_ma_percent ?? 0) >= 0 ? 'Above' : 'Below'}
                          </span>}
                        </div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>50-day MA</span>
                        <span className={styles.nrVal} style={{ color: (tech.price_vs_50d_ma_percent ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {ma50 != null ? `$${ma50.toFixed(2)}` : '—'}
                        </span>
                        <div className={styles.nrTag}>
                          <span className={`${styles.tag} ${(tech.price_vs_50d_ma_percent ?? 0) >= 0 ? styles.tBull : styles.tBear}`}>
                            {(tech.price_vs_50d_ma_percent ?? 0) >= 0 ? 'Above' : 'Below'}
                          </span>
                        </div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>200-day MA</span>
                        <span className={styles.nrVal} style={{ color: (tech.price_vs_200d_ma_percent ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {ma200 != null ? `$${ma200.toFixed(2)}` : '—'}
                        </span>
                        <div className={styles.nrTag}>
                          <span className={`${styles.tag} ${(tech.price_vs_200d_ma_percent ?? 0) >= 0 ? styles.tBull : styles.tBear}`}>
                            {(tech.price_vs_200d_ma_percent ?? 0) >= 0 ? 'Above' : 'Below'}
                          </span>
                        </div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Mean price target</span>
                        <span className={styles.nrVal} style={{ color: 'var(--blue)' }}>
                          {meanPT != null ? `$${(meanPT as number).toFixed(2)}` : '—'}
                        </span>
                        <div className={styles.nrTag}>
                          {meanPT != null && cur != null && (
                            <span className={`${styles.tag} ${(meanPT as number) >= cur ? styles.tBull : styles.tBear}`}>
                              {calcUpside(meanPT as number, cur)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cell 3: 52W Range */}
                  <div className={styles.pCell}>
                    <div className={styles.pCellLabel}>52-week range</div>
                    <div className={styles.cellChart}>
                      <div className={styles.w52Prices}>
                        <span className={styles.neg} style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                          {low52 != null ? `$${low52.toFixed(2)}` : '—'}
                        </span>
                        <span className={styles.pos} style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>
                          {high52 != null ? `$${high52.toFixed(2)}` : '—'}
                        </span>
                      </div>
                      <div className={styles.w52Track}>
                        <div className={styles.w52Fill} style={{ width: `${w52Pct ?? 50}%` }}/>
                        <div className={styles.w52Thumb} style={{ left: `${w52Pct ?? 50}%` }}/>
                      </div>
                      <div className={styles.w52Axis}><span>52W Low</span><span>52W High</span></div>
                      <div className={styles.w52Big} style={{ color: w52Color }}>
                        {w52Pct != null ? `${w52Pct}%` : '—'}
                      </div>
                      <div className={styles.w52Sub}>of 52-week range</div>
                      <span className={`${styles.tag} ${w52TagCls}`}>{w52Tag}</span>
                    </div>
                    <div className={styles.cellDivider}/>
                    <div className={styles.numTable}>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Current price</span>
                        <span className={styles.nrVal}>{cur != null ? `$${cur.toFixed(2)}` : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>52-week low</span>
                        <span className={styles.nrVal} style={{ color: 'var(--red)' }}>{low52 != null ? `$${low52.toFixed(2)}` : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>52-week high</span>
                        <span className={styles.nrVal} style={{ color: 'var(--green)' }}>{high52 != null ? `$${high52.toFixed(2)}` : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Range position</span>
                        <span className={styles.nrVal} style={{ color: w52Color }}>{w52Pct != null ? `${w52Pct}%` : '—'}</span>
                        <div className={styles.nrTag}><span className={`${styles.tag} ${w52TagCls}`}>{w52Tag}</span></div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Distance from high</span>
                        <span className={styles.nrVal} style={{ color: 'var(--red)' }}>
                          {cur != null && high52 != null ? `${(((cur - high52) / high52) * 100).toFixed(1)}%` : '—'}
                        </span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Distance from low</span>
                        <span className={styles.nrVal} style={{ color: 'var(--green)' }}>
                          {cur != null && low52 != null ? `+${(((cur - low52) / low52) * 100).toFixed(1)}%` : '—'}
                        </span>
                        <div className={styles.nrTag}/>
                      </div>
                    </div>
                  </div>

                  {/* Cell 4: Volume */}
                  <div className={styles.pCell}>
                    <div className={styles.pCellLabel}>Volume vs average</div>
                    <div className={styles.cellChart}>
                      <div className={styles.volBig} style={{ color: volColor }}>
                        {volRatio != null ? `${volRatio.toFixed(1)}×` : '—'}
                      </div>
                      <div className={styles.volSub}>vs 30-day average</div>
                      <div className={styles.volTrack}>
                        <div className={styles.volFill} style={{ width: `${volPct}%`, background: volColor }}/>
                        <div className={styles.volAvg} style={{ left: `${avgPct}%` }}/>
                      </div>
                      <div className={styles.volAxis}><span>0×</span><span>avg</span><span>3×</span></div>
                      <span className={`${styles.tag} ${volTagCls}`}>{volTag}</span>
                    </div>
                    <div className={styles.cellDivider}/>
                    <div className={styles.numTable}>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Today&apos;s volume</span>
                        <span className={styles.nrVal}>{vol != null ? fmtMillions(vol) : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>30-day avg volume</span>
                        <span className={styles.nrVal}>{avgVol != null ? fmtMillions(avgVol) : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Volume ratio</span>
                        <span className={styles.nrVal} style={{ color: volColor }}>{volRatio != null ? `${volRatio.toFixed(1)}×` : '—'}</span>
                        <div className={styles.nrTag}><span className={`${styles.tag} ${volTagCls}`}>{volTag}</span></div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* ── PILLAR 2 — SENTIMENT ── */}
          {(() => {
            const totalArticles = (news.bullish_count ?? 0) + (news.neutral_count ?? 0) + (news.bearish_count ?? 0);
            const bullPct  = totalArticles > 0 ? Math.round((news.bullish_count ?? 0) / totalArticles * 100) : 0;
            const neutPct  = totalArticles > 0 ? Math.round((news.neutral_count ?? 0) / totalArticles * 100) : 0;
            const bearPct  = totalArticles > 0 ? 100 - bullPct - neutPct : 0;

            const sentScore = news.average_sentiment_score as number | null | undefined;
            const sentCircum = 2 * Math.PI * 28; // r=28
            const sentOffset = sentCircum - (sentScore != null ? Math.min(1, Math.max(0, (sentScore + 1) / 2)) * sentCircum : sentCircum / 2);
            const sentColor  = sentScore == null ? 'var(--tx2)'
              : sentScore >= 0.3 ? 'var(--green)'
              : sentScore >= -0.1 ? 'var(--amber)'
              : 'var(--red)';

            // Analyst
            const totalAnalysts = analyst.number_of_analysts ?? 0;
            const meanScore = analyst.mean_score as number | null | undefined;
            let strongBuy: number, buyCount: number, holdCount: number, sellCount: number;

            if ((analyst.strong_buy as number | null) != null) {
              strongBuy  = analyst.strong_buy as number;
              buyCount   = (analyst.buy ?? 0) as number;
              holdCount  = (analyst.hold ?? 0) as number;
              sellCount  = ((analyst.sell ?? 0) as number) + ((analyst.strong_sell ?? 0) as number);
            } else {
              const total = totalAnalysts;
              if (meanScore != null && meanScore <= 1.5) {
                strongBuy = Math.round(total * 0.55);
                buyCount  = Math.round(total * 0.25);
                holdCount = Math.round(total * 0.15);
                sellCount = total - strongBuy - buyCount - holdCount;
              } else if (meanScore != null && meanScore <= 2.5) {
                strongBuy = Math.round(total * 0.30);
                buyCount  = Math.round(total * 0.35);
                holdCount = Math.round(total * 0.25);
                sellCount = total - strongBuy - buyCount - holdCount;
              } else if (meanScore != null && meanScore <= 3.5) {
                strongBuy = Math.round(total * 0.10);
                buyCount  = Math.round(total * 0.20);
                holdCount = Math.round(total * 0.50);
                sellCount = total - strongBuy - buyCount - holdCount;
              } else {
                strongBuy = 0;
                buyCount  = Math.round(total * 0.10);
                holdCount = Math.round(total * 0.30);
                sellCount = total - buyCount - holdCount;
              }
            }

            const buyTotal   = strongBuy + buyCount;
            const holdTotal  = holdCount;
            const sellTotal  = sellCount;
            const buyPctBar  = totalAnalysts > 0 ? Math.round((buyTotal  / totalAnalysts) * 100) : 0;
            const holdPctBar = totalAnalysts > 0 ? Math.round((holdTotal / totalAnalysts) * 100) : 0;
            const sellPctBar = 100 - buyPctBar - holdPctBar;

            const consensus = analyst.consensus as string | null | undefined;
            const verdictColor = (consensus?.toLowerCase().includes('buy'))  ? 'var(--green)'
              : (consensus?.toLowerCase().includes('sell')) ? 'var(--red)' : 'var(--amber)';

            // Price target
            const cur2      = price.current_price as number | null | undefined;
            const ptLow     = analyst.price_target_low  ?? analyst.low_target;
            const ptMean    = analyst.price_target_mean ?? analyst.mean_target;
            const ptMedian  = analyst.price_target_median ?? analyst.median_target;
            const ptHigh    = analyst.price_target_high ?? analyst.high_target;
            const upside    = analyst.upside_to_target_percent as number | null | undefined;

            // Compute positions on [ptLow, ptHigh] axis
            function ptPos(val: number | null | undefined): number {
              if (val == null || ptLow == null || ptHigh == null || (ptHigh as number) === (ptLow as number)) return 50;
              return Math.min(100, Math.max(0, ((val as number - (ptLow as number)) / ((ptHigh as number) - (ptLow as number))) * 100));
            }
            const nowPtPct  = ptPos(cur2);
            const meanPtPct = ptPos(ptMean);

            // Reddit + insider
            const redditRank = reddit.current_rank as number | null | undefined;
            const mspr = insider.latest_mspr as number | null | undefined;
            const msprPct = mspr != null ? Math.min(100, Math.max(0, ((mspr + 100) / 200) * 100)) : 50;
            const msprColor = mspr == null ? 'var(--tx2)' : mspr >= 0 ? 'var(--green)' : 'var(--red)';

            const sentimentTag = sentScore == null ? { label: 'Neutral', cls: styles.tNeu }
              : sentScore >= 0.2 ? { label: 'Bullish', cls: styles.tBull }
              : sentScore >= -0.1 ? { label: 'Neutral', cls: styles.tNeu }
              : { label: 'Bearish', cls: styles.tBear };

            return (
              <div className={styles.pillar}>
                <div className={styles.pillarHeader}>
                  <span className={styles.pillarPip} style={{ background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
                  <span className={styles.pillarName}>Sentiment</span>
                  <span className={`${styles.tag} ${sentimentTag.cls}`}>{sentimentTag.label}</span>
                </div>
                <div className={styles.pillarBody}>

                  {/* Cell 1: Analyst consensus */}
                  <div className={styles.pCell}>
                    <div className={styles.pCellLabel}>Analyst consensus</div>
                    <div className={styles.cellChart}>
                      <div className={styles.analystBar}>
                        <div className={styles.abBuy}  style={{ width: `${buyPctBar}%` }}/>
                        <div className={styles.abHold} style={{ width: `${holdPctBar}%` }}/>
                        <div className={styles.abSell} style={{ width: `${sellPctBar}%` }}/>
                      </div>
                      <div className={styles.analystLegend}>
                        <div className={styles.alItem}>
                          <div className={styles.alDot} style={{ background: 'var(--green)' }}/>
                          <span style={{ color: 'var(--tx3)' }}>Buy</span>
                          <span style={{ color: 'var(--tx1)' }}>{buyTotal || '—'}</span>
                        </div>
                        <div className={styles.alItem}>
                          <div className={styles.alDot} style={{ background: 'var(--amber)' }}/>
                          <span style={{ color: 'var(--tx3)' }}>Hold</span>
                          <span style={{ color: 'var(--tx1)' }}>{holdTotal || '—'}</span>
                        </div>
                        <div className={styles.alItem}>
                          <div className={styles.alDot} style={{ background: 'var(--red)' }}/>
                          <span style={{ color: 'var(--tx3)' }}>Sell</span>
                          <span style={{ color: 'var(--tx1)' }}>{sellTotal || '—'}</span>
                        </div>
                      </div>
                      <div className={styles.analystVerdict} style={{ color: verdictColor }}>{consensus ?? '—'}</div>
                      <div className={styles.analystCount}>{totalAnalysts ? `${totalAnalysts} analysts` : '—'}</div>
                    </div>
                    <div className={styles.cellDivider}/>
                    <div className={styles.numTable}>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Strong Buy</span>
                        <span className={styles.nrVal} style={{ color: 'var(--green)' }}>{strongBuy}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Buy</span>
                        <span className={styles.nrVal} style={{ color: 'var(--green)' }}>{buyCount}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Hold</span>
                        <span className={styles.nrVal} style={{ color: 'var(--amber)' }}>{holdCount}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Sell</span>
                        <span className={styles.nrVal} style={{ color: 'var(--red)' }}>{sellCount}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Mean score</span>
                        <span className={styles.nrVal} style={{ color: verdictColor }}>
                          {analyst.mean_score != null ? `${(analyst.mean_score as number).toFixed(2)} / 5` : '—'}
                        </span>
                        <div className={styles.nrTag}>
                          <span className={`${styles.tag} ${tagClass(consensus)}`}>{consensus ?? 'N/A'}</span>
                        </div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Total analysts</span>
                        <span className={styles.nrVal}>{totalAnalysts || '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                    </div>
                  </div>

                  {/* Cell 2: Price target range */}
                  <div className={styles.pCell}>
                    <div className={styles.pCellLabel}>Price target range</div>
                    <div className={styles.cellChart}>
                      <div className={styles.ptTrack}>
                        <div className={styles.ptFill} style={{ left: '0%', width: '100%' }}/>
                        <div className={styles.ptLblTop} style={{ left: '0%', color: 'var(--red)' }}>Low</div>
                        <div className={styles.ptNow} style={{ left: `${nowPtPct}%` }}/>
                        <div style={{ position: 'absolute', left: `${nowPtPct}%`, top: 13, transform: 'translateX(-50%)', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--tx2)', whiteSpace: 'nowrap' }}>Now</div>
                        <div className={styles.ptMeanLine} style={{ left: `${meanPtPct}%` }}/>
                        <div className={styles.ptLblTop} style={{ left: `${meanPtPct}%`, color: 'var(--blue)' }}>Mean</div>
                        <div className={styles.ptLblTop} style={{ left: '100%', transform: 'translateX(-100%)', color: 'var(--green)' }}>High</div>
                      </div>
                      <div className={styles.ptVals} style={{ marginTop: 18 }}>
                        <div>
                          <div className={styles.ptVLbl}>Low</div>
                          <div className={styles.ptVVal} style={{ color: 'var(--red)' }}>{ptLow != null ? `$${(ptLow as number).toFixed(0)}` : '—'}</div>
                        </div>
                        <div>
                          <div className={styles.ptVLbl}>Now</div>
                          <div className={styles.ptVVal}>{cur2 != null ? `$${cur2.toFixed(0)}` : '—'}</div>
                        </div>
                        <div>
                          <div className={styles.ptVLbl}>Mean</div>
                          <div className={styles.ptVVal} style={{ color: 'var(--blue)' }}>{ptMean != null ? `$${(ptMean as number).toFixed(0)}` : '—'}</div>
                        </div>
                        <div>
                          <div className={styles.ptVLbl}>High</div>
                          <div className={styles.ptVVal} style={{ color: 'var(--green)' }}>{ptHigh != null ? `$${(ptHigh as number).toFixed(0)}` : '—'}</div>
                        </div>
                      </div>
                      <div className={styles.ptUpside}>
                        <span className={styles.ptUpsideLbl}>Upside to mean target</span>
                        <span className={styles.ptUpsideVal}>
                          {upside != null ? `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%` : '—'}
                        </span>
                      </div>
                    </div>
                    <div className={styles.cellDivider}/>
                    <div className={styles.numTable}>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Current price</span>
                        <span className={styles.nrVal}>{cur2 != null ? `$${cur2.toFixed(2)}` : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Low target</span>
                        <span className={styles.nrVal} style={{ color: 'var(--red)' }}>{ptLow != null ? `$${(ptLow as number).toFixed(2)}` : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Mean target</span>
                        <span className={styles.nrVal} style={{ color: 'var(--blue)' }}>{ptMean != null ? `$${(ptMean as number).toFixed(2)}` : '—'}</span>
                        <div className={styles.nrTag}>
                          {upside != null && (
                            <span className={`${styles.tag} ${upside >= 0 ? styles.tBull : styles.tBear}`}>
                              {upside >= 0 ? '+' : ''}{upside.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Median target</span>
                        <span className={styles.nrVal} style={{ color: 'var(--blue)' }}>{ptMedian != null ? `$${(ptMedian as number).toFixed(2)}` : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>High target</span>
                        <span className={styles.nrVal} style={{ color: 'var(--green)' }}>{ptHigh != null ? `$${(ptHigh as number).toFixed(2)}` : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                    </div>
                  </div>

                  {/* Cell 3: News sentiment */}
                  <div className={styles.pCell}>
                    <div className={styles.pCellLabel}>News sentiment</div>
                    <div className={styles.cellChart}>
                      <div className={styles.newsTop}>
                        <div className={styles.donutWrap}>
                          <svg width="80" height="80" viewBox="0 0 80 80">
                            <circle cx="40" cy="40" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10"/>
                            <circle cx="40" cy="40" r="28" fill="none" stroke={sentColor} strokeWidth="10"
                              strokeDasharray={sentCircum.toFixed(1)} strokeDashoffset={sentOffset.toFixed(1)}
                              strokeLinecap="round" transform="rotate(-90 40 40)"/>
                          </svg>
                          <div className={styles.donutCenter}>
                            <span className={styles.donutScore} style={{ color: sentColor }}>
                              {sentScore != null ? `${sentScore >= 0 ? '+' : ''}${sentScore.toFixed(2)}` : '—'}
                            </span>
                            <span className={styles.donutLbl}>score</span>
                          </div>
                        </div>
                        <div className={styles.sentRows}>
                          <div className={styles.sentRow}>
                            <div className={styles.sentDot} style={{ background: 'var(--green)' }}/>
                            <span className={styles.sentName}>Bull</span>
                            <div className={styles.sentBarBg}><div className={styles.sentBarFill} style={{ width: `${bullPct}%`, background: 'var(--green)' }}/></div>
                            <span className={styles.sentNum}>{news.bullish_count ?? 0}</span>
                          </div>
                          <div className={styles.sentRow}>
                            <div className={styles.sentDot} style={{ background: 'var(--amber)' }}/>
                            <span className={styles.sentName}>Neut</span>
                            <div className={styles.sentBarBg}><div className={styles.sentBarFill} style={{ width: `${neutPct}%`, background: 'var(--amber)' }}/></div>
                            <span className={styles.sentNum}>{news.neutral_count ?? 0}</span>
                          </div>
                          <div className={styles.sentRow}>
                            <div className={styles.sentDot} style={{ background: 'var(--red)' }}/>
                            <span className={styles.sentName}>Bear</span>
                            <div className={styles.sentBarBg}><div className={styles.sentBarFill} style={{ width: `${bearPct}%`, background: 'var(--red)' }}/></div>
                            <span className={styles.sentNum}>{news.bearish_count ?? 0}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`${styles.tag} ${sentimentTag.cls}`}>{news.overall_sentiment ?? sentimentTag.label}</span>
                    </div>
                    <div className={styles.cellDivider}/>
                    <div className={styles.numTable}>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Sentiment score</span>
                        <span className={styles.nrVal} style={{ color: sentColor }}>
                          {sentScore != null ? `${sentScore >= 0 ? '+' : ''}${sentScore.toFixed(2)}` : '—'}
                        </span>
                        <div className={styles.nrTag}><span className={`${styles.tag} ${sentimentTag.cls}`}>{sentimentTag.label}</span></div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Bullish articles</span>
                        <span className={styles.nrVal} style={{ color: 'var(--green)' }}>{news.bullish_count ?? '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Neutral articles</span>
                        <span className={styles.nrVal} style={{ color: 'var(--amber)' }}>{news.neutral_count ?? '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Bearish articles</span>
                        <span className={styles.nrVal} style={{ color: 'var(--red)' }}>{news.bearish_count ?? '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Bull ratio</span>
                        <span className={styles.nrVal} style={{ color: 'var(--green)' }}>{totalArticles > 0 ? `${bullPct}%` : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                    </div>
                  </div>

                  {/* Cell 4: Reddit & Insider */}
                  <div className={styles.pCell}>
                    <div className={styles.pCellLabel}>Reddit &amp; insider activity</div>
                    <div className={styles.cellChart}>
                      <div className={styles.riGrid}>
                        <div>
                          <div className={styles.riLbl}>Reddit rank</div>
                          <div className={styles.riRank}>{redditRank != null ? `#${redditRank}` : '—'}</div>
                          <span className={`${styles.tag} ${tagClass(reddit.momentum_signal)}`}>{reddit.momentum_signal ?? 'N/A'}</span>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--tx3)', marginTop: 5 }}>of all stocks today</div>
                        </div>
                        <div>
                          <div className={styles.riLbl}>Insider MSPR</div>
                          <div className={styles.msprBig} style={{ color: msprColor }}>
                            {mspr != null ? `${mspr >= 0 ? '+' : ''}${mspr.toFixed(0)}` : '—'}
                          </div>
                          <div className={styles.msprTrack}>
                            <div className={styles.msprThumb} style={{ left: `${msprPct}%`, boxShadow: `0 0 0 1.5px ${msprColor}` }}/>
                          </div>
                          <div className={styles.msprAxis}><span>Sell</span><span>Buy</span></div>
                          <span className={`${styles.tag} ${tagClass(insider.signal)}`}>{insider.signal ?? 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.cellDivider}/>
                    <div className={styles.numTable}>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Reddit rank</span>
                        <span className={styles.nrVal} style={{ color: 'var(--green)' }}>{redditRank != null ? `#${redditRank}` : '—'}</span>
                        <div className={styles.nrTag}><span className={`${styles.tag} ${tagClass(reddit.momentum_signal)}`}>{reddit.momentum_signal ?? 'N/A'}</span></div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Mentions (24h)</span>
                        <span className={styles.nrVal}>{reddit.mentions_24h != null ? (reddit.mentions_24h as number).toLocaleString() : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Mention change</span>
                        <span className={styles.nrVal} style={{ color: (reddit.mention_change_percent ?? 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {reddit.mention_change_percent != null
                            ? `${(reddit.mention_change_percent as number) >= 0 ? '+' : ''}${(reddit.mention_change_percent as number).toFixed(0)}%`
                            : '—'}
                        </span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Insider MSPR</span>
                        <span className={styles.nrVal} style={{ color: msprColor }}>
                          {mspr != null ? `${mspr >= 0 ? '+' : ''}${mspr.toFixed(1)}` : '—'}
                        </span>
                        <div className={styles.nrTag}><span className={`${styles.tag} ${tagClass(insider.signal)}`}>{insider.signal ?? 'N/A'}</span></div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* ── PILLAR 3 — MARKET CONTEXT ── */}
          {(() => {
            const fgScore = fg.score as number | null | undefined;
            const fgLabel = fg.label as string | null | undefined;
            const fgTrend = fg.trend as string | null | undefined;
            const fgPrevWeek  = fg.one_week_ago as number | null | undefined;
            const fgPrevMonth = fg.one_month_ago as number | null | undefined;

            const fgPct = fgScore != null ? Math.min(100, Math.max(0, fgScore)) : 50;
            const fgColor = fgScore == null ? 'var(--amber)'
              : fgScore >= 65 ? 'var(--green)'
              : fgScore >= 40 ? 'var(--amber)'
              : 'var(--red)';

            // Sub-indicators
            const subs = fg.sub_indicators ?? {};
            const momentum    = subs.market_momentum?.score as number | null | undefined;
            const strength    = subs.stock_price_strength?.score as number | null | undefined;
            const breadth     = subs.stock_price_breadth?.score as number | null | undefined;
            const putCall     = subs.put_call_ratio?.score as number | null | undefined;
            const volatility  = subs.market_volatility?.score as number | null | undefined;
            const junkBond    = subs.junk_bond_demand?.score as number | null | undefined;

            const subList = [
              { lbl: 'Momentum',   val: momentum },
              { lbl: 'Stock str.', val: strength },
              { lbl: 'Breadth',    val: breadth },
              { lbl: 'Put/Call',   val: putCall },
              { lbl: 'Volatility', val: volatility },
              { lbl: 'Junk bond',  val: junkBond },
            ];
            function subColor(v: number | null | undefined): string {
              if (v == null) return 'var(--tx2)';
              if (v >= 55) return 'var(--green)';
              if (v >= 35) return 'var(--amber)';
              return 'var(--red)';
            }
            function subTagCls(v: number | null | undefined): string {
              if (v == null) return styles.tNeu;
              if (v >= 55) return styles.tBull;
              if (v >= 35) return styles.tNeu;
              return styles.tBear;
            }
            function subTagLabel(v: number | null | undefined): string {
              if (v == null) return 'N/A';
              if (v >= 65) return 'Bullish';
              if (v >= 55) return 'Bullish';
              if (v >= 35) return 'Neutral';
              return 'Fear';
            }

            const subScores = subList.map(s => s.val).filter((v): v is number => v != null);
            const subAvg = subScores.length > 0 ? subScores.reduce((a, b) => a + b, 0) / subScores.length : null;

            // VIX (from sub_indicators.market_volatility.score — this IS the VIX proxy from F&G)
            const vixScore = volatility;
            const vixLabel = vixScore == null ? 'Unknown'
              : vixScore < 15 ? 'Calm market'
              : vixScore < 25 ? 'Moderate volatility'
              : 'High volatility';
            const vixPct = vixScore != null ? Math.min(100, Math.max(0, (vixScore / 50) * 100)) : 0;
            const vixTagCls = vixScore == null ? styles.tNeu
              : vixScore < 15 ? styles.tBull
              : vixScore < 25 ? styles.tNeu
              : styles.tBear;

            // Short float (from institutional data)
            const shortFloat = inst.short_percent_of_float as number | null | undefined;
            const shortRatio = inst.short_ratio as number | null | undefined;
            const sharesShort = inst.shares_short as number | null | undefined;
            const shortPct = shortFloat != null ? Math.min(100, (shortFloat / 15) * 100) : 0;
            const shortColor = shortFloat == null ? 'var(--green)'
              : shortFloat < 5 ? 'var(--green)'
              : shortFloat < 10 ? 'var(--amber)'
              : 'var(--red)';
            const shortTagCls = shortFloat == null ? styles.tBull
              : shortFloat < 5 ? styles.tBull
              : shortFloat < 10 ? styles.tNeu
              : styles.tBear;
            const shortTagLabel = shortFloat == null ? 'N/A'
              : shortFloat < 5 ? 'Low pressure'
              : shortFloat < 10 ? 'Elevated'
              : 'High pressure';

            const mktCtxTagCls = fgScore == null ? styles.tNeu
              : fgScore >= 55 ? styles.tBull
              : fgScore >= 35 ? styles.tNeu
              : styles.tBear;
            const mktCtxLabel = fgScore == null ? 'Neutral'
              : fgScore >= 55 ? 'Bullish' : fgScore >= 35 ? 'Neutral' : 'Bearish';

            function fgTagCls(v: number | null | undefined): string {
              if (v == null) return styles.tNeu;
              if (v >= 55) return styles.tBull;
              if (v >= 35) return styles.tNeu;
              return styles.tBear;
            }
            function fgTagLabel(v: number | null | undefined): string {
              if (v == null) return 'N/A';
              if (v >= 75) return 'Extreme Greed';
              if (v >= 55) return 'Greed';
              if (v >= 45) return 'Neutral';
              if (v >= 25) return 'Fear';
              return 'Extreme Fear';
            }

            return (
              <div className={styles.pillar}>
                <div className={styles.pillarHeader}>
                  <span className={styles.pillarPip} style={{ background: 'var(--amber)', boxShadow: '0 0 6px var(--amber)' }} />
                  <span className={styles.pillarName}>Market Context</span>
                  <span className={`${styles.tag} ${mktCtxTagCls}`}>{mktCtxLabel}</span>
                </div>
                <div className={styles.pillarBody}>

                  {/* Cell 1: F&G */}
                  <div className={styles.pCell}>
                    <div className={styles.pCellLabel}>CNN Fear &amp; Greed</div>
                    <div className={styles.cellChart}>
                      <div className={styles.fgNum} style={{ color: fgColor }}>
                        {fgScore != null ? Math.round(fgScore) : '—'}
                      </div>
                      <div className={styles.fgLbl} style={{ color: fgColor }}>{fgLabel ?? '—'}</div>
                      <div className={styles.fgTrackPillar}>
                        <div className={styles.fgThumbPillar} style={{ left: `${fgPct}%`, boxShadow: `0 0 0 2px ${fgColor}` }}/>
                      </div>
                      <div className={styles.fgAxis}><span>Extreme Fear</span><span>Neutral</span><span>Extreme Greed</span></div>
                      <div className={styles.fgPrev}>
                        <span style={{ color: fgTrend === 'Rising' ? 'var(--green)' : fgTrend === 'Falling' ? 'var(--red)' : 'var(--tx2)' }}>
                          {fgTrend === 'Rising' ? '↑ Rising' : fgTrend === 'Falling' ? '↓ Falling' : '→ Stable'}
                        </span>
                        <span style={{ marginLeft: 'auto', color: 'var(--tx3)' }}>
                          Prev week:&nbsp;<span style={{ color: 'var(--tx2)' }}>{fgPrevWeek != null ? Math.round(fgPrevWeek) : '—'}</span>
                        </span>
                      </div>
                    </div>
                    <div className={styles.cellDivider}/>
                    <div className={styles.numTable}>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>F&amp;G score</span>
                        <span className={styles.nrVal} style={{ color: fgColor }}>{fgScore != null ? Math.round(fgScore) : '—'}</span>
                        <div className={styles.nrTag}><span className={`${styles.tag} ${fgTagCls(fgScore)}`}>{fgLabel ?? 'N/A'}</span></div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Previous close</span>
                        <span className={styles.nrVal}>{fg.previous_close != null ? Math.round(fg.previous_close as number) : '—'}</span>
                        <div className={styles.nrTag}><span className={`${styles.tag} ${fgTagCls(fg.previous_close as number)}`}>{fgTagLabel(fg.previous_close as number)}</span></div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Previous week</span>
                        <span className={styles.nrVal}>{fgPrevWeek != null ? Math.round(fgPrevWeek) : '—'}</span>
                        <div className={styles.nrTag}><span className={`${styles.tag} ${fgTagCls(fgPrevWeek)}`}>{fgTagLabel(fgPrevWeek)}</span></div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Previous month</span>
                        <span className={styles.nrVal}>{fgPrevMonth != null ? Math.round(fgPrevMonth) : '—'}</span>
                        <div className={styles.nrTag}><span className={`${styles.tag} ${fgTagCls(fgPrevMonth)}`}>{fgTagLabel(fgPrevMonth)}</span></div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Trend</span>
                        <span className={styles.nrVal} style={{ color: fgTrend === 'Rising' ? 'var(--green)' : fgTrend === 'Falling' ? 'var(--red)' : 'var(--tx2)' }}>
                          {fgTrend === 'Rising' ? '↑ Rising' : fgTrend === 'Falling' ? '↓ Falling' : '→ Stable'}
                        </span>
                        <div className={styles.nrTag}><span className={`${styles.tag} ${tagClass(fgTrend)}`}>{fgTrend ?? 'N/A'}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Cell 2: F&G Sub-indicators */}
                  <div className={styles.pCell}>
                    <div className={styles.pCellLabel}>F&amp;G sub-indicators</div>
                    <div className={styles.cellChart}>
                      <div className={styles.subGrid}>
                        {subList.map(({ lbl, val }) => (
                          <div key={lbl}>
                            <div className={styles.subLbl}>{lbl}</div>
                            <div className={styles.subTrack}>
                              <div className={styles.subFill} style={{ width: `${val ?? 0}%`, background: subColor(val) }}/>
                            </div>
                            <div className={styles.subVal} style={{ color: subColor(val) }}>{val != null ? Math.round(val) : '—'}</div>
                          </div>
                        ))}
                        <div className={styles.subAvg}>
                          <span className={styles.subAvgLbl}>Average score</span>
                          <span className={styles.subAvgVal}>{subAvg != null ? subAvg.toFixed(1) : '—'}</span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.cellDivider}/>
                    <div className={styles.numTable}>
                      {[
                        { name: 'Market momentum',    val: momentum,   lbl: subs.market_momentum?.label },
                        { name: 'Stock price strength', val: strength, lbl: subs.stock_price_strength?.label },
                        { name: 'Stock price breadth',  val: breadth,  lbl: subs.stock_price_breadth?.label },
                        { name: 'Put / call ratio',   val: putCall,    lbl: subs.put_call_ratio?.label },
                        { name: 'Market volatility',  val: volatility, lbl: subs.market_volatility?.label },
                        { name: 'Junk bond demand',   val: junkBond,   lbl: subs.junk_bond_demand?.label },
                      ].map(({ name, val, lbl }) => (
                        <div key={name} className={styles.numRow}>
                          <span className={styles.nrName}>{name}</span>
                          <span className={styles.nrVal} style={{ color: subColor(val) }}>{val != null ? Math.round(val) : '—'}</span>
                          <div className={styles.nrTag}><span className={`${styles.tag} ${subTagCls(val)}`}>{lbl ?? subTagLabel(val)}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cell 3: VIX */}
                  <div className={styles.pCell}>
                    <div className={styles.pCellLabel}>VIX — volatility index</div>
                    <div className={styles.cellChart}>
                      <div className={styles.vixNum} style={{ color: subColor(vixScore) }}>
                        {vixScore != null ? vixScore.toFixed(1) : '—'}
                      </div>
                      <div className={styles.vixSub}>{vixLabel}</div>
                      <div className={styles.vixTrack}>
                        <div className={styles.vixThumb} style={{ left: `${vixPct}%`, boxShadow: `0 0 0 2px ${subColor(vixScore)}` }}/>
                      </div>
                      <div className={styles.vixAxis}><span>0</span><span>25</span><span>50+</span></div>
                      <span className={`${styles.tag} ${vixTagCls}`}>
                        {vixScore == null ? 'N/A' : vixScore < 15 ? 'Calm' : vixScore < 25 ? 'Moderate' : 'High'}
                      </span>
                    </div>
                    <div className={styles.cellDivider}/>
                    <div className={styles.numTable}>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>VIX level</span>
                        <span className={styles.nrVal} style={{ color: subColor(vixScore) }}>{vixScore != null ? vixScore.toFixed(1) : '—'}</span>
                        <div className={styles.nrTag}><span className={`${styles.tag} ${vixTagCls}`}>{subs.market_volatility?.label ?? 'N/A'}</span></div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Calm threshold</span>
                        <span className={styles.nrVal}>&lt; 15</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Fear threshold</span>
                        <span className={styles.nrVal}>&gt; 25</span>
                        <div className={styles.nrTag}/>
                      </div>
                    </div>
                  </div>

                  {/* Cell 4: Short float */}
                  <div className={styles.pCell}>
                    <div className={styles.pCellLabel}>Short float</div>
                    <div className={styles.cellChart}>
                      <div className={styles.sfNum} style={{ color: shortColor }}>
                        {shortFloat != null ? `${shortFloat.toFixed(1)}%` : '—'}
                      </div>
                      <div className={styles.sfSub}>of float is shorted</div>
                      <div className={styles.sfTrack}>
                        <div className={styles.sfFill} style={{ width: `${shortPct}%`, background: shortColor }}/>
                      </div>
                      <div className={styles.sfAxis}><span>0%</span><span>High pressure 15%+</span></div>
                      <span className={`${styles.tag} ${shortTagCls}`}>{shortTagLabel}</span>
                    </div>
                    <div className={styles.cellDivider}/>
                    <div className={styles.numTable}>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Short float</span>
                        <span className={styles.nrVal} style={{ color: shortColor }}>{shortFloat != null ? `${shortFloat.toFixed(2)}%` : '—'}</span>
                        <div className={styles.nrTag}><span className={`${styles.tag} ${shortTagCls}`}>{shortFloat == null ? 'N/A' : shortFloat < 5 ? 'Low' : shortFloat < 10 ? 'Elevated' : 'High'}</span></div>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Short ratio</span>
                        <span className={styles.nrVal}>{shortRatio != null ? (shortRatio as number).toFixed(2) : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Days to cover</span>
                        <span className={styles.nrVal}>{shortRatio != null ? (shortRatio as number).toFixed(2) : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>Shares shorted</span>
                        <span className={styles.nrVal}>{sharesShort != null ? fmtMillions(sharesShort) : '—'}</span>
                        <div className={styles.nrTag}/>
                      </div>
                      <div className={styles.numRow}>
                        <span className={styles.nrName}>High pressure level</span>
                        <span className={styles.nrVal} style={{ color: 'var(--red)' }}>15%+</span>
                        <div className={styles.nrTag}/>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}

        </div>
      </div>
      </FadeIn>

      {/* ── 5. NEWS ────────────────────────────────────────────── */}
      <FadeIn delay={60}>
      <div className={styles.section}>
        <div className={styles.secLabel}>Recent news</div>
        <div className={styles.newsList}>
          {articles.length > 0 ? articles.map((article: any, i: number) => (
            <a
              key={i}
              className={styles.newsRow}
              href={article.url ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div>
                <div className={styles.newsTitle}>{article.title}</div>
                <div className={styles.newsMeta}>
                  <span>{article.source}</span>
                  <span>{fmtTime(article.published_at)}</span>
                </div>
              </div>
              <span className={`${styles.tag} ${tagClass(article.sentiment_label)}`}>
                {formatSentimentLabel(article.sentiment_label)}
              </span>
            </a>
          )) : (
            <div className={styles.newsEmpty}>
              News data refreshes daily — check back during market hours.
            </div>
          )}
        </div>
      </div>
      </FadeIn>

      {/* ── 6. FUNDAMENTALS ────────────────────────────────────── */}
      <FadeIn delay={60}>
      <div className={styles.section}>
        <div className={styles.secLabel}>Fundamentals</div>
        <div className={styles.fundGrid}>
          <div className={styles.fundCell}>
            <div className={styles.fundLabel}>Market cap</div>
            <div className={styles.fundVal}>{fmtLargeNum(fund.market_cap)}</div>
            <div className={styles.fundSub}>USD</div>
          </div>
          <div className={styles.fundCell}>
            <div className={styles.fundLabel}>P/E trailing</div>
            <div className={styles.fundVal}>{fund.pe_ratio_trailing != null ? `${fmt(fund.pe_ratio_trailing, 1)}×` : '—'}</div>
            <div className={styles.fundSub}>TTM</div>
          </div>
          <div className={styles.fundCell}>
            <div className={styles.fundLabel}>P/E forward</div>
            <div className={styles.fundVal}>{fund.pe_ratio_forward != null ? `${fmt(fund.pe_ratio_forward, 1)}×` : '—'}</div>
            <div className={styles.fundSub}>FY est.</div>
          </div>
          <div className={styles.fundCell}>
            <div className={styles.fundLabel}>EPS (TTM)</div>
            <div className={styles.fundVal}>{fund.eps_trailing != null ? `$${fmt(fund.eps_trailing, 2)}` : '—'}</div>
            <div className={styles.fundSub}>USD</div>
          </div>
          <div className={styles.fundCell}>
            <div className={styles.fundLabel}>Revenue</div>
            <div className={styles.fundVal}>{fmtLargeNum(fund.revenue_ttm)}</div>
            <div className={styles.fundSub}>TTM</div>
          </div>
          <div className={styles.fundCell}>
            <div className={styles.fundLabel}>Revenue growth</div>
            <div className={`${styles.fundVal} ${(fund.revenue_growth ?? 0) >= 0 ? styles.pos : styles.neg}`}>
              {fund.revenue_growth != null ? fmtPct(fund.revenue_growth * 100) : '—'}
            </div>
            <div className={styles.fundSub}>YoY</div>
          </div>
          <div className={styles.fundCell}>
            <div className={styles.fundLabel}>Profit margin</div>
            <div className={styles.fundVal}>
              {fund.profit_margin != null ? `${fmt(fund.profit_margin * 100, 1)}%` : '—'}
            </div>
            <div className={styles.fundSub}>Net</div>
          </div>
          <div className={styles.fundCell}>
            <div className={styles.fundLabel}>Free cash flow</div>
            <div className={styles.fundVal}>{fmtLargeNum(fund.free_cash_flow)}</div>
            <div className={styles.fundSub}>TTM</div>
          </div>
          <div className={styles.fundCell}>
            <div className={styles.fundLabel}>ROE</div>
            <div className={`${styles.fundVal} ${(fund.return_on_equity ?? 0) >= 0 ? styles.pos : styles.neg}`}>
              {fund.return_on_equity != null ? `${fmt(fund.return_on_equity * 100, 0)}%` : '—'}
            </div>
            <div className={styles.fundSub}>TTM</div>
          </div>
          <div className={styles.fundCell}>
            <div className={styles.fundLabel}>Debt / equity</div>
            <div className={styles.fundVal}>
              {fund.debt_to_equity != null ? fmt(fund.debt_to_equity / 100, 2) : '—'}
            </div>
            <div className={styles.fundSub}>Ratio</div>
          </div>
          <div className={styles.fundCell}>
            <div className={styles.fundLabel}>Beta</div>
            <div className={styles.fundVal}>{fmt(fund.beta, 2)}</div>
            <div className={styles.fundSub}>5Y monthly</div>
          </div>
          <div className={styles.fundCell}>
            <div className={styles.fundLabel}>Dividend yield</div>
            <div className={styles.fundVal}>
              {fund.dividend_yield != null ? `${fmt(fund.dividend_yield * 100, 2)}%` : '—'}
            </div>
            <div className={styles.fundSub}>Trailing</div>
          </div>
        </div>
      </div>
      </FadeIn>

      {/* ── 7. ANALYST VIEW ────────────────────────────────────── */}
      <FadeIn delay={60}>
      <div className={styles.section}>
        <div className={styles.secLabel}>Analyst view</div>
        <div className={styles.analystGrid}>

          <div className={styles.analystConsensus}>
            <div className={styles.consensusLabel}>Consensus</div>
            <div className={styles.consensusWord}>{analyst.consensus ?? '—'}</div>
            <div className={styles.consensusScore}>
              Mean score {analyst.mean_score != null ? `${analyst.mean_score.toFixed(1)} / 5` : '—'}
            </div>
            <div className={styles.consensusCount}>
              {analyst.number_of_analysts != null ? `${analyst.number_of_analysts} analysts` : '—'}
            </div>
          </div>

          <div className={styles.analystRight}>
            <div className={styles.priceTargets}>
              <div className={styles.ptLabel}>
                Price targets{analyst.number_of_analysts != null ? ` (${analyst.number_of_analysts} analysts)` : ''}
              </div>
              <div className={styles.ptRow}>
                {[
                  { label: 'Mean',   val: analyst.price_target_mean },
                  { label: 'High',   val: analyst.price_target_high },
                  { label: 'Median', val: analyst.price_target_median },
                  { label: 'Low',    val: analyst.price_target_low },
                ].map(({ label, val }) => (
                  <div key={label} className={styles.ptItem}>
                    <div className={styles.ptItemLabel}>{label}</div>
                    <div className={styles.ptItemVal}>{val != null ? `$${Math.round(val)}` : '—'}</div>
                    <div className={`${styles.ptItemSub} ${calcUpsideClass(val, price.current_price)}`}>
                      {calcUpside(val, price.current_price)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(analyst.earnings_surprises ?? []).length > 0 && (
              <div className={styles.earningsTable}>
                <div className={styles.etHead}>
                  <span>Quarter</span>
                  <span>EPS est.</span>
                  <span>EPS actual</span>
                  <span>Surprise</span>
                </div>
                {(analyst.earnings_surprises ?? []).map((row: any, i: number) => (
                  <div key={i} className={styles.etRow}>
                    <span className={styles.etTx1}>{fmtQuarter(row.period)}</span>
                    <span>{row.estimate != null ? `$${row.estimate.toFixed(2)}` : '—'}</span>
                    <span className={styles.etTx1}>{row.actual != null ? `$${row.actual.toFixed(2)}` : '—'}</span>
                    <span className={(row.surprise_percent ?? 0) >= 0 ? styles.etPos : styles.etNeg}>
                      {row.surprise_percent != null
                        ? `${row.surprise_percent >= 0 ? '+' : ''}${row.surprise_percent.toFixed(1)}%`
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
      </FadeIn>

      {/* ── 8. INSTITUTIONAL ───────────────────────────────────── */}
      <FadeIn delay={60}>
      <div className={styles.section}>
        <div className={styles.secLabel}>Institutional &amp; insider activity</div>

        <div className={styles.instTop}>
          <div className={styles.instStat}>
            <div className={styles.instLabel}>Institutional ownership</div>
            <div className={styles.instVal}>
              {inst.percent_held_by_institutions != null
                ? `${inst.percent_held_by_institutions.toFixed(1)}%`
                : '—'}
            </div>
            <div className={styles.instSub}>of float</div>
          </div>
          <div className={styles.instStat}>
            <div className={styles.instLabel}>Insider ownership</div>
            <div className={styles.instVal}>
              {inst.percent_held_by_insiders != null
                ? `${inst.percent_held_by_insiders.toFixed(2)}%`
                : '—'}
            </div>
            <div className={styles.instSub}>of float</div>
          </div>
          <div className={styles.instStat}>
            <div className={styles.instLabel}>Short float</div>
            <div className={styles.instVal}>
              {inst.short_percent_of_float != null
                ? `${inst.short_percent_of_float.toFixed(1)}%`
                : '—'}
            </div>
            <div className={styles.instSub}>of float</div>
          </div>
          <div className={styles.instStat}>
            <div className={styles.instLabel}>Short ratio</div>
            <div className={styles.instVal}>
              {inst.short_ratio != null ? inst.short_ratio.toFixed(1) : '—'}
            </div>
            <div className={styles.instSub}>days to cover</div>
          </div>
        </div>

        {(inst.top_holders ?? []).length > 0 && (
          <div className={styles.holdersTable}>
            <div className={styles.htHead}>
              <span>Holder</span>
              <span>Shares</span>
              <span>% owned</span>
              <span>Change</span>
            </div>
            {(inst.top_holders ?? []).map((h: any, i: number) => (
              <div key={i} className={styles.htRow}>
                <span className={styles.htTx1}>{h.holder ?? '—'}</span>
                <span>{fmtShares(h.shares)}</span>
                <span>{h.percent_held != null ? `${h.percent_held.toFixed(2)}%` : '—'}</span>
                <span className={(h.change_percent ?? 0) > 0 ? styles.htPos : (h.change_percent ?? 0) < 0 ? styles.htNeg : ''}>
                  {h.change_percent != null
                    ? `${h.change_percent >= 0 ? '+' : ''}${h.change_percent.toFixed(1)}%`
                    : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      </FadeIn>

      {/* ── 9. FOOTER ──────────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerLogo}>
          <span className={styles.footerLogoWord}>TheMarketMood</span>
          <span className={styles.footerLogoTld}>.ai</span>
        </div>
        <div className={styles.footerLinks}>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
          <a href="#">API</a>
        </div>
        <div className={styles.footerCopy}>© 2026 · Data for informational purposes only. Not financial advice.</div>
      </footer>

    </div>
  );
}
