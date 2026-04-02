import { useCallback, useEffect, useMemo, useState } from "react";
import RolePageGate from "./RolePageGate";

export default function ProviderPage() {
  const [beds, setBeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedBedId, setSelectedBedId] = useState("");
  const [idocId, setIdocId] = useState("");
  const [saving, setSaving] = useState(false);

  const availableBeds = useMemo(
    () => beds.filter((bed) => bed.bed_status === "available"),
    [beds]
  );

  const fetchBeds = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/provider/beds/", {
        credentials: "include",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Could not load provider beds.");
      }

      setBeds(Array.isArray(payload) ? payload : []);
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Could not load provider beds.");
      setBeds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBeds();
  }, [fetchBeds]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedBedId || !idocId.trim()) {
      setError("Select a bed and enter a client ID.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const response = await fetch("/api/provider/assign-client/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bed_id: selectedBedId,
          idoc_id: idocId.trim(),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Could not assign client to bed.");
      }

      setMessage(payload?.message || "Client assigned successfully.");
      setSelectedBedId("");
      setIdocId("");
      fetchBeds();
    } catch (requestError) {
      setError(requestError.message || "Could not assign client to bed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RolePageGate allowedRoles={["provider"]}>
      <main>
        <nav aria-label="Global navigation" style={{ textAlign: "left", marginBottom: "1rem" }}>
          <a href="/">Admin Dashboard</a>
          <span style={{ margin: "0 0.5rem" }}>|</span>
          <a href="/main-dashboard">Main Bed Dashboard</a>
          <span style={{ margin: "0 0.5rem" }}>|</span>
          <a href="/case-manager.html">Case Manager View</a>
          <span style={{ margin: "0 0.5rem" }}>|</span>
          <a href="/parole-officer.html">Parole Officer View</a>
          <span style={{ margin: "0 0.5rem" }}>|</span>
          <a href="/login">Login Page</a>
        </nav>

        <h1>Housing Provider Bed Updates</h1>
        <p>Assign a client to an available bed using an existing client record ID.</p>

        <form onSubmit={handleSubmit} style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <label>
            Bed
            <select value={selectedBedId} onChange={(e) => setSelectedBedId(e.target.value)} style={{ marginLeft: "0.5rem" }}>
              <option value="">Select available bed</option>
              {availableBeds.map((bed) => (
                <option key={bed.bed_id} value={bed.bed_id}>
                  {bed.facility_name} - {bed.bed_label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Client ID
            <input
              type="text"
              value={idocId}
              onChange={(e) => setIdocId(e.target.value)}
              placeholder="IDOC-10001"
              style={{ marginLeft: "0.5rem" }}
            />
          </label>

          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Assign Client"}
          </button>
        </form>

        {loading && <p>Loading beds...</p>}
        {!loading && error && <p style={{ color: "#b42318" }}>{error}</p>}
        {!loading && !error && message && <p style={{ color: "#067647" }}>{message}</p>}

        {!loading && !error && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Facility</th>
                <th style={{ textAlign: "left" }}>District</th>
                <th style={{ textAlign: "left" }}>Bed</th>
                <th style={{ textAlign: "left" }}>Status</th>
                <th style={{ textAlign: "left" }}>Client ID</th>
                <th style={{ textAlign: "left" }}>Client</th>
              </tr>
            </thead>
            <tbody>
              {beds.map((bed) => (
                <tr key={bed.bed_id}>
                  <td>{bed.facility_name}</td>
                  <td>{bed.district_number}</td>
                  <td>{bed.bed_label}</td>
                  <td>{bed.bed_status}</td>
                  <td>{bed.client_id || "-"}</td>
                  <td>{bed.client_name || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </RolePageGate>
  );
}
