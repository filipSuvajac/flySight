import type { User } from "./types";

export const storageKeys = {
  token: "flysight_token",
  user: "flysight_user"
};

export function readStoredUser() {
  const stored = localStorage.getItem(storageKeys.user);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as User;
  } catch {
    localStorage.removeItem(storageKeys.user);
    return null;
  }
}

export function storeSession(token: string, user: User) {
  localStorage.setItem(storageKeys.token, token);
  localStorage.setItem(storageKeys.user, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(storageKeys.token);
  localStorage.removeItem(storageKeys.user);
}

