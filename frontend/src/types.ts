export type AuthMode = "login" | "register";

export type WorkspaceRoute = "explore" | "analytics" | "data" | "admin" | "cityinfra";

export type Health = {
  status: string;
  database: string;
};

export type Counts = Record<string, number>;

export type User = {
  id: number;
  email: string;
  name: string;
  role: string;
};

export function isAdminUser(user: User | null) {
  return user?.role === "admin";
}

export type AuthResponse = {
  user: User;
  token: string;
};

export type EbirdObservation = {
  id: string;
  speciesCode: string;
  commonName: string;
  slovenianName: string;
  imageUrl: string;
  scientificName: string;
  locationName: string;
  city: string;
  observedAt: string;
  count: number | null;
  latitude: number | null;
  longitude: number | null;
  region: string;
  valid: boolean;
  reviewed: boolean;
};

export type EbirdHotspot = {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  countryCode: string;
  subnational1Code: string;
  subnational2Code: string;
  latestObservationDate: string;
  speciesAllTime: number | null;
};

export type DataSourceSettings = {
  key: string;
  name: string;
  enabled: boolean;
  region: string;
  maxResults: number;
  recentDays: number;
  settings: Record<string, unknown>;
  lastSync: string | null;
  updatedAt: string;
};
