import styles from "../setup/Setup.module.css";

interface Props {
  items: string[];
  selectedIndex: number;          // 0 = Back, 1..N = items[0..N-1]
  onBack: () => void;
  onActivate: (idx: number) => void; // idx is 0..items.length-1 (not including Back)
}

export default function HomeMenu({ items, selectedIndex, onBack, onActivate }: Props) {
  return (
    <div className={styles.app} role="region" aria-label="Home menu">
      <div className={styles.circleFrame}>
        {/* Back chip (index 0) */}
        <button
          type="button"
          className={`${styles.backBtn} ${selectedIndex === 0 ? styles.backBtnSelected : ""}`}
          onClick={onBack}
          aria-label="Back to dashboard"
        >
          ← Back
        </button>

        <div className={styles.centerStack}>
          <div>
            <div className={styles.title}>Home</div>
            <div className={styles.subtitle}>Rotate to choose, press to confirm</div>
          </div>

          {/* List: indices 1..N map to items[0..N-1] */}
          <ul className={styles.deviceList} role="listbox">
            {items.map((label, i) => {
              const idx = i + 1; // shift because 0 is Back
              const selected = selectedIndex === idx;
              return (
                <li
                  key={label}
                  role="option"
                  aria-selected={selected}
                  className={`${styles.deviceItem} ${selected ? styles.deviceItemSelected : ""}`}
                  onClick={() => onActivate(i)}
                >
                  {label}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
