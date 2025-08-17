#!/usr/bin/env python3
import time
import subprocess
import RPi.GPIO as GPIO

# BCM pins (adjust if different)
PIN_A = 17   # Encoder A (CLK)
PIN_B = 27   # Encoder B (DT)
PIN_SW = 22  # Push button (SW)

# Absolute paths for Tapo toggle
VENV_PY = "/home/jwall/project-root/tapoenv/bin/python3"
TOGGLE_SCRIPT = "/home/jwall/project-root/src/devices/tapo/tapo_toggle.py"

def run_toggle():
    try:
        out = subprocess.check_output([VENV_PY, TOGGLE_SCRIPT], text=True, timeout=10)
        print(out.strip())  # Prints "Tapo: toggled ON/OFF"
    except Exception as e:
        print(f"Toggle error: {e}")

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
                print("BUTTON: PRESS - Toggling Tapo...")
                run_toggle()
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
