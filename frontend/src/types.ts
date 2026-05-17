export type AuthMode = "login" | "register";

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

export type AuthResponse = {
  user: User;
  token: string;
};

export type EbirdObservation = {
  id: string;
  speciesCode: string;
  commonName: string;
  slovenianName: string;
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

