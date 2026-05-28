import type { ReactNode } from "react";
import type { Health, User, WorkspaceRoute } from "../types";
import { Navbar } from "../components/Navbar";

type AppLayoutProps = {
  health: Health | null;
  user: User | null;
  activeRoute: WorkspaceRoute;
  onRouteChange: (route: WorkspaceRoute) => void;
  onLogout: () => void;
  children: ReactNode;
};

export function AppLayout({ health, user, activeRoute, onRouteChange, onLogout, children }: AppLayoutProps) {
  return (
    <main className="app-frame">
      <Navbar
        health={health}
        user={user}
        activeRoute={activeRoute}
        onRouteChange={onRouteChange}
        onLogout={onLogout}
      />
      <div className="app-shell">{children}</div>
    </main>
  );
}
