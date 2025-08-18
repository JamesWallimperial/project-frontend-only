#!/usr/bin/env python3
import time
import requests
import RPi.GPIO as GPIO

# BCM pins (adjust if different)
PIN_A = 17   # Encoder A (CLK)
PIN_B = 27   # Encoder B (DT)
PIN_SW = 22  # Push button (SW)

# API endpoint to notify of button presses
API_URL = "http://localhost:8000/events/button"


def send_button_event():
    """Notify the API that the button was pressed."""
    try:
        requests.post(API_URL, timeout=2)
    except Exception as e:
        print(f"Button event error: {e}")

def main():
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(PIN_A, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    GPIO.setup(PIN_B, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    GPIO.setup(PIN_SW, GPIO.IN, pull_up_down=GPIO.PUD_UP)

    last_a = GPIO.input(PIN_A)
    last_state_sw = GPIO.HIGH  # assume idle HIGH

    print("Encoder + Tapo control running. Rotate for CW/CCW, press button to toggle Tapo. Ctrl+C to stop.")
    try:
        while True:
            # Poll for rotation (same as before)
            current_a = GPIO.input(PIN_A)
            if last_a == GPIO.HIGH and current_a == GPIO.LOW:
                current_b = GPIO.input(PIN_B)
                if current_b == GPIO.LOW:
                    print("ROTATE: CW")
                else:
                    print("ROTATE: CCW")
            last_a = current_a

            # Poll for button press (toggle on press)
            current_state_sw = GPIO.input(PIN_SW)
            if last_state_sw == GPIO.HIGH and current_state_sw == GPIO.LOW:
                print("BUTTON: PRESS - notifying API...")
                send_button_event()
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
