'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

interface SearchResult {
  ticker: string;
  display_ticker?: string;
  name: string;
  type?: string;
  asset_type?: string;
  exchange?: string;
}

function getAssetUrl(result: SearchResult): string {
  const assetType = result.asset_type || 'stock';
  return `/${assetType}/${encodeURIComponent(result.ticker)}`;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function HeroSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setFocusIdx(-1);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Debounced search
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
          setOpen(true);
          setFocusIdx(-1);
        }
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  function navigate(result: SearchResult | string) {
    setOpen(false);
    setQuery('');
    if (typeof result === 'string') {
      router.push(`/stock/${result.toUpperCase()}`);
    } else {
      router.push(getAssetUrl(result));
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
      setFocusIdx(-1);
      return;
    }
    if (!open || results.length === 0) {
      if (e.key === 'Enter' && query.trim()) navigate(query.trim());
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIdx(i => Math.min(i + 1, Math.min(results.length, 6) - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      if (focusIdx >= 0 && results[focusIdx]) {
        navigate(results[focusIdx]);
      } else if (query.trim()) {
        navigate(query.trim());
      }
    }
  }

  function handleGo() {
    if (focusIdx >= 0 && results[focusIdx]) {
      navigate(results[focusIdx]);
    } else if (query.trim()) {
      navigate(query.trim());
    }
  }

  const shown = results.slice(0, 6);

  return (
    <div className={styles.searchOuter} ref={wrapRef}>
      <div className={styles.searchBar}>
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
          <circle cx="6.5" cy="6.5" r="5" stroke="white" strokeWidth="1.3" />
          <path d="M11 11L13.5 13.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <input
          className={styles.searchInput}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search ticker or company — AAPL, Tesla, NVDA…"
          autoComplete="off"
        />
        <button className={styles.searchGo} onClick={handleGo}>
          Read mood →
        </button>
      </div>

      {open && shown.length > 0 && (
        <div className={styles.searchDropdown}>
          {shown.map((r, i) => (
            <div
              key={r.ticker}
              className={`${styles.dropdownItem}${i === focusIdx ? ' ' + styles.dropdownFocused : ''}`}
              onMouseDown={() => navigate(r)}
              onMouseEnter={() => setFocusIdx(i)}
            >
              <div className={styles.diLeft}>
                <span className={styles.diTicker}>{r.display_ticker || r.ticker}</span>
                <span className={styles.diName}>{r.name}</span>
              </div>
              {r.type && (
                <div className={styles.diRight}>
                  <span className={`${styles.tag} ${styles.tBlue}`}>{r.type}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
