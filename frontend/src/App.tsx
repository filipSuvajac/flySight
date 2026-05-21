import { useEffect, useState } from "react";
import { authenticate, fetchHealth, fetchTableCounts } from "./api";
import { AuthPage } from "./pages/AuthPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { clearSession, readStoredUser, storageKeys, storeSession } from "./storage";
import type { AuthMode, Counts, Health, User } from "./types";

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [counts, setCounts] = useState<Counts>({});
  const [error, setError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [token, setToken] = useState(() => localStorage.getItem(storageKeys.token) ?? "");
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
      storeSession(result.token, result.user);
      setToken(result.token);
      setUser(result.user);
      setAuthMessage("");
    } catch (authError) {
      setAuthMessage("");
      setError(authError instanceof Error ? authError.message : "Authentication failed.");
    }
  }

  function handleLogout() {
    clearSession();
    setToken("");
    setUser(null);
    setCounts({});
    setAuthMessage("Logged out.");
  }

  if (!token) {
    return (
      <AuthPage
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
    <WorkspacePage
      health={health}
      user={user}
      token={token}
      counts={counts}
      error={error}
      onLogout={handleLogout}
    />
  );
}
