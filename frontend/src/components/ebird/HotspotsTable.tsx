import type { EbirdHotspot } from "../../types";
import { formatDateTime } from "./format";

type HotspotsTableProps = {
  hotspots: EbirdHotspot[];
  selectedHotspotId: string;
  onSelect: (hotspot: EbirdHotspot) => void;
};

export function HotspotsTable({ hotspots, selectedHotspotId, onSelect }: HotspotsTableProps) {
  return (
    <div className="table-wrap">
      <table className="observations-table">
        <thead>
          <tr>
            <th>Hotspot</th>
            <th>Coordinates</th>
            <th>Species all time</th>
            <th>Latest observation</th>
            <th>Location code</th>
          </tr>
        </thead>
        <tbody>
          {hotspots.map((hotspot) => (
            <tr
              className={selectedHotspotId === hotspot.id ? "selected-row" : "clickable-row"}
              key={hotspot.id}
              onClick={() => onSelect(hotspot)}
            >
              <td>
                <strong>{hotspot.name}</strong>
                <span>Click for hotspot sightings</span>
                <span>{hotspot.subnational2Code || hotspot.subnational1Code || hotspot.countryCode}</span>
              </td>
              <td>{hotspot.latitude}, {hotspot.longitude}</td>
              <td>{hotspot.speciesAllTime ?? "-"}</td>
              <td>{formatDateTime(hotspot.latestObservationDate)}</td>
              <td>{hotspot.id}</td>
            </tr>
          ))}
          {hotspots.length === 0 && (
            <tr>
              <td colSpan={5}>No eBird hotspots match the current filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

