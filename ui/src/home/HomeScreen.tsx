import styles from "../setup/Setup.module.css";

interface Props {
  total: number;
  configured: number;
  menu: string[];           // e.g., ["Dashboard", "Restart setup"]
  selectedIndex: number;    // knob highlight
  onActivate: (index: number) => void; // press action
}

export default function HomeScreen({ total, configured, menu, selectedIndex, onActivate }: Props) {
  const remaining = Math.max(total - configured, 0);

  return (
    <div className={styles.app} role="region" aria-label="Home">
      <div className={styles.circleFrame}>
        <div className={styles.centerStack}>
          <div>
            <div className={styles.title}>Setup complete</div>
            <div className={styles.subtitle}>
              {configured} of {total} devices configured{remaining ? ` • ${remaining} remaining` : ""}
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

          <ul className={styles.homeMenu} role="listbox"
              aria-activedescendant={`home-option-${selectedIndex}`}>
            {menu.map((label, idx) => (
              <li
                id={`home-option-${idx}`}
                role="option"
                aria-selected={idx === selectedIndex}
                key={label}
                className={`${styles.homeMenuItem} ${idx === selectedIndex ? styles.homeMenuItemSelected : ""}`}
                onClick={() => onActivate(idx)}
              >
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
