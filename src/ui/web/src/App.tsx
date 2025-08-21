import { useState, useEffect, useRef } from "react";
import Startup from "./startup/Startup";
import AccessPoint from "./setup/AccessPoint";
import HomeAssistant from "./setup/HomeAssistant";
import DeviceSelection from "./setup/DeviceSelection";
import CategorySelection from "./setup/CategorySelection";
import ExposureSelection, { SensitivityOption } from "./setup/ExposureSelection";
import HomeScreen from "./home/HomeScreen";
import DashboardScreen from "./home/DashboardScreen";
import OnlineDevices from "./home/OnlineDevices";

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
  const [exposureLevel, setExposureLevel] = useState<number>(1);

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

// === exposure: fetch initial level once ===

  useEffect(() => {

    const base = getApiBaseUrl();

    fetch(`${base}/exposure`)

      .then((r) => (r.ok ? r.json() : { level: 1 }))

      .then(({ level }) => {

        if (typeof level === "number") {

          setExposureLevel(Math.max(1, Math.min(5, level)));

        }

      })

      .catch(() => {});

  }, []);


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

     // --- keep the center bubble in sync with server/LED LEDs ---

        if (type === "exposure") {

          const lvl = Number(payload);

          if (Number.isFinite(lvl)) {

            setExposureLevel(Math.max(1, Math.min(5, lvl)));

          }

          return; // exposure updates don't affect the wizard flow

        }



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
                setSelectedIndex(prev => (prev - 1 + menuLen) % menuLen);
              } else if (payload === "ccw") {
                setSelectedIndex(prev => (prev + 1) % menuLen);
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
           } else if (stepRef.current === 7) {
             // OUTER bubbles only: 0=top(Online), 1=right(Cloud), 2=bottom(Settings), 3=left(Local)
             const total = 4;
           
             if (type === "rotate") {
               if (payload === "cw") {
                 setSelectedIndex((prev) => (prev - 1 + total) % total); // reversed nav
               } else if (payload === "ccw") {
                 setSelectedIndex((prev) => (prev + 1) % total);
               }
               return;
             }

             // Normalize button payloads from different firmwares
             const p = String(payload ?? "").toLowerCase();
             const isPress = type === "button" && (p === "press" || p === "click" || p === "short" || p === "down");

             if (isPress) {
               const idx = selectedRef.current; // 0..3
               // TEMP: debug log (remove after verifying)
               console.log("[step7] button press -> idx =", idx, "raw payload=", payload);

               switch (idx) {
                 case 0: // Online (top)
                   setStep(8);
                   break;
                 case 1: // Cloud (right)
                   // TODO: setStep(9) if/when you add a Cloud screen
                   break;
                 case 2: // Settings (bottom)
                   // TODO: open settings screen
                   break;
                 case 3: // Local-only (left)
                   // TODO: setStep(10) if/when you add Local-only screen
                   break;
                 default:
                   // Safety: clamp and try again
                   setSelectedIndex(0);
                   break;
               }
               return;
             }
           } else if (stepRef.current === 8) {
            // List of "online" devices; for now, all clients are online
             const list = clientsRef.current;
             const total = list.length + 1;
             if (total > 0 && type === "rotate") {
               if (payload === "cw") {
                 setSelectedIndex((prev) => (prev - 1 + total) % total); // using your reversed nav
               } else if (payload === "ccw") {
                 setSelectedIndex((prev) => (prev + 1) % total);
               }
             } else if (type === "button" && payload === "press") {
               const chosen = list[selectedRef.current];
               if (chosen) {
                 setSelectedDevice(chosen.mac);
                 // TODO: navigate to a device details screen if/when you add one
               }
             }
             if (type === "button") {
               const press = String(payload ?? "").toLowerCase();
               const isPress = press === "press" || press === "click" || press === "short" || press === "down";
               if (isPress) {
                 const sel = selectedRef.current;
                 if (sel === 0) {
                   // Back
                   setStep(7);
                 } else {
                   const chosen = list[sel - 1];
                   if (chosen) {
                     setSelectedDevice(chosen.mac);
                     // TODO: navigate to a device details screen if/when you add one
                   }
                 }
                 return;
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
      else if (step === 7) {

      setSelectedIndex(0);

    }
      else if (step === 8) {
      setSelectedIndex(1);
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
      const localOnly = 0;           // TODO real calc
      const online = clients.length; // placeholder
      const cloud = 0;               // TODO real calc
      content = (
        <DashboardScreen
          localOnly={localOnly}
          online={online}
          cloud={cloud}
          exposureLevel={exposureLevel}
          selectedIndex={selectedIndex}          // 0..3 outer only
          onActivate={(idx) => {
            switch (idx) {
              case 0: /* Online */ setStep(8); break;
              case 1: /* Cloud */ break;
              case 2: /* Settings */ break;
              case 3: /* Local-only */ break;
            }
          }}
        />
      );
      break;
    }
    case 8:
      content = (
        <OnlineDevices
          devices={clients}          // clients are the currently online devices
          selectedIndex={selectedIndex}
          onBack={() => setStep(7)}
        />
      );
      break;

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
 