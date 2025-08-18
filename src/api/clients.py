from __future__ import annotations

"""Helpers for listing connected Wi-Fi clients.

This module mirrors the behaviour of ``scripts/clients`` but exposes the
information to Python callers.

The underlying ``iw`` command requires root privileges and access to the
NetworkManager leases file.
"""

from pathlib import Path
import subprocess
from typing import Any


def list_clients(iface: str = "wlan0") -> list[dict[str, Any]]:
    """Return DHCP leases combined with Wi-Fi signal strength.

    Requires elevated privileges because ``iw`` needs root permissions.
    """

    leases_path = Path(f"/var/lib/NetworkManager/dnsmasq-{iface}.leases")
    if not leases_path.is_file():
        return []

    ip_by_mac: dict[str, str] = {}
    host_by_mac: dict[str, str] = {}

    for line in leases_path.read_text().splitlines():
        parts = line.split()
        if len(parts) < 3:
            continue
        _, mac, ip, *rest = parts
        mac = mac.lower()
        host = rest[0] if rest else ""
        ip_by_mac[mac] = ip
        if not host or host == "*":
            host_by_mac[mac] = ""
        else:
            host_by_mac[mac] = host

    sig_by_mac: dict[str, int] = {}
    try:
        result = subprocess.run(
            ["iw", "dev", iface, "station", "dump"],
            capture_output=True,
            text=True,
            check=False,
        )
        cur_mac: str | None = None
        for line in result.stdout.splitlines():
            line = line.strip()
            if line.startswith("Station "):
                parts = line.split()
                if len(parts) >= 2:
                    cur_mac = parts[1].lower()
            elif cur_mac and line.startswith("signal:"):
                try:
                    sig_by_mac[cur_mac] = int(line.split()[1])
                except ValueError:
                    pass
    except FileNotFoundError:
        pass

    clients: list[dict[str, Any]] = []
    for mac, ip in ip_by_mac.items():
        clients.append(
            {
                "ip": ip,
                "mac": mac,
                "hostname": host_by_mac.get(mac, ""),
                "signal": sig_by_mac.get(mac),
            }
        )

    return sorted(clients, key=lambda c: c["ip"])
