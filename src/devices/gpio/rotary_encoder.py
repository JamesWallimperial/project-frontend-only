#!/usr/bin/env python3
"""Rotary encoder watcher utilities.

This module provides classes to spawn one or more rotary encoder watchers
that report events to the API. Each watcher is responsible for a single
encoder and posts events using its configured ``device_id``.

Example configuration JSON::

    {
        "host": "http://localhost:8000",
        "encoders": [
            {"pin_a": 17, "pin_b": 27, "pin_sw": 22, "device_id": "encoder_1"},
            {"pin_a": 23, "pin_b": 24, "pin_sw": 25, "device_id": "encoder_2"}
        ]
    }

Run with ``python rotary_encoder.py --config config.json`` to start all
encoders defined in the configuration.

Alternatively, pass one or more ``--pin-a``, ``--pin-b``, ``--pin-sw`` and
``--device-id`` arguments to configure encoders directly on the command line.
"""

from __future__ import annotations

import argparse
import json
import os
import threading
import time
from typing import Iterable

import RPi.GPIO as GPIO
import requests


class RotaryEncoderWatcher(threading.Thread):
    """Background thread that watches a single rotary encoder."""

    def __init__(self, pin_a: int, pin_b: int, pin_sw: int, device_id: str, api_url: str) -> None:
        super().__init__(daemon=True)
        self.pin_a = pin_a
        self.pin_b = pin_b
        self.pin_sw = pin_sw
        self.device_id = device_id
        self.api_url = api_url
        self._stop = threading.Event()

    # ------------------------------------------------------------------
    def send_event(self, event_type: str, payload: str) -> None:
        """Send an event to the API."""

        data = {
            "type": event_type,
            "device_id": self.device_id,
            "payload": payload,
        }
        try:
            requests.post(self.api_url, json=data, timeout=2)
        except Exception as exc:  # pragma: no cover - network/hardware dependent
            print(f"{self.device_id} {event_type} event error: {exc}")

    # ------------------------------------------------------------------
    def stop(self) -> None:
        """Signal the watcher to stop."""

        self._stop.set()

    # ------------------------------------------------------------------
    def run(self) -> None:  # pragma: no cover - hardware dependent
        GPIO.setup(self.pin_a, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(self.pin_b, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(self.pin_sw, GPIO.IN, pull_up_down=GPIO.PUD_UP)

        last_a = GPIO.input(self.pin_a)
        last_state_sw = GPIO.HIGH

        print(
            f"Encoder {self.device_id} running on A={self.pin_a} B={self.pin_b} SW={self.pin_sw}"
        )
        try:
            while not self._stop.is_set():
                current_a = GPIO.input(self.pin_a)
                if last_a == GPIO.HIGH and current_a == GPIO.LOW:
                    current_b = GPIO.input(self.pin_b)
                    if current_b == GPIO.LOW:
                        print(f"{self.device_id}: ROTATE CW")
                        self.send_event("rotate", "cw")
                    else:
                        print(f"{self.device_id}: ROTATE CCW")
                        self.send_event("rotate", "ccw")
                last_a = current_a

                current_state_sw = GPIO.input(self.pin_sw)
                if last_state_sw == GPIO.HIGH and current_state_sw == GPIO.LOW:
                    print(f"{self.device_id}: BUTTON PRESS")
                    self.send_event("button", "press")
                elif last_state_sw == GPIO.LOW and current_state_sw == GPIO.HIGH:
                    print(f"{self.device_id}: BUTTON RELEASE")
                last_state_sw = current_state_sw

                time.sleep(0.005)
        finally:
            # Cleanup is handled globally once all watchers stop.
            pass


class EncoderFactory:
    """Factory that spawns ``RotaryEncoderWatcher`` instances."""

    def __init__(self, api_host: str) -> None:
        self.api_url = f"{api_host.rstrip('/')}/events"
        GPIO.setmode(GPIO.BCM)
        self.watchers: list[RotaryEncoderWatcher] = []

    # ------------------------------------------------------------------
    def spawn(self, encoder_configs: Iterable[dict[str, int | str]]) -> list[RotaryEncoderWatcher]:
        """Create and start watchers for each encoder configuration."""

        for cfg in encoder_configs:
            device_id = cfg.get("device_id")
            pin_a = cfg.get("pin_a")
            pin_b = cfg.get("pin_b")
            pin_sw = cfg.get("pin_sw")
            if None in (device_id, pin_a, pin_b, pin_sw):
                raise ValueError("Encoder config requires pin_a, pin_b, pin_sw and device_id")

            watcher = RotaryEncoderWatcher(int(pin_a), int(pin_b), int(pin_sw), str(device_id), self.api_url)
            watcher.start()
            self.watchers.append(watcher)
        return self.watchers

    # ------------------------------------------------------------------
    def stop_all(self) -> None:
        """Stop all active watchers."""

        for watcher in self.watchers:
            watcher.stop()
        for watcher in self.watchers:
            watcher.join()


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""

    parser = argparse.ArgumentParser(description="Rotary encoder event reporter")
    parser.add_argument("--config", help="Path to JSON config file")
    parser.add_argument("--host", help="API host name, e.g. api.example.com")
    parser.add_argument("--port", help="API port, e.g. 8000")
    parser.add_argument("--pin-a", type=int, action="append", dest="pin_a")
    parser.add_argument("--pin-b", type=int, action="append", dest="pin_b")
    parser.add_argument("--pin-sw", type=int, action="append", dest="pin_sw")
    parser.add_argument("--device-id", action="append", dest="device_id")
    return parser.parse_args()


def load_config(path: str | None) -> dict:
    """Load a JSON configuration file."""

    if not path:
        return {}
    with open(path) as f:
        return json.load(f)


def main() -> None:  # pragma: no cover - hardware dependent
    args = parse_args()
    config = load_config(args.config)

    env_host = os.environ.get("API_HOST", "localhost")
    env_port = os.environ.get("API_PORT", "8000")

    host = args.host or config.get("host") or env_host
    port = args.port or config.get("port") or env_port

    if host.startswith("http://") or host.startswith("https://"):
        api_host = host.rstrip("/")
    else:
        api_host = f"http://{host}:{port}"

    encoders_cfg: list[dict[str, int | str]]
    if args.pin_a and args.pin_b and args.pin_sw and args.device_id:
        counts = {len(args.pin_a), len(args.pin_b), len(args.pin_sw), len(args.device_id)}
        if len(counts) != 1:
            raise SystemExit("Pin and device-id arguments must be provided in equal numbers")
        encoders_cfg = [
            {
                "pin_a": pa,
                "pin_b": pb,
                "pin_sw": psw,
                "device_id": did,
            }
            for pa, pb, psw, did in zip(
                args.pin_a, args.pin_b, args.pin_sw, args.device_id
            )
        ]
    else:
        encoders_cfg = config.get("encoders", [])

    if not encoders_cfg:
        raise SystemExit("No encoder configuration provided")

    factory = EncoderFactory(api_host)
    factory.spawn(encoders_cfg)

    print("Encoders running. Ctrl+C to stop.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        factory.stop_all()
        GPIO.cleanup()
        print("Clean exit.")


if __name__ == "__main__":  # pragma: no cover - CLI entry
    main()

