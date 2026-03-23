'use client';
import { useEffect, useRef } from 'react';

export default function CountUp({
  value,
  prefix = '',
  decimals = 2,
}: {
  value: number | null | undefined;
  prefix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || value == null) return;

    const end = value;
    const duration = 700;
    const t0 = performance.now();

    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      el.textContent = prefix + (eased * end).toFixed(decimals);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, prefix, decimals]);

  // suppressHydrationWarning: server renders final value, client animates from 0
  return (
    <span ref={ref} suppressHydrationWarning>
      {value != null ? prefix + value.toFixed(decimals) : '—'}
    </span>
  );
}
