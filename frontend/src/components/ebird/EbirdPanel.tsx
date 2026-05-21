import { useEffect, useMemo, useRef, useState } from "react";
import { fetchEbirdHotspotObservations, fetchEbirdHotspots, webSocketUrl } from "../../api";
import type { EbirdHotspot, EbirdObservation } from "../../types";
import { EbirdFilters } from "./EbirdFilters";
import type { EbirdMode, EbirdSocketMessage } from "./ebirdTypes";
import { formatDateTime } from "./format";
import { HotspotDetails } from "./HotspotDetails";
import { HotspotsTable } from "./HotspotsTable";
import { ModeTabs } from "./ModeTabs";
import { RecentObservationsTable } from "./RecentObservationsTable";

type EbirdPanelProps = {
  token: string;
};

export function EbirdPanel({ token }: EbirdPanelProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const [mode, setMode] = useState<EbirdMode>("recent");
  const [recentDays, setRecentDays] = useState("30");
  const [observations, setObservations] = useState<EbirdObservation[]>([]);
  const [hotspots, setHotspots] = useState<EbirdHotspot[]>([]);
  const [selectedHotspot, setSelectedHotspot] = useState<EbirdHotspot | null>(null);
  const [hotspotObservations, setHotspotObservations] = useState<EbirdObservation[]>([]);
  const [hotspotDetailStatus, setHotspotDetailStatus] = useState("");
  const [status, setStatus] = useState("Connecting to eBird stream...");
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const minDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  }, []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    const socket = new WebSocket(webSocketUrl("/ws/ebird", { token }));
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setStatus("Loading recent Slovenia observations from eBird...");
      setError("");
      socket.send(JSON.stringify({ type: "refresh", days: Number(recentDays) || 30 }));
    });

    socket.addEventListener("message", (event) => handleSocketMessage(event.data));
    socket.addEventListener("close", () => {
      if (socketRef.current === socket) setStatus("eBird stream disconnected");
    });
    socket.addEventListener("error", () => {
      setError("Could not connect to the eBird WebSocket.");
      setStatus("eBird stream needs attention");
    });

    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, [recentDays, token]);

  useEffect(() => {
    if (mode !== "hotspots" || hotspots.length > 0) return;
    loadHotspots();
  }, [hotspots.length, mode]);

  useEffect(() => {
    if (mode !== "hotspots" || !selectedHotspot) return;
    loadHotspotDetails(selectedHotspot);
  }, [mode, recentDays, selectedHotspot]);

  const filteredObservations = useMemo(() => {
    const location = locationFilter.trim().toLowerCase();
    const species = speciesFilter.trim().toLowerCase();

    return observations.filter((observation) => {
      const observedDate = observation.observedAt.slice(0, 10);
      const locationMatch =
        !location ||
        observation.city.toLowerCase().includes(location) ||
        observation.locationName.toLowerCase().includes(location);
      const speciesMatch =
        !species ||
        observation.slovenianName.toLowerCase().includes(species) ||
        observation.commonName.toLowerCase().includes(species) ||
        observation.scientificName.toLowerCase().includes(species) ||
        observation.speciesCode.toLowerCase().includes(species);
      const dateMatch = !dateFilter || observedDate === dateFilter;

      return locationMatch && speciesMatch && dateMatch;
    });
  }, [dateFilter, locationFilter, observations, speciesFilter]);

  const filteredHotspots = useMemo(() => {
    const location = locationFilter.trim().toLowerCase();
    return hotspots.filter((hotspot) => !location || hotspot.name.toLowerCase().includes(location));
  }, [hotspots, locationFilter]);

  function handleSocketMessage(data: string) {
    let message: EbirdSocketMessage;
    try {
      message = JSON.parse(data) as EbirdSocketMessage;
    } catch {
      setError("Received an invalid eBird WebSocket message.");
      return;
    }

    if (message.type === "loading") {
      setStatus("Loading recent Slovenia observations from eBird...");
      return;
    }
    if (message.type === "error") {
      setError(message.error);
      setStatus("eBird stream needs attention");
      return;
    }

    setObservations(message.observations);
    setLastUpdated(message.receivedAt);
    setError("");
    setStatus(`${message.observations.length} recent observations received for Slovenia`);
  }

  function refreshRecentObservations() {
    socketRef.current?.send(JSON.stringify({ type: "refresh", days: Number(recentDays) || 30 }));
  }

  function loadHotspots() {
    setStatus("Loading all-time eBird hotspots...");
    fetchEbirdHotspots(token)
      .then((nextHotspots) => {
        setHotspots(nextHotspots);
        setError("");
        setStatus(`${nextHotspots.length} all-time eBird hotspots loaded for Slovenia`);
      })
      .catch((hotspotError: unknown) => {
        setError(hotspotError instanceof Error ? hotspotError.message : "Could not load eBird hotspots.");
        setStatus("eBird hotspots need attention");
      });
  }

  function loadHotspotDetails(hotspot: EbirdHotspot) {
    setSelectedHotspot(hotspot);
    setHotspotDetailStatus(`Loading recent sightings for ${hotspot.name}...`);
    fetchEbirdHotspotObservations(token, hotspot.id, Number(recentDays) || 30)
      .then((nextObservations) => {
        setHotspotObservations(nextObservations);
        setHotspotDetailStatus(`${nextObservations.length} sightings loaded for ${hotspot.name}`);
      })
      .catch((detailError: unknown) => {
        setHotspotObservations([]);
        setHotspotDetailStatus("");
        setError(detailError instanceof Error ? detailError.message : "Could not load hotspot sightings.");
      });
  }

  return (
    <section className="workspace-panel ebird-panel">
      <div className="panel-heading">
        <div>
          <h2>eBird data in Slovenia</h2>
          <p>{status}</p>
          {lastUpdated && mode === "recent" && <p>Last updated {formatDateTime(lastUpdated)}</p>}
        </div>
        <button className="secondary" onClick={mode === "recent" ? refreshRecentObservations : loadHotspots}>
          Refresh
        </button>
      </div>

      <ModeTabs mode={mode} onChange={setMode} />
      {error && <p className="error">{error}</p>}

      <EbirdFilters
        mode={mode}
        locationFilter={locationFilter}
        speciesFilter={speciesFilter}
        dateFilter={dateFilter}
        recentDays={recentDays}
        minDate={minDate}
        today={today}
        onLocationChange={setLocationFilter}
        onSpeciesChange={setSpeciesFilter}
        onDateChange={setDateFilter}
        onRecentDaysChange={setRecentDays}
      />

      {mode === "recent" ? (
        <RecentObservationsTable observations={filteredObservations} />
      ) : (
        <>
          <HotspotsTable
            hotspots={filteredHotspots}
            selectedHotspotId={selectedHotspot?.id ?? ""}
            onSelect={loadHotspotDetails}
          />
          {selectedHotspot && (
            <HotspotDetails
              hotspot={selectedHotspot}
              observations={hotspotObservations}
              status={hotspotDetailStatus}
              recentDays={recentDays}
              onClose={() => setSelectedHotspot(null)}
            />
          )}
        </>
      )}
    </section>
  );
}

