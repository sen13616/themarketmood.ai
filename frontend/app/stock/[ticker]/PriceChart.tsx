'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import styles from './page.module.css';

interface PriceChartProps {
  ticker: string;
  indexName: string;
  dates: string[];
  stockPrices: number[];
  indexPrices: number[];
}

const PERIODS = ['1M', '3M', '6M', '1Y'] as const;
type Period = typeof PERIODS[number];

const PERIOD_LABEL: Record<Period, string> = {
  '1M': '1 month',
  '3M': '3 months',
  '6M': '6 months',
  '1Y': '1 year',
};

function calcReturn(prices: number[]): number | null {
  if (prices.length < 2 || prices[0] === 0) return null;
  return ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100;
}

function fmtRet(r: number | null): string {
  if (r == null) return '—';
  return (r >= 0 ? '+' : '') + r.toFixed(1) + '%';
}

function buildSparseLabels(dates: string[]): string[] {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return dates.map((d, i) => {
    const step = Math.max(1, Math.floor(dates.length / 7));
    if (i % step === 0 || i === dates.length - 1) {
      const p = d.split('-');
      return p.length === 3
        ? MONTHS[parseInt(p[1], 10) - 1] + ' ' + parseInt(p[2], 10)
        : d;
    }
    return '';
  });
}

export default function PriceChart({
  ticker,
  indexName,
  dates: initialDates,
  stockPrices: initialStockPrices,
  indexPrices: initialIndexPrices,
}: PriceChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<any>(null);

  const [activePeriod, setActivePeriod] = useState<Period>('3M');
  const [showIndex, setShowIndex] = useState(true);
  const [loading, setLoading] = useState(false);

  // Current chart data (starts with server-side 3M data)
  const [chartData, setChartData] = useState({
    dates: initialDates,
    stockPrices: initialStockPrices,
    indexPrices: initialIndexPrices,
  });

  const stockReturn = calcReturn(chartData.stockPrices);
  const indexReturn = calcReturn(chartData.indexPrices);
  const diff = stockReturn != null && indexReturn != null
    ? stockReturn - indexReturn
    : null;

  // Build/rebuild chart when chartData changes
  useEffect(() => {
    if (!canvasRef.current) return;
    let destroyed = false;
    let resizeObserver: ResizeObserver | null = null;

    const { dates, stockPrices, indexPrices } = chartData;
    const sparseLabels = buildSparseLabels(dates);
    const isUp = (calcReturn(stockPrices) ?? 0) >= 0;

    (async () => {
      const { Chart } = await import('chart.js/auto');
      if (destroyed || !canvasRef.current) return;

      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      chartRef.current = new Chart(ctx, {
        type: 'line',
        data: {
          labels: sparseLabels,
          datasets: [
            {
              label: ticker,
              data: stockPrices,
              borderColor: 'rgba(255,255,255,0.85)',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.3,
              fill: true,
              backgroundColor: (c: any) => {
                const g = c.chart.ctx.createLinearGradient(0, 0, 0, 200);
                g.addColorStop(0, isUp ? 'rgba(29,204,154,0.12)' : 'rgba(240,96,96,0.12)');
                g.addColorStop(1, isUp ? 'rgba(29,204,154,0)'    : 'rgba(240,96,96,0)');
                return g;
              },
              yAxisID: 'yStock',
            },
            {
              label: indexName,
              data: indexPrices,
              borderColor: 'rgba(90,156,248,0.55)',
              borderWidth: 1.5,
              borderDash: [5, 4],
              pointRadius: 0,
              tension: 0.3,
              fill: false,
              yAxisID: 'yIndex',
              hidden: !showIndex,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          resizeDelay: 0,
          layout: { autoPadding: false },
          animation: { duration: 800, easing: 'easeInOutQuart' },
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#0e1119',
              borderColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              titleColor: '#4a5568',
              bodyColor: '#f0f4ff',
              titleFont: { family: 'Geist Mono, monospace', size: 10 },
              bodyFont: { family: 'Geist Mono, monospace', size: 11 },
              padding: 10,
              callbacks: {
                label: (c: any) => {
                  if (c.datasetIndex === 0) {
                    return `  ${ticker}  $${Number(c.parsed.y).toFixed(2)}`;
                  }
                  return `  ${indexName}  ${Number(c.parsed.y).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
                },
              },
            },
          },
          scales: {
            x: {
              grid:   { color: 'rgba(255,255,255,0.03)' },
              ticks:  { color: '#4a5568', font: { size: 10, family: 'Geist Mono, monospace' }, maxTicksLimit: 7 },
              border: { color: 'rgba(255,255,255,0.06)' },
            },
            yStock: {
              position: 'left',
              grid:   { color: 'rgba(255,255,255,0.03)' },
              ticks:  { color: '#4a5568', font: { size: 10, family: 'Geist Mono, monospace' }, callback: (v: any) => '$' + Number(v).toFixed(0) },
              border: { display: false },
            },
            yIndex: {
              position: 'right',
              grid:   { display: false },
              ticks:  { color: '#4a5568', font: { size: 10, family: 'Geist Mono, monospace' }, callback: (v: any) => Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }) },
              border: { display: false },
            },
          },
        },
      });

      if (canvasRef.current?.parentElement) {
        resizeObserver = new ResizeObserver(() => {
          if (chartRef.current) chartRef.current.resize();
        });
        resizeObserver.observe(canvasRef.current.parentElement);
      }
    })();

    return () => {
      destroyed = true;
      resizeObserver?.disconnect();
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, chartData]);

  const handlePeriodChange = useCallback(async (period: Period) => {
    if (period === activePeriod) return;
    setActivePeriod(period);

    // 3M data is already loaded from the server
    if (period === '3M') {
      setChartData({
        dates: initialDates,
        stockPrices: initialStockPrices,
        indexPrices: initialIndexPrices,
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/price-history/${ticker}?period=${period}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setChartData({
        dates: data.dates ?? [],
        stockPrices: data.stock_prices ?? [],
        indexPrices: data.index_prices ?? [],
      });
    } catch {
      // Keep existing data on error
    } finally {
      setLoading(false);
    }
  }, [activePeriod, ticker, initialDates, initialStockPrices, initialIndexPrices]);

  const toggleIndex = () => {
    if (!chartRef.current) return;
    const next = !showIndex;
    setShowIndex(next);
    chartRef.current.data.datasets[1].hidden = !next;
    chartRef.current.update();
  };

  return (
    <div>
      {/* Toolbar */}
      <div className={styles.chartToolbar}>
        <span className={styles.chartLabel}>Price performance</span>
        <div className={styles.rangeTabs}>
          {PERIODS.map(p => (
            <button
              key={p}
              className={`${styles.rangeTab} ${activePeriod === p ? styles.rangeTabActive : ''}`}
              onClick={() => handlePeriodChange(p)}
              disabled={loading}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Legend chips */}
      <div className={styles.chartLegend}>
        <div className={styles.legendChip}>
          <div className={styles.legendChipDot} style={{ background: 'var(--tx1)' }} />
          {ticker}
        </div>
        <div
          className={styles.legendChip}
          style={{ opacity: showIndex ? 1 : 0.4, cursor: 'pointer' }}
          onClick={toggleIndex}
        >
          <div className={styles.legendChipDashed} />
          vs {indexName} {showIndex ? '✓' : ''}
        </div>
        {showIndex && diff != null && (
          <div
            className={styles.vsChip}
            style={{
              color:       diff >= 0 ? 'var(--green)'    : 'var(--red)',
              borderColor: diff >= 0 ? 'var(--green-br)' : 'var(--red-br)',
              background:  diff >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
            }}
          >
            {diff >= 0 ? '↑ +' : '↓ '}{Math.abs(diff).toFixed(1)}% vs {indexName}
          </div>
        )}
      </div>

      {/* Canvas */}
      <div
        className={styles.chartCanvasWrap}
        style={{ overflow: 'hidden', maxWidth: '100%', minWidth: 0, opacity: loading ? 0.4 : 1, transition: 'opacity 0.2s' }}
      >
        <canvas ref={canvasRef} style={{ width: '100%', maxWidth: '100%' }} />
      </div>

      {/* Footer */}
      <div className={styles.chartFooter}>
        <div className={styles.chartFooterLegend}>
          <div className={styles.cflItem}>
            <div className={styles.cflLine} style={{ background: 'var(--tx1)' }} />
            <span>{ticker}</span>
            <span className={(stockReturn ?? 0) >= 0 ? styles.pos : styles.neg}>
              {fmtRet(stockReturn)}
            </span>
          </div>
          <div className={styles.cflItem}>
            <div className={`${styles.cflLine} ${styles.cflDashed}`} />
            <span>{indexName}</span>
            <span className={(indexReturn ?? 0) >= 0 ? styles.pos : styles.neg}>
              {fmtRet(indexReturn)}
            </span>
          </div>
        </div>
        <div className={styles.chartFooterMeta}>daily close · {PERIOD_LABEL[activePeriod]}</div>
      </div>
    </div>
  );
}
