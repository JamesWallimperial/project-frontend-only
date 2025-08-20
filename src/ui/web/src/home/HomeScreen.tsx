import styles from "../setup/Setup.module.css";

interface Props {
  total: number;
  configured: number;
  onReview?: () => void;   // go back to configure more (if any remain)
  onRestart?: () => void;  // optional: restart the setup flow
}

export default function HomeScreen({ total, configured, onReview, onRestart }: Props) {
  const remaining = Math.max(total - configured, 0);

  return (
    <div className={styles.app} role="region" aria-label="Home">
      <div className={styles.circleFrame}>
        <div className={styles.centerStack}>
          <div>
            <div className={styles.title}>Setup complete</div>
            <div className={styles.subtitle}>
              {configured} of {total} devices configured
              {remaining > 0 ? ` • ${remaining} remaining` : ""}
            </div>
          </div>

          <div className={styles.homeGrid}>
            <div className={styles.homeCard}>
              <div className={styles.homeStatLabel}>Configured</div>
              <div className={styles.homeStatValue}>{configured}</div>
            </div>
            <div className={styles.homeCard}>
              <div className={styles.homeStatLabel}>Remaining</div>
              <div className={styles.homeStatValue}>{remaining}</div>
            </div>
          </div>

          <div className={styles.homeActions}>
            {remaining > 0 && (
              <button className={styles.primaryBtn} onClick={onReview}>
                Configure remaining
              </button>
            )}
            <button
              className={styles.primaryBtn}
              onClick={onRestart}
              aria-label="Restart setup"
              title="Restart setup"
            >
              Restart setup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
