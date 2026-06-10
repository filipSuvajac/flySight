import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { addFavoriteBird, fetchVisualizationObservations, removeFavoriteBird } from "../../api";
import type { ObservationFilters } from "../../observations/filters";
import type { VisualizationObservation } from "../../types";
import { formatDateTime } from "../ebird/format";
import birdIconUrl from "../../assets/bird-fill-svgrepo-com.svg";

type FlySightMapProps = {
  token: string;
  filters: ObservationFilters;
  recentDays: string;
  onSelectObservation: (observation: VisualizationObservation) => void;
};

function hasCoordinates(observation: VisualizationObservation): observation is VisualizationObservation & {
  latitude: number;
  longitude: number;
} {
  return observation.latitude !== null && observation.longitude !== null;
}

const birdMarkerIcon = L.divIcon({
  className: "bird-marker",
  html: `
    <span class="bird-marker-pin" aria-hidden="true">
      <img src="${birdIconUrl}" alt="" />
    </span>
  `,
  iconSize: [36, 44],
  iconAnchor: [18, 42],
  popupAnchor: [0, -40]
});

export function FlySightMap({
  token,
  filters,
  recentDays,
  onSelectObservation
}: FlySightMapProps) {
  const [observations, setObservations] = useState<VisualizationObservation[]>([]);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const [status, setStatus] = useState("Loading database sightings...");
  const [error, setError] = useState("");
  const [favoriteBirdIds, setFavoriteBirdIds] = useState<Set<number>>(new Set());
  const [favoriteBusyId, setFavoriteBusyId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    setStatus("Loading database sightings...");
    setError("");

    fetchVisualizationObservations(token, filters, recentDays)
      .then((nextObservations) => {
        if (cancelled) return;
        setObservations(nextObservations);
        setFavoriteBirdIds(new Set(nextObservations.filter((observation) => observation.isFavorite).map((observation) => observation.birdId)));
        setStatus(`${nextObservations.length} database sightings`);
      })
      .catch((mapError: unknown) => {
        if (cancelled) return;
        setObservations([]);
        setStatus("Observation map needs attention");
        setError(mapError instanceof Error ? mapError.message : "Could not load database sightings.");
      });

    return () => {
      cancelled = true;
    };
  }, [filters, recentDays, token]);

  const markers = useMemo(() => observations.filter(hasCoordinates), [observations]);

  async function toggleFavorite(observation: VisualizationObservation) {
    const isFavorite = favoriteBirdIds.has(observation.birdId);
    setFavoriteBusyId(observation.birdId);
    setError("");

    try {
      if (isFavorite) {
        await removeFavoriteBird(token, observation.birdId);
        setFavoriteBirdIds((current) => {
          const next = new Set(current);
          next.delete(observation.birdId);
          return next;
        });
      } else {
        await addFavoriteBird(token, observation.birdId);
        setFavoriteBirdIds((current) => new Set(current).add(observation.birdId));
      }
    } catch (favoriteError) {
      setError(favoriteError instanceof Error ? favoriteError.message : "Could not update favorite.");
    } finally {
      setFavoriteBusyId(null);
    }
  }

  return (
    <section className="map-card">
      <div className="map-card-header">
        <div>
          <span>Database view</span>
          <h2>Slovenia sightings map</h2>
          <p>{markers.length} markers from {observations.length} filtered database observations</p>
          {error && <p className="map-error">{error}</p>}
        </div>
        <div className="map-pulse">{markers.length} mapped</div>
      </div>

      <MapContainer center={[46.25, 15.05]} zoom={8} scrollWheelZoom className="leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((observation) => (
          <Marker
            icon={birdMarkerIcon}
            key={observation.observationId}
            eventHandlers={{
              click: () => onSelectObservation(observation)
            }}
            position={[observation.latitude, observation.longitude]}
          >
            <Popup>
              <div className="bird-popup">
                <div className="bird-popup-summary">
                  {observation.imageUrl && (
                    <button
                      aria-label={`Open larger image of ${observation.speciesName}`}
                      className="bird-popup-image"
                      onClick={() => setSelectedImage({
                        src: observation.imageUrl,
                        alt: observation.speciesName
                      })}
                      type="button"
                    >
                      <img
                        alt={observation.speciesName}
                        src={observation.imageUrl}
                      />
                    </button>
                  )}
                  <div className="bird-popup-names">
                    <div className="bird-popup-title">
                      <strong>{observation.speciesName}</strong>
                      <button
                        aria-label={`${favoriteBirdIds.has(observation.birdId) ? "Remove" : "Save"} ${observation.speciesName} favorite`}
                        className={`bookmark-button ${favoriteBirdIds.has(observation.birdId) ? "active" : ""}`}
                        disabled={favoriteBusyId === observation.birdId}
                        onClick={() => toggleFavorite(observation)}
                        title={favoriteBirdIds.has(observation.birdId) ? "Remove from favorites" : "Save to favorites"}
                        type="button"
                      />
                    </div>
                    <span>{observation.scientificName || "Scientific name missing"}</span>
                    <span>{observation.familyName ?? observation.source}</span>
                  </div>
                </div>
                <div className="bird-popup-details">
                  <dl className="bird-popup-column">
                    <div>
                      <dt>Location</dt>
                      <dd>{observation.locationName}</dd>
                    </div>
                    <div>
                      <dt>Observed</dt>
                      <dd>{formatDateTime(observation.eventDate)}</dd>
                    </div>
                  </dl>
                  <dl className="bird-popup-column">
                   <div>
                      <dt>Count</dt>
                      <dd>{observation.observedCount}</dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>{observation.source}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <p className="map-status">{status}</p>
      {selectedImage && (
        <div className="bird-image-lightbox" role="dialog" aria-modal="true" aria-label={selectedImage.alt}>
          <button
            className="bird-image-lightbox-backdrop"
            onClick={() => setSelectedImage(null)}
            type="button"
            aria-label="Close image preview"
          />
          <div className="bird-image-lightbox-content">
            <button className="bird-image-lightbox-close" onClick={() => setSelectedImage(null)} type="button">
              Close
            </button>
            <img alt={selectedImage.alt} src={selectedImage.src} />
          </div>
        </div>
      )}
    </section>
  );
}
