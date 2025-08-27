import styles from "../setup/Setup.module.css";

type Risk = "high" | "medium" | "low" | undefined;

interface Device {
  ip: string;
  mac: string;
  hostname: string;
  category?: string;
  sensitivity?: Risk;
}

interface Props {
  devices: Device[];
  selectedIndex: number;
  onBack: () => void;
  onSelect?: (mac: string) => void;   // NEW
}

export default function CloudDevices({ devices, selectedIndex, onBack, onSelect }: Props) {
  const has = devices.length > 0;
  const label = (d: Device) => d.hostname || d.mac || d.ip;

  const riskClass = (s: Risk) =>
    s === "high" ? styles.riskHigh :
    s === "medium" ? styles.riskMedium :
    s === "low" ? styles.riskLow : styles.riskUnknown;

  const riskText = (s: Risk) =>
    s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";

  const listSel = Math.max(0, selectedIndex - 1);

  return (
    <div className={styles.app} role="region" aria-label="Cloud devices">
      <div className={styles.circleFrame}>
        {/* Back button (index 0) */}
        <button
          id="cloud-back"
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
            <div className={styles.title}>Cloud-connected</div>
            <div className={styles.subtitle}>Rotate to scroll, press to select</div>
          </div>

          <ul
            className={styles.deviceList}
            role="listbox"
            aria-activedescendant={
              selectedIndex === 0 ? "cloud-back"
              : has ? `cloud-option-${listSel}` : undefined
            }
          >
            {devices.map((d, idx) => {
              const selected = idx === listSel && selectedIndex > 0;
              return (
                <li
                  id={`cloud-option-${idx}`}
                  key={`${d.mac}-${d.ip}`}
                  role="option"
                  aria-selected={selected}
                  className={`${styles.deviceItem} ${selected ? styles.deviceItemSelected : ""}`}
                  onClick={() => onSelect?.(d.mac)}
                >
                  <div className={styles.deviceRowTop}>{label(d)}</div>
                  <div className={styles.deviceRowBottom}>
                    <span className={styles.categoryTag}>{d.category ?? "Uncategorized"}</span>
                    <span className={`${styles.riskPill} ${riskClass(d.sensitivity)}`}>
                      {riskText(d.sensitivity)}
                    </span>
                  </div>
                </li>
              );
            })}
            {!has && <li className={styles.deviceItemEmpty}>No cloud-connected devices</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
