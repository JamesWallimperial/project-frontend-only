#!/usr/bin/env python3
# Terminal UI for hotspot device monitoring + WAN control

import curses
import subprocess

def get_clients():
    """Run the clients script and parse output."""
    result = subprocess.run(["sudo", "/usr/local/bin/clients"],
                            stdout=subprocess.PIPE, text=True)
    lines = result.stdout.strip().splitlines()
    devices = []
    for line in lines[2:]:  # skip header lines
        parts = line.split()
        if len(parts) >= 3:
            ip, mac, host = parts[0], parts[1], parts[2]
            devices.append({"ip": ip, "mac": mac, "host": host})
    return devices

def get_blocked_macs():
    """Run wanctl list and return blocked MACs."""
    result = subprocess.run(["sudo", "wanctl", "list"],
                            stdout=subprocess.PIPE, text=True)
    blocked = []
    for line in result.stdout.splitlines():
        if "--mac-source" in line:
            parts = line.split()
            idx = parts.index("--mac-source")
            blocked.append(parts[idx+1].lower())
    return set(blocked)

def toggle_mac(mac, blocked):
    """Flip block/unblock for a MAC address."""
    if mac in blocked:
        subprocess.run(["sudo", "wanctl", "unblock", mac])
    else:
        subprocess.run(["sudo", "wanctl", "block", mac])

def main(stdscr):
    curses.curs_set(0)  # hide cursor
    current_row = 0

    while True:
        stdscr.clear()

        devices = get_clients()
        blocked = get_blocked_macs()

        stdscr.addstr(0, 0, "Hotspot Device Manager (press q to quit, Enter to toggle WAN)")
        stdscr.addstr(1, 0, "{:<15} {:<17} {:<20} {:<10}".format("IP", "MAC", "Hostname", "WAN"))
        stdscr.addstr(2, 0, "-"*70)

        for idx, dev in enumerate(devices):
            status = "Blocked" if dev["mac"].lower() in blocked else "Allowed"
            if idx == current_row:
                stdscr.attron(curses.color_pair(1))
                stdscr.addstr(idx+3, 0,
                              "{:<15} {:<17} {:<20} {:<10}".format(dev["ip"], dev["mac"], dev["host"], status))
                stdscr.attroff(curses.color_pair(1))
            else:
                stdscr.addstr(idx+3, 0,
                              "{:<15} {:<17} {:<20} {:<10}".format(dev["ip"], dev["mac"], dev["host"], status))

        key = stdscr.getch()

        if key == curses.KEY_UP and current_row > 0:
            current_row -= 1
        elif key == curses.KEY_DOWN and current_row < len(devices)-1:
            current_row += 1
        elif key == curses.KEY_ENTER or key in [10, 13]:  # Enter key
            mac = devices[current_row]["mac"]
            toggle_mac(mac, blocked)
        elif key == ord("q"):
            break

        stdscr.refresh()

if __name__ == "__main__":
    curses.wrapper(lambda stdscr: (
        curses.start_color(),
        curses.init_pair(1, curses.COLOR_BLACK, curses.COLOR_CYAN),
        main(stdscr)
    ))
