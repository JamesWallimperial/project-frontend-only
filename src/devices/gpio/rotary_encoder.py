#!/usr/bin/env python3
import argparse
import json
import os
import time

import RPi.GPIO as GPIO
import requests


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="Rotary encoder event reporter")
    parser.add_argument("--pin-a", type=int, help="GPIO pin for encoder A (CLK)")
    parser.add_argument("--pin-b", type=int, help="GPIO pin for encoder B (DT)")
    parser.add_argument("--pin-sw", type=int, help="GPIO pin for push button (SW)")
    parser.add_argument("--device-id", help="Unique device identifier")
    parser.add_argument("--host", help="API host, e.g. http://localhost:8000")
    parser.add_argument("--config", help="Path to JSON config file")
    return parser.parse_args()

def main():
    args = parse_args()
    config = {}
    if args.config:
        with open(args.config) as f:
            config = json.load(f)

    pin_a = args.pin_a or config.get("pin_a", 17)
    pin_b = args.pin_b or config.get("pin_b", 27)
    pin_sw = args.pin_sw or config.get("pin_sw", 22)
    device_id = args.device_id or config.get("device_id")
    if not device_id:
        raise SystemExit("DEVICE_ID must be specified via --device-id or config")

    api_host = (
        args.host
        or config.get("host")
        or os.environ.get("API_HOST", "http://localhost:8000")
    )
    api_url = f"{api_host.rstrip('/')}/events"

    GPIO.setmode(GPIO.BCM)
    GPIO.setup(pin_a, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    GPIO.setup(pin_b, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    GPIO.setup(pin_sw, GPIO.IN, pull_up_down=GPIO.PUD_UP)

    last_a = GPIO.input(pin_a)
    last_state_sw = GPIO.HIGH  # assume idle HIGH

    def send_event(event_type, payload):
        """Send an event to the API."""
        data = {"type": event_type, "device": device_id, "payload": payload}
        try:
            requests.post(api_url, json=data, timeout=2)
        except Exception as e:
            print(f"{event_type} event error: {e}")

    print(
        f"Encoder {device_id} running. Rotate for CW/CCW, press button to send events. Ctrl+C to stop."
    )
    try:
        while True:
            # Poll for rotation (same as before)
            current_a = GPIO.input(pin_a)
            if last_a == GPIO.HIGH and current_a == GPIO.LOW:
                current_b = GPIO.input(pin_b)
                if current_b == GPIO.LOW:
                    print("ROTATE: CW - notifying API...")
                    send_event("rotate", "cw")
                else:
                    print("ROTATE: CCW - notifying API...")
                    send_event("rotate", "ccw")
            last_a = current_a

            # Poll for button press (toggle on press)
            current_state_sw = GPIO.input(pin_sw)
            if last_state_sw == GPIO.HIGH and current_state_sw == GPIO.LOW:
                print("BUTTON: PRESS - notifying API...")
                send_event("button", "press")
            elif last_state_sw == GPIO.LOW and current_state_sw == GPIO.HIGH:
                print("BUTTON: RELEASE")
            last_state_sw = current_state_sw

            time.sleep(0.005)  # fast poll for rotation
    except KeyboardInterrupt:
        pass
    finally:
        GPIO.cleanup()
        print("Clean exit.")

if __name__ == "__main__":
    main()
