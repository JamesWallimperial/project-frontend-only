"""Simple API exposing generic events via WebSocket and HTTP."""

from __future__ import annotations

from typing import Any
from pathlib import Path
import subprocess

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src.devices.gpio.leds import turn_off, turn_on
from src.api.clients import list_clients


app = FastAPI()

# Allow cross-origin requests so the web UI can connect during development.
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
async def wifi_clients() -> list[dict[str, Any]]:
    """Return connected Wi-Fi clients.

    Requires elevated privileges because ``iw`` needs root.
    """

    return list_clients()


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
