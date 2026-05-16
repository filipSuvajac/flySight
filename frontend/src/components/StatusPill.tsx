import type { Health } from "../types";

type StatusPillProps = {
  health: Health | null;
};

export function StatusPill({ health }: StatusPillProps) {
  return (
    <span className={health?.database === "connected" ? "status-pill ok" : "status-pill"}>
      API {health?.database ?? "offline"}
    </span>
  );
}

