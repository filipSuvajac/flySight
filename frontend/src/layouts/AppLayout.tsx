import type { ReactNode } from "react";
import type { Health, User } from "../types";
import { Navbar } from "../components/Navbar";

type AppLayoutProps = {
  health: Health | null;
  user: User | null;
  onLogout: () => void;
  children: ReactNode;
};

export function AppLayout({ health, user, onLogout, children }: AppLayoutProps) {
  return (
    <main className="app-frame">
      <Navbar health={health} user={user} onLogout={onLogout} />
      <div className="app-shell">{children}</div>
    </main>
  );
}
