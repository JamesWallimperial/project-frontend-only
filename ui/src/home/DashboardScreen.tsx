import styles from "../setup/Setup.module.css";
import ExposureSlider from "../common/ExposureSlider";

interface Props {
  localOnly: number;
  online: number;
  cloud: number;
  exposureLevel: number;
  /** 0=Online, 1=Cloud, 2=Settings, 3=Local */
  selectedIndex: number;
  onActivate: (index: number) => void;
  onExposureChange: (level: number) => void;
}

export default function DashboardScreen({
  localOnly, online, cloud,
  exposureLevel,
  selectedIndex, onActivate,
  onExposureChange,               
}: Props) {
  const isSel = (i: number) => (selectedIndex === i ? styles.bubbleSelected : "");
  const level = Math.max(1, Math.min(5, exposureLevel));

  const exposureSummaries: Record<number, string> = {
    1: "Secure: All devices local-only",
    2: "Activity: TV and iPhones online; others local-only.",
    3: "High activity: TV, Kids Phone, speaker online.",
    4: "Alert: Homepod and Work Laptop cloud connected",
    5: "Critical: cameras, roomba, TV, Speaker cloud-connected; high risk.",
  };
  const summary = exposureSummaries[level] ?? "System status unknown";

  return (
    <div className={styles.app} role="region" aria-label="Dashboard">
      {/* NEW flex row wrapper */}
      <div className={styles.dashboardLayout}>
        {/* Left: the circular dashboard */}
        <div className={styles.circleFrame}>
          <div className={styles.centerStack}>
            <div className={styles.dashWrap}>
              {/* Center bubble */}
              <div
                className={`${styles.bubble} ${styles.bubbleCenter} ${styles[`bubbleCenterL${level}`]} ${styles.bubbleDisplay}`}
                role="status"
                aria-live="polite"
              >
                <span className={styles.summaryText}>{summary}</span>
              </div>

              {/* Top: Online */}
              <button
                className={`${styles.bubble} ${styles.bubbleTop} ${styles.bubbleOnline} ${isSel(0)}`}
                onClick={() => onActivate(0)}
                aria-selected={selectedIndex === 0}
                aria-label="Online devices"
              >
                <span className={styles.bubbleValue}>{online}</span>
                <span className={styles.bubbleTitle}>Online</span>
              </button>

              {/* Right: Cloud */}
              <button
                className={`${styles.bubble} ${styles.bubbleRight} ${styles.bubbleCloud} ${isSel(1)}`}
                onClick={() => onActivate(1)}
                aria-selected={selectedIndex === 1}
                aria-label="Cloud-connected devices"
              >
                <span className={styles.bubbleValue}>{cloud}</span>
                <span className={styles.bubbleTitle}>Cloud</span>
              </button>

              {/* Bottom: Settings */}
              <button
                className={`${styles.bubble} ${styles.bubbleBottom} ${styles.bubbleHome} ${isSel(2)}`}
                onClick={() => onActivate(2)}
                aria-selected={selectedIndex === 2}
                aria-label="Settings"
                title="Settings"
              >
                <svg className={styles.homeIcon} viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 10.5L12 3l9 7.5v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9z"/>
                </svg>
              </button>

              {/* Left: Local-only */}
              <button
                className={`${styles.bubble} ${styles.bubbleLeft} ${styles.bubbleLocal} ${isSel(3)}`}
                onClick={() => onActivate(3)}
                aria-selected={selectedIndex === 3}
                aria-label="Local-only devices"
              >
                <span className={styles.bubbleValue}>{localOnly}</span>
                <span className={styles.bubbleTitle}>Local-only</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right: the vertical exposure slider */}
        <aside className={styles.rightSideRail} aria-label="Exposure control">
          <ExposureSlider value={exposureLevel} onChange={onExposureChange} />
        </aside>
      </div>
    </div>
  );
}
