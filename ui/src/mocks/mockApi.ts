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
// Bump key to force a clean reseed after we add presets
const LS_KEY = "mockApi.db.v2";

type DB = {
  clients: WiFiClient[];
  // exposure is derived from clients; we cache it for convenience
  exposureLevel: number; // 1..5
};

// ==== HOSTNAME PRESETS (your exact mapping) ====
// For any device not named here, we'll ignore it when matching a level,
// and default it to "Local-only" when applying a preset.
const LEVEL_PRESETS: Record<
  number,
  { local: string[]; online: string[]; cloud: string[] }
> = {
  1: {
    local: [
      "HomePod",
      "tapo-cam-front",
      "tv-lounge",
      "roomba",
      "Alans iPhone",
      "Lucys iPhone",
      "Peters iPhone",
      "Work Laptop",
    ],
    online: [],
    cloud: [],
  },
  2: {
    local: ["Peters iPhone", "roomba", "tapo-cam-front", "Work Laptop", "HomePod"],
    online: ["tv-lounge", "Alans iPhone", "Lucys iPhone"],
    cloud: [],
  },
  3: {
    local: ["roomba", "tapo-cam-front", "Work Laptop"],
    online: ["Peters iPhone", "Alans iPhone", "Lucys iPhone", "tv-lounge", "HomePod"],
    cloud: [],
  },
  4: {
    local: ["roomba", "tv-lounge"],
    online: ["Peters iPhone", "Alans iPhone", "Lucys iPhone", "tapo-cam-front"],
    cloud: ["Work Laptop", "HomePod"],
  },
  5: {
    local: ["Work Laptop"],
    online: ["Peters iPhone", "Alans iPhone", "Lucys iPhone"],
    cloud: ["roomba", "tv-lounge", "HomePod", "tapo-cam-front"],
  },
};

// ---- DB helpers ----
function loadDB(): DB {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed: DB = JSON.parse(raw);
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
  // (same starter set you showed, any initial statuses are fine—they’ll be
  // overridden by the preset once we derive exposure)
  const clients: WiFiClient[] = [
    {
      mac: "AA:BB:CC:DD:EE:01",
      ip: "10.0.0.101",
      hostname: "HomePod",
      signal: -48,
      category: "Smart Speaker",
      sensitivity: "medium",
      status: "Online",
    },
    {
      mac: "AA:BB:CC:DD:EE:02",
      ip: "10.0.0.102",
      hostname: "tapo-cam-front",
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
      sensitivity: "medium",
      status: "Cloud-Connected",
    },
    {
      mac: "AA:BB:CC:DD:EE:09",
      ip: "10.0.0.105",
      hostname: "Lucys iPhone",
      signal: -70,
      category: "Personal Devices",
      sensitivity: "medium",
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

  // Set initial exposure to the closest preset level the current statuses match
  const exposure = chooseLevelFromCurrent(clients) ?? deriveExposureFromCounts(clients);
  return { clients, exposureLevel: exposure };
}

// ---- Matching / derivation helpers ----
function clamp(min: number, max: number, n: number) {
  return Math.max(min, Math.min(max, n));
}

// Fallback count rule (used if we don't match a named preset exactly)
function deriveExposureFromCounts(clients: WiFiClient[]) {
  let local = 0,
    online = 0,
    cloud = 0;
  for (const c of clients) {
    const s = c.status ?? "Online";
    if (s === "Cloud-Connected") cloud++;
    else if (s === "Online") online++;
    else if (s === "Local-only") local++;
  }
  if (cloud >= 4) return 5;
  if (cloud >= 1) return 4;
  if (online > 3) return 3;
  if (online >= 1) return 2;
  return 1;
}

// Try to find a preset level that matches the CURRENT device statuses.
// We match only devices we know about in the preset; devices not present
// in the preset are ignored for matching (so you can add extras if needed).
function chooseLevelFromCurrent(clients: WiFiClient[]): number | null {
  const byName = new Map(clients.map((c) => [c.hostname, c.status ?? "Online"]));
  for (let level = 1; level <= 5; level++) {
    const preset = LEVEL_PRESETS[level];
    let ok = true;

    for (const h of preset.local) {
      if (byName.get(h) !== "Local-only") {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    for (const h of preset.online) {
      if (byName.get(h) !== "Online") {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    for (const h of preset.cloud) {
      if (byName.get(h) !== "Cloud-Connected") {
        ok = false;
        break;
      }
    }
    if (ok) return level;
  }
  return null;
}

// Apply a preset to ALL known clients.
// Devices not listed in the preset are set to Local-only by default.
function applyPresetForExposure(db: DB, level: number) {
  const preset = LEVEL_PRESETS[level] ?? LEVEL_PRESETS[1];
  const toStatus = new Map<string, DeviceStatusStr>();

  for (const h of preset.local) toStatus.set(h, "Local-only");
  for (const h of preset.online) toStatus.set(h, "Online");
  for (const h of preset.cloud) toStatus.set(h, "Cloud-Connected");

  db.clients = db.clients.map((c) => {
    const s = toStatus.get(c.hostname) ?? "Local-only";
    return { ...c, status: s };
  });

  db.exposureLevel = level;
}

// ---- Public API (Promise-based to mimic network) ----
export async function getClientsWithMeta(): Promise<{ clients: WiFiClient[] }> {
  const db = loadDB();
  // keep exposure derived from clients (prefer preset match; else counts)
  db.exposureLevel =
    chooseLevelFromCurrent(db.clients) ?? deriveExposureFromCounts(db.clients);
  saveDB(db);
  return wait({ clients: db.clients });
}

export async function setDeviceStatus(
  mac: string,
  status: DeviceStatusStr
): Promise<{ ok: true; exposureLevel: number }> {
  const db = loadDB();
  const idx = db.clients.findIndex(
    (c) => c.mac.toLowerCase() === mac.toLowerCase()
  );
  if (idx >= 0) {
    db.clients[idx] = { ...db.clients[idx], status };
  }
  // After individual change, try to recognize a preset first,
  // otherwise fall back to counts.
  db.exposureLevel =
    chooseLevelFromCurrent(db.clients) ?? deriveExposureFromCounts(db.clients);
  saveDB(db);
  return wait({ ok: true, exposureLevel: db.exposureLevel });
}

export async function getExposure(): Promise<{ level: number }> {
  const db = loadDB();
  db.exposureLevel =
    chooseLevelFromCurrent(db.clients) ?? deriveExposureFromCounts(db.clients);
  saveDB(db);
  return wait({ level: db.exposureLevel });
}

export async function setExposure(level: number): Promise<{ level: number }> {
  const db = loadDB();
  const clamped = clamp(1, 5, Number(level) || 1);
  applyPresetForExposure(db, clamped);
  saveDB(db);
  return wait({ level: db.exposureLevel });
}

// Small utility to simulate latency
function wait<T>(value: T, ms = 120): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
