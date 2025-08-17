import styles from "./Setup.module.css";

type Props = { onContinue?: () => void };

export default function HomeAssistant({ onContinue }: Props) {
  return (
    <div className={styles.app}>
      <div className={styles.circleFrame}>
        <div className={styles.centerStack}>
          <div>
            <div className={styles.title}>Home Assistant Access</div>
            <div className={styles.subtitle}>
              Scan on your phone to configure devices
            </div>
          </div>
          <div className={styles.qrPlaceholder}>QR</div>
          <button className={styles.primaryBtn} onClick={onContinue}>
            Continue: Set up devices
          </button>
        </div>
      </div>
    </div>
  );
}
