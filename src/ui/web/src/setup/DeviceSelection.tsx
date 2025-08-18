import styles from "./Setup.module.css";

interface Props {
  devices: string[];
  selectedIndex: number;
}

export default function DeviceSelection({ devices, selectedIndex }: Props) {
  return (
    <div className={styles.app}>
      <div className={styles.circleFrame}>
        <div className={styles.centerStack}>
          <div>
            <div className={styles.title}>Select a device</div>
            <div className={styles.subtitle}>Rotate to choose, press to confirm</div>
          </div>
          <ul className={styles.deviceList}>
            {devices.map((device, idx) => (
              <li
                key={device}
                className={`${styles.deviceItem} ${
                  idx === selectedIndex ? styles.deviceItemSelected : ""
                }`}
              >
                {device}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
