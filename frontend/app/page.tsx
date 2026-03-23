import { getHomeData } from '@/lib/api';
import styles from './page.module.css';
import Link from 'next/link';
import HeroSearch from './HeroSearch';
import FadeIn from './FadeIn';
import MoodCard from './MoodCard';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fgLabel(score: number): string {
  if (score >= 75) return 'Extreme Greed';
  if (score >= 55) return 'Greed';
  if (score >= 45) return 'Neutral';
  if (score >= 25) return 'Fear';
  return 'Extreme Fear';
}

function fgColor(score: number): string {
  if (score >= 65) return 'var(--green)';
  if (score >= 45) return 'var(--amber)';
  return 'var(--red)';
}

function subIndicatorColor(score: number): string {
  if (score >= 60) return 'var(--green)';
  if (score >= 40) return 'var(--amber)';
  return 'var(--red)';
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const data = await getHomeData();

  const fg       = data.fear_and_greed  ?? {};
  const subInd   = fg.sub_indicators    ?? {};
  const indices  = data.market_indices  ?? {};
  const trending = (data.trending_tickers ?? []).slice(0, 10);
  const articles = (data.macro_news?.articles ?? []).slice(0, 9);

  const fgScore = Math.round(fg.score ?? 50);

  const subIndicatorDefs = [
    { key: 'market_momentum',      name: 'Market Momentum (S&P 500)' },
    { key: 'stock_price_strength', name: 'Stock Price Strength' },
    { key: 'stock_price_breadth',  name: 'Stock Price Breadth' },
    { key: 'put_call_ratio',       name: 'Put & Call Options' },
    { key: 'market_volatility',    name: 'Market Volatility (VIX)' },
    { key: 'safe_haven_demand',    name: 'Safe Haven Demand' },
    { key: 'junk_bond_demand',     name: 'Junk Bond Demand' },
  ];

  const indexDefs = [
    { key: 'sp500',  label: 'S&P 500'   },
    { key: 'nasdaq', label: 'NASDAQ'    },
    { key: 'dow',    label: 'Dow Jones' },
    { key: 'vix',    label: 'VIX'       },
  ];

  return (
    <>
      {/* ── 1. NAV ───────────────────────────────────────────────── */}
      <nav className={styles.navOuter}>
        <div className={styles.navInner}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoWord}>TheMarketMood</span>
            <span className={styles.logoTld}>.ai</span>
          </Link>
          <div className={styles.navLinks}>
            <Link href="/" className={styles.navLink}>Markets</Link>
          </div>
          <button className={styles.btnPro}>Get Pro</button>
        </div>
      </nav>

      <div className={styles.page}>

        {/* ── 2. HERO ──────────────────────────────────────────────── */}
        <section className={styles.hero}>
          <div className={`${styles.heroEyebrow} ${styles.heroFade0}`}>
            <span className={styles.pip} />
            Real-time market intelligence
          </div>
          <h1 className={styles.heroFade1}>
            The market has<br />
            a <em>mood.</em><br />
            We read it.
          </h1>
          <p className={`${styles.heroSub} ${styles.heroFade2}`}>
            Search any stock for an instant sentiment read — technical signals, crowd behaviour, and AI narrative in one place.
          </p>
          <div className={styles.heroFade3}><HeroSearch /></div>
          <div className={`${styles.hints} ${styles.heroFade4}`}>
            <span className={styles.hintLabel}>Try</span>
            {['NVDA', 'TSLA', 'AAPL', 'META', 'AMD'].map(t => (
              <Link key={t} href={`/stock/${t}`} className={styles.hintChip}>{t}</Link>
            ))}
          </div>
        </section>

        {/* ── 3. MARKET MOOD ───────────────────────────────────────── */}
        <FadeIn delay={40}>
          <MoodCard />
        </FadeIn>

        {/* ── 4. MARKET INDICES ────────────────────────────────────── */}
        <FadeIn>
        <div className={styles.section}>
          <div className={styles.secLabel}>
            <span className={styles.livePip} />
            Market indices
          </div>
          <div className={styles.indicesGrid}>
            {indexDefs.map(({ key, label }) => {
              const idx = (indices as any)[key] ?? {};
              const isPos = (idx.change_percent ?? 0) >= 0;
              const isVix = key === 'vix';
              let tagLabel: string, tagClass: string;
              if (isVix) {
                if (idx.price < 15)      { tagLabel = 'Calm';     tagClass = styles.tBull; }
                else if (idx.price < 25) { tagLabel = 'Elevated'; tagClass = styles.tNeu;  }
                else                     { tagLabel = 'High';     tagClass = styles.tBear; }
              } else {
                tagLabel = isPos ? 'Bullish' : 'Bearish';
                tagClass = isPos ? styles.tBull : styles.tBear;
              }
              const absChange = idx.change ?? 0;
              return (
                <div key={key} className={styles.idxCard}>
                  <div className={styles.idxName}>{label}</div>
                  <div className={styles.idxPrice}>{fmtPrice(idx.price)}</div>
                  <div className={`${styles.idxChange} ${isPos ? styles.pos : styles.neg}`}>
                    {fmtPct(idx.change_percent)}
                    <span className={styles.idxChangeAbs}>
                      {isPos ? '+' : ''}{absChange.toFixed(2)}
                    </span>
                  </div>
                  <span className={`${styles.tag} ${tagClass}`}>{tagLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
        </FadeIn>

        {/* ── 4. FEAR & GREED ──────────────────────────────────────── */}
        <FadeIn delay={60}>
        <div className={styles.fgDashboard}>

          {/* Left: main score */}
          <div className={styles.fgLeft}>
            <div className={styles.fgTopLabel}>
              <span className={styles.livePip} />
              Fear &amp; Greed Index
            </div>

            <div>
              <div className={styles.fgScoreNum}>{fgScore}</div>
              <div className={styles.fgScoreLabel} style={{ color: fgColor(fgScore) }}>
                {fgLabel(fgScore)}
              </div>
            </div>

            <div>
              <div className={styles.fgTrack}>
                <div
                  className={styles.fgThumb}
                  style={{
                    left: `${fgScore}%`,
                    boxShadow: `0 0 0 2px var(--bg), 0 0 0 3px ${fgColor(fgScore)}`,
                  }}
                />
              </div>
              <div className={styles.fgTrackLabels}>
                <span>Extreme fear</span>
                <span>Neutral</span>
                <span>Extreme greed</span>
              </div>
            </div>

            <div className={styles.fgHistorical}>
              {[
                { period: '1 WK AGO',  val: Math.round(fg.one_week_ago  ?? 0) },
                { period: '1 MO AGO',  val: Math.round(fg.one_month_ago ?? 0) },
                { period: '1 YR AGO',  val: Math.round(fg.one_year_ago  ?? 0) },
              ].map(({ period, val }) => (
                <div key={period} className={styles.fgHistItem}>
                  <div className={styles.fgHistPeriod}>{period}</div>
                  <div className={styles.fgHistVal} style={{ color: fgColor(val) }}>{val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: sub-indicators */}
          <div className={styles.fgRight}>
            <div className={styles.fgRightTitle}>Sub-indicators</div>
            {subIndicatorDefs.map(({ key, name }) => {
              const s = Math.round((subInd as any)[key]?.score ?? 0);
              const col = subIndicatorColor(s);
              return (
                <div key={key} className={styles.subIndicator}>
                  <span className={styles.siName}>{name}</span>
                  <div className={styles.siBarTrack}>
                    <div className={styles.siBarFill} style={{ width: `${s}%`, background: col }} />
                  </div>
                  <span className={styles.siVal} style={{ color: col }}>{s}</span>
                </div>
              );
            })}
          </div>
        </div>
        </FadeIn>

        {/* ── 5. TRENDING ON REDDIT ────────────────────────────────── */}
        <FadeIn delay={60}>
        <div className={styles.section}>
          <div className={styles.secLabel}>Trending on Reddit · ApeWisdom</div>
          <div className={styles.redditTable}>
            <div className={styles.rtHead}>
              <span>#</span>
              <span>Ticker</span>
              <span>Name</span>
              <span>Mentions</span>
              <span>Momentum</span>
            </div>
            {trending.map((t: any) => {
              const signal = t.momentum_signal ?? 'Stable';
              const sl = signal.toLowerCase();
              let tagCls: string;
              if (sl === 'surging' || sl === 'rising' || (t.rank_change ?? 0) > 20) tagCls = styles.tBull;
              else if (sl === 'falling') tagCls = styles.tBear;
              else tagCls = styles.tNeu;

              const mentChg = t.mention_change_percent;
              const mentChgStr = mentChg != null
                ? `${mentChg >= 0 ? '+' : ''}${Math.round(mentChg)}% vs yesterday`
                : '';

              return (
                <Link key={t.ticker} href={`/stock/${t.ticker}`} className={styles.rtRow}>
                  <span className={styles.rtRank}>{t.rank}</span>
                  <span className={styles.rtTicker}>{t.ticker}</span>
                  <span className={styles.rtName}>{t.name}</span>
                  <div>
                    <div className={styles.rtMentions}>{(t.mentions ?? 0).toLocaleString()}</div>
                    {mentChgStr && <div className={styles.rtMentionsSub}>{mentChgStr}</div>}
                  </div>
                  <span className={`${styles.tag} ${tagCls}`}>{signal}</span>
                </Link>
              );
            })}
          </div>
        </div>
        </FadeIn>

        {/* ── 6. MARKET HEADLINES ──────────────────────────────────── */}
        <FadeIn delay={60}>
        <div className={`${styles.section} ${styles.sectionNoBorder}`}>
          <div className={styles.secLabel}>Market headlines</div>
          <div className={styles.newsGrid}>
            {articles.map((a: any, i: number) => (
              <a
                key={i}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.newsCard}
              >
                <div className={styles.newsSourceRow}>
                  <span className={styles.newsSource}>{a.source}</span>
                  <span className={styles.newsTime}>{fmtTime(a.published_at)}</span>
                </div>
                <div className={styles.newsTitle}>{a.title}</div>
                <div className={styles.newsFooter}>
                  <span className={styles.newsRead}>Read →</span>
                </div>
              </a>
            ))}
          </div>
        </div>
        </FadeIn>

        {/* ── 7. FOOTER ────────────────────────────────────────────── */}
        <footer className={styles.footer}>
          <div className={styles.footerLogo}>
            <span className={styles.footerLogoWord}>TheMarketMood</span>
            <span className={styles.footerLogoTld}>.ai</span>
          </div>
          <div className={styles.footerLinks}>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Contact</a>
          </div>
          <div className={styles.footerCopy}>© 2026 · Not financial advice.</div>
        </footer>

      </div>
    </>
  );
}
