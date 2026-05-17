import { useEffect, useMemo, useRef, useState } from "react";
import { TABLES, webSocketUrl } from "../api";
import type { Counts, EbirdObservation, Health, User } from "../types";
import { StatusPill } from "./StatusPill";

type DashboardProps = {
  health: Health | null;
  user: User | null;
  token: string;
  counts: Counts;
  error: string;
  onLogout: () => void;
};

type EbirdSocketMessage =
  | { type: "loading" }
  | {
      type: "observations";
      regionCode: string;
      days: number;
      receivedAt: string;
      observations: EbirdObservation[];
    }
  | { type: "error"; error: string };

export function Dashboard({
  health,
  user,
  token,
  counts,
  error,
  onLogout,
}: DashboardProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const [observations, setObservations] = useState<EbirdObservation[]>([]);
  const [ebirdStatus, setEbirdStatus] = useState(
    "Connecting to eBird stream...",
  );
  const [ebirdError, setEbirdError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const minDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  }, []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    const socket = new WebSocket(webSocketUrl("/ws/ebird", { token }));
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setEbirdStatus("Loading Slovenia observations from eBird...");
      setEbirdError("");
    });

    socket.addEventListener("message", (event) => {
      let message: EbirdSocketMessage;
      try {
        message = JSON.parse(event.data) as EbirdSocketMessage;
      } catch {
        setEbirdError("Received an invalid eBird WebSocket message.");
        return;
      }

      if (message.type === "loading") {
        setEbirdStatus("Loading Slovenia observations from eBird...");
        return;
      }
      if (message.type === "error") {
        setEbirdError(message.error);
        setEbirdStatus("eBird stream needs attention");
        return;
      }

      setObservations(message.observations);
      setLastUpdated(message.receivedAt);
      setEbirdError("");
      setEbirdStatus(
        `${message.observations.length} observations received for Slovenia`,
      );
    });

    socket.addEventListener("close", () => {
      if (socketRef.current === socket) {
        setEbirdStatus("eBird stream disconnected");
      }
    });

    socket.addEventListener("error", () => {
      setEbirdError("Could not connect to the eBird WebSocket.");
      setEbirdStatus("eBird stream needs attention");
    });

    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, [token]);

  const filteredObservations = useMemo(() => {
    const city = cityFilter.trim().toLowerCase();
    const species = speciesFilter.trim().toLowerCase();

    return observations.filter((observation) => {
      const observedDate = observation.observedAt.slice(0, 10);
      const cityMatch =
        !city ||
        observation.city.toLowerCase().includes(city) ||
        observation.locationName.toLowerCase().includes(city);
      const speciesMatch =
        !species ||
        observation.slovenianName.toLowerCase().includes(species) ||
        observation.commonName.toLowerCase().includes(species) ||
        observation.scientificName.toLowerCase().includes(species) ||
        observation.speciesCode.toLowerCase().includes(species);
      const dateMatch = !dateFilter || observedDate === dateFilter;

      return cityMatch && speciesMatch && dateMatch;
    });
  }, [cityFilter, dateFilter, observations, speciesFilter]);

  function refreshEbirdObservations() {
    socketRef.current?.send(JSON.stringify({ type: "refresh" }));
  }

  return (
    <main className="app-shell">
      <section className="app-header">
        <div>
          <StatusPill health={health} />
          <h1>FlySight workspace</h1>
          <p>
            {user ? `Signed in as ${user.name} (${user.email})` : "Signed in"}
          </p>
        </div>
        <button className="secondary" onClick={onLogout}>
          Logout
        </button>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="grid">
        {TABLES.map((table) => (
          <article className="card" key={table}>
            <span>{table}</span>
            <strong>{counts[table] ?? "-"}</strong>
          </article>
        ))}
      </section>

      <section className="workspace-panel">
        <h2>Protected API access</h2>
        <p>
          This dashboard is loaded only after JWT login. The same backend also
          serves the Kotlin Compose desktop app.
        </p>
      </section>

      <section className="workspace-panel ebird-panel">
        <div className="panel-heading">
          <div>
            <h2>eBird observations in Slovenia</h2>
            <p>{ebirdStatus}</p>
            {lastUpdated && <p>Last updated {formatDateTime(lastUpdated)}</p>}
          </div>
          <button className="secondary" onClick={refreshEbirdObservations}>
            Refresh
          </button>
        </div>

        {ebirdError && <p className="error">{ebirdError}</p>}

        <div className="filters">
          <label>
            City
            <input
              value={cityFilter}
              onChange={(event) => setCityFilter(event.target.value)}
              placeholder="Ljubljana, Maribor..."
            />
          </label>
          <label>
            Species
            <input
              value={speciesFilter}
              onChange={(event) => setSpeciesFilter(event.target.value)}
              placeholder="Mlakarica, Kos..."
            />
          </label>
          <label>
            Date
            <input
              type="date"
              min={minDate}
              max={today}
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
            />
          </label>
        </div>

        <div className="table-wrap">
          <table className="observations-table">
            <thead>
              <tr>
                <th>Species</th>
                <th>City / location</th>
                <th>Date</th>
                <th>Count</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredObservations.map((observation) => (
                <tr key={observation.id}>
                  <td>
                    <strong>
                      {observation.slovenianName || observation.commonName}
                    </strong>
                    <span>{observation.commonName}</span>
                    <span>
                      {observation.scientificName || observation.speciesCode}
                    </span>
                  </td>
                  <td>
                    <strong>{observation.city}</strong>
                    <span>
                      {observation.latitude}, {observation.longitude}
                    </span>
                  </td>
                  <td>{formatDateTime(observation.observedAt)}</td>
                  <td>{observation.count ?? "-"}</td>
                  <td>
                    {observation.reviewed
                      ? "Reviewed"
                      : observation.valid
                        ? "Valid"
                        : "Pending"}
                  </td>
                </tr>
              ))}
              {filteredObservations.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    No eBird observations match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function formatDateTime(value: string) {
  if (!value) return "-";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: value.includes(":") ? "short" : undefined,
  }).format(date);
}
