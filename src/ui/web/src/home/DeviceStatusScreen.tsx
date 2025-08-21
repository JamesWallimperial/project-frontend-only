import styles from "../setup/Setup.module.css";

export type DeviceStatusStr =
  | "Disconnected"
  | "Local-only"
  | "Online"
  | "Cloud-Connected";

interface Props {
  deviceName?: string;                // optional label (hostname/MAC/IP)
  currentStatus: DeviceStatusStr;     // for highlighting text
  options: DeviceStatusStr[];         // 4 statuses
  selectedIndex: number;              // 0 = Back, 1..4 = options[0..3]
  onBack: () => void;
  onChoose: (status: DeviceStatusStr) => void; // used when user clicks (mouse/touch)
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

  return (
    <div className={styles.app} role="region" aria-label="Device status">
      <div className={styles.circleFrame}>
        {/* Back button (index 0) */}
        <button
          id="status-back"
          className={`${styles.backBtn} ${selectedIndex === 0 ? styles.backBtnSelected : ""}`}
          onClick={onBack}
          aria-selected={selectedIndex === 0}
          title="Back"
        >
          <svg className={styles.backIcon} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15.5 19.5 8 12l7.5-7.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className={styles.backLabel}>Back</span>
        </button>

        <div className={styles.centerStack}>
          <div>
            <div className={styles.title}>Set device status</div>
            <div className={styles.subtitle}>
              {deviceName ? deviceName + " — " : ""}current: <strong>{currentStatus}</strong>
            </div>
          </div>

          <ul
            className={styles.deviceList}
            role="listbox"
            aria-activedescendant={
              selectedIndex === 0 ? "status-back" : `status-opt-${listSel}`
            }
          >
            {options.map((opt, idx) => {
              const isSelected = selectedIndex > 0 && idx === listSel;
              return (
                <li
                  id={`status-opt-${idx}`}
                  key={opt}
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.deviceItem} ${isSelected ? styles.deviceItemSelected : ""}`}
                  onClick={() => onChoose(opt)}
                >
                  {opt}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
