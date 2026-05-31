import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { fetchRecentEbirdObservations } from "../../api";
import type { EbirdObservation } from "../../types";
import { formatDateTime } from "../ebird/format";
import birdIconUrl from "../../assets/bird-fill-svgrepo-com.svg";

type FlySightMapProps = {
  token: string;
};

function hasCoordinates(observation: EbirdObservation): observation is EbirdObservation & {
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

export function FlySightMap({ token }: FlySightMapProps) {
  const [observations, setObservations] = useState<EbirdObservation[]>([]);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const [status, setStatus] = useState("Loading eBird sightings...");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setStatus("Loading eBird sightings...");
    setError("");

    fetchRecentEbirdObservations(token)
      .then((nextObservations) => {
        if (cancelled) return;
        setObservations(nextObservations);
        setStatus(`${nextObservations.length} recent eBird sightings`);
      })
      .catch((mapError: unknown) => {
        if (cancelled) return;
        setObservations([]);
        setStatus("eBird map needs attention");
        setError(mapError instanceof Error ? mapError.message : "Could not load eBird sightings.");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const markers = useMemo(() => observations.filter(hasCoordinates), [observations]);

  return (
    <section className="map-card">
      <div className="map-card-header">
        <div>
          <span>Live eBird view</span>
          <h2>Slovenia sightings map</h2>
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
            key={observation.id}
            position={[observation.latitude, observation.longitude]}
          >
            <Popup>
              <div className="bird-popup">
                <div className="bird-popup-summary">
                  {observation.imageUrl && (
                    <button
                      aria-label={`Open larger image of ${observation.slovenianName || observation.commonName}`}
                      className="bird-popup-image"
                      onClick={() => setSelectedImage({
                        src: observation.imageUrl,
                        alt: observation.slovenianName || observation.commonName
                      })}
                      type="button"
                    >
                      <img
                        alt={observation.slovenianName || observation.commonName}
                        src={observation.imageUrl}
                      />
                    </button>
                  )}
                  <div className="bird-popup-names">
                    <strong>{observation.slovenianName || observation.commonName}</strong>
                    <span>{observation.commonName}</span>
                    <span>{observation.scientificName || observation.speciesCode}</span>
                  </div>
                </div>
                <div className="bird-popup-details">
                  <dl className="bird-popup-column">
                    <div>
                      <dt>Location</dt>
                      <dd>{observation.locationName || observation.city}</dd>
                    </div>
                    <div>
                      <dt>Observed</dt>
                      <dd>{formatDateTime(observation.observedAt)}</dd>
                    </div>
                  </dl>
                  <dl className="bird-popup-column">
                   <div>
                      <dt>Count</dt>
                      <dd>{observation.count ?? "-"}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{observation.reviewed ? "Reviewed" : observation.valid ? "Valid" : "Pending"}</dd>
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
