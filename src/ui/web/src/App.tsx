import { useState, useEffect, useRef } from "react";
import Startup from "./startup/Startup";
import AccessPoint from "./setup/AccessPoint";
import HomeAssistant from "./setup/HomeAssistant";
import DeviceSelection from "./setup/DeviceSelection";
import CategorySelection from "./setup/CategorySelection";
import ExposureSelection, { SensitivityOption } from "./setup/ExposureSelection";
import HomeScreen from "./home/HomeScreen";
import DashboardScreen from "./home/DashboardScreen";

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

  // Show only devices that still need category or sensitivity
  const unconfiguredClients = clients.filter(
    (c) => !c.category || !c.sensitivity
  );

  const sensitivityOptions: SensitivityOption[] = [
    { label: "High Sensitivity", value: "high", color: "red" },
    { label: "Medium Sensitivity", value: "medium", color: "yellow" },
    { label: "Low Sensitivity", value: "low", color: "green" },
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
    const direct = (import.meta as any)?.env?.VITE_API_BASE_URL as
      | string
      | undefined;
    if (direct) return direct.replace(/\/+$/, "");
    const host =
      (import.meta as any)?.env?.VITE_API_HOST ||
      window.location.hostname ||
      "localhost";
    const port = (import.meta as any)?.env?.VITE_API_PORT || "8000";
    const proto = "http:";
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

  // WebSocket input handling
  useEffect(() => {
    const base = getApiBaseUrl();
    const { protocol, host } = new URL(base);
    const wsProto = protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProto}//${host}/events`);

    ws.onmessage = (event) => {
      try {
        const { type, device, payload } = JSON.parse(event.data);
        setLastDevice(device);

        // === STEP 3: device selection (only unconfigured clients) ===
        if (stepRef.current === 3) {
          const unconfigured = clientsRef.current.filter(
            (c) => !c.category || !c.sensitivity
          );

          if (type === "rotate" && unconfigured.length > 0) {
            if (payload === "cw") {
              setSelectedIndex((prev) => (prev + 1) % unconfigured.length);
            } else if (payload === "ccw") {
              setSelectedIndex(
                (prev) => (prev - 1 + unconfigured.length) % unconfigured.length
              );
            }
          } else if (type === "button" && payload === "press") {
            const selected = unconfigured[selectedRef.current];
            setSelectedDevice(selected?.mac ?? null);
            setSelectedIndex(0);
            setStep((prev) => prev + 1); // -> step 4
          }

        // === STEP 4: category selection ===
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
              const baseUrl = getApiBaseUrl();
              fetch(`${baseUrl}/devices/${deviceName}/category`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category }),
              })
                .then(() => {
                  // optimistic local state update
                  setClients((prev) =>
                    prev.map((c) =>
                      c.mac === deviceName ? { ...c, category } : c
                    )
                  );
                  setStep((prev) => prev + 1); // -> step 5
                })
                .catch((err) =>
                  console.error("Failed to persist category", err)
                );
            }
          }

        // === STEP 5: exposure/sensitivity selection ===
        } else if (stepRef.current === 5) {
          if (type === "rotate" && sensitivityOptions.length > 0) {
            if (payload === "cw") {
              setSelectedIndex((prev) => (prev + 1) % sensitivityOptions.length);
            } else if (payload === "ccw") {
              setSelectedIndex(
                (prev) =>
                  (prev - 1 + sensitivityOptions.length) %
                  sensitivityOptions.length
              );
            }
          } else if (type === "button" && payload === "press") {
            const deviceName = selectedDeviceRef.current;
            const chosen = sensitivityOptions[selectedRef.current]?.value; // "high" | "medium" | "low"
            if (deviceName && chosen) {
              const baseUrl = getApiBaseUrl();
              fetch(`${baseUrl}/devices/${deviceName}/sensitivity`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sensitivity: chosen }),
              })
                .then(() => {
                  // optimistic local state update + loop remaining
                  setClients((prev) => {
                    const updated = prev.map((c) =>
                      c.mac === deviceName ? { ...c, sensitivity: chosen } : c
                    );
                    const remaining = updated.filter(
                      (c) => !c.category || !c.sensitivity
                    );
                    if (remaining.length > 0) {
                      // loop back to pick the next device
                      setSelectedDevice(null);
                      setSelectedIndex(0);
                      setStep(3);
                    } else {
                      // all devices configured; advance to a "done" step (6) or stay
                      setStep(6);
                    }
                    return updated;
                  });
                })
                .catch((err) =>
                  console.error("Failed to persist sensitivity", err)
                );
            }
          }
          } else if (stepRef.current === 6) {
            // Two-menu navigation by knob: 0 = Dashboard, 1 = Restart setup
            if (type === "rotate") {
              const menuLen = 2; // ["Dashboard","Restart setup"]
              if (payload === "cw") {
                setSelectedIndex(prev => (prev + 1) % menuLen);
              } else if (payload === "ccw") {
                setSelectedIndex(prev => (prev - 1 + menuLen) % menuLen);
              }
            } else if (type === "button" && payload === "press") {
              if (selectedRef.current === 0) {
                setStep(7); // go to Dashboard
              } else {
                // Restart setup
                setSelectedDevice(null);
                setSelectedIndex(0);
                setStep(0);
              }
            }
        // Steps 0–2: simple advance on press
        } else if (stepRef.current <= 2) {
          if (type === "button" && payload === "press") {
            setStep((prev) => prev + 1);
          }
        } else {
          // Fallback navigation (optional)
          if (type === "button" && payload === "press") {
            setStep((prev) => prev + 1);
          } else if (type === "rotate") {
            if (payload === "cw") setStep((prev) => prev + 1);
            else if (payload === "ccw") setStep((prev) => Math.max(prev - 1, 0));
          }
        }
      } catch (err) {
        console.error("Failed to parse event", err);
      }
    };

    return () => ws.close();
  }, []);

  // Step-based effects (fetch & reset selection)
  useEffect(() => {
    if (step === 3) {
      const base = getApiBaseUrl();
      // Prefer enriched endpoint if present; otherwise clients-only
      fetch(`${base}/wifi/clients_with_meta`, { cache: "no-store" })
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          const list = normalizeClients(json);
          setClients(list);
          setSelectedIndex(0);
         // If nothing left to configure, go straight to Home (step 6)
          const remaining = list.filter((c: any) => !c.category || !c.sensitivity);
          if (remaining.length === 0) setStep(6);
        })
        .catch(async () => {
          // fallback to plain clients
          const res = await fetch(`${base}/wifi/clients`, {
            cache: "no-store",
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          const list = normalizeClients(json);
          setClients(list);
          setSelectedIndex(0);
          const remaining = list.filter((c: any) => !c.category || !c.sensitivity);
          if (remaining.length === 0) setStep(6);
        });
    } else if (step === 4) {
      setSelectedIndex(0);
    } else if (step === 5) {
      setSelectedIndex(0);
    }
      else if (step === 6) {
      setSelectedIndex(0);
    }
  }, [step]);

  const categories = [
    "Smart Speaker",
    "Security & Monitoring",
    "Entertainment",
    "Personal Devices",
    "Appliance or Light",
    "Other/Unknown",
  ];

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
        <DeviceSelection
          clients={unconfiguredClients}
          selectedIndex={selectedIndex}
        />
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
    case 6: {
      const configured = clients.filter(c => c.category && c.sensitivity).length;
      const menu = ["Dashboard", "Restart setup"];
      content = (
        <HomeScreen
          total={clients.length}
          configured={configured}
          menu={menu}
          selectedIndex={selectedIndex}
          onActivate={(idx) => {
            if (idx === 0) setStep(7);
            else { setSelectedDevice(null); setSelectedIndex(0); setStep(0); }
          }}
        />
      );
      break;
    }
    case 7: {
      // Basic counts (adjust as you add real data)
      const online = clients.length;
      const blocked = 0; // TODO: wire to your /wifi/block state if available
      const cloud = 0;   // TODO: compute once you track "cloud-connected"
      const alerts = 0;  // TODO: wire to alerts source
      content = (
        <DashboardScreen
          online={online}
          blocked={blocked}
          cloud={cloud}
          alerts={alerts}
          onPrivacy={() => {/* TODO: navigate or open modal */}}
          onOnline={() => {/* TODO */}}
          onBlocked={() => {/* TODO */}}
          onCloud={() => {/* TODO */}}
          onAlerts={() => {/* TODO */}}
        />
      );
      break;
    }

    default:
      content = null;
      break;
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
 