import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fetchFavoriteBirds, removeFavoriteBird } from "../api";
import type { Counts, FavoriteBird, Health, User, WorkspaceRoute } from "../types";
import { isAdminUser } from "../types";
import { AppLayout } from "../layouts/AppLayout";
import { HomePage } from "./HomePage";
import { AdminPage } from "./AdminPage";
import { ProfilePage } from "./ProfilePage";
import { MySightingsPage } from "./MySightingsPage";
import { StatsGrid } from "../components/StatsGrid";

type WorkspacePageProps = {
  health: Health | null;
  user: User | null;
  token: string;
  counts: Counts;
  error: string;
  onSessionChange: (token: string, user: User) => void;
  onLogout: () => void;
};

export function WorkspacePage({ health, user, token, counts, error, onSessionChange, onLogout }: WorkspacePageProps) {
  const [activeRoute, setActiveRoute] = useState<WorkspaceRoute>("explore");
  const isAdmin = isAdminUser(user);
  const allowedUserRoutes: WorkspaceRoute[] = ["explore", "my-sightings", "favorites", "profile"];
  const safeRoute = !isAdmin && !allowedUserRoutes.includes(activeRoute) ? "explore" : activeRoute;

  function handleRouteChange(route: WorkspaceRoute) {
    if (!isAdmin && !allowedUserRoutes.includes(route)) return;
    setActiveRoute(route);
  }

  return (
    <AppLayout health={health} user={user} activeRoute={safeRoute} onRouteChange={handleRouteChange} onLogout={onLogout}>
      {safeRoute === "explore" && <HomePage token={token} user={user} />}
      {safeRoute === "analytics" && <AnalyticsPage counts={counts} />}
      {safeRoute === "data" && <DataPage counts={counts} error={error} />}
      {safeRoute === "admin" && isAdmin && <AdminPage health={health} token={token} />}
      {safeRoute === "cityinfra" && <CityInfraPage />}
      {safeRoute === "my-sightings" && <MySightingsPage token={token} />}
      {safeRoute === "favorites" && <FavoritesPage token={token} />}
      {safeRoute === "profile" && <ProfilePage token={token} onSessionChange={onSessionChange} />}
    </AppLayout>
  );
}

function AnalyticsPage({ counts }: { counts: Counts }) {
  return (
    <section className="route-page">
      <div className="page-heading">
        <span>Analytics</span>
        <h1>Observation intelligence</h1>
      </div>
      <div className="route-grid">
        <div className="route-panel wide">
          <h2>Database overview</h2>
          <StatsGrid counts={counts} />
        </div>
        <div className="route-panel">
          <h2>Chart workspace</h2>
          <div className="chart-preview">
            <span className="bar-a" />
            <span className="bar-b" />
            <span className="bar-c" />
            <span className="bar-d" />
            <span className="bar-e" />
          </div>
        </div>
      </div>
    </section>
  );
}

function DataPage({ counts, error }: { counts: Counts; error: string }) {
  const rows = Object.entries(counts);

  return (
    <section className="route-page">
      <div className="page-heading">
        <span>Data</span>
        <h1>Database tables</h1>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="data-list">
        {rows.length ? rows.map(([table, count]) => (
          <article className="data-row" key={table}>
            <strong>{table}</strong>
            <span>{count} rows</span>
          </article>
        )) : (
          <article className="data-row">
            <strong>No table snapshot</strong>
            <span>Refresh after API connection</span>
          </article>
        )}
      </div>
    </section>
  );
}

function CityInfraPage() {
  return (
    <section className="route-page cityinfra-page">
      <div className="page-heading">
        <span>CityInfra</span>
        <h1>Infrastructure layer</h1>
      </div>
      <div className="route-panel">
        <h2>GeoJSON workspace</h2>
        <p>City model: Demo</p>
        <div className="cityinfra-preview">
          <span className="road-line" />
          <span className="park-block" />
          <span className="water-line" />
          <span className="poi-dot" />
        </div>
      </div>
    </section>
  );
}


function FavoritesPage({ token }: { token: string }) {
  const [favorites, setFavorites] = useState<FavoriteBird[]>([]);
  const [status, setStatus] = useState("Loading favorites...");
  const [error, setError] = useState("");
  const [busyBirdId, setBusyBirdId] = useState<number | null>(null);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("Loading favorites...");
    setError("");

    fetchFavoriteBirds(token)
      .then((nextFavorites) => {
        if (cancelled) return;
        setFavorites(nextFavorites);
        setStatus(`${nextFavorites.length} favorite species`);
      })
      .catch((favoriteError: unknown) => {
        if (cancelled) return;
        setFavorites([]);
        setStatus("Favorites need attention");
        setError(favoriteError instanceof Error ? favoriteError.message : "Could not load favorites.");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function removeFavorite(favorite: FavoriteBird) {
    setBusyBirdId(favorite.birdId);
    setError("");

    try {
      await removeFavoriteBird(token, favorite.birdId);
      setFavorites((current) => {
        const nextFavorites = current.filter((item) => item.birdId !== favorite.birdId);
        setStatus(`${nextFavorites.length} favorite species`);
        return nextFavorites;
      });
    } catch (favoriteError) {
      setError(favoriteError instanceof Error ? favoriteError.message : "Could not remove favorite.");
    } finally {
      setBusyBirdId(null);
    }
  }

  return (
    <section className="route-page">
      <div className="page-heading">
        <div>
          <span>Favorites</span>
          <h1>My favorite species</h1>
        </div>
        <strong className="admin-status ok">{status}</strong>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="favorites-grid">
        {favorites.map((favorite) => (
          <article className="favorite-card" key={favorite.birdId}>
            <button
              aria-label={`Remove ${favorite.birdName} from favorites`}
              className="bookmark-button favorite-card-bookmark active"
              disabled={busyBirdId === favorite.birdId}
              onClick={() => removeFavorite(favorite)}
              title="Remove from favorites"
              type="button"
            />
            <div className="favorite-card-top">
              {favorite.birdImageUrl && (
                <button
                  aria-label={`Open larger image of ${favorite.birdName}`}
                  className="favorite-card-image"
                  onClick={() => setSelectedImage({ src: favorite.birdImageUrl, alt: favorite.birdName })}
                  type="button"
                >
                  <img alt={favorite.birdName} src={favorite.birdImageUrl} />
                </button>
              )}
              <div className="favorite-card-info">
                <span>{favorite.familyName ?? favorite.source}</span>
                <h2>{favorite.birdName}</h2>
                <p>{favorite.birdLatinName || favorite.familyLatinName || "Scientific name missing"}</p>
              </div>
            </div>
            {favorite.birdDescription && (
              <p className="favorite-card-description">{favorite.birdDescription}</p>
            )}
          </article>
        ))}
        {favorites.length === 0 && !error && (
          <div className="route-panel">
            <h2>No favorites yet</h2>
            <p style={{ color: "#52606d" }}>Save species from the map popup bookmark button.</p>
          </div>
        )}
      </div>
      {selectedImage && createPortal(
        <div className="bird-image-lightbox" role="dialog" aria-modal="true" aria-label={selectedImage.alt}>
          <button
            className="bird-image-lightbox-backdrop"
            onClick={() => setSelectedImage(null)}
            type="button"
            aria-label="Close image preview"
          />
          <div className="bird-image-lightbox-content">
            <button className="bird-image-lightbox-close" onClick={() => setSelectedImage(null)} type="button">
              Close
            </button>
            <img alt={selectedImage.alt} src={selectedImage.src} />
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
