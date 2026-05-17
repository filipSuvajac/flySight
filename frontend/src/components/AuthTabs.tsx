import type { AuthMode } from "../types";

type AuthTabsProps = {
  mode: AuthMode;
  onChange: (mode: AuthMode) => void;
};

const tabs: Array<{ mode: AuthMode; label: string }> = [
  { mode: "login", label: "Login" },
  { mode: "register", label: "Register" }
];

export function AuthTabs({ mode, onChange }: AuthTabsProps) {
  return (
    <div className="auth-tabs">
      {tabs.map((tab) => (
        <button
          className={mode === tab.mode ? "active" : ""}
          key={tab.mode}
          onClick={() => onChange(tab.mode)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

