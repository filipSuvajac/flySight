import type { Health, User, WorkspaceRoute } from "../types";
import { StatusPill } from "./StatusPill";

type NavbarProps = {
  health: Health | null;
  user: User | null;
  activeRoute: WorkspaceRoute;
  onRouteChange: (route: WorkspaceRoute) => void;
  onLogout: () => void;
};

const navItems: Array<{ route: WorkspaceRoute; label: string }> = [
  { route: "explore", label: "Explore" },
  { route: "analytics", label: "Analytics" },
  { route: "data", label: "Data" },
  { route: "admin", label: "Admin" },
  { route: "cityinfra", label: "CityInfra" }
];

export function Navbar({ health, user, activeRoute, onRouteChange, onLogout }: NavbarProps) {
  return (
    <nav className="navbar">
      <div className="brand">
        <div className="brand-mark">FS</div>
        <div>
          <strong>FlySight</strong>
          <span>Digital twin</span>
        </div>
      </div>

      <div className="nav-tabs" aria-label="Workspace navigation">
        {navItems.map((item) => (
          <button
            key={item.route}
            className={item.route === activeRoute ? "active" : ""}
            aria-current={item.route === activeRoute ? "page" : undefined}
            onClick={() => onRouteChange(item.route)}
          >
            {item.label}
          </button>
        ))}
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
