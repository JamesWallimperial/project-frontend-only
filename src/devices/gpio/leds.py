"""Simple helpers to control LEDs connected to GPIO pins."""

from __future__ import annotations

from typing import Set

try:
    import RPi.GPIO as GPIO  # type: ignore
except ModuleNotFoundError:  # pragma: no cover - hardware not available
    class _MockGPIO:
        BCM = OUT = HIGH = LOW = None

        def setmode(self, *_: object, **__: object) -> None:  # noqa: D401 - mock
            """Mock setmode."""

        def setup(self, *_: object, **__: object) -> None:  # noqa: D401 - mock
            """Mock setup."""

        def output(self, *_: object, **__: object) -> None:  # noqa: D401 - mock
            """Mock output."""

        def cleanup(self, *_: object, **__: object) -> None:  # noqa: D401 - mock
            """Mock cleanup."""

    GPIO = _MockGPIO()  # type: ignore


_initialized_pins: Set[int] = set()
_mode_set = False


def _ensure_setup(pin: int) -> None:
    """Ensure the GPIO pin is ready for use."""
    global _mode_set
    if not _mode_set:
        GPIO.setmode(GPIO.BCM)
        _mode_set = True
    if pin not in _initialized_pins:
        GPIO.setup(pin, GPIO.OUT)
        _initialized_pins.add(pin)


def turn_on(pin: int) -> None:
    """Turn on LED connected to ``pin``.

    The function is idempotent; calling it multiple times leaves the LED on.
    """
    _ensure_setup(pin)
    GPIO.output(pin, GPIO.HIGH)


def turn_off(pin: int) -> None:
    """Turn off LED connected to ``pin`` and clean up resources.

    The function is idempotent; calling it multiple times leaves the LED off.
    """
    _ensure_setup(pin)
    GPIO.output(pin, GPIO.LOW)
    GPIO.cleanup(pin)
    if pin in _initialized_pins:
        _initialized_pins.remove(pin)
    global _mode_set
    if not _initialized_pins:
        _mode_set = False
