import { useState, useEffect, useRef } from "react";
import Startup from "./startup/Startup";
import AccessPoint from "./setup/AccessPoint";
import HomeAssistant from "./setup/HomeAssistant";
import DeviceSelection from "./setup/DeviceSelection";
import CategorySelection from "./setup/CategorySelection";
import ExposureSelection, { SensitivityOption } from "./setup/ExposureSelection";

export default function App() {
  const [step, setStep] = useState(0);
  const [lastDevice, setLastDevice] = useState<string | null>(null);
  interface WiFiClient {
    ip: string;
    mac: string;
    hostname: string;
    signal?: number | null;
    category?: string;
    sensitivity?: "high" | "medium" | "low";
  }

  const [clients, setClients] = useState<WiFiClient[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const sensitivityOptions: SensitivityOption[] = [
    { label: "High Sensitivity",   value: "high",   color: "red" },
    { label: "Medium Sensitivity", value: "medium", color: "yellow" },
    { label: "Low Sensitivity",    value: "low",    color: "green" },
  ];

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

  // ----- API base URL (prefer env; fallback to port 8000 on current host) -----
  function getApiBaseUrl(): string {
    // Primary: Vite-style single var
    const direct = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
    if (direct) return direct.replace(/\/+$/, "");

    // Back-compat: separate host/port envs if you already use them
    const host = (import.meta as any)?.env?.VITE_API_HOST || window.location.hostname || "localhost";
    const port = (import.meta as any)?.env?.VITE_API_PORT || "8000"; // <— default to 8000, not UI port
    const proto = "http:"; // API usually on HTTP locally; change to https if you terminate TLS
    return `${proto}//${host}:${port}`;
  }

  // Accept either [] or { clients: [...] }
  function normalizeClients(raw: unknown) {
    if (Array.isArray(raw)) return raw as WiFiClient[];
    if (raw && typeof raw === "object" && Array.isArray((raw as any).clients)) {
      return (raw as any).clients as WiFiClient[];
    }
    return [] as WiFiClient[];
  }

  useEffect(() => {
    const base = getApiBaseUrl();              // e.g., "http://raspberrypi.local:8000"
    const { protocol, host } = new URL(base);  // "http:", "raspberrypi.local:8000"
    const wsProto = protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProto}//${host}/events`);
    ws.onmessage = (event) => {
      try {
        const { type, device, payload } = JSON.parse(event.data);
        setLastDevice(device);
	
	// === STEP 3: device selection ===
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
              const base = getApiBaseUrl();
              fetch(`${base}/devices/${deviceName}/category`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category }),
              })
                .then(() => {
                  // optimistic local state update
                  setClients(prev =>
                    prev.map(c => c.mac === deviceName ? { ...c, category } : c)
                  );
                  setStep((prev) => prev + 1);
                })
                .catch((err) =>
                  console.error("Failed to persist category", err)
                );
            }
          }

        } else if (stepRef.current === 5) {
          // === STEP 5: exposure/sensitivity selection ===
          if (type === "rotate" && sensitivityOptions.length > 0) {
            if (payload === "cw") {
              setSelectedIndex((prev) => (prev + 1) % sensitivityOptions.length);
            } else if (payload === "ccw") {
              setSelectedIndex(
                (prev) => (prev - 1 + sensitivityOptions.length) % sensitivityOptions.length
              );
            }
          } else if (type === "button" && payload === "press") {
            const deviceName = selectedDeviceRef.current;
            const chosen = sensitivityOptions[selectedRef.current]?.value; // "high" | "medium" | "low"
            if (deviceName && chosen) {
              const base = getApiBaseUrl();
              fetch(`${base}/devices/${deviceName}/sensitivity`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sensitivity: chosen }),
              })
                .then(() => {
                  // optimistic local state update
                  setClients(prev =>
                    prev.map(c => c.mac === deviceName ? { ...c, sensitivity: chosen } : c)
                  );
                  setStep((prev) => prev + 1);
                })
                .catch((err) =>
                  console.error("Failed to persist sensitivity", err)
                );
            }
          }
        } else if (stepRef.current <= 2) {
          if (type === "button" && payload === "press") {
            setStep((prev) => prev + 1);
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
        const base = getApiBaseUrl();
        // If you added the enriched endpoint, use it so saved category/sensitivity appear automatically:
        // (If this 404s, switch back to `/wifi/clients`.)
        fetch(`${base}/wifi/clients_with_meta`, { cache: "no-store" })
          .then(async (res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const list = normalizeClients(json);
            setClients(list);
            setSelectedIndex(0);
          })
          .catch((err) => console.error("Failed to load clients", err));
	// === STEP 4: category selection ===
      } else if (step === 4) {
        setSelectedIndex(0);
      } else if (step === 5) {
        setSelectedIndex(0);
      }
  }, [step]);

  const categories = ["Smart Speaker", "Security & Monitoring", "Entertainment", "Personal Devices", "Appliance or Light", "Other/Unknown"];
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
    case 5:
      content = (
        <ExposureSelection
          options={sensitivityOptions}
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
