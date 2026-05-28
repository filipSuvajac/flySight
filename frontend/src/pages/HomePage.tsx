import type { Counts } from "../types";
import { DashboardPanel } from "../components/dashboard/DashboardPanel";
import { EbirdPanel } from "../components/ebird/EbirdPanel";
import { FlySightMap } from "../components/map/FlySightMap";

type HomePageProps = {
  token: string;
  counts: Counts;
  error: string;
};

export function HomePage({ token, counts, error }: HomePageProps) {
  return (
    <>
      <section className="home-grid">
        <FlySightMap token={token} />
        <DashboardPanel counts={counts} error={error} />
      </section>
      <EbirdPanel token={token} />
    </>
  );
}

