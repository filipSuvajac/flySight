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
    <section className="explore-page">
      <div className="page-heading explore-heading">
        <span>Explore</span>
        <h1>Live bird observations</h1>
      </div>
      <section className="home-grid">
        <FlySightMap />
        <DashboardPanel counts={counts} error={error} />
      </section>
      <EbirdPanel token={token} />
    </section>
  );
}
