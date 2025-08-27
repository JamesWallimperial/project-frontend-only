import styles from "./Setup.module.css";

interface Props {
  categories: string[];
  selectedIndex: number;
}

export default function CategorySelection({ categories, selectedIndex }: Props) {
  return (
    <div className={styles.app}>
      <div className={styles.circleFrame}>
        <div className={styles.centerStack}>
          <div>
            <div className={styles.title}>Select a category</div>
            <div className={styles.subtitle}>Rotate to choose, press to confirm</div>
          </div>
          <ul className={styles.deviceList}>
            {categories.map((category, idx) => (
              <li
                key={category}
                className={`${styles.deviceItem} ${
                  idx === selectedIndex ? styles.deviceItemSelected : ""
                }`}
              >
                {category}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
