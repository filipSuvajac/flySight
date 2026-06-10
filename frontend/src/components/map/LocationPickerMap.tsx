import { useState } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";

import birdIconUrl from "../../assets/bird-fill-svgrepo-com.svg";

const birdMarkerIcon = L.divIcon({
  className: "bird-marker",
  html: `
    <span class="bird-marker-pin" aria-hidden="true">
      <img src="${birdIconUrl}" alt="" />
    </span>
  `,
  iconSize: [36, 44],
  iconAnchor: [18, 42]
});

function MapEvents({ onLocationSelected }: { onLocationSelected: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelected(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

type LocationPickerMapProps = {
  initialLat: number;
  initialLng: number;
  onSelect: (lat: number, lng: number) => void;
  onClose: () => void;
};

export function LocationPickerMap({ initialLat, initialLng, onSelect, onClose }: LocationPickerMapProps) {
  const [position, setPosition] = useState<[number, number]>([initialLat, initialLng]);

  return (
    <div className="location-picker-modal" style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <div style={{
        background: "white", padding: "16px", borderRadius: "8px", width: "90%", maxWidth: "600px",
        display: "flex", flexDirection: "column", gap: "12px"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "18px", color: "#102a43" }}>Pick Location</h3>
          <button type="button" onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "16px", color: "#627d98" }}>✕</button>
        </div>
        <p style={{ margin: 0, fontSize: "13px", color: "#486581" }}>Click anywhere on the map to set your location.</p>
        <div style={{ height: "400px", width: "100%", borderRadius: "6px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
          <MapContainer center={position} zoom={8} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapEvents onLocationSelected={(lat, lng) => setPosition([lat, lng])} />
            <Marker position={position} icon={birdMarkerIcon} />
          </MapContainer>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
          <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "white", cursor: "pointer", color: "#334155", fontWeight: "bold" }}>Cancel</button>
          <button type="button" onClick={() => onSelect(position[0], position[1])} style={{ padding: "8px 16px", borderRadius: "6px", border: "none", background: "#0f766e", color: "white", cursor: "pointer", fontWeight: "bold" }}>Confirm Location</button>
        </div>
      </div>
    </div>
  );
}
