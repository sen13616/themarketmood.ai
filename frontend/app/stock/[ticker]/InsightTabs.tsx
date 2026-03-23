'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface InsightTabsProps {
  summary: string | null;
  bullCase: string | null;
  bearCase: string | null;
  whatToWatch: string | null;
  ticker: string;
  signals: any;
}

const TABS = [
  { key: 'summary', label: 'Summary'       },
  { key: 'bull',    label: 'Bull case'     },
  { key: 'bear',    label: 'Bear case'     },
  { key: 'watch',   label: 'What to watch' },
] as const;

type TabKey = typeof TABS[number]['key'];

function TypewriterText({ text, animate, onDone }: { text: string; animate: boolean; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState(animate ? '' : text);

  useEffect(() => {
    if (!animate) {
      setDisplayed(text);
      return;
    }
    setDisplayed('');
    let i = 0;
    const timer = setInterval(() => {
      i += 3;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        setDisplayed(text);
        clearInterval(timer);
        onDone?.();
      }
    }, 18);
    return () => clearInterval(timer);
  }, [text, animate]);

  const done = !animate || displayed.length >= text.length;
  return (
    <>
      {displayed}
      {!done && (
        <span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--blue)', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'pip 0.8s ease-in-out infinite' }} />
      )}
    </>
  );
}

function parseBold(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function InsightTabs({
  summary,
  bullCase,
  bearCase,
  whatToWatch,
  ticker,
  signals,
}: InsightTabsProps) {
  const [active, setActive] = useState<TabKey>('summary');
  const [deepContent, setDeepContent] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [animated, setAnimated] = useState<Record<string, boolean>>({});

  const content: Record<TabKey, string | null> = {
    summary,
    bull: bullCase,
    bear: bearCase,
    watch: whatToWatch,
  };

  async function handleDeepAnalysis(key: TabKey) {
    if (deepContent[key] || loading[key]) return;
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      // Strip large arrays that add noise without analytical value
      const { price_history, ...rest } = signals as any;
      const trimmedSignals = {
        ...rest,
        news_sentiment: rest.news_sentiment
          ? { ...rest.news_sentiment, articles: undefined }
          : undefined,
      };
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/deep-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, tab: key, signals: trimmedSignals }),
      });
      const data = await res.json();
      setDeepContent(prev => ({ ...prev, [key]: data.content }));
    } catch {
      setDeepContent(prev => ({ ...prev, [key]: 'Deep analysis temporarily unavailable.' }));
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  }

  return (
    <>
      <div className={styles.insightTabs}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`${styles.insightTab} ${active === tab.key ? styles.insightTabActive : ''}`}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.insightBody}>
        <p className={styles.insightText}>
          {content[active] ? parseBold(content[active]!) : '—'}
        </p>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--line)', margin: '20px 0' }} />

        {/* Deep content if loaded */}
        {deepContent[active] && (
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--tx3)', marginBottom: 12 }}>
              AI Deep Analysis
            </div>
            <p style={{ fontSize: 15, fontWeight: 300, color: 'var(--tx2)', lineHeight: 1.75 }}>
              <TypewriterText
                text={deepContent[active]}
                animate={!animated[active]}
                onDone={() => setAnimated(prev => ({ ...prev, [active]: true }))}
              />
            </p>
          </div>
        )}

        {/* Go deeper button or loading state */}
        {!deepContent[active] && (
          loading[active] ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--tx3)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', boxShadow: '0 0 6px var(--blue)', animation: 'pip 2.5s ease-in-out infinite' }} />
              Generating deep analysis...
            </div>
          ) : (
            <button
              onClick={() => handleDeepAnalysis(active)}
              style={{
                background: 'none', border: '1px solid var(--blue-br)', borderRadius: 6,
                color: 'var(--blue)', fontFamily: 'var(--mono)', fontSize: 11,
                padding: '6px 14px', cursor: 'pointer', letterSpacing: '0.3px',
                transition: 'all .15s',
              }}
            >
              Go deeper →
            </button>
          )
        )}
      </div>
    </>
  );
}
