# src/devices/gpio/motor.py
from __future__ import annotations
import time
import threading

try:
    import RPi.GPIO as GPIO
    HW = True
except Exception:
    # Dev box fallback
    HW = False

# === Pinout (BCM) ===
IN1 = 25  # L298N IN1
IN2 = 8   # L298N IN2
PWM_FREQ_HZ = 200

# === Motion tuning ===
POWER_DUTY = 16      # 0..100; adjust for torque / noise
STEP_SECONDS = 0.20  # how long to pulse per "one exposure level"

# If the direction is inverted on your hardware, flip this flag
INVERT_DIRECTION = False

_lock = threading.Lock()
_initialized = False
_pwm1 = None
_pwm2 = None

def _ensure_setup():
    global _initialized, _pwm1, _pwm2
    if _initialized:
        return
    if not HW:
        _initialized = True
        return
    GPIO.setwarnings(False)
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(IN1, GPIO.OUT, initial=GPIO.LOW)
    GPIO.setup(IN2, GPIO.OUT, initial=GPIO.LOW)
    _pwm1 = GPIO.PWM(IN1, PWM_FREQ_HZ)
    _pwm2 = GPIO.PWM(IN2, PWM_FREQ_HZ)
    _pwm1.start(0)
    _pwm2.start(0)
    _initialized = True

def _both_low():
    if not HW:
        return
    GPIO.output(IN1, GPIO.LOW)
    GPIO.output(IN2, GPIO.LOW)

def nudge(direction: str, power: int = POWER_DUTY, duration: float = STEP_SECONDS):
    """
    Pulse the motor briefly in 'up' or 'down' direction.
    """
    _ensure_setup()
    with _lock:
        if not HW:
            print(f"[motor] nudge({direction}) power={power} duration={duration}")
            time.sleep(duration)
            return

        up = (direction.lower() in ("up", "cw", "+"))
        if INVERT_DIRECTION:
            up = not up

        # One side PWM, the other held LOW
        if up:
            GPIO.output(IN2, GPIO.LOW)
            _pwm1.ChangeDutyCycle(max(0, min(100, power)))
            time.sleep(duration)
            _pwm1.ChangeDutyCycle(0)
        else:
            GPIO.output(IN1, GPIO.LOW)
            _pwm2.ChangeDutyCycle(max(0, min(100, power)))
            time.sleep(duration)
            _pwm2.ChangeDutyCycle(0)

        _both_low()

def move_levels(delta: int, power: int = POWER_DUTY, per_step: float = STEP_SECONDS, pause: float = 0.05):
    """
    Move |delta| exposure steps: positive = 'up', negative = 'down'.
    """
    if delta == 0:
        return
    direction = "up" if delta > 0 else "down"
    for _ in range(abs(delta)):
        nudge(direction, power=power, duration=per_step)
        if pause > 0:
            time.sleep(pause)

def cleanup():
    if not HW:
        return
    with _lock:
        try:
            _both_low()
        finally:
            try:
                if _pwm1: _pwm1.stop()
                if _pwm2: _pwm2.stop()
            except Exception:
                pass
            GPIO.cleanup()

# A tiny helper for guards in callers
def step_seconds() -> float:
    return STEP_SECONDS

if __name__ == "__main__":
    # Quick manual test:
    print("Nudging down, then up...")
    nudge("down")
    time.sleep(0.5)
    nudge("up")
    cleanup()
