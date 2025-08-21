import styles from "../setup/Setup.module.css";

interface Props {
  online: number;
  blocked: number;
  cloud: number;
  alerts: number;
  exposureLevel: number;                 // <-- NEW
  selectedIndex: number;
  onActivate: (index: number) => void;
  onPrivacy?: () => void;
  onOnline?: () => void;
  onBlocked?: () => void;
  onCloud?: () => void;
  onAlerts?: () => void;
}

export default function DashboardScreen({
  online, blocked, cloud, alerts,
  exposureLevel,                       // <-- NEW
  selectedIndex, onActivate,
  onPrivacy, onOnline, onBlocked, onCloud, onAlerts,
}: Props) {
  const isSel = (i: number) => (selectedIndex === i ? styles.bubbleSelected : "");

  return (
    <div className={styles.app} role="region" aria-label="Dashboard">
      <div className={styles.circleFrame}>
        <div className={styles.centerStack}>
          <div className={styles.dashWrap}>
            {/* 0: center — show level + tint class */}
            <button
              className={`${styles.bubble} ${styles.bubbleCenter} ${styles[`bubbleCenterL${Math.max(1, Math.min(5, exposureLevel))}`]} ${isSel(0)}`}
              onClick={() => { onActivate(0); onPrivacy?.(); }}
              aria-selected={selectedIndex === 0}
            >
              <span className={styles.bubbleValue}>L{Math.max(1, Math.min(5, exposureLevel))}</span>
              <span className={styles.bubbleTitle}>Exposure</span>
            </button>

            {/* 1: top (online) */}
            <button
              className={`${styles.bubble} ${styles.bubbleTop} ${styles.bubbleOnline} ${isSel(1)}`}
              onClick={() => { onActivate(1); onOnline?.(); }}
              aria-selected={selectedIndex === 1}
            >
              <span className={styles.bubbleValue}>{online}</span>
              <span className={styles.bubbleTitle}>Devices online</span>
            </button>

            {/* 2: right (blocked) */}
            <button
              className={`${styles.bubble} ${styles.bubbleRight} ${styles.bubbleBlocked} ${isSel(2)}`}
              onClick={() => { onActivate(2); onBlocked?.(); }}
              aria-selected={selectedIndex === 2}
            >
              <span className={styles.bubbleValue}>{blocked}</span>
              <span className={styles.bubbleTitle}>Devices blocked</span>
            </button>

            {/* 3: bottom (cloud) */}
            <button
              className={`${styles.bubble} ${styles.bubbleBottom} ${styles.bubbleCloud} ${isSel(3)}`}
              onClick={() => { onActivate(3); onCloud?.(); }}
              aria-selected={selectedIndex === 3}
            >
              <span className={styles.bubbleValue}>{cloud}</span>
              <span className={styles.bubbleTitle}>Cloud-connected</span>
            </button>

            {/* 4: left (alerts) */}
            <button
              className={`${styles.bubble} ${styles.bubbleLeft} ${styles.bubbleAlerts} ${isSel(4)}`}
              onClick={() => { onActivate(4); onAlerts?.(); }}
              aria-selected={selectedIndex === 4}
            >
              <span className={styles.bubbleValue}>{alerts}</span>
              <span className={styles.bubbleTitle}>Alerts</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
