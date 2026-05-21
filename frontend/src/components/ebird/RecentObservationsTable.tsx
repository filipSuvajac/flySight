import type { EbirdObservation } from "../../types";
import { formatDateTime } from "./format";

type RecentObservationsTableProps = {
  observations: EbirdObservation[];
  emptyMessage?: string;
};

export function RecentObservationsTable({
  observations,
  emptyMessage = "No recent eBird observations match the current filters."
}: RecentObservationsTableProps) {
  return (
    <div className="table-wrap">
      <table className="observations-table">
        <thead>
          <tr>
            <th>Species</th>
            <th>City / location</th>
            <th>Date</th>
            <th>Count</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {observations.map((observation) => (
            <tr key={observation.id}>
              <td>
                <strong>{observation.slovenianName || observation.commonName}</strong>
                <span>{observation.commonName}</span>
                <span>{observation.scientificName || observation.speciesCode}</span>
              </td>
              <td>
                <strong>{observation.city}</strong>
                <span>{observation.locationName}</span>
                <span>{observation.latitude}, {observation.longitude}</span>
              </td>
              <td>{formatDateTime(observation.observedAt)}</td>
              <td>{observation.count ?? "-"}</td>
              <td>{observation.reviewed ? "Reviewed" : observation.valid ? "Valid" : "Pending"}</td>
            </tr>
          ))}
          {observations.length === 0 && (
            <tr>
              <td colSpan={5}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

