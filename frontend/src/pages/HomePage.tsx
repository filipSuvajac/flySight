import { useMemo, useState } from "react";
import type { User, VisualizationObservation } from "../types";
import { isAdminUser } from "../types";
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
  user: User | null;
};

export function HomePage({ token, user }: HomePageProps) {
  const [filters, setFilters] = useState(emptyObservationFilters);
  const [recentDays, setRecentDays] = useState("30");
  const [selectedObservation, setSelectedObservation] = useState<VisualizationObservation | null>(null);
  const isAdmin = isAdminUser(user);
  const minDate = useMemo(() => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 10);
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
    <section className="explore-page">
      <div className="explore-topbar">
        <div className="page-heading">
          <div>
            <span>Explore</span>
            <h1>Map-first observations</h1>
          </div>
        </div>
        <div className="explore-actions">
          <span>{isAdmin ? "Developer admin access" : "User explorer access"}</span>
          <span>Live eBird data</span>
        </div>
      </div>

      <section className="explore-layout">
        <FlySightMap
          token={token}
          filters={filters}
          recentDays={recentDays}
          onSelectObservation={setSelectedObservation}
        />
        <ExploreSidePanel
          filters={filters}
          minDate={minDate}
          recentDays={recentDays}
          selectedObservation={selectedObservation}
          today={today}
          isAdmin={isAdmin}
          onFiltersChange={updateFilters}
          onRecentDaysChange={updateRecentDays}
        />
      </section>

      <section className="explore-results">
        <EbirdPanel
          token={token}
          filters={filters}
          recentDays={recentDays}
          hideFilters={!isAdmin}
          onFiltersChange={updateFilters}
          onRecentDaysChange={updateRecentDays}
        />
      </section>
    </section>
  );
}

type ExploreSidePanelProps = {
  filters: ObservationFilters;
  minDate: string;
  recentDays: string;
  selectedObservation: VisualizationObservation | null;
  today: string;
  onFiltersChange: (filters: ObservationFilters) => void;
  isAdmin: boolean;
  onRecentDaysChange: (value: string) => void;
};

function ExploreSidePanel({
  filters,
  minDate,
  recentDays,
  selectedObservation,
  today,
  isAdmin,
  onFiltersChange,
  onRecentDaysChange
}: ExploreSidePanelProps) {
  return (
    <aside className="explore-side-panel">
      <section className="filter-stage admin-filter-stage">
        <div>
          <span>{isAdmin ? "Admin controls" : "Observation controls"}</span>
          <h2>Shared observation filters</h2>
          <p>These filters affect the eBird result table and charts on this page.</p>
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
            <h2>{selectedObservation.speciesName}</h2>
            <p>{selectedObservation.scientificName || selectedObservation.familyName || "Scientific name missing"}</p>
            <dl>
              <div>
                <dt>Location</dt>
                <dd>{selectedObservation.locationName}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{formatDateTime(selectedObservation.eventDate)}</dd>
              </div>
              <div>
                <dt>Count</dt>
                <dd>{selectedObservation.observedCount}</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>{selectedObservation.source}</dd>
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
