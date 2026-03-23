import styles from './loading.module.css';

export default function Loading() {
  return (
    <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '0 0 40px' }}>

      {/* Top card — stock header */}
      <div className={styles.topCard}>
        <div className={styles.row}>
          <div className={styles.skeleton} style={{ width: 120, height: 52 }} />
          <div className={styles.skeleton} style={{ width: 200, height: 18 }} />
        </div>
        <div className={styles.row}>
          <div className={styles.skeleton} style={{ width: 150, height: 44 }} />
          <div className={styles.skeleton} style={{ width: 120, height: 14 }} />
        </div>

        {/* Chart + gauge grid */}
        <div className={styles.chartGaugeGrid}>
          <div className={styles.skeleton} style={{ height: 200 }} />
          <div className={styles.skeleton} style={{ height: 200 }} />
        </div>
      </div>

      {/* AI Insights */}
      <div className={styles.card}>
        <div className={styles.skeleton} style={{ width: 120, height: 14, marginBottom: 20 }} />
        <div className={styles.skeleton} style={{ height: 80 }} />
      </div>

      {/* Signal breakdown — 3 pillars */}
      {[1, 2, 3].map(i => (
        <div key={i} className={styles.card}>
          <div className={styles.skeleton} style={{ width: 100, height: 12, marginBottom: 16 }} />
          <div className={styles.skeleton} style={{ height: 180 }} />
        </div>
      ))}

      {/* News */}
      <div className={styles.card}>
        <div className={styles.skeleton} style={{ width: 100, height: 12, marginBottom: 16 }} />
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className={styles.skeleton} style={{ height: 44, marginBottom: 8 }} />
        ))}
      </div>

      {/* Fundamentals */}
      <div className={styles.card}>
        <div className={styles.skeleton} style={{ width: 120, height: 12, marginBottom: 16 }} />
        <div className={styles.grid4}>
          {[...Array(12)].map((_, i) => (
            <div key={i} className={styles.skeleton} style={{ height: 64 }} />
          ))}
        </div>
      </div>

      {/* Analyst + Institutional */}
      {[1, 2].map(i => (
        <div key={i} className={styles.card}>
          <div className={styles.skeleton} style={{ width: 120, height: 12, marginBottom: 16 }} />
          <div className={styles.skeleton} style={{ height: 140 }} />
        </div>
      ))}

    </div>
  );
}
