import { useEffect, useState } from "react";
import {
  fetchBirds,
  fetchPersonalObservations,
  addPersonalObservation,
  deletePersonalObservation
} from "../api";
import type { PersonalObservation, BirdOption } from "../types";
import { LocationPickerMap } from "../components/map/LocationPickerMap";

async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=sl`);
    const data = await res.json();
    return data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || data.name || data.display_name?.split(",")[0] || null;
  } catch {
    return null;
  }
}

type MySightingsPageProps = {
  token: string;
};

export function MySightingsPage({ token }: MySightingsPageProps) {
  const [observations, setObservations] = useState<PersonalObservation[]>([]);
  const [birds, setBirds] = useState<BirdOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Form states
  const [birdId, setBirdId] = useState("");
  const [customBirdName, setCustomBirdName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [observedCount, setObservedCount] = useState(1);
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));

  // Search states
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Map Picker
  const [showMapPicker, setShowMapPicker] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setError("");

    Promise.all([fetchBirds(token), fetchPersonalObservations(token)])
      .then(([birdsData, obsData]) => {
        setBirds(birdsData);
        setObservations(obsData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load data.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest("#bird-search-container")) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleGetCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setLatitude(lat.toFixed(5));
        setLongitude(lon.toFixed(5));
        const name = await reverseGeocode(lat, lon);
        setLocationName(name || "My Current Location");
      },
      (err) => {
        setError("Failed to get current location. Please allow location access or use the map.");
      }
    );
  }

  function handleSelectBird(b: BirdOption) {
    setBirdId(String(b.id));
    setCustomBirdName("");
    setSearchTerm(`${b.name} (${b.latinName})`);
    setIsDropdownOpen(false);
  }

  function handleSelectCustom(name: string) {
    setBirdId("custom");
    setCustomBirdName(name);
    setSearchTerm(`Custom: ${name}`);
    setIsDropdownOpen(false);
  }

  function handleClearSearch() {
    setBirdId("");
    setCustomBirdName("");
    setSearchTerm("");
    setIsDropdownOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!birdId && !customBirdName) {
      setError("Please select or search for a bird species.");
      return;
    }
    if (!locationName.trim()) {
      setError("Location name is required.");
      return;
    }

    const latNum = Number(latitude);
    const lonNum = Number(longitude);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setError("Latitude must be a number between -90 and 90.");
      return;
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      setError("Longitude must be a number between -180 and 180.");
      return;
    }

    setIsSaving(true);
    setError("");
    setSuccessMessage("");

    const payload = birdId && birdId !== "custom"
      ? { birdId: Number(birdId) }
      : { customBirdName: customBirdName.trim() };

    addPersonalObservation(token, {
      ...payload,
      locationName: locationName.trim(),
      latitude: latNum,
      longitude: lonNum,
      observedCount,
      eventDate
    })
      .then((newObs) => {
        setObservations((prev) => [newObs, ...prev]);
        setBirdId("");
        setCustomBirdName("");
        setSearchTerm("");
        setLocationName("");
        setLatitude("");
        setLongitude("");
        setObservedCount(1);
        setEventDate(new Date().toISOString().slice(0, 10));
        setSuccessMessage("Sighting logged successfully!");
        setTimeout(() => setSuccessMessage(""), 4000);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to save sighting.");
      })
      .finally(() => {
        setIsSaving(false);
      });
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Are you sure you want to delete this observation?")) return;

    setError("");
    deletePersonalObservation(token, id)
      .then(() => {
        setObservations((prev) => prev.filter((o) => o.id !== id));
        setSuccessMessage("Observation deleted successfully.");
        setTimeout(() => setSuccessMessage(""), 3000);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to delete observation.");
      });
  }

  const filteredBirds = birds.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.latinName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <section className="route-page">
        <div className="page-heading">
          <span>My Sightings</span>
          <h1>Loading observations...</h1>
        </div>
      </section>
    );
  }

  return (
    <section className="route-page">
      <div className="page-heading">
        <span>My Sightings</span>
        <h1>Personal observations</h1>
      </div>

      <div className="route-grid">
        {/* Sighting Logging Form */}
        <div className="route-panel">
          <h2>Log new sighting</h2>
          <p style={{ color: "#52606d", fontSize: "14px", marginBottom: "20px" }}>
            Record a bird observation to your personal log.
          </p>

          {error && (
            <p style={{ color: "#b42318", marginBottom: "16px", fontWeight: "bold" }}>
              {error}
            </p>
          )}

          {successMessage && (
            <p style={{ color: "#0f766e", marginBottom: "16px", fontWeight: "bold" }}>
              {successMessage}
            </p>
          )}

          <form onSubmit={handleSave} style={{ display: "grid", gap: "16px" }}>
            {/* Searchable Species dropdown */}
            <div className="field" id="bird-search-container" style={{ position: "relative" }}>
              <label htmlFor="bird-search">Species</label>
              <div style={{ display: "flex", gap: "8px", position: "relative" }}>
                <input
                  id="bird-search"
                  type="text"
                  placeholder="Type to search species..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setIsDropdownOpen(true);
                    setBirdId("");
                    setCustomBirdName("");
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  style={{ width: "100%", paddingRight: "30px" }}
                  autoComplete="off"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontSize: "14px",
                      color: "#94a3b8",
                      padding: 0
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {isDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    background: "white",
                    border: "1px solid #cbd5e1",
                    borderRadius: "6px",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
                    maxHeight: "220px",
                    overflowY: "auto",
                    zIndex: 50,
                    marginTop: "4px"
                  }}
                >
                  {filteredBirds.map((b) => (
                    <div
                      key={b.id}
                      onClick={() => handleSelectBird(b)}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderBottom: "1px solid #f1f5f9",
                        fontSize: "14px",
                        textAlign: "left"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <strong>{b.name}</strong>{" "}
                      <span style={{ color: "#64748b", fontSize: "12px" }}>({b.latinName})</span>
                    </div>
                  ))}

                  {searchTerm.trim().length > 0 && (
                    <div
                      onClick={() => handleSelectCustom(searchTerm.trim())}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        background: "#f0fdf4",
                        color: "#166534",
                        fontSize: "14px",
                        fontWeight: "bold",
                        borderTop: "1px solid #bbf7d0",
                        textAlign: "left"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#dcfce7")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#f0fdf4")}
                    >
                      ➕ Use custom species: "{searchTerm.trim()}"
                    </div>
                  )}

                  {filteredBirds.length === 0 && searchTerm.trim().length === 0 && (
                    <div style={{ padding: "8px 12px", color: "#64748b", fontSize: "14px", textAlign: "left" }}>
                      No species in database. Type to enter a custom species.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="field">
              <label htmlFor="obs-date">Date</label>
              <input
                id="obs-date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="obs-count">Count</label>
              <input
                id="obs-count"
                type="number"
                min="1"
                value={observedCount}
                onChange={(e) => setObservedCount(Math.max(1, Number(e.target.value)))}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="obs-location">Location Name</label>
              <input
                id="obs-location"
                type="text"
                placeholder="E.g. Tivoli Park"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="field">
                <label htmlFor="obs-lat">Latitude</label>
                <input
                  id="obs-lat"
                  type="text"
                  placeholder="E.g. 46.05"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="obs-lon">Longitude</label>
                <input
                  id="obs-lon"
                  type="text"
                  placeholder="E.g. 14.51"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={handleGetCurrentLocation}
                style={{
                  background: "#f0fdf4",
                  color: "#166534",
                  border: "1px dashed #bbf7d0",
                  padding: "6px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                  flex: 1
                }}
              >
                📍 Current Location
              </button>
              <button
                type="button"
                onClick={() => setShowMapPicker(true)}
                style={{
                  background: "#f0f9ff",
                  color: "#0369a1",
                  border: "1px dashed #bae6fd",
                  padding: "6px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  cursor: "pointer",
                  flex: 1
                }}
              >
                🗺️ Pick on Map
              </button>
            </div>

            <button type="submit" className="primary-action" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Sighting"}
            </button>
          </form>
        </div>

        {/* Observations List */}
        <div className="route-panel wide">
          <h2>Sightings log</h2>
          <p style={{ color: "#52606d", fontSize: "14px", marginBottom: "20px" }}>
            Your personal record of observations.
          </p>

          {observations.length === 0 ? (
            <p style={{ color: "#627d98", fontStyle: "italic" }}>
              No observations logged yet. Use the form on the left to add one!
            </p>
          ) : (
            <div style={{ display: "grid", gap: "12px" }}>
              {observations.map((obs) => (
                <div
                  key={obs.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    background: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px"
                  }}
                >
                  <div>
                    <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", textAlign: "left" }}>
                      {obs.birdName} <span style={{ fontSize: "13px", color: "#627d98", fontStyle: "italic" }}>({obs.birdLatinName})</span>
                    </h3>
                    <p style={{ margin: 0, fontSize: "13px", color: "#486581", textAlign: "left" }}>
                      📍 <strong>{obs.locationName}</strong> ({obs.latitude.toFixed(4)}, {obs.longitude.toFixed(4)})
                    </p>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#627d98", textAlign: "left" }}>
                      📅 {obs.eventDate} &nbsp;|&nbsp; 👥 Count: <strong>{obs.observedCount}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(obs.id)}
                    style={{
                      background: "#fee2e2",
                      color: "#991b1b",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      cursor: "pointer",
                      fontWeight: "bold"
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showMapPicker && (
        <LocationPickerMap
          initialLat={Number(latitude) || 46.0569}
          initialLng={Number(longitude) || 14.5058}
          onSelect={async (lat, lng) => {
            setLatitude(lat.toFixed(5));
            setLongitude(lng.toFixed(5));
            const name = await reverseGeocode(lat, lng);
            setLocationName(name || "Picked Location");
            setShowMapPicker(false);
          }}
          onClose={() => setShowMapPicker(false)}
        />
      )}
    </section>
  );
}
