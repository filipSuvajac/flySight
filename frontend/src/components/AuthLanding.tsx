import type { AuthMode, Health } from "../types";
import { AuthTabs } from "./AuthTabs";
import { FormField } from "./FormField";

type AuthLandingProps = {
  mode: AuthMode;
  email: string;
  name: string;
  password: string;
  health: Health | null;
  error: string;
  message: string;
  onModeChange: (mode: AuthMode) => void;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (mode: AuthMode) => void;
};

export function AuthLanding({
  mode,
  email,
  name,
  password,
  health: _health,
  error,
  message,
  onModeChange,
  onEmailChange,
  onNameChange,
  onPasswordChange,
  onSubmit
}: AuthLandingProps) {
  return (
    <main className="auth-shell">
      <section className="hero">
        <div className="hero-copy">
          <h1>FlySight</h1>
          <p>
            "Tame birds sing of freedom. Wild birds fly." — John Lennon
          </p>
        </div>

        <section className="auth-card" aria-label="Authentication">
          <AuthTabs mode={mode} onChange={onModeChange} />
          <FormField label="Email" type="email" value={email} onChange={onEmailChange} />
          {mode === "register" && <FormField label="Name" value={name} onChange={onNameChange} />}
          <FormField label="Password" type="password" value={password} onChange={onPasswordChange} />

          <button className="primary-action" onClick={() => onSubmit(mode)}>
            {mode === "login" ? "Login to workspace" : "Create profile"}
          </button>

          {error && <p className="error">{error}</p>}
          {message && <p className="message">{message}</p>}
        </section>
      </section>
    </main>
  );
}

