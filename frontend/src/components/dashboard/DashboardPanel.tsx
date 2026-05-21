import type { Counts } from "../../types";
import { StatsGrid } from "../StatsGrid";
import { WorkspaceIntro } from "../WorkspaceIntro";

type DashboardPanelProps = {
  counts: Counts;
  error: string;
};

export function DashboardPanel({ counts, error }: DashboardPanelProps) {
  return (
    <aside className="dashboard-panel">
      {error && <p className="error">{error}</p>}
      <StatsGrid counts={counts} />
      <WorkspaceIntro />
    </aside>
  );
}

