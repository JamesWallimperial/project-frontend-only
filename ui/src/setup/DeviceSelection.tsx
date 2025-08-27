import styles from "./Setup.module.css";

// Shape of a connected client reported by the backend
interface Client {
  ip: string;
  mac: string;
  hostname: string;
  signal?: number | null;
}

// Controlled props from the parent:
// - `clients`: list of devices to render
// - `selectedIndex`: index of the currently highlighted device
interface Props {
  clients: Client[];
  selectedIndex: number;
}

export default function DeviceSelection({ clients, selectedIndex }: Props) {
  // Human-friendly label for each client; falls back safely.
  const displayName = (c: Client) => c.hostname || c.mac || c.ip;

  const hasClients = clients.length > 0;

  return (
    <div className={styles.app} role="region" aria-label="Device selection">
      <div className={styles.circleFrame}>
        <div className={styles.centerStack}>
          <div>
            <div className={styles.title}>Select a device</div>
            {/* Hardware UX hint: rotation changes the highlight; button confirms. */}
            <div className={styles.subtitle}>Rotate to choose, press to confirm</div>
          </div>

          {/* Presentational list only — the parent updates selectedIndex in response to knob events. */}
          <ul
            className={styles.deviceList}
            role="listbox"
            aria-activedescendant={
              hasClients ? `device-option-${selectedIndex}` : undefined
            }
          >
            {clients.map((client, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <li
                  id={`device-option-${idx}`}
                  key={`${client.mac}-${client.ip}`} // MAC is usually stable; include IP for extra safety
                  role="option"
                  aria-selected={isSelected}
                  className={`${styles.deviceItem} ${
                    isSelected ? styles.deviceItemSelected : ""
                  }`}
                >
                  {displayName(client)}
                </li>
              );
            })}

            {/* Gentle empty state when no devices are connected */}
            {!hasClients && (
              <li className={styles.deviceItemEmpty}>No devices found</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
