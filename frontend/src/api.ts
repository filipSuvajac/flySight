import type { AuthMode, AuthResponse, Counts, Health } from "./types";

export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";
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

