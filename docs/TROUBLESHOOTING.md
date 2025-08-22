# Troubleshooting

## Web UI build errors

Building the web interface may fail with messages such as:

```
Illegal instruction
ERR_PACKAGE_PATH_NOT_EXPORTED
```

Install older versions of the build tools to resolve the issue:

```bash
npm install vite@^4 rollup@^3 --save-dev
```

This downgrade uses pure-JS bundles compatible with older Pi CPUs.


# Hotspot can’t assign IPs (dnsmasq conflict)

**Symptom:** Phones can’t join the Raspberry Pi Wi-Fi hotspot.  
**Cause:** NetworkManager starts its *own* `dnsmasq` for `wlan0`, but the project’s `dnsmasq` was bound globally on `0.0.0.0:53`, blocking NM’s instance.

---

## Fix: scope the project’s dnsmasq (LAN/Docker only)

Create (or edit) `/etc/dnsmasq.d/lan-only.conf`:

```ini
# Serve only on wired LAN + Docker; never on the hotspot
interface=eth0
interface=docker0
except-interface=wlan0
bind-dynamic

# DNS only (leave DHCP to your home router / NM hotspot)
port=53
no-dhcp-interface=eth0
no-dhcp-interface=docker0

# Upstream resolvers (optional)
server=1.1.1.1
server=8.8.8.8
Note: Avoid listen-address= unless you need to pin specific IPs. If you do use it, update the addresses whenever eth0’s IP changes.

Apply changes:

bash

sudo systemctl restart dnsmasq
sudo systemctl status dnsmasq --no-pager


NetworkManager’s embedded dnsmasq continues to own wlan0 (10.42.0.0/24) for the hotspot.

The project’s dnsmasq serves DNS on eth0 (home LAN) and docker0 only, so there’s no port 53 clash on wlan0.

Verify
Check interface IPs:

bash

ip -4 addr
Confirm dnsmasq is listening (and not on wlan0):

bash

sudo ss -lntup | grep ':53'
Hotspot leases file (should update as phones join):

bash

sudo tail -f /var/lib/NetworkManager/dnsmasq-wlan0.leases
See associated stations:

bash
Copy
Edit
sudo iw dev wlan0 station dump
App API (uses iw + NM leases):

bash
Copy
Edit
curl -s http://127.0.0.1:8000/wifi/clients?iface=wlan0 | jq .
Moving the Pi to a different router (new LAN/subnet)
With bind-dynamic and no listen-address, this “just works.” After moving:

bash
Copy
Edit
# 1) New eth0 address
ip -4 addr show dev eth0

# 2) dnsmasq is listening on the new eth0 IP
sudo ss -lntup | grep ':53'

# 3) DNS resolution via the Pi
dig @<NEW_ETH0_IP> example.com +short