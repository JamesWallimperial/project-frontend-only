import { useState, useEffect } from "react";
import Startup from "./startup/Startup";
import AccessPoint from "./setup/AccessPoint";
import HomeAssistant from "./setup/HomeAssistant";

export default function App() {
  const [step, setStep] = useState(0);
  const [lastDevice, setLastDevice] = useState<string | null>(null);

  useEffect(() => {
    const host = import.meta.env.VITE_API_HOST || window.location.hostname || "localhost";
    const port = import.meta.env.VITE_API_PORT || window.location.port || "8000";
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${host}:${port}/events`);

    ws.onmessage = (event) => {
      try {
        const { type, device, payload } = JSON.parse(event.data);
        setLastDevice(device);
        if (type === "button" && payload === "press") {
          setStep((prev) => prev + 1);
        } else if (type === "rotate") {
          if (payload === "cw") {
            setStep((prev) => prev + 1);
          } else if (payload === "ccw") {
            setStep((prev) => Math.max(prev - 1, 0));
          }
        }
      } catch (err) {
        console.error("Failed to parse event", err);
      }
    };

    return () => ws.close();
  }, []);

  let content;
  switch (step) {
    case 0:
      content = <Startup onStart={() => setStep(1)} />;
      break;
    case 1:
      content = <AccessPoint onContinue={() => setStep(2)} />;
      break;
    case 2:
      content = (
        <HomeAssistant onContinue={() => console.log("setup devices")} />
      );
      break;
    default:
      content = null;
  }

  return (
    <>
      {content}
      {lastDevice && (
        <div className="device-indicator">Input from {lastDevice}</div>
      )}
    </>
  );
}
