import type { EbirdMode } from "./ebirdTypes";

type EbirdFiltersProps = {
  mode: EbirdMode;
  locationFilter: string;
  speciesFilter: string;
  dateFilter: string;
  sourceFilter: string;
  recentDays: string;
  minDate: string;
  today: string;
  onLocationChange: (value: string) => void;
  onSpeciesChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onSourceChange: (value: string) => void;
  onRecentDaysChange: (value: string) => void;
};

export function EbirdFilters({
  mode,
  locationFilter,
  speciesFilter,
  dateFilter,
  sourceFilter,
  recentDays,
  minDate,
  today,
  onLocationChange,
  onSpeciesChange,
  onDateChange,
  onSourceChange,
  onRecentDaysChange
}: EbirdFiltersProps) {
  return (
    <div className="filters">
      <label>
        Location
        <input
          value={locationFilter}
          onChange={(event) => onLocationChange(event.target.value)}
          placeholder="Ljubljana, Maribor, Drava..."
        />
      </label>
      {mode === "recent" && (
        <>
          <label>
            Species
            <input
              value={speciesFilter}
              onChange={(event) => onSpeciesChange(event.target.value)}
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
              onChange={(event) => onDateChange(event.target.value)}
            />
          </label>
          <label>
            Source
            <select value={sourceFilter} onChange={(event) => onSourceChange(event.target.value)}>
              <option value="">All sources</option>
              <option value="ebird">eBird</option>
              <option value="generated">Generated</option>
              <option value="user">User</option>
            </select>
          </label>
        </>
      )}
      <label>
        Recent range
        <select value={recentDays} onChange={(event) => onRecentDaysChange(event.target.value)}>
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
          <option value="all">All time</option>
        </select>
      </label>
    </div>
  );
}
