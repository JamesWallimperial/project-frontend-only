"""Simple API exposing generic events via WebSocket and HTTP."""

from __future__ import annotations

from typing import Any, Literal
import logging
from pathlib import Path
import subprocess
import json, os, tempfile

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.devices.gpio.leds import turn_off, turn_on
from src.api.clients import list_clients


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

# ---- simple JSON store for per-device metadata ----
def _store_path() -> Path:
    default = Path(__file__).resolve().parents[2] / "data" / "devices.json"
    return Path(os.environ.get("DEVICE_STORE", str(default)))

def _load_store() -> dict[str, dict[str, Any]]:
    p = _store_path()
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text())
    except Exception:
        return {}

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
        enriched.append({**c, **{k: v for k, v in meta.items() if k in ("category", "sensitivity")}})
    return enriched
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
    payload = event.dict()
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
    
    
@app.get("/wifi/clients_with_meta")
async def wifi_clients_with_meta(iface: str = "wlan0") -> dict[str, Any]:
    items = list_clients(iface)
    merged = _enrich_clients(items)
    log.info("HTTP /wifi/clients_with_meta iface=%s returned=%d", iface, len(merged))
    return {"clients": merged}
