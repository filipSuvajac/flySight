import type { Counts, Health, User } from "../types";
import { AppLayout } from "../layouts/AppLayout";
import { HomePage } from "./HomePage";

type WorkspacePageProps = {
  health: Health | null;
  user: User | null;
  token: string;
  counts: Counts;
  error: string;
  onLogout: () => void;
};

export function WorkspacePage({ health, user, token, counts, error, onLogout }: WorkspacePageProps) {
  return (
    <AppLayout health={health} user={user} onLogout={onLogout}>
      <HomePage token={token} counts={counts} error={error} />
    </AppLayout>
  );
}
