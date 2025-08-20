import styles from "../setup/Setup.module.css";

interface Props {
  online: number;
  blocked: number;
  cloud: number;
  alerts: number;
  onPrivacy?: () => void;
  onOnline?: () => void;
  onBlocked?: () => void;
  onCloud?: () => void;
  onAlerts?: () => void;
}

export default function DashboardScreen({
  online, blocked, cloud, alerts,
  onPrivacy, onOnline, onBlocked, onCloud, onAlerts,
}: Props) {
  return (
    <div className={styles.app} role="region" aria-label="Dashboard">
      <div className={styles.circleFrame}>
        <div className={styles.centerStack}>

          <div className={styles.dashWrap}>
            {/* Center bubble */}
            <button className={`${styles.bubble} ${styles.bubbleCenter}`} onClick={onPrivacy}>
              <span className={styles.bubbleTitle}>Privacy state</span>
            </button>

            {/* Orbit bubbles */}
            <button className={`${styles.bubble} ${styles.bubbleTop} ${styles.bubbleOnline}`} onClick={onOnline}>
              <span className={styles.bubbleValue}>{online}</span>
              <span className={styles.bubbleTitle}>Devices online</span>
            </button>

            <button className={`${styles.bubble} ${styles.bubbleRight} ${styles.bubbleBlocked}`} onClick={onBlocked}>
              <span className={styles.bubbleValue}>{blocked}</span>
              <span className={styles.bubbleTitle}>Devices blocked</span>
            </button>

            <button className={`${styles.bubble} ${styles.bubbleBottom} ${styles.bubbleCloud}`} onClick={onCloud}>
              <span className={styles.bubbleValue}>{cloud}</span>
              <span className={styles.bubbleTitle}>Cloud-connected</span>
            </button>

            <button className={`${styles.bubble} ${styles.bubbleLeft} ${styles.bubbleAlerts}`} onClick={onAlerts}>
              <span className={styles.bubbleValue}>{alerts}</span>
              <span className={styles.bubbleTitle}>Alerts</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
