import { getMood } from '@/lib/api';
import styles from './MoodCard.module.css';

const ACCENT_VARS: Record<string, { accent: string; bg: string; br: string }> = {
  red:   { accent: 'var(--red)',   bg: 'var(--red-bg)',    br: 'var(--red-br)'   },
  amber: { accent: 'var(--amber)', bg: 'var(--amber-bg)',  br: 'var(--amber-br)' },
  gray:  { accent: 'var(--tx3)',   bg: 'var(--surface-2)', br: 'var(--line)'     },
  blue:  { accent: 'var(--blue)',  bg: 'var(--blue-bg)',   br: 'var(--blue-br)'  },
  green: { accent: 'var(--green)', bg: 'var(--green-bg)',  br: 'var(--green-br)' },
  teal:  { accent: 'var(--green)', bg: 'var(--green-bg)',  br: 'var(--green-br)' },
};

function fmtTimestamp(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const sgt = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  const hh = sgt.getUTCHours().toString().padStart(2, '0');
  const mm = sgt.getUTCMinutes().toString().padStart(2, '0');
  const day = sgt.getUTCDate();
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${hh}:${mm} SGT · ${day} ${months[sgt.getUTCMonth()]}`;
}

export default async function MoodCard() {
  let mood: any = null;
  try {
    mood = await getMood();
  } catch {
    return null;
  }

  if (!mood?.emotion) return null;

  const colorKey = mood.accent_color ?? 'amber';
  const vars = ACCENT_VARS[colorKey] ?? ACCENT_VARS.amber;
  const intensity = Math.min(Math.max(Math.round(mood.intensity ?? 5), 1), 10);
  const history: any[] = mood.history ?? [];
  const signals: string[] = mood.key_signals ?? [];

  return (
    <section
      className={styles.moodSection}
      style={{
        '--accent':    vars.accent,
        '--accent-bg': vars.bg,
        '--accent-br': vars.br,
      } as React.CSSProperties}
    >
      <div className={styles.moodCard}>
        <div className={styles.cardStripe} />

        <div className={styles.cardHeader}>
          <div>
            <div className={styles.moodLabel}>Market mood</div>
            <div className={styles.moodWord}>{mood.emotion}</div>
          </div>
          <div className={styles.headerRight}>
            <div className={styles.aiBadge}>AI · GPT-4o</div>
            <div className={styles.intensityRow}>
              <div className={styles.intensityDots}>
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className={`${styles.dot} ${i < intensity ? styles.dotOn : ''}`} />
                ))}
              </div>
              <span className={styles.intensityNum}>{intensity}/10</span>
            </div>
          </div>
        </div>

        <div className={styles.cardBody}>
          <p className={styles.rationale}>{mood.rationale}</p>
        </div>

        {signals.length > 0 && (
          <div className={styles.cardTags}>
            {signals.map((s, i) => (
              <span key={i} className={styles.moodTag}>{s}</span>
            ))}
          </div>
        )}

        <div className={styles.cardFooter}>
          <div className={styles.historyWrap}>
            {history.length > 0 && <span className={styles.historyLabel}>5d</span>}
            {history.map((h: any, i: number) => (
              <span key={i} style={{ display: 'contents' }}>
                {i > 0 && <span className={styles.hSep}>›</span>}
                <span className={`${styles.hPill} ${i === history.length - 1 ? styles.hPillToday : ''}`}>
                  {h.emotion}
                </span>
              </span>
            ))}
          </div>
          <div className={styles.cardTimestamp}>{fmtTimestamp(mood.timestamp)}</div>
        </div>
      </div>
    </section>
  );
}
