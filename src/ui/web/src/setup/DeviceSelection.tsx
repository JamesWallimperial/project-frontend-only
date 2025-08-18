import styles from "./Setup.module.css";

interface Client {
  ip: string;
  mac: string;
  hostname: string;
  signal?: number | null;
}

interface Props {
  clients: Client[];
  selectedIndex: number;
}

export default function DeviceSelection({ clients, selectedIndex }: Props) {
  const host =
    import.meta.env.VITE_API_HOST || window.location.hostname || "localhost";
  const port =
    import.meta.env.VITE_API_PORT || window.location.port || "8000";
  const protocol = window.location.protocol === "https:" ? "https" : "http";

  const displayName = (c: Client) => c.hostname || c.mac || c.ip;
  const selected = clients[selectedIndex];

  const block = () => {
    if (!selected) return;
    fetch(`${protocol}://${host}:${port}/wifi/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mac: selected.mac }),
    }).catch((err) => console.error("Failed to block client", err));
  };

  const unblock = () => {
    if (!selected) return;
    fetch(`${protocol}://${host}:${port}/wifi/unblock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mac: selected.mac }),
    }).catch((err) => console.error("Failed to unblock client", err));
  };

  return (
    <div className={styles.app}>
      <div className={styles.circleFrame}>
        <div className={styles.centerStack}>
          <div>
            <div className={styles.title}>Select a device</div>
            <div className={styles.subtitle}>Rotate to choose, press to confirm</div>
          </div>
          <ul className={styles.deviceList}>
            {clients.map((client, idx) => (
              <li
                key={client.mac}
                className={`${styles.deviceItem} ${
                  idx === selectedIndex ? styles.deviceItemSelected : ""
                }`}
              >
                {displayName(client)}
              </li>
            ))}
          </ul>
          {selected && (
            <div className={styles.actionButtons}>
              <button className={styles.primaryBtn} onClick={block}>
                Block
              </button>
              <button className={styles.primaryBtn} onClick={unblock}>
                Unblock
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
