import { useState } from "react";
import type { Counts, Health, User, WorkspaceRoute } from "../types";
import { AppLayout } from "../layouts/AppLayout";
import { HomePage } from "./HomePage";
import { StatsGrid } from "../components/StatsGrid";

type WorkspacePageProps = {
  health: Health | null;
  user: User | null;
  token: string;
  counts: Counts;
  error: string;
  onLogout: () => void;
};

export function WorkspacePage({ health, user, token, counts, error, onLogout }: WorkspacePageProps) {
  const [activeRoute, setActiveRoute] = useState<WorkspaceRoute>("explore");

  return (
    <AppLayout health={health} user={user} activeRoute={activeRoute} onRouteChange={setActiveRoute} onLogout={onLogout}>
      {activeRoute === "explore" && <HomePage token={token} counts={counts} error={error} />}
      {activeRoute === "analytics" && <AnalyticsPage counts={counts} />}
      {activeRoute === "data" && <DataPage counts={counts} error={error} />}
      {activeRoute === "admin" && <AdminPage health={health} />}
      {activeRoute === "cityinfra" && <CityInfraPage />}
    </AppLayout>
  );
}

function AnalyticsPage({ counts }: { counts: Counts }) {
  return (
    <section className="route-page">
      <div className="page-heading">
        <span>Analytics</span>
        <h1>Observation intelligence</h1>
      </div>
      <div className="route-grid">
        <div className="route-panel wide">
          <h2>Database overview</h2>
          <StatsGrid counts={counts} />
        </div>
        <div className="route-panel">
          <h2>Chart workspace</h2>
          <div className="chart-preview">
            <span className="bar-a" />
            <span className="bar-b" />
            <span className="bar-c" />
            <span className="bar-d" />
            <span className="bar-e" />
          </div>
        </div>
      </div>
    </section>
  );
}

function DataPage({ counts, error }: { counts: Counts; error: string }) {
  const rows = Object.entries(counts);

  return (
    <section className="route-page">
      <div className="page-heading">
        <span>Data</span>
        <h1>Database tables</h1>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="data-list">
        {rows.length ? rows.map(([table, count]) => (
          <article className="data-row" key={table}>
            <strong>{table}</strong>
            <span>{count} rows</span>
          </article>
        )) : (
          <article className="data-row">
            <strong>No table snapshot</strong>
            <span>Refresh after API connection</span>
          </article>
        )}
      </div>
    </section>
  );
}

function AdminPage({ health }: { health: Health | null }) {
  const sources = ["eBird API", "DOPPS scraper", "Generated data", "CityInfra GeoJSON"];

  return (
    <section className="route-page">
      <div className="page-heading">
        <span>Admin</span>
        <h1>Data sources</h1>
      </div>
      <div className="source-grid">
        {sources.map((source) => (
          <article className="source-card" key={source}>
            <div>
              <strong>{source}</strong>
              <span>{health ? "Available" : "Waiting for API"}</span>
            </div>
            <span className="source-toggle" />
          </article>
        ))}
      </div>
    </section>
  );
}

function CityInfraPage() {
  return (
    <section className="route-page cityinfra-page">
      <div className="page-heading">
        <span>CityInfra</span>
        <h1>Infrastructure layer</h1>
      </div>
      <div className="route-panel">
        <h2>GeoJSON workspace</h2>
        <p>City model: Demo</p>
        <div className="cityinfra-preview">
          <span className="road-line" />
          <span className="park-block" />
          <span className="water-line" />
          <span className="poi-dot" />
        </div>
      </div>
    </section>
  );
}
