import { useState, useEffect } from "react";
import Startup from "./startup/Startup";
import AccessPoint from "./setup/AccessPoint";
import HomeAssistant from "./setup/HomeAssistant";

export default function App() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/events/button");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "next") {
            setStep((prev) => prev + 1);
        }
      } catch (err) {
        console.error("Failed to parse event", err);
      }
    };

    return () => ws.close();
  }, []);

  switch (step) {
    case 0:
      return <Startup onStart={() => setStep(1)} />;
    case 1:
      return <AccessPoint onContinue={() => setStep(2)} />;
    case 2:
      return <HomeAssistant onContinue={() => console.log("setup devices")} />;
    default:
      return null;
  }
}
