'use client';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

export default function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Only hide if below the fold — avoids flash for above-fold content
    const rect = el.getBoundingClientRect();
    const inView = rect.top < window.innerHeight * 0.9;

    if (!inView) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(16px)';
      el.style.transition = `opacity 0.45s ease ${delay}ms, transform 0.45s ease ${delay}ms`;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1';
          el.style.transform = 'none';
          observer.disconnect();
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
