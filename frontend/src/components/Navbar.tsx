import type { Health, User } from "../types";
import { StatusPill } from "./StatusPill";

type NavbarProps = {
  health: Health | null;
  user: User | null;
  onLogout: () => void;
};

export function Navbar({ health, user, onLogout }: NavbarProps) {
  return (
    <nav className="navbar">
      <div className="brand">
        <div className="brand-mark">FS</div>
        <div>
          <strong>FlySight</strong>
          <span>Digital twin</span>
        </div>
      </div>

      <div className="nav-tabs" aria-label="Demo navigation">
        <button className="active">Dashboard</button>
        <button>Map</button>
        <button>Data</button>
        <button>Admin</button>
      </div>

      <div className="profile-chip">
        <StatusPill health={health} />
        <div className="avatar">{initials(user?.name ?? user?.email ?? "FS")}</div>
        <div className="profile-copy">
          <strong>{user?.name ?? "Demo user"}</strong>
          <span>{user?.email ?? "signed in"}</span>
        </div>
        <button className="secondary compact" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "FS";
}
