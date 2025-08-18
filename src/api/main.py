"""Simple API exposing button events via WebSocket and HTTP."""

from __future__ import annotations

from typing import List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()

# Allow cross-origin requests so the web UI can connect during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

connected: List[WebSocket] = []


@app.websocket("/events/button")
async def button_events(ws: WebSocket) -> None:
    """WebSocket endpoint clients subscribe to for button events."""
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


@app.post("/events/button")
async def emit_button_event() -> dict[str, str]:
    """HTTP endpoint to broadcast a 'next' event to all listeners."""
    payload = {"event": "next"}
    for ws in list(connected):
        try:
            await ws.send_json(payload)
        except Exception:
            if ws in connected:
                connected.remove(ws)
    return payload
