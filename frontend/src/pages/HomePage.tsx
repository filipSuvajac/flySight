import { useMemo, useState } from "react";
import type { Counts, EbirdObservation } from "../types";
import { DashboardPanel } from "../components/dashboard/DashboardPanel";
import { EbirdFilters } from "../components/ebird/EbirdFilters";
import { EbirdPanel } from "../components/ebird/EbirdPanel";
import { formatDateTime } from "../components/ebird/format";
import { FlySightMap } from "../components/map/FlySightMap";
import {
  emptyObservationFilters,
  type ObservationFilters
} from "../observations/filters";

type HomePageProps = {
  token: string;
  counts: Counts;
  error: string;
};

export function HomePage({ token, counts, error }: HomePageProps) {
  const [filters, setFilters] = useState(emptyObservationFilters);
  const [recentDays, setRecentDays] = useState("30");
  const [selectedObservation, setSelectedObservation] = useState<EbirdObservation | null>(null);
  const minDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  }, []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  function updateFilters(nextFilters: ObservationFilters) {
    setFilters(nextFilters);
    setSelectedObservation(null);
  }

  function updateRecentDays(nextRecentDays: string) {
    setRecentDays(nextRecentDays);
    setSelectedObservation(null);
  }

  return (
    <>
      <section className="home-grid">
        <FlySightMap token={token} />
        <DashboardPanel counts={counts} error={error} />
      </section>

      <section className="explore-results">
        <EbirdPanel
          token={token}
          filters={filters}
          recentDays={recentDays}
          hideFilters
          onFiltersChange={updateFilters}
          onRecentDaysChange={updateRecentDays}
        />
      </section>
    </section>
  );
}

type ExploreSidePanelProps = {
  counts: Counts;
  error: string;
  filters: ObservationFilters;
  minDate: string;
  recentDays: string;
  selectedObservation: EbirdObservation | null;
  today: string;
  onFiltersChange: (filters: ObservationFilters) => void;
  onRecentDaysChange: (value: string) => void;
};

function ExploreSidePanel({
  counts,
  error,
  filters,
  minDate,
  recentDays,
  selectedObservation,
  today,
  onFiltersChange,
  onRecentDaysChange
}: ExploreSidePanelProps) {
  return (
    <aside className="explore-side-panel">
      <DashboardPanel counts={counts} error={error} />

      <section className="filter-stage">
        <div>
          <span>Filter workspace</span>
          <h2>Shared observation filters</h2>
        </div>
        <EbirdFilters
          mode="recent"
          locationFilter={filters.location}
          speciesFilter={filters.species}
          dateFilter={filters.date}
          sourceFilter={filters.source}
          recentDays={recentDays}
          minDate={minDate}
          today={today}
          onLocationChange={(location) => onFiltersChange({ ...filters, location })}
          onSpeciesChange={(species) => onFiltersChange({ ...filters, species })}
          onDateChange={(date) => onFiltersChange({ ...filters, date })}
          onSourceChange={(source) => onFiltersChange({ ...filters, source })}
          onRecentDaysChange={onRecentDaysChange}
        />
      </section>

      <section className="details-stage">
        <span>Selection details</span>
        {selectedObservation ? (
          <div className="selected-observation">
            <h2>{selectedObservation.slovenianName || selectedObservation.commonName}</h2>
            <p>{selectedObservation.commonName}</p>
            <dl>
              <div>
                <dt>Location</dt>
                <dd>{selectedObservation.locationName || selectedObservation.city}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{formatDateTime(selectedObservation.observedAt)}</dd>
              </div>
              <div>
                <dt>Count</dt>
                <dd>{selectedObservation.count ?? "-"}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <>
            <h2>No marker selected</h2>
            <p>Click a bird marker to inspect the observation without leaving the map.</p>
          </>
        )}
      </section>
    </aside>
  );
}
