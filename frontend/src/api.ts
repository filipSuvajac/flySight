import type {
  AuthMode,
  AuthResponse,
  Counts,
  DataSourceSettings,
  EbirdHotspot,
  EbirdObservation,
  Health,
  UserProfile,
  PersonalObservation,
  BirdOption
} from "./types";

export const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost" : window.location.origin);
export const TABLES = ["bird_family", "bird_info", "location", "observation"];

export function webSocketUrl(path: string, params: Record<string, string>) {
  const url = new URL(path, API_URL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

export async function fetchHealth(): Promise<Health> {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) throw new Error(`Health check failed with HTTP ${response.status}`);
  return response.json() as Promise<Health>;
}

export async function authenticate(
  mode: AuthMode,
  values: { email: string; name: string; password: string }
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/auth/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mode === "login"
      ? { email: values.email, password: values.password }
      : values
    )
  });
  const payload = (await response.json()) as AuthResponse | { error?: string };
  if (!response.ok || !("token" in payload)) {
    throw new Error("error" in payload ? payload.error : `HTTP ${response.status}`);
  }
  return payload;
}

export async function fetchTableCounts(token: string): Promise<Counts> {
  const nextCounts: Counts = {};
  for (const table of TABLES) {
    const response = await fetch(`${API_URL}/api/${table}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) throw new Error(`API ${table} failed with HTTP ${response.status}`);
    const rows = await response.json();
    nextCounts[table] = Array.isArray(rows) ? rows.length : 0;
  }
  return nextCounts;
}

export async function fetchEbirdHotspots(token: string): Promise<EbirdHotspot[]> {
  const response = await fetch(`${API_URL}/api/ebird/hotspots`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`eBird hotspots failed with HTTP ${response.status}`);
  const payload = (await response.json()) as { hotspots?: EbirdHotspot[] };
  return Array.isArray(payload.hotspots) ? payload.hotspots : [];
}

export async function fetchRecentEbirdObservations(token: string, days = 30, maxResults?: number): Promise<EbirdObservation[]> {
  const params = new URLSearchParams({ days: String(days) });
  if (maxResults !== undefined) params.set("maxResults", String(maxResults));

  const response = await fetch(`${API_URL}/api/ebird/recent?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`eBird observations failed with HTTP ${response.status}`);
  const payload = (await response.json()) as { observations?: EbirdObservation[] };
  return Array.isArray(payload.observations) ? payload.observations : [];
}

export async function fetchVisualizationObservations(
  token: string,
  filters: { species?: string; location?: string; date?: string; source?: string; mineOnly?: boolean },
  recentDays = "30",
  limit = 1000
): Promise<VisualizationObservation[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (filters.species) params.set("species", filters.species);
  if (filters.location) params.set("location", filters.location);
  if (filters.mineOnly) params.set("mineOnly", "true");
  if (filters.date) {
    params.set("from", filters.date);
    params.set("to", filters.date);
  } else if (recentDays !== "all") {
    const days = Number(recentDays) || 30;
    const from = new Date();
    from.setDate(from.getDate() - days);
    params.set("from", from.toISOString().slice(0, 10));
  }
  if (filters.source) params.set("source", filters.source);

  const response = await fetch(`${API_URL}/api/visualization/observations?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Observation visualization failed with HTTP ${response.status}`);
  const payload = (await response.json()) as { observations?: VisualizationObservation[] };
  return Array.isArray(payload.observations) ? payload.observations : [];
}

export async function fetchFavoriteBirds(token: string): Promise<FavoriteBird[]> {
  const response = await fetch(`${API_URL}/api/me/favorites`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Failed to load favorites with HTTP ${response.status}`);
  const payload = (await response.json()) as { favorites?: FavoriteBird[] };
  return Array.isArray(payload.favorites) ? payload.favorites : [];
}

export async function addFavoriteBird(token: string, birdId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/me/favorites`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ birdId })
  });
  if (!response.ok) throw new Error(`Failed to save favorite with HTTP ${response.status}`);
}

export async function removeFavoriteBird(token: string, birdId: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/me/favorites/${birdId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Failed to remove favorite with HTTP ${response.status}`);
}

export async function fetchEbirdHotspotObservations(
  token: string,
  locId: string,
  days: number
): Promise<EbirdObservation[]> {
  const response = await fetch(`${API_URL}/api/ebird/hotspots/${encodeURIComponent(locId)}/recent?days=${days}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`eBird hotspot observations failed with HTTP ${response.status}`);
  const payload = (await response.json()) as { observations?: EbirdObservation[] };
  return Array.isArray(payload.observations) ? payload.observations : [];
}

export async function fetchDataSources(token: string): Promise<DataSourceSettings[]> {
  const response = await fetch(`${API_URL}/api/data-sources`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Data sources failed with HTTP ${response.status}`);
  const payload = (await response.json()) as { sources?: DataSourceSettings[] };
  return Array.isArray(payload.sources) ? payload.sources : [];
}

export async function updateDataSource(
  token: string,
  key: string,
  values: Partial<Pick<DataSourceSettings, "enabled" | "region" | "maxResults" | "recentDays" | "settings">> & {
    markSynced?: boolean;
  }
): Promise<DataSourceSettings> {
  const response = await fetch(`${API_URL}/api/data-sources/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(values)
  });
  if (!response.ok) throw new Error(`Data source update failed with HTTP ${response.status}`);
  return response.json() as Promise<DataSourceSettings>;
}

export async function runDataSourceAction(
  token: string,
  source: DataSourceSettings
): Promise<{ message: string; source: DataSourceSettings }> {
  if (source.key === "ebird") {
    const recentDays = Number.isFinite(source.recentDays) ? source.recentDays : 30;
    const maxResults = Number.isFinite(source.maxResults) ? source.maxResults : 500;
    const observations = await fetchRecentEbirdObservations(token, recentDays, maxResults);
    const synced = await updateDataSource(token, source.key, { markSynced: true });
    return { message: `Fetched ${observations.length} eBird observations.`, source: synced };
  }

  if (source.key === "generated") {
    const maxResults = Number.isFinite(source.maxResults) ? source.maxResults : 10;
    const generatedCount = Math.min(Math.max(maxResults, 1), 25);
    const response = await fetch(`${API_URL}/api/generate/observations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ count: generatedCount, minObserved: 1, maxObserved: 12 })
    });
    if (!response.ok) throw new Error(`Generate data failed with HTTP ${response.status}`);
    const payload = (await response.json()) as { generated?: number };
    const synced = await updateDataSource(token, source.key, { markSynced: true });
    return { message: `Generated ${payload.generated ?? generatedCount} demo observations.`, source: synced };
  }

  if (source.key === "dopps") {
    const response = await fetch(`${API_URL}/api/import/dopps`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify([])
    });
    if (!response.ok) throw new Error(`DOPPS import failed with HTTP ${response.status}`);
    const synced = await updateDataSource(token, source.key, { markSynced: true });
    return { message: "DOPPS import endpoint is reachable.", source: synced };
  }

  const synced = await updateDataSource(token, source.key, { markSynced: true });
  return { message: `${source.name} marked as synced.`, source: synced };
}

export async function fetchProfile(token: string): Promise<UserProfile> {
  const response = await fetch(`${API_URL}/api/me/profile`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Profile load failed with HTTP ${response.status}`);
  return response.json() as Promise<UserProfile>;
}

export async function updateProfile(
  token: string,
  profile: { bio: string; location: string }
): Promise<UserProfile> {
  const response = await fetch(`${API_URL}/api/me/profile`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(profile)
  });
  if (!response.ok) throw new Error(`Profile update failed with HTTP ${response.status}`);
  return response.json() as Promise<UserProfile>;
}

export async function fetchBirds(token: string): Promise<BirdOption[]> {
  const response = await fetch(`${API_URL}/api/birds`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Failed to load species with HTTP ${response.status}`);
  return response.json() as Promise<BirdOption[]>;
}

export async function fetchPersonalObservations(token: string): Promise<PersonalObservation[]> {
  const response = await fetch(`${API_URL}/api/me/observations`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Failed to load observations with HTTP ${response.status}`);
  return response.json() as Promise<PersonalObservation[]>;
}

export async function addPersonalObservation(
  token: string,
  observation: {
    birdId?: number;
    customBirdName?: string;
    locationName: string;
    latitude: number;
    longitude: number;
    observedCount: number;
    eventDate: string;
  }
): Promise<PersonalObservation> {
  const response = await fetch(`${API_URL}/api/me/observations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(observation)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Failed to save observation with HTTP ${response.status}`);
  }
  return response.json() as Promise<PersonalObservation>;
}

export async function deletePersonalObservation(token: string, id: number): Promise<void> {
  const response = await fetch(`${API_URL}/api/me/observations/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error(`Failed to delete observation with HTTP ${response.status}`);
}

