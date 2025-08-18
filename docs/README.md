# Project Overview

This repository hosts a modular home‑automation stack with services for
hardware control, a web interface, and optional voice interaction.

## Setup

### 1. Create a virtual environment
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies
```bash
pip install -r config/requirements.txt
```

### 3. Build and run
```bash
./scripts/build_ui.sh      # compile front‑end assets
./scripts/run_dev.sh       # start API, UI, and voice services
```

## Configuration
- **UI options:** edit `config/ui.json`.
- **Hardware pins:** see `config/pins.yaml` for GPIO mappings.

### Environment variables

Runtime services derive their API endpoints from the following variables:

| Variable | Default | Used by |
| --- | --- | --- |
| `API_HOST` | `localhost` | Python device adapters |
| `API_PORT` | `8000` | Python device adapters |
| `VITE_API_HOST` | `localhost` | Web UI (Vite) |
| `VITE_API_PORT` | `8000` | Web UI (Vite) |

To override the defaults, set the variables in your shell before running the
services or create `.env` files:

```bash
export API_HOST=myserver.example.com
export API_PORT=9000

# For the web UI
cd src/ui/web
echo "VITE_API_HOST=myserver.example.com" >> .env
echo "VITE_API_PORT=9000" >> .env
```

## Architecture
The platform is composed of:
- **API service** exposing REST endpoints for device and status control.
- **Device adapters** in `src/devices/` that interact with sensors and actuators.
- **User interface** served from `src/ui/` for kiosks or browsers.
- **Voice module** in `src/voice/` providing hotword detection and TTS/STT.

More details are available in [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).

## Troubleshooting
Typical problems and fixes:
- *Virtual environment not activated:* ensure `.venv` is sourced.
- *Missing packages:* rerun `pip install -r config/requirements.txt`.
- *Hardware not responding:* verify GPIO pins in `config/pins.yaml` and
connections.
- *Web UI build errors:* see [Web UI build errors](TROUBLESHOOTING.md#web-ui-build-errors)
  for failures such as `Illegal instruction` or `ERR_PACKAGE_PATH_NOT_EXPORTED`.

For extended guidance refer to [`docs/TROUBLESHOOTING.md`](TROUBLESHOOTING.md).
