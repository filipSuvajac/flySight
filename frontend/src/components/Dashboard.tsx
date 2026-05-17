import { TABLES } from "../api";
import type { Counts, Health, User } from "../types";
import { StatusPill } from "./StatusPill";

type DashboardProps = {
  health: Health | null;
  user: User | null;
  counts: Counts;
  error: string;
  onLogout: () => void;
};

export function Dashboard({ health, user, counts, error, onLogout }: DashboardProps) {
  return (
    <main className="app-shell">
      <section className="app-header">
        <div>
          <StatusPill health={health} />
          <h1>FlySight workspace</h1>
          <p>{user ? `Signed in as ${user.name} (${user.email})` : "Signed in"}</p>
        </div>
        <button className="secondary" onClick={onLogout}>Logout</button>
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
          This dashboard is loaded only after JWT login. The same backend also serves the Kotlin Compose desktop app.
        </p>
      </section>
    </main>
  );
}

