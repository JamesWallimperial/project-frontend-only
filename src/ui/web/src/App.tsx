import { useState } from "react";
import Startup from "./startup/Startup";
import AccessPoint from "./setup/AccessPoint";
import HomeAssistant from "./setup/HomeAssistant";

export default function App() {
  const [step, setStep] = useState(0);

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
