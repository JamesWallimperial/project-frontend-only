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

import CloudDevices from "./home/CloudDevices";

import LocalDevices from "./home/LocalDevices";

import DeviceStatusScreen from "./home/DeviceStatusScreen";
import HomeMenu from "./home/HomeMenu";

const USE_MOCKS = true;
import {
  getExposure,
  setExposure as mockSetExposure,          // optional, if you later wire it
  getClientsWithMeta,
  setDeviceStatus as mockSetDeviceStatus,
} from "./mocks/mockApi";

// ---- Device status constants/types (define BEFORE the interface) ----

const STATUS_OPTIONS = [

  "Disconnected",

  "Local-only",

  "Online",

  "Cloud-Connected",

] as const;

type DeviceStatusStr = typeof STATUS_OPTIONS[number];

// function recalcExposure(list: { status?: DeviceStatusStr }[]): number {
//   const st = (s?: DeviceStatusStr) => s ?? "Online";
//   const cloud  = list.filter(c => st(c.status) === "Cloud-Connected").length;
//   const online = list.filter(c => st(c.status) === "Online").length;

//   if (cloud >= 4) return 5;
//   if (cloud >= 1) return 4;
//   if (online > 3) return 3;
//   if (online >= 1) return 2;
//   return 1;
// }

// For mocks, mirror backend "rebalance" policy when exposure changes
// function applyPolicyForExposure(list: any[], level: number): any[] {
//   const copy = list.map(d => ({ ...d }));
//   const macs = copy.map(d => d.mac);
//   const set = (mac: string, status: DeviceStatusStr) => {
//     const i = copy.findIndex(c => c.mac === mac);
//     if (i >= 0) copy[i].status = status;
//   };
//   if (level <= 1) macs.forEach(m => set(m, "Local-only"));
//   else if (level === 2) { if (macs[0]) set(macs[0], "Online"); macs.slice(1).forEach(m => set(m, "Local-only")); }
//   else if (level === 3) { macs.slice(0, 4).forEach(m => set(m, "Online")); macs.slice(4).forEach(m => set(m, "Local-only")); }
//   else if (level === 4) { if (macs[0]) set(macs[0], "Cloud-Connected"); macs.slice(1).forEach(m => set(m, "Online")); }
//   else { macs.slice(0, 4).forEach(m => set(m, "Cloud-Connected")); macs.slice(4).forEach(m => set(m, "Online")); }
//   return copy;
// }

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

    status?: DeviceStatusStr; // <-- single, typed status

  }



  const [clients, setClients] = useState<WiFiClient[]>([]);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const [exposureLevel, setExposureLevel] = useState<number>(1);
  const [returnStep, setReturnStep] = useState<number>(7);



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



  // Treat missing status as Online (back-compat)

  const statusOf = (c: WiFiClient): DeviceStatusStr => c.status ?? "Online";



  const onlineList = clients.filter((c) => statusOf(c) === "Online");

  const cloudList = clients.filter((c) => statusOf(c) === "Cloud-Connected");

  const localList = clients.filter((c) => statusOf(c) === "Local-only");

  const homeMenuItems = [

    "Home Assistant",

    "Per Category Controls",

    "Scenes/Automation",

    "Activity Log",

    "Settings",

  ];

  // ----- API base URL (prefer env; fallback to port 8000 on current host) -----
  // function getApiBaseUrl(): string {
  //   const direct = (import.meta as any)?.env?.VITE_API_BASE_URL as
  //     | string
  //     | undefined;
  //   if (direct) return direct.replace(/\/+$/, "");
  //   const host =
  //     (import.meta as any)?.env?.VITE_API_HOST ||
  //     window.location.hostname ||
  //     "localhost";
  //   const port = (import.meta as any)?.env?.VITE_API_PORT || "8000";
  //   const proto = "http:";
  //   return `${proto}//${host}:${port}`;
  // }

  // Accept either [] or { clients: [...] }
  // function normalizeClients(raw: unknown) {
  //   if (Array.isArray(raw)) return raw as WiFiClient[];
  //   if (raw && typeof raw === "object" && Array.isArray((raw as any).clients)) {
  //     return (raw as any).clients as WiFiClient[];
  //   }
  //   return [] as WiFiClient[];
  // }

// === exposure: fetch initial level once ===

  // Load initial exposure + clients from mocks
  useEffect(() => {
    getExposure()
      .then(({ level }) => {
        if (typeof level === "number") {
          setExposureLevel(Math.max(1, Math.min(5, level)));
        }
      })
      .catch(() => {});

    getClientsWithMeta()
      .then(({ clients }) => {
        const list = Array.isArray(clients) ? clients : [];
        setClients(list);
        // no local recompute; mockApi derives exposure
      })
      .catch(() => {});
  }, []);




  // WebSocket input handling
  useEffect(() => {
    if (USE_MOCKS) return; 
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

            const clamped = Math.max(1, Math.min(5, lvl));

            setExposureLevel(clamped);

        

            // Re-fetch statuses because the server rebalances device states on exposure change

            const base = getApiBaseUrl();

            fetch(`${base}/wifi/clients_with_meta`, { cache: "no-store" })

              .then(r => r.ok ? r.json() : Promise.reject(r.status))

              .then(({ clients }) => setClients(Array.isArray(clients) ? clients : []))

              .catch(() => {});

          }

          return; // consume

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
              setClients(prev =>
                prev.map(c => c.mac === deviceName ? { ...c, category } : c)
              );
              setStep(prev => prev + 1); // -> step 5

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
              setClients((prev) => {
                const updated = prev.map((c) =>
                  c.mac === deviceName ? { ...c, sensitivity: chosen } : c
                );
                const remaining = updated.filter((c) => !c.category || !c.sensitivity);
                if (remaining.length > 0) {
                  setSelectedDevice(null);
                  setSelectedIndex(0);
                  setStep(3);
                } else {
                  setStep(6);
                }
                setExposureLevel(recalcExposure(updated));
                return updated;
              });
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

                   setStep(9);

                   break;

                 case 2: // Settings (bottom)

                   setStep(12);

                   break;

                 case 3: // Local-only (left)

                   setStep(10);

                   break;

                 default:

                   // Safety: clamp and try again

                   setSelectedIndex(0);

                   break;

               }

               return;

             }
           } else if (stepRef.current === 8) {

             // Online screen: 0 = Back, 1..N = devices

             const list = clientsRef.current.filter(c => (c.status ?? "Online") === "Online");

             const total = list.length + 1;

           

             const t = String(type || "").toLowerCase();

             const p = String(payload ?? "").toLowerCase();

           

             if (t === "rotate") {

               if (p === "cw")   setSelectedIndex(prev => (prev - 1 + total) % total);

               else if (p === "ccw") setSelectedIndex(prev => (prev + 1) % total);

               return;

             }

           

             const isPress = t === "button" && (p === "press" || p === "click" || p === "short" || p === "down");

             if (isPress) {

               const sel = selectedRef.current;

               if (sel === 0) {

                 setStep(7); // Back

               } else {

                 const chosen = list[sel - 1];

                 if (chosen) {

                   setSelectedDevice(chosen.mac);

                   setReturnStep(8);

                   setStep(11); // Device status picker

                 }

               }

               return;

             }


           } else if (stepRef.current === 9) {

             // Cloud screen: 0 = Back, 1..N = devices

             const list = clientsRef.current.filter(c => (c.status ?? "Online") === "Cloud-Connected");

             const total = list.length + 1;



             if (type === "rotate") {

               const dir = String(payload ?? "").toLowerCase();

               if (dir === "cw") setSelectedIndex((prev) => (prev - 1 + total) % total);

               else if (dir === "ccw") setSelectedIndex((prev) => (prev + 1) % total);

               return;

             }

           

             if (type === "button") {

               const press = String(payload ?? "").toLowerCase();

               const isPress = press === "press" || press === "click" || press === "short" || press === "down";

               if (isPress) {

                 const sel = selectedRef.current;

                 if (sel === 0) setStep(7); // Back

                 else {

                   const chosen = list[sel - 1];

                   if (chosen) {

                     setSelectedDevice(chosen.mac);

                     setReturnStep(9);     // back returns to Online

                     setStep(11);          // go to status picker

                   }

                 }

                 return;

               }

             }

           

           } else if (stepRef.current === 10) {

             // Local-only screen: 0 = Back, 1..N = devices

             const list = clientsRef.current.filter(c => (c.status ?? "Online") === "Local-only");

             const total = list.length + 1;

           

             if (type === "rotate") {

               const dir = String(payload ?? "").toLowerCase();

               if (dir === "cw") setSelectedIndex((prev) => (prev - 1 + total) % total);

               else if (dir === "ccw") setSelectedIndex((prev) => (prev + 1) % total);

               return;

             }

           

             if (type === "button") {

               const press = String(payload ?? "").toLowerCase();

               const isPress = press === "press" || press === "click" || press === "short" || press === "down";

               if (isPress) {

                 const sel = selectedRef.current;

                 if (sel === 0) setStep(7); // Back

                 else {

                   const chosen = list[sel - 1];

                   if (chosen) {

                     setSelectedDevice(chosen.mac);

                     setReturnStep(10);     // back returns to Online

                     setStep(11);          // go to status picker

                   }

                 }

                 return;

               }

             }
           } else if (stepRef.current === 11) {

             // Status picker: index 0 = Back, 1..4 = STATUS_OPTIONS[0..3]

             const total = STATUS_OPTIONS.length + 1;

           

             if (type === "rotate") {

               const dir = String(payload ?? "").toLowerCase();

               if (dir === "cw") {

                 setSelectedIndex((prev) => (prev - 1 + total) % total); // keep your reversed CW

               } else if (dir === "ccw") {

                 setSelectedIndex((prev) => (prev + 1) % total);

               }

               return;

             }

           

             if (type === "button") {

               const press = String(payload ?? "").toLowerCase();

               const isPress = press === "press" || press === "click" || press === "short" || press === "down";

               if (isPress) {

                 const sel = selectedRef.current;

                 if (sel === 0) {

                   // Back to the list we came from

                   setStep(returnStep);

                 } else {

                   const mac = selectedDeviceRef.current;

                   const chosen = STATUS_OPTIONS[sel - 1];

                   if (mac && chosen) {

                     mockSetDeviceStatus(mac, status)
                       .then(() => {
                         setClients(prev => {
                           const updated = prev.map(c => c.mac === mac ? { ...c, status } : c);
                           setExposureLevel(recalcExposure(updated));
                           return updated;
                         });
                         setSelectedDevice(null);
                         setSelectedIndex(0);
                         setStep(7);
                       })
                       .catch(err => console.error("Mock status save failed", err));

                   }

                 }

                 return;

               }

             }
           } else if (stepRef.current === 12) {

             // Home Menu screen:

             // index 0 = Back, 1..N = items from homeMenuItems[0..N-1]

             const total = homeMenuItems.length + 1;

           

             // Normalize event type/payload for this block

             const t = String(type || "").toLowerCase();

             const p = String(payload ?? "").toLowerCase();

           

             // Rotate to move selection (reversed CW per your UI)

             if (t === "rotate") {

               if (p === "cw") {

                 setSelectedIndex((prev) => (prev - 1 + total) % total);

               } else if (p === "ccw") {

                 setSelectedIndex((prev) => (prev + 1) % total);

               }

               return; // consume event

             }



             // Button press to activate selection

             const isPress =

               t === "button" && (p === "press" || p === "click" || p === "short" || p === "down");

           

             if (isPress) {

               const sel = selectedRef.current;

           

               if (sel === 0) {

                 // Back to Dashboard

                 setSelectedIndex(0);

                 setStep(7);

               } else {

                 // Activate chosen menu item (sel-1)

                 const label = homeMenuItems[sel - 1];

           

                 switch (label) {

                   case "Home Assistant":

                     setSelectedIndex(0);

                     setStep(2); // your existing HA step

                     break;



                   // Wire these to real screens later; for now return to dashboard

                   case "Per Category Controls":

                   case "Scenes/Automation":

                   case "Activity Log":

                   case "Settings":

                   default:

                     setSelectedIndex(0);

                     setStep(7);

                     break;

                 }

               }

               return; // consume event

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
      getClientsWithMeta()
         .then(({ clients }) => {
          const list = Array.isArray(clients) ? clients : [];
          setClients(list);
          setSelectedIndex(0);

          // optional recompute of exposure from loaded clients

          const remaining = list.filter((c: any) => !c.category || !c.sensitivity);
          if (remaining.length === 0) setStep(6);
        })
        .catch(() => {});
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

      setSelectedIndex( onlineList.length > 0 ? 1 : 0 );

    } else if (step === 9) {

      setSelectedIndex( cloudList.length > 0 ? 1 : 0 );

    } else if (step === 10) {

      setSelectedIndex( localList.length > 0 ? 1 : 0 );

    } else if (step === 11) {

     // default highlight = current status, otherwise "Online"

      const mac = selectedDevice;

      const dev = clients.find(c => c.mac === mac);

      const current = dev?.status ?? "Online";

      const idx = STATUS_OPTIONS.indexOf(current as DeviceStatusStr);

      setSelectedIndex(idx >= 0 ? idx + 1 : 1); // +1 because 0 is Back
    } else if (step === 12) {

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

  const handleExposureChange = async (level: number) => {
    const clamped = Math.max(1, Math.min(5, level));
    setExposureLevel(clamped);
  
    // Frontend-only path
    const { level: confirmed } = await mockSetExposure(clamped);
    setExposureLevel(confirmed);
  
    const { clients } = await getClientsWithMeta();
    setClients(Array.isArray(clients) ? clients : []);
  };


  
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

      const localOnly = localList.length;

      const online    = onlineList.length;

      const cloud     = cloudList.length;

      content = (

        <DashboardScreen

          localOnly={localOnly}

          online={online}

          cloud={cloud}

          exposureLevel={exposureLevel}

          selectedIndex={selectedIndex}          // 0..3 outer only

          onExposureChange={handleExposureChange}

          onActivate={(idx) => {

            switch (idx) {

              case 0: /* Online */ setStep(8); break;

              case 1: /* Cloud */ setStep(9); break;

              case 2: /* Settings */ setStep(12); break;

              case 3: /* Local-only */ setStep(10); break;

            }

          }}

        />

      );

      break;

    }
    case 8:
      content = (
        <OnlineDevices
          devices={onlineList}
          selectedIndex={selectedIndex}
          onBack={() => setStep(7)}
          onSelect={(mac) => {
            setSelectedDevice(mac);
            setReturnStep(8);   // return to Online list after status screen
            setSelectedIndex(0);
            setStep(11);        // go to DeviceStatusScreen
          }}
        />
      );
      break;

    case 9:
      content = (
        <CloudDevices
          devices={cloudList}
          selectedIndex={selectedIndex}
          onBack={() => setStep(7)}
          onSelect={(mac) => {
            setSelectedDevice(mac);
            setReturnStep(9);
            setSelectedIndex(0);
            setStep(11);
          }}
        />
      );
      break;

    

    case 10:
      content = (
        <LocalDevices
          devices={localList}
          selectedIndex={selectedIndex}
          onBack={() => setStep(7)}
          onSelect={(mac) => {
            setSelectedDevice(mac);
            setReturnStep(10);
            setSelectedIndex(0);
            setStep(11);
          }}
        />
      );
      break;

    default:
      content = null;
      break;
 
    case 11: {

      const mac = selectedDevice;

      const dev = clients.find(c => c.mac === mac);

      const label = dev?.hostname || dev?.mac || dev?.ip || "Device";

      const current = (dev?.status ?? "Online") as DeviceStatusStr;

    

      const onChoose = async (status: DeviceStatusStr) => {
        if (!mac) return;
      
        try {
          const { exposureLevel } = await mockSetDeviceStatus(mac, status);

          // Optimistic local device update for snappy UI
          setClients(prev =>
            prev.map(c => (c.mac === mac ? { ...c, status } : c))
          );

          // Trust mock’s derived exposure (preset match or fallback)
          setExposureLevel(Math.max(1, Math.min(5, exposureLevel)));

          setSelectedDevice(null);
          setSelectedIndex(0);
          setStep(returnStep);
        } catch (err) {
          console.error("Mock status save failed", err);
        }
      };




      content = (

        <DeviceStatusScreen

          deviceName={label}

          currentStatus={current}

          options={[...STATUS_OPTIONS]}

          selectedIndex={selectedIndex}

          onBack={() => setStep(returnStep)}

          onChoose={onChoose}

        />

      );

      break;

    }
    case 12:

      content = (

        <HomeMenu

          items={homeMenuItems}

          selectedIndex={selectedIndex}

          onBack={() => setStep(7)}

          onActivate={(idx) => {

            console.log("[HomeMenu] clicked", homeMenuItems[idx]);

            setSelectedIndex(0);

            setStep(7); // placeholder: back to dashboard after click

          }}

        />

      );

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
 
