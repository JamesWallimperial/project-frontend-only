"""Simple API exposing generic events via WebSocket and HTTP."""

from __future__ import annotations

from typing import Any, Literal
import logging
from pathlib import Path
import subprocess
import json, os, tempfile
from enum import Enum
import threading, time 
from src.devices.gpio import motor  

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.devices.gpio.leds import turn_off, turn_on
from src.api.clients import list_clients

_motor_guard_until: float = 0.0  # monotonic time until which we ignore encoder_2 rotates (motor is moving)


app = FastAPI()
log = logging.getLogger("api")

""" JSON store for per device metadata"""

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

connected: list[WebSocket] = []


class Event(BaseModel):
    """Representation of a generic event."""

    type: str
    device: str
    payload: Any


class LEDState(BaseModel):
    """Desired state of an LED."""

    on: bool


class MACAddress(BaseModel):
    """Identifier for a Wi-Fi client."""

    mac: str
    
class Sensitivity(BaseModel):
    """Data sensitivity / exposure level for a device."""
    sensitivity: Literal["high", "medium", "low"]

class Category(BaseModel):
    """Device category label chosen by the user."""
    category: str
    
class Exposure(BaseModel):
    # 1..5 cumulative exposure level
    level: int

EXPOSURE_LED_PINS = [
    int(os.getenv("EXPOSURE_LED1", "5")),   # LED1 (Green)
    int(os.getenv("EXPOSURE_LED2", "6")),   # LED2 (Green)
    int(os.getenv("EXPOSURE_LED3", "12")),  # LED3 (Amber)
    int(os.getenv("EXPOSURE_LED4", "13")),  # LED4 (Red)
    int(os.getenv("EXPOSURE_LED5", "26")),  # LED5 (Green)
]

_current_exposure_level = 1  # default on boot

class DeviceStatus(str, Enum):
    disconnected = "Disconnected"
    local        = "Local-only"
    online       = "Online"
    cloud        = "Cloud-Connected"

class StatusPayload(BaseModel):
    status: DeviceStatus

# ---- simple JSON store for per-device metadata ----
def _store_path() -> Path:
    default = Path(__file__).resolve().parents[2] / "data" / "devices.json"
    return Path(os.environ.get("DEVICE_STORE", str(default)))

def _load_store() -> dict[str, dict[str, Any]]:
    p = _store_path()
    if not p.exists():
        return {}
    try:
        data = json.loads(p.read_text())
    except Exception:
        return {}
    # Backfill defaults for older records
    for mac, rec in data.items():
        rec.setdefault("category", None)
        rec.setdefault("sensitivity", None)
        rec.setdefault("status", DeviceStatus.online.value)  # "Online"
    return data

def _atomic_write(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", delete=False, dir=path.parent) as tmp:
        json.dump(payload, tmp, indent=2, sort_keys=True)
        tmp.flush()
        os.fsync(tmp.fileno())
        tmp_name = tmp.name
    os.replace(tmp_name, path)

def _set_device_attrs(mac: str, **attrs) -> dict[str, Any]:
    mac = mac.lower()
    store = _load_store()
    record = store.get(mac, {})
    record.update(attrs)
    store[mac] = record
    _atomic_write(_store_path(), store)
    return record

def _get_device(mac: str) -> dict[str, Any] | None:
    return _load_store().get(mac.lower())

def _get_all_devices() -> dict[str, dict[str, Any]]:
    return _load_store()


def _enrich_clients(clients: list[dict[str, Any]]) -> list[dict[str, Any]]:
    store = _get_all_devices()
    enriched = []
    for c in clients:
        meta = store.get(c["mac"].lower(), {})
        enriched.append({
            **c,
            "category": meta.get("category"),
            "sensitivity": meta.get("sensitivity"),
            "status": meta.get("status", DeviceStatus.online.value),
        })
    return enriched
    
    

def _apply_exposure_leds(level: int) -> None:
    """Turn on the first N LEDs cumulatively; turn off the rest."""
    # clamp to [1,5]
    n = max(1, min(level, len(EXPOSURE_LED_PINS)))
    for idx, pin in enumerate(EXPOSURE_LED_PINS, start=1):
        if idx <= n:
            turn_on(pin)
        else:
            turn_off(pin)
            
            
def _count_statuses(store: dict[str, dict[str, Any]]) -> tuple[int, int, int]:
    """Return (local_only, online, cloud) counts."""
    local = online = cloud = 0
    for rec in store.values():
        s = rec.get("status", DeviceStatus.online.value)
        if s == DeviceStatus.local.value:
            local += 1
        elif s == DeviceStatus.cloud.value:
            cloud += 1
        elif s == DeviceStatus.online.value:
            online += 1
        # "Disconnected" not counted
    return local, online, cloud


def _exposure_from_counts(local: int, online: int, cloud: int) -> int:
    """
    Your rules:
      - cloud >= 4                      -> 5
      - cloud >= 1 (and <4)             -> 4
      - cloud == 0 and online > 3       -> 3
      - cloud == 0 and online >= 1      -> 2
      - cloud == 0 and online == 0      -> 1
    """
    if cloud >= 4:
        return 5
    if cloud >= 1:
        return 4
    if online > 3:
        return 3
    if online >= 1:
        return 2
    return 1


async def _broadcast_exposure(level: int) -> None:
    """Notify all UIs of the current exposure level."""
    msg = {"type": "exposure", "device": "server", "payload": level}
    for ws in list(connected):
        try:
            await ws.send_json(msg)
        except Exception:
            if ws in connected:
                connected.remove(ws)


def _rebalance_for_exposure(level: int, iface: str = "wlan0") -> None:
    """
    Update the stored status for currently connected clients based on exposure level.

    Policy (matches your spec):
      1 -> all Local-only
      2 -> 1 Online, rest Local-only (no Cloud)
      3 -> >3 Online (we'll pick up to 4), rest Local-only (no Cloud)
      4 -> 1 Cloud-Connected, rest Online
      5 -> >3 Cloud-Connected (we'll pick up to 4), rest Online
    """
    # who is connected right now
    assoc = list_clients(iface)  # [{mac, ip, ...}]
    macs = [c.get("mac", "").lower() for c in assoc if c.get("mac")]

    store = _load_store()

    def _set(mac: str, status: str) -> None:
        rec = store.get(mac, {})
        rec["status"] = status
        store[mac] = rec

    if level <= 1:
        # Level 1: everyone Local-only
        for mac in macs:
            _set(mac, DeviceStatus.local.value)

    elif level == 2:
        # Level 2: 1 Online, rest Local-only
        if macs:
            _set(macs[0], DeviceStatus.online.value)
            for mac in macs[1:]:
                _set(mac, DeviceStatus.local.value)

    elif level == 3:
        # Level 3: >3 Online (choose up to 4), rest Local-only
        n_online = min(4, len(macs))
        for mac in macs[:n_online]:
            _set(mac, DeviceStatus.online.value)
        for mac in macs[n_online:]:
            _set(mac, DeviceStatus.local.value)

    elif level == 4:
        # Level 4: 1 Cloud-Connected, rest Online
        if macs:
            _set(macs[0], DeviceStatus.cloud.value)
            for mac in macs[1:]:
                _set(mac, DeviceStatus.online.value)

    else:
        # Level 5: >3 Cloud-Connected (choose up to 4), rest Online
        n_cloud = min(4, len(macs))
        for mac in macs[:n_cloud]:
            _set(mac, DeviceStatus.cloud.value)
        for mac in macs[n_cloud:]:
            _set(mac, DeviceStatus.online.value)

    _atomic_write(_store_path(), store)
    
def _compute_exposure_from_clients(clients: list[dict[str, Any]]) -> int:
    cloud = sum(1 for c in clients if c.get("status") == DeviceStatus.cloud.value)
    online = sum(1 for c in clients if c.get("status") == DeviceStatus.online.value)
    # local-only / disconnected don’t affect the formula
    return _exposure_from_counts(0, online, cloud)


async def _update_exposure_from_clients_and_drive_motor(iface: str = "wlan0") -> int:
    """
    Merge live clients with stored meta, recompute exposure from fleet,
    update LEDs, move motor to match (with guard), and notify UIs.
    """
    global _current_exposure_level, _motor_guard_until

    merged = _enrich_clients(list_clients(iface))  # [{mac, ip, hostname, signal, status, ...}]
    new_level = _compute_exposure_from_clients(merged)
    prev = _current_exposure_level

    if new_level != prev:
        _current_exposure_level = new_level
        _apply_exposure_leds(new_level)

        # Move the dial physically
        delta = new_level - prev
        if delta != 0:
            try:
                threading.Thread(target=motor.move_levels, args=(delta,), daemon=True).start()
                _motor_guard_until = time.monotonic() + abs(delta) * (motor.step_seconds() + 0.10)
            except Exception as e:
                log.warning("Motor move failed; leaving dial as-is: %s", e)

        # Tell UIs exposure changed
        await _broadcast_exposure(new_level)

    # Nudge UIs that the meta distribution changed (safe even if level unchanged)
    ping = {"type": "devices_meta_updated", "device": "server", "payload": None}
    for ws in list(connected):
        try:
            await ws.send_json(ping)
        except Exception:
            if ws in connected:
                connected.remove(ws)

    return new_level
    
# ---- end store helpers ----

@app.websocket("/events")
async def events(ws: WebSocket) -> None:
    """WebSocket endpoint clients subscribe to for events."""
    await ws.accept()
    connected.append(ws)
    try:
        # Keep connection open; we do not care about messages from the client.
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if ws in connected:
            connected.remove(ws)



@app.post("/events")
async def emit_event(event: Event) -> dict[str, Any]:
    """HTTP endpoint to broadcast an event to all listeners."""
    payload: dict[str, Any] = event.dict()

    try:
        if event.device == "encoder_2":
            global _current_exposure_level, _motor_guard_until

            # Still ignore motor-generated rotation while dial is moving
            if event.type == "rotate" and time.monotonic() < _motor_guard_until:
                log.info("Ignoring encoder_2 rotate during motor guard window")
                return payload

            prev = _current_exposure_level
            

            if event.type == "rotate" and isinstance(event.payload, str):
                    p = event.payload.lower()
                    if p == "cw":
                        _current_exposure_level = min(_current_exposure_level + 1, 5)
                    elif p == "ccw":
                        _current_exposure_level = max(_current_exposure_level - 1, 1)
                        
                    # Update LEDs
                    _apply_exposure_leds(_current_exposure_level)
            
                    # ✅ Rebalance device statuses again (no motor here)
                    _rebalance_for_exposure(_current_exposure_level)
            
                    # Notify UIs
                    payload = {"type": "exposure", "device": "server", "payload": _current_exposure_level}
                    for ws in list(connected):
                        try:
                            await ws.send_json({"type": "devices_meta_updated", "device": "server", "payload": None})
                        except Exception:
                            if ws in connected: connected.remove(ws)

                            for ws in list(connected):
                                try:
                                    await ws.send_json({"type": "devices_meta_updated", "device": "server", "payload": None})
                                except Exception:
                                    if ws in connected:
                                        connected.remove(ws)

            elif event.type == "button" and str(event.payload).lower() in {"press", "click", "short", "down"}:
                # Optional: keep cycling exposure via button (still no motor)
                _current_exposure_level = 1 if _current_exposure_level >= 5 else _current_exposure_level + 1
                _apply_exposure_leds(_current_exposure_level)
                payload = {"type": "exposure", "device": "server", "payload": _current_exposure_level}

                for ws in list(connected):
                    try:
                        await ws.send_json({"type": "devices_meta_updated", "device": "server", "payload": None})
                    except Exception:
                        if ws in connected:
                            connected.remove(ws)

    except Exception as e:
        log.warning("encoder_2 exposure handling failed: %r", e)

    # Broadcast whatever payload we ended up with
    for ws in list(connected):
        try:
            await ws.send_json(payload)
        except Exception:
            if ws in connected:
                connected.remove(ws)

    return payload



@app.post("/devices/led/{pin}")
async def set_led(pin: int, state: LEDState) -> dict[str, Any]:
    """Switch an LED on or off."""
    if state.on:
        turn_on(pin)
    else:
        turn_off(pin)
    return {"pin": pin, "on": state.on}


@app.get("/wifi/clients")
async def wifi_clients(iface: str = "wlan0") -> list[dict[str, Any]]:
    """Return connected Wi-Fi clients (bare array for backward compatibility)."""
    items = list_clients(iface)
    log.info("HTTP /wifi/clients iface=%s returned=%d", iface, len(items))
    return items

@app.get("/wifi/clients_v2")
async def wifi_clients_v2(iface: str = "wlan0") -> dict[str, Any]:
    """Return clients wrapped as {'clients': [...]} for UIs that expect an object."""
    items = list_clients(iface)
    log.info("HTTP /wifi/clients_v2 iface=%s returned=%d", iface, len(items))
    return {"clients": items}

def _normalize(c: dict[str, Any]) -> dict[str, Any]:
    return {
        "macAddress": c.get("mac"),
        "ipAddress": c.get("ip"),
        "name": c.get("hostname"),
        "rssi": c.get("signal"),
    }

@app.get("/wifi/clients_ui")
async def wifi_clients_ui(iface: str = "wlan0") -> dict[str, Any]:
    """Return clients mapped to UI-friendly keys."""
    items = [ _normalize(c) for c in list_clients(iface) ]
    log.info("HTTP /wifi/clients_ui iface=%s returned=%d", iface, len(items))
    return {"clients": items}

def _wanctl() -> str:
    return str(Path(__file__).resolve().parents[2] / "scripts" / "wanctl")


@app.post("/wifi/block")
async def wifi_block(client: MACAddress) -> dict[str, Any]:
    """Block WAN access for a client.

    Requires elevated privileges because ``iptables`` needs root.
    """

    subprocess.run([_wanctl(), "block", client.mac], check=False)
    return {"mac": client.mac}


@app.post("/wifi/unblock")
async def wifi_unblock(client: MACAddress) -> dict[str, Any]:
    """Unblock WAN access for a client.

    Requires elevated privileges because ``iptables`` needs root.
    """

    subprocess.run([_wanctl(), "unblock", client.mac], check=False)
    return {"mac": client.mac}

@app.post("/devices/{mac}/category")
async def set_category(mac: str, payload: Category) -> dict[str, Any]:
    log.info("HTTP POST /devices/%s/category value=%s", mac, payload.category)
    record = _set_device_attrs(mac, category=payload.category)
    return {"mac": mac, **record}

@app.post("/devices/{mac}/sensitivity")
async def set_sensitivity(mac: str, payload: Sensitivity) -> dict[str, Any]:
    log.info("HTTP POST /devices/%s/sensitivity value=%s", mac, payload.sensitivity)
    record = _set_device_attrs(mac, sensitivity=payload.sensitivity)
    return {"mac": mac, **record}
    
    
@app.get("/devices/{mac}")
async def get_device(mac: str) -> dict[str, Any]:
    record = _get_device(mac) or {}
    return {"mac": mac, **record}
    
@app.get("/devices")
async def get_devices() -> dict[str, dict[str, Any]]:
    return _get_all_devices()
    
    
@app.get("/exposure")
async def get_exposure() -> dict[str, Any]:
    return {"level": _current_exposure_level}

@app.post("/exposure")
async def set_exposure(payload: Exposure) -> dict[str, Any]:
    global _current_exposure_level, _motor_guard_until
    prev = _current_exposure_level
    level = max(1, min(int(payload.level), 5))
    _current_exposure_level = level
    log.info("Set exposure level=%d", level)
    _apply_exposure_leds(level)
    _rebalance_for_exposure(level)

    delta = level - prev
    if delta != 0:
        threading.Thread(
            target=motor.move_levels, args=(delta,), daemon=True
        ).start()
        _motor_guard_until = time.monotonic() + abs(delta) * (motor.step_seconds() + 0.10)

    # broadcast so UIs can reflect change
    for ws in list(connected):
        try:
            await ws.send_json({"type": "exposure", "device": "server", "payload": level})
            await ws.send_json({"type": "devices_meta_updated", "device": "server", "payload": None})
        except Exception:
            if ws in connected:
                connected.remove(ws)
    return {"level": level}

@app.post("/devices/{mac}/status")
async def set_device_status(mac: str, payload: StatusPayload) -> dict[str, Any]:
    log.info("HTTP POST /devices/%s/status value=%s", mac, payload.status.value)
    record = _set_device_attrs(mac, status=payload.status.value)

    # Exposure becomes DERIVED from fleet status; update and rotate the dial here
    new_level = await _update_exposure_from_clients_and_drive_motor("wlan0")

    # Tell UIs that device meta/status changed
    for ws in list(connected):
        try:
            await ws.send_json({"type": "devices_meta_updated", "device": "server", "payload": None})
        except Exception:
            if ws in connected:
                connected.remove(ws)

    return {"mac": mac, **record, "exposure_level": new_level}

    
@app.get("/wifi/clients_with_meta")
async def wifi_clients_with_meta(iface: str = "wlan0") -> dict[str, Any]:
    items = list_clients(iface)
    merged = _enrich_clients(items)
    log.info("HTTP /wifi/clients_with_meta iface=%s returned=%d", iface, len(merged))
    return {"clients": merged}
