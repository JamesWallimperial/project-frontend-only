import { useState, useEffect, useRef } from "react";
import Startup from "./startup/Startup";
import AccessPoint from "./setup/AccessPoint";
import HomeAssistant from "./setup/HomeAssistant";
import DeviceSelection from "./setup/DeviceSelection";
import CategorySelection from "./setup/CategorySelection";

export default function App() {
  const [step, setStep] = useState(0);
  const [lastDevice, setLastDevice] = useState<string | null>(null);
  interface WiFiClient {
    ip: string;
    mac: string;
    hostname: string;
    signal?: number | null;
  }

  const [clients, setClients] = useState<WiFiClient[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const stepRef = useRef(step);
  const clientsRef = useRef(clients);
  const selectedRef = useRef(selectedIndex);
  const selectedDeviceRef = useRef(selectedDevice);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);
  useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);
  useEffect(() => {
    selectedRef.current = selectedIndex;
  }, [selectedIndex]);
  useEffect(() => {
    selectedDeviceRef.current = selectedDevice;
  }, [selectedDevice]);

  useEffect(() => {
    const host =
      import.meta.env.VITE_API_HOST || window.location.hostname || "localhost";
    const port =
      import.meta.env.VITE_API_PORT || window.location.port || "8000";
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${protocol}://${host}:${port}/events`);

    ws.onmessage = (event) => {
      try {
        const { type, device, payload } = JSON.parse(event.data);
        setLastDevice(device);
          if (stepRef.current === 3) {
            if (type === "rotate" && clientsRef.current.length > 0) {
              if (payload === "cw") {
                setSelectedIndex(
                  (prev) => (prev + 1) % clientsRef.current.length
                );
              } else if (payload === "ccw") {
                setSelectedIndex(
                  (prev) =>
                    (prev - 1 + clientsRef.current.length) %
                    clientsRef.current.length
                );
              }
            } else if (type === "button" && payload === "press") {
              const selected = clientsRef.current[selectedRef.current];
              setSelectedDevice(selected?.mac ?? null);
              setSelectedIndex(0);
              setStep((prev) => prev + 1);
            }
          } else if (stepRef.current === 4) {
          if (type === "rotate" && categories.length > 0) {
            if (payload === "cw") {
              setSelectedIndex((prev) => (prev + 1) % categories.length);
            } else if (payload === "ccw") {
              setSelectedIndex(
                (prev) => (prev - 1 + categories.length) % categories.length
              );
            }
          } else if (type === "button" && payload === "press") {
            const category = categories[selectedRef.current];
            const deviceName = selectedDeviceRef.current;
            if (deviceName) {
              const host =
                import.meta.env.VITE_API_HOST ||
                window.location.hostname ||
                "localhost";
              const port =
                import.meta.env.VITE_API_PORT || window.location.port || "8000";
              const protocol =
                window.location.protocol === "https:" ? "https" : "http";
              fetch(
                `${protocol}://${host}:${port}/devices/${deviceName}/category`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ category }),
                }
              )
                .then(() => setStep((prev) => prev + 1))
                .catch((err) =>
                  console.error("Failed to persist category", err)
                );
            }
          }
        } else {
          if (type === "button" && payload === "press") {
            setStep((prev) => prev + 1);
          } else if (type === "rotate") {
            if (payload === "cw") {
              setStep((prev) => prev + 1);
            } else if (payload === "ccw") {
              setStep((prev) => Math.max(prev - 1, 0));
            }
          }
        }
      } catch (err) {
        console.error("Failed to parse event", err);
      }
    };

    return () => ws.close();
  }, []);

  useEffect(() => {
      if (step === 3) {
        const host =
          import.meta.env.VITE_API_HOST || window.location.hostname || "localhost";
        const port =
          import.meta.env.VITE_API_PORT || window.location.port || "8000";
        const protocol = window.location.protocol === "https:" ? "https" : "http";
        fetch(`${protocol}://${host}:${port}/wifi/clients`)
          .then((res) => res.json())
          .then((data: WiFiClient[]) => {
            setClients(data);
            setSelectedIndex(0);
          })
          .catch((err) => console.error("Failed to load clients", err));
      } else if (step === 4) {
        setSelectedIndex(0);
      }
  }, [step]);

  const categories = ["Light", "Outlet", "Switch", "Sensor"];
  let content;
  switch (step) {
    case 0:
      content = <Startup onStart={() => setStep(1)} />;
      break;
    case 1:
      content = <AccessPoint onContinue={() => setStep(2)} />;
      break;
    case 2:
      content = <HomeAssistant onContinue={() => setStep(3)} />;
      break;
    case 3:
        content = (
          <DeviceSelection clients={clients} selectedIndex={selectedIndex} />
        );
      break;
    case 4:
      content = (
        <CategorySelection
          categories={categories}
          selectedIndex={selectedIndex}
        />
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
