import styles from "./Setup.module.css";

type Props = { onContinue?: () => void };

export default function AccessPoint({ onContinue }: Props) {
  const ssid = "MyHub-AP";
  const password = "changeme123";

  return (
    <div className={styles.app}>
      <div className={styles.circleFrame}>
        <div className={styles.centerStack}>
          <div>
            <div className={styles.title}>Connect to Hub Wi-Fi</div>
            <div className={styles.subtitle}>
              Use the details below to connect
            </div>
          </div>
          <div className={styles.credentials}>
            <div>
              <strong>SSID:</strong> {ssid}
            </div>
            <div>
              <strong>Password:</strong> {password}
            </div>
          </div>
          <img
            src="/wifisetup.png"
            alt="Setup instructions QR"
            className={styles.qrImage}
          />
          <button className={styles.primaryBtn} onClick={onContinue}>
            Continue: Home Assistant setup
          </button>
        </div>
      </div>
    </div>
  );
}
