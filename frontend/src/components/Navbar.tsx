import type { Health, User, WorkspaceRoute } from "../types";
import { isAdminUser } from "../types";
import { StatusPill } from "./StatusPill";

type NavbarProps = {
  health: Health | null;
  user: User | null;
  activeRoute: WorkspaceRoute;
  onRouteChange: (route: WorkspaceRoute) => void;
  onLogout: () => void;
};

const adminNavItems: Array<{ route: WorkspaceRoute; label: string }> = [
  { route: "explore", label: "Explore" },
  { route: "analytics", label: "Analytics" },
  { route: "data", label: "Data" },
  { route: "admin", label: "Admin" },
  { route: "cityinfra", label: "CityInfra" }
];

const userNavItems: Array<{ route: WorkspaceRoute; label: string }> = [
  { route: "explore", label: "Explore" },
  { route: "my-sightings", label: "My Sightings" },
  { route: "favorites", label: "Favorites" },
  { route: "profile", label: "Profile" }
];

export function Navbar({ health, user, activeRoute, onRouteChange, onLogout }: NavbarProps) {
  const isAdmin = isAdminUser(user);
  const visibleItems = isAdmin ? adminNavItems : userNavItems;

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
        {visibleItems.map((item) => (
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
        {isAdmin && <StatusPill health={health} />}
        <div className="avatar">{initials(user?.name ?? user?.email ?? "FS")}</div>
        <div className="profile-copy">
          <strong>{user?.name ?? "Demo user"}</strong>
          <span>{user?.email ?? "signed in"}</span>
          <em>{isAdmin ? "Administrator" : "Standard user"}</em>
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
