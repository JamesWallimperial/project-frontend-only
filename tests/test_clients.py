import logging
from pathlib import Path
import sys

sys.path.append("src")
import api.clients as clients


def test_list_clients_unreadable_leases(monkeypatch, tmp_path, caplog):
    lease_path = tmp_path / "dnsmasq.leases"
    lease_path.write_text("dummy")

    def fake_find_leases_path(iface: str) -> Path:
        return lease_path

    def fake_iw_signals(iface: str):
        return {}

    original_read_text = Path.read_text

    def read_text(self, *args, **kwargs):
        if self == lease_path:
            raise PermissionError("denied")
        return original_read_text(self, *args, **kwargs)

    monkeypatch.setattr(clients, "_find_leases_path", fake_find_leases_path)
    monkeypatch.setattr(clients, "_iw_signals", fake_iw_signals)
    monkeypatch.setattr(Path, "read_text", read_text)

    with caplog.at_level(logging.WARNING):
        result = clients.list_clients("wlan0")

    assert result == []
    assert any("unreadable" in r.message for r in caplog.records)