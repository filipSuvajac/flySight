import { TABLES } from "../api";
import type { Counts } from "../types";

type StatsGridProps = {
  counts: Counts;
};

export function StatsGrid({ counts }: StatsGridProps) {
  return (
    <section className="grid">
      {TABLES.map((table) => (
        <article className="card" key={table}>
          <span>{table}</span>
          <strong>{counts[table] ?? "-"}</strong>
        </article>
      ))}
    </section>
  );
}

