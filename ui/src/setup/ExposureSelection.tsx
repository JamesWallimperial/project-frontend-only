import styles from "./Setup.module.css";

export type SensitivityValue = "high" | "medium" | "low";

export interface SensitivityOption {
  label: string;          // "High Sensitivity"
  value: SensitivityValue; // "high" | "medium" | "low"
  color: string;          // "red" | "yellow" | "green"
}

interface Props {
  options: SensitivityOption[];
  selectedIndex: number;
}

export default function ExposureSelection({ options, selectedIndex }: Props) {
  const hasOptions = options.length > 0;

  return (
    <div className={styles.app} role="region" aria-label="Exposure selection">
      <div className={styles.circleFrame}>
        <div className={styles.centerStack}>
          <div>
            <div className={styles.title}>Set data sensitivity</div>
            <div className={styles.subtitle}>Rotate to choose, press to confirm</div>
          </div>

          <ul
            className={styles.deviceList}
            role="listbox"
            aria-activedescendant={
              hasOptions ? `sensitivity-option-${selectedIndex}` : undefined
            }
          >
            {options.map((opt, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <li
                  id={`sensitivity-option-${idx}`}
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.deviceItem} ${
                    isSelected ? styles.deviceItemSelected : ""
                  }`}
                >
                  {/* colored dot + label */}
                  <span
                    className={styles.colorDot}
                    aria-hidden="true"
                    style={{ backgroundColor: opt.color }}
                  />
                  {opt.label}
                </li>
              );
            })}

            {!hasOptions && (
              <li className={styles.deviceItemEmpty}>No options</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
