import styles from "../setup/Setup.module.css";

type DeviceStatusStr = "Disconnected" | "Local-only" | "Online" | "Cloud-Connected";

interface Props {
  deviceName: string;
  currentStatus: DeviceStatusStr;
  options: readonly DeviceStatusStr[];
  /** 0 = Back, 1..N = option index in `options` */
  selectedIndex: number;
  onBack: () => void;
  onChoose: (status: DeviceStatusStr) => void;
}

export default function DeviceStatusScreen({
  deviceName,
  currentStatus,
  options,
  selectedIndex,
  onBack,
  onChoose,
}: Props) {
  const listSel = Math.max(0, selectedIndex - 1);
  const idFor = (i: number) => (i === -1 ? "status-back" : `status-opt-${i}`);

  const handleKey = (e: React.KeyboardEvent, status: DeviceStatusStr) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChoose(status);
    }
  };

  return (
    <div className={styles.app} role="region" aria-label="Device status">
      <div className={styles.circleFrame}>
        {/* Back button (index 0) */}
        <button
          id="status-back"
          className={`${styles.backBtn} ${selectedIndex === 0 ? styles.backBtnSelected : ""}`}
          onClick={onBack}
          aria-label="Back"
          aria-selected={selectedIndex === 0}
          title="Back"
          style={{ pointerEvents: "auto", zIndex: 6 }}
        >
          <svg className={styles.backIcon} viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M15.5 19.5 8 12l7.5-7.5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.backLabel}>Back</span>
        </button>

        <div className={styles.centerStack} style={{ pointerEvents: "auto", zIndex: 5 }}>
          <div>
            <div className={styles.title}>{deviceName}</div>
            <div className={styles.subtitle}>Choose a connection status</div>
          </div>

          <ul
            className={styles.deviceList}
            role="listbox"
            aria-activedescendant={selectedIndex === 0 ? "status-back" : idFor(listSel)}
          >
            {options.map((opt, i) => {
              const selected = selectedIndex > 0 && listSel === i;
              const isCurrent = opt === currentStatus;
              return (
                <li
                  id={idFor(i)}
                  key={opt}
                  role="option"
                  aria-selected={selected}
                  className={`${styles.deviceItem} ${selected ? styles.deviceItemSelected : ""}`}
                  // Mouse/pointer: fire immediately
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChoose(opt);
                  }}
                  // Keyboard accessibility
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => handleKey(e, opt)}
                  style={{ pointerEvents: "auto" }}
                >
                  <div className={styles.deviceRowTop}>{opt}</div>
                  <div className={styles.deviceRowBottom}>
                    {isCurrent && <span className={styles.categoryTag}>Current</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
