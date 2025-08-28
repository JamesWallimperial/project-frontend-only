// ui/src/mocks/mockApi.ts

// ---- Types (kept simple to match App.tsx) ----
export type DeviceStatusStr =
  | "Disconnected"
  | "Local-only"
  | "Online"
  | "Cloud-Connected";

export interface WiFiClient {
  ip: string;
  mac: string;
  hostname: string;
  signal?: number | null;
  category?: string;
  sensitivity?: "high" | "medium" | "low";
  status?: DeviceStatusStr;
}

// ---- LocalStorage-backed mock DB ----
const LS_KEY = "mockApi.db.v1";

type DB = {
  clients: WiFiClient[];
  // exposure is derived from clients; we cache it for convenience
  exposureLevel: number; // 1..5
};

function loadDB(): DB {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed: DB = JSON.parse(raw);
      // ensure types
      if (Array.isArray(parsed.clients)) {
        parsed.exposureLevel = clamp(1, 5, Number(parsed.exposureLevel) || 1);
        return parsed;
      }
    }
  } catch {}
  const seeded: DB = seedDB();
  saveDB(seeded);
  return seeded;
}

function saveDB(db: DB) {
  localStorage.setItem(LS_KEY, JSON.stringify(db));
}

function seedDB(): DB {
  const clients: WiFiClient[] = [
    {
      mac: "AA:BB:CC:DD:EE:01",
      ip: "10.0.0.101",
      hostname: "kitchen-speaker",
      signal: -48,
      category: "Smart Speaker",
      sensitivity: "medium",
      status: "Online",
    },
    {
      mac: "AA:BB:CC:DD:EE:02",
      ip: "10.0.0.102",
      hostname: "nest-cam-front",
      signal: -61,
      category: "Security & Monitoring",
      sensitivity: "high",
      status: "Cloud-Connected",
    },
    {
      mac: "AA:BB:CC:DD:EE:03",
      ip: "10.0.0.103",
      hostname: "tv-lounge",
      signal: -55,
      category: "Entertainment",
      sensitivity: "low",
      status: "Online",
    },
    {
      mac: "AA:BB:CC:DD:EE:04",
      ip: "10.0.0.104",
      hostname: "roomba",
      signal: -67,
      category: "Appliance or Light",
      sensitivity: "medium",
      status: "Local-only",
    },
    {
      mac: "AA:BB:CC:DD:EE:05",
      ip: "10.0.0.105",
      hostname: "Alans iPhone",
      signal: -70,
      category: "Personal Devices",
      sensitivity: "high",
      status: "Cloud-Connected",
    },
    {
      mac: "AA:BB:CC:DD:EE:09",
      ip: "10.0.0.105",
      hostname: "Lucys iPhone",
      signal: -70,
      category: "Personal Devices",
      sensitivity: "high",
      status: "Cloud-Connected",
    },
        {
      mac: "AA:BB:CC:DD:EE:06",
      ip: "10.0.0.106",
      hostname: "Peters iPhone",
      signal: -80,
      category: "Childrens Devices",
      sensitivity: "high",
      status: "Cloud-Connected",
    },
        {
      mac: "AA:BB:CC:DD:EE:07",
      ip: "10.0.0.105",
      hostname: "Work Laptop",
      signal: -90,
      category: "Personal Devices",
      sensitivity: "high",
      status: "Cloud-Connected",
    },
  ];

  const { exposure } = countAndDeriveExposure(clients);
  return { clients, exposureLevel: exposure };
}

// ---- Helpers ----
function clamp(min: number, max: number, n: number) {
  return Math.max(min, Math.min(max, n));
}

function countAndDeriveExposure(clients: WiFiClient[]) {
  let local = 0,
    online = 0,
    cloud = 0;
  for (const c of clients) {
    const s = c.status ?? "Online";
    if (s === "Cloud-Connected") cloud++;
    else if (s === "Online") online++;
    else if (s === "Local-only") local++;
    // "Disconnected" not counted
  }

  // Your rules:
  // - cloud >= 4                      -> 5
  // - cloud >= 1 (and <4)             -> 4
  // - cloud == 0 and online > 3       -> 3
  // - cloud == 0 and online >= 1      -> 2
  // - cloud == 0 and online == 0      -> 1
  let exposure = 1;
  if (cloud >= 4) exposure = 5;
  else if (cloud >= 1) exposure = 4;
  else if (online > 3) exposure = 3;
  else if (online >= 1) exposure = 2;
  else exposure = 1;

  return { local, online, cloud, exposure };
}

function rebalanceForExposure(db: DB, level: number) {
  // Keep the same order, just adjust statuses
  const list = db.clients.slice();

  if (level <= 1) {
    // 1 -> all Local-only
    for (const c of list) c.status = "Local-only";
  } else if (level === 2) {
    // 2 -> 1 Online, rest Local-only
    list.forEach((c, i) => (c.status = i === 0 ? "Online" : "Local-only"));
  } else if (level === 3) {
    // 3 -> >3 Online (up to 4), rest Local-only
    list.forEach((c, i) => (c.status = i < 4 ? "Online" : "Local-only"));
  } else if (level === 4) {
    // 4 -> 1 Cloud-Connected, rest Online
    list.forEach((c, i) => (c.status = i === 0 ? "Cloud-Connected" : "Online"));
  } else {
    // 5 -> >3 Cloud-Connected (up to 4), rest Online
    list.forEach((c, i) => (c.status = i < 4 ? "Cloud-Connected" : "Online"));
  }

  db.clients = list;
  db.exposureLevel = clamp(1, 5, level);
}

// ---- Public API (Promise-based to mimic network) ----
export async function getClientsWithMeta(): Promise<{ clients: WiFiClient[] }> {
  const db = loadDB();
  // keep exposure derived from clients
  db.exposureLevel = countAndDeriveExposure(db.clients).exposure;
  saveDB(db);
  return wait({ clients: db.clients });
}

export async function setDeviceStatus(
  mac: string,
  status: DeviceStatusStr
): Promise<{ ok: true; exposureLevel: number }> {
  const db = loadDB();
  const idx = db.clients.findIndex((c) => c.mac.toLowerCase() === mac.toLowerCase());
  if (idx >= 0) {
    db.clients[idx] = { ...db.clients[idx], status };
    // derive exposure after individual change
    db.exposureLevel = countAndDeriveExposure(db.clients).exposure;
    saveDB(db);
  }
  return wait({ ok: true, exposureLevel: db.exposureLevel });
}

export async function getExposure(): Promise<{ level: number }> {
  const db = loadDB();
  // ensure derived & synced
  db.exposureLevel = countAndDeriveExposure(db.clients).exposure;
  saveDB(db);
  return wait({ level: db.exposureLevel });
}

export async function setExposure(level: number): Promise<{ level: number }> {
  const db = loadDB();
  const clamped = clamp(1, 5, Number(level) || 1);
  rebalanceForExposure(db, clamped);
  // After rebalance, exposure should match requested level (by definition)
  saveDB(db);
  return wait({ level: db.exposureLevel });
}

// Small utility to simulate latency
function wait<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
