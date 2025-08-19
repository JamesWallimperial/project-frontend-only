# clients.py
from __future__ import annotations

from pathlib import Path
import logging
import shutil
import subprocess
from typing import Any, Dict, List, Tuple

log = logging.getLogger(__name__)

# Resolve iw once; systemd often lacks /usr/sbin in PATH
_IW_CANDIDATES = ["/usr/sbin/iw", "/sbin/iw", "/usr/bin/iw", shutil.which("iw")]
_IW_PATH = next((p for p in _IW_CANDIDATES if p and Path(p).exists()), None)

def _iw_signals(iface: str) -> Dict[str, int]:
    """Return {mac: signal_dbm} for currently associated stations; {} on error."""
    if not _IW_PATH:
        log.warning("iw not found. candidates=%s", _IW_CANDIDATES)
        return {}
    try:
        out = subprocess.check_output([_IW_PATH, "dev", iface, "station", "dump"], text=True, stderr=subprocess.STDOUT)
    except subprocess.CalledProcessError as e:
        log.warning("iw error (iface=%s, exit=%s): %s", iface, e.returncode, e.output.strip())
        return {}
    except Exception as e:
        log.warning("iw exec failed (iface=%s): %s", iface, e)
        return {}

    signals: Dict[str, int] = {}
    current_mac: str | None = None
    for raw in out.splitlines():
        line = raw.strip()
        if line.startswith("Station "):
            parts = line.split()
            if len(parts) >= 2:
                current_mac = parts[1].lower()
        elif current_mac and line.startswith("signal:"):
            parts = line.split()
            if len(parts) >= 2:
                try:
                    signals[current_mac] = int(parts[1])
                except ValueError:
                    pass
            current_mac = None

    log.info("iw stations found=%d (iface=%s)", len(signals), iface)
    return signals

def _find_leases_path(iface: str) -> Path | None:
    """Return first existing leases file path for this iface."""
    candidates = [
        Path(f"/var/lib/NetworkManager/dnsmasq-{iface}.leases"),
        Path("/var/lib/misc/dnsmasq.leases"),  # non-NM dnsmasq default
    ]
    for p in candidates:
        if p.is_file():
            return p
    return None

def _leases_maps(iface: str) -> Tuple[Dict[str, str], Dict[str, str], Path | None]:
    """Return (ip_by_mac, host_by_mac, path_used)."""
    path = _find_leases_path(iface)
    ip_by_mac: Dict[str, str] = {}
    host_by_mac: Dict[str, str] = {}
    if not path:
        log.warning("leases file not found for iface=%s", iface)
        return ip_by_mac, host_by_mac, None

    for raw in path.read_text().splitlines():
        parts = raw.split()
        if len(parts) < 3:
            continue
        _, mac, ip, *rest = parts
        mac = mac.lower()
        host = rest[0] if rest else ""
        host_by_mac[mac] = "" if (not host or host == "*") else host
        ip_by_mac[mac] = ip

    log.info("leases loaded path=%s macs=%d", path, len(ip_by_mac))
    return ip_by_mac, host_by_mac, path

def list_clients(iface: str = "wlan0") -> List[dict[str, Any]]:
    """Prefer `iw` (associated now); fallback to leases so UI shows something."""
    sig_by_mac = _iw_signals(iface)
    ip_by_mac, host_by_mac, leases_path = _leases_maps(iface)

    clients: List[dict[str, Any]] = []
    if sig_by_mac:
        for mac, signal in sig_by_mac.items():
            clients.append({
                "mac": mac,
                "ip": ip_by_mac.get(mac),
                "hostname": host_by_mac.get(mac, ""),
                "signal": signal,
            })
        source = f"iw + leases({leases_path})"
    else:
        # Fallback: show all leases (not strictly “connected now”)
        for mac, ip in ip_by_mac.items():
            clients.append({
                "mac": mac,
                "ip": ip,
                "hostname": host_by_mac.get(mac, ""),
                "signal": None,
            })
        source = f"leases-only({leases_path})"

    clients.sort(key=lambda c: (c["hostname"] or "", c["ip"] or "", c["mac"]))
    log.info("list_clients iface=%s returned=%d source=%s", iface, len(clients), source)
    return clients
