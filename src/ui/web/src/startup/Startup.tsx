import { useState } from "react";
import styles from "./Startup.module.css";

type Props = { onStart?: () => void };

export default function Startup({ onStart }: Props) {
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      // placeholder: later we might call /modes or check backend health
      onStart?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.app}>
      <div className={styles.circleFrame}>
        <div className={styles.centerStack}>
          {/* Put your logo at public/logo.png. Fallback shows text if missing */}
          <img
            className={styles.logo}
            src="/logo.png"
            alt="Device Logo"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <div>
            <div className={styles.title}>NetDash</div>
            <div className={styles.subtitle}>privacy-first smart hub</div>
          </div>
          <button
            className={styles.primaryBtn}
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? "Starting…" : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
}
