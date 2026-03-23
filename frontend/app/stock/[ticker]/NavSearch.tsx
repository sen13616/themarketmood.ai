'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import styles from './page.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function NavSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  async function navigateToTicker(input: string) {
    const ticker = input.trim().toUpperCase();
    if (!ticker) return;
    if (inputRef.current) inputRef.current.value = '';
    try {
      const res = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(ticker)}`);
      const data = await res.json();
      const exact = data.results?.find(
        (r: any) => r.ticker.toUpperCase() === ticker || (r.display_ticker ?? '').toUpperCase() === ticker
      );
      if (exact) {
        router.push(`/${exact.asset_type}/${encodeURIComponent(exact.ticker)}`);
      } else if (data.results?.length > 0) {
        const first = data.results[0];
        router.push(`/${first.asset_type}/${encodeURIComponent(first.ticker)}`);
      } else {
        router.push(`/stock/${ticker}`);
      }
    } catch {
      router.push(`/stock/${ticker}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const value = inputRef.current?.value ?? '';
      navigateToTicker(value);
    }
  }

  return (
    <div className={styles.navSearchWrap}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="6" cy="6" r="4.5" stroke="white" strokeWidth="1.2" />
        <path d="M10 10L12.5 12.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <input
        ref={inputRef}
        className={styles.navSearch}
        placeholder="Search ticker or company — AAPL, Tesla…"
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
