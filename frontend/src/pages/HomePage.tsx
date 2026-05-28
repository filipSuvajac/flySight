import type { Counts } from "../types";
import { DashboardPanel } from "../components/dashboard/DashboardPanel";
import { EbirdPanel } from "../components/ebird/EbirdPanel";
import { FlySightMap } from "../components/map/FlySightMap";

type HomePageProps = {
  token: string;
  counts: Counts;
  error: string;
};

export function HomePage({ token, counts, error }: HomePageProps) {
  return (
    <section className="explore-page">
      <div className="explore-topbar">
        <div className="page-heading explore-heading">
          <span>Explore</span>
          <h1>Slovenia sightings map</h1>
        </div>
        <div className="explore-actions" aria-label="Explore workspace status">
          <span>Map-first view</span>
          <span>Live data ready</span>
        </div>
      </div>

      <section className="explore-layout">
        <FlySightMap />
        <ExploreSidePanel counts={counts} error={error} />
      </section>

      <section className="explore-results">
        <EbirdPanel token={token} />
      </section>
    </section>
  );
}

function ExploreSidePanel({ counts, error }: { counts: Counts; error: string }) {
  return (
    <aside className="explore-side-panel">
      <DashboardPanel counts={counts} error={error} />

      <section className="filter-stage">
        <div>
          <span>Filter workspace</span>
          <h2>Ready for shared filters</h2>
        </div>
        <div className="filter-chips" aria-label="Upcoming filter groups">
          <span>Species</span>
          <span>Location</span>
          <span>Date range</span>
          <span>Source</span>
        </div>
      </section>

      <section className="details-stage">
        <span>Selection details</span>
        <h2>No marker selected</h2>
        <p>Marker and table row details will open here without pushing the map out of view.</p>
      </section>
    </aside>
  );
}
