import { useEffect, useState } from "react";

type Health = {
  status: string;
  database: string;
};

type Counts = Record<string, number>;

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
const TABLES = ["bird_family", "bird_info", "location", "observation"];

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [counts, setCounts] = useState<Counts>({});
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const healthResponse = await fetch(`${API_URL}/health`);
        setHealth(await healthResponse.json());

        const nextCounts: Counts = {};
        for (const table of TABLES) {
          const response = await fetch(`${API_URL}/api/${table}`);
          const rows = await response.json();
          nextCounts[table] = Array.isArray(rows) ? rows.length : 0;
        }
        setCounts(nextCounts);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load API data.");
      }
    }

    load();
  }, []);

  return (
    <main className="shell">
      <section className="header">
        <div>
          <h1>FlySight</h1>
          <p>REST API status and database overview</p>
        </div>
        <span className={health?.database === "connected" ? "badge ok" : "badge"}>
          {health ? health.database : "loading"}
        </span>
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
    </main>
  );
}
