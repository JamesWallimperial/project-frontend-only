import { useState } from "react";

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
    <div className="app">
      <div className="circle-frame">
        <div className="center-stack">
          {/* Put your logo at public/logo.png. Fallback shows text if missing */}
          <img
            className="logo"
            src="/logo.png"
            alt="Device Logo"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <div>
            <div className="title">NetDash</div>
            <div className="subtitle">privacy-first smart hub</div>
          </div>
          <button className="primary-btn" onClick={handleStart} disabled={loading}>
            {loading ? "Starting…" : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
}
