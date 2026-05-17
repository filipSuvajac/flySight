import { useEffect, useState } from "react";
import { authenticate, fetchHealth, fetchTableCounts } from "./api";
import { AuthLanding } from "./components/AuthLanding";
import { Dashboard } from "./components/Dashboard";
import type { AuthMode, Counts, Health, User } from "./types";

const storage = {
  token: "flysight_token",
  user: "flysight_user"
};

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [counts, setCounts] = useState<Counts>({});
  const [error, setError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [token, setToken] = useState(() => localStorage.getItem(storage.token) ?? "");
  const [user, setUser] = useState<User | null>(() => readStoredUser());
  const [email, setEmail] = useState("demo@flysight.test");
  const [name, setName] = useState("Demo User");
  const [password, setPassword] = useState("password123");

  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    if (!token) return;

    fetchTableCounts(token)
      .then((nextCounts) => {
        setError("");
        setCounts(nextCounts);
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load API data.");
      });
  }, [token]);

  async function handleAuthenticate(mode: AuthMode) {
    try {
      setError("");
      setAuthMessage(mode === "login" ? "Logging in..." : "Creating profile...");
      const result = await authenticate(mode, { email, name, password });
      localStorage.setItem(storage.token, result.token);
      localStorage.setItem(storage.user, JSON.stringify(result.user));
      setToken(result.token);
      setUser(result.user);
      setAuthMessage("");
    } catch (authError) {
      setAuthMessage("");
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    }
  }

  function handleLogout() {
    localStorage.removeItem(storage.token);
    localStorage.removeItem(storage.user);
    setToken("");
    setUser(null);
    setCounts({});
    setAuthMessage("Logged out.");
  }

  if (!token) {
    return (
      <AuthLanding
        mode={authMode}
        email={email}
        name={name}
        password={password}
        health={health}
        error={error}
        message={authMessage}
        onModeChange={setAuthMode}
        onEmailChange={setEmail}
        onNameChange={setName}
        onPasswordChange={setPassword}
        onSubmit={handleAuthenticate}
      />
    );
  }

  return (
    <Dashboard
      health={health}
      user={user}
      counts={counts}
      error={error}
      onLogout={handleLogout}
    />
  );
}

function readStoredUser() {
  const stored = localStorage.getItem(storage.user);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as User;
  } catch {
    localStorage.removeItem(storage.user);
    return null;
  }
}

