import { useEffect, useState } from "react";
import { fetchDataSources, runDataSourceAction, updateDataSource } from "../api";
import type { DataSourceSettings, Health } from "../types";

type AdminPageProps = {
  health: Health | null;
  token: string;
};

const sourceHints: Record<string, string> = {
  ebird: "Live recent observations and hotspot data.",
  dopps: "Bird catalogue import source.",
  generated: "Synthetic observations for demos and testing.",
  cityinfra: "GeoJSON layer exported from the CityInfra DSL."
};

export function AdminPage({ health, token }: AdminPageProps) {
  const [sources, setSources] = useState<DataSourceSettings[]>([]);
  const [status, setStatus] = useState("Loading data sources...");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetchDataSources(token)
      .then((nextSources) => {
        if (cancelled) return;
        setSources(nextSources);
        setStatus(`${nextSources.length} data sources loaded`);
        setError("");
      })
      .catch((sourceError: unknown) => {
        if (cancelled) return;
        setSources([]);
        setStatus("Data sources need attention");
        setError(sourceError instanceof Error ? sourceError.message : "Could not load data sources.");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  function updateDraft(key: string, values: Partial<DataSourceSettings>) {
    setSources((current) => current.map((source) => (
      source.key === key ? { ...source, ...values } : source
    )));
  }

  async function saveSource(source: DataSourceSettings) {
    setBusyKey(source.key);
    setError("");

    try {
      const saved = await updateDataSource(token, source.key, {
        enabled: source.enabled,
        region: source.region,
        maxResults: Number(source.maxResults) || 1,
        recentDays: Number(source.recentDays) || 1
      });
      replaceSource(saved);
      setStatus(`${saved.name} settings saved`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save data source.");
    } finally {
      setBusyKey("");
    }
  }

  async function runAction(source: DataSourceSettings) {
    setBusyKey(source.key);
    setError("");

    try {
      const result = await runDataSourceAction(token, source);
      replaceSource(result.source);
      setStatus(result.message);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not run data source action.");
    } finally {
      setBusyKey("");
    }
  }

  function replaceSource(nextSource: DataSourceSettings) {
    setSources((current) => current.map((source) => (
      source.key === nextSource.key ? nextSource : source
    )));
  }

  return (
    <section className="route-page admin-page">
      <div className="page-heading">
        <div>
          <span>Admin</span>
          <h1>Data sources</h1>
        </div>
        <div className={health ? "admin-status ok" : "admin-status"}>
          {health ? "API connected" : "Waiting for API"}
        </div>
      </div>

      <div className="admin-summary">
        <p>{status}</p>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="admin-source-grid">
        {sources.map((source) => (
          <article className="admin-source-card" key={source.key}>
            <div className="source-card-top">
              <div>
                <span>{source.key}</span>
                <h2>{source.name}</h2>
                <p>{sourceHints[source.key] ?? "Managed FlySight data source."}</p>
              </div>
              <label className="toggle-field">
                <input
                  checked={source.enabled}
                  onChange={(event) => updateDraft(source.key, { enabled: event.target.checked })}
                  type="checkbox"
                />
                <span>{source.enabled ? "Enabled" : "Disabled"}</span>
              </label>
            </div>

            <div className="source-settings">
              <label>
                Region
                <input
                  value={source.region}
                  onChange={(event) => updateDraft(source.key, { region: event.target.value })}
                />
              </label>
              <label>
                Max results
                <input
                  min="1"
                  max="10000"
                  type="number"
                  value={source.maxResults}
                  onChange={(event) => updateDraft(source.key, { maxResults: Number(event.target.value) })}
                />
              </label>
              <label>
                Recent days
                <input
                  min="1"
                  max="365"
                  type="number"
                  value={source.recentDays}
                  onChange={(event) => updateDraft(source.key, { recentDays: Number(event.target.value) })}
                />
              </label>
            </div>

            <div className="source-meta">
              <span>Last sync</span>
              <strong>{formatSync(source.lastSync)}</strong>
            </div>

            <div className="source-actions">
              <button className="secondary" disabled={busyKey === source.key} onClick={() => saveSource(source)}>
                Save settings
              </button>
              <button className="primary-action slim" disabled={busyKey === source.key} onClick={() => runAction(source)}>
                {actionLabel(source.key)}
              </button>
            </div>
          </article>
        ))}

        {sources.length === 0 && !error && (
          <article className="admin-source-card">
            <div className="source-card-top">
              <div>
                <span>empty</span>
                <h2>No sources found</h2>
                <p>Backend did not return data source settings yet.</p>
              </div>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}

function formatSync(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function actionLabel(key: string) {
  if (key === "ebird") return "Refresh";
  if (key === "generated") return "Generate";
  if (key === "dopps") return "Import check";
  return "Mark synced";
}
