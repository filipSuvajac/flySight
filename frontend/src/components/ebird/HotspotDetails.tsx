import type { EbirdHotspot, EbirdObservation } from "../../types";
import { RecentObservationsTable } from "./RecentObservationsTable";

type HotspotDetailsProps = {
  hotspot: EbirdHotspot;
  observations: EbirdObservation[];
  status: string;
  recentDays: string;
  onClose: () => void;
};

export function HotspotDetails({ hotspot, observations, status, recentDays, onClose }: HotspotDetailsProps) {
  return (
    <section className="hotspot-details">
      <div className="panel-heading">
        <div>
          <h3>{hotspot.name}</h3>
          <p>{status || `Recent sightings from the last ${recentDays} days`}</p>
        </div>
        <button className="secondary" onClick={onClose}>
          Back to hotspots
        </button>
      </div>
      <RecentObservationsTable
        observations={observations}
        emptyMessage="No recent sightings were returned for this hotspot and range."
      />
    </section>
  );
}

