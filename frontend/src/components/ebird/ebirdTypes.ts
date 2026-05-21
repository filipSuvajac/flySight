import type { EbirdObservation } from "../../types";

export type EbirdMode = "recent" | "hotspots";

export type EbirdSocketMessage =
  | { type: "loading" }
  | {
      type: "observations";
      regionCode: string;
      days: number;
      receivedAt: string;
      observations: EbirdObservation[];
    }
  | { type: "error"; error: string };

