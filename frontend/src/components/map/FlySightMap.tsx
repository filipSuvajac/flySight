import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

type DemoMarker = {
  name: string;
  description: string;
  position: [number, number];
};

const demoMarkers: DemoMarker[] = [
  {
    name: "Maribor",
    description: "Demo hotspot area around the Drava river.",
    position: [46.5547, 15.6459]
  },
  {
    name: "Ljubljana",
    description: "Demo central Slovenia observation cluster.",
    position: [46.0569, 14.5058]
  },
  {
    name: "Mestni park Maribor",
    description: "Example city park marker for hotspot exploration.",
    position: [46.565, 15.644]
  }
];

export function FlySightMap() {
  return (
    <section className="map-card">
      <div className="map-card-header">
        <div>
          <span>Habitat map</span>
          <h2>Bird activity across Slovenia</h2>
        </div>
        <div className="map-pulse">Marker layer</div>
      </div>

      <MapContainer center={[46.25, 15.05]} zoom={8} scrollWheelZoom className="leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {demoMarkers.map((marker) => (
          <Marker key={marker.name} position={marker.position}>
            <Popup>
              <strong>{marker.name}</strong>
              <br />
              {marker.description}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </section>
  );
}
