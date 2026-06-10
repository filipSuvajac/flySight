import { useEffect, useState } from "react";
import { fetchProfile, updateProfile } from "../api";
import type { UserProfile } from "../types";

type ProfilePageProps = {
  token: string;
};

export function ProfilePage({ token }: ProfilePageProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setIsLoading(true);
    setError("");
    fetchProfile(token)
      .then((data) => {
        setProfile(data);
        setBio(data.bio);
        setLocation(data.location);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load profile.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError("");
    setSuccessMessage("");
    updateProfile(token, { bio, location })
      .then((updated) => {
        setProfile(updated);
        setBio(updated.bio);
        setLocation(updated.location);
        setSuccessMessage("Profile updated successfully!");
        setTimeout(() => setSuccessMessage(""), 4000);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to update profile.");
      })
      .finally(() => {
        setIsSaving(false);
      });
  }

  if (isLoading) {
    return (
      <section className="route-page">
        <div className="page-heading">
          <span>Profile</span>
          <h1>Loading profile...</h1>
        </div>
      </section>
    );
  }

  return (
    <section className="route-page">
      <div className="page-heading">
        <span>Profile</span>
        <h1>User space</h1>
      </div>

      <div className="route-grid">
        <div className="route-panel wide">
          <h2>My profile info</h2>
          <p style={{ color: "#52606d", fontSize: "14px", marginBottom: "24px" }}>
            Personal information and settings.
          </p>

          {error && (
            <p className="error" style={{ color: "#b42318", marginBottom: "16px", fontWeight: "bold" }}>
              {error}
            </p>
          )}

          {successMessage && (
            <p className="success" style={{ color: "#0f766e", marginBottom: "16px", fontWeight: "bold" }}>
              {successMessage}
            </p>
          )}

          <form onSubmit={handleSave} style={{ display: "grid", gap: "16px" }}>
            <div className="field">
              <label>Name</label>
              <input
                type="text"
                value={profile?.name || ""}
                disabled
                style={{ background: "#f1f5f9", cursor: "not-allowed", border: "1px solid #cbd5e1" }}
              />
            </div>

            <div className="field">
              <label>Email</label>
              <input
                type="email"
                value={profile?.email || ""}
                disabled
                style={{ background: "#f1f5f9", cursor: "not-allowed", border: "1px solid #cbd5e1" }}
              />
            </div>

            <div className="field">
              <label>Role</label>
              <input
                type="text"
                value={profile?.role || ""}
                disabled
                style={{
                  background: "#f1f5f9",
                  cursor: "not-allowed",
                  border: "1px solid #cbd5e1",
                  textTransform: "capitalize",
                }}
              />
            </div>

            <div className="field">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={4}
                style={{
                  width: "100%",
                  border: "1px solid #bcccdc",
                  borderRadius: "6px",
                  padding: "11px 12px",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </div>

            <div className="field">
              <label htmlFor="location">Location</label>
              <input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, Country"
              />
            </div>

            <button type="submit" className="primary-action" disabled={isSaving} style={{ marginTop: "8px" }}>
              {isSaving ? "Saving..." : "Save Profile"}
            </button>
          </form>
        </div>

        <div className="route-panel">
          <h2>About profiles</h2>
          <p style={{ lineHeight: "1.5", color: "#52606d" }}>
            Profiles on FlySight allow you to store your location and biography. This helps identify your regional
            observations and allows researchers to connect with you.
          </p>
          <div style={{ marginTop: "20px", padding: "12px", background: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
            <strong style={{ display: "block", marginBottom: "4px", fontSize: "14px" }}>System Status</strong>
            <span style={{ fontSize: "13px", color: "#64748b" }}>Your account is in good standing.</span>
          </div>
        </div>
      </div>
    </section>
  );
}
