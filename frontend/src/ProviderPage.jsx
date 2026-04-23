import { useCallback, useEffect, useMemo, useState } from "react";
import RolePageGate from "./RolePageGate";
import { apiJson } from "./apiClient";
import PageTemplate from "./components/PageTemplate";
import "./ProviderPage.css";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

export default function ProviderPage() {
  const [beds, setBeds] = useState([]);
  const [holds, setHolds] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedBedId, setSelectedBedId] = useState("");
  const [idocId, setIdocId] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [holdActionId, setHoldActionId] = useState("");
  const [clientForm, setClientForm] = useState({
    firstName: "",
    lastName: "",
    idocId: "",
  });
  const [anonymousHoldForm, setAnonymousHoldForm] = useState({
    bedId: "",
    reason: "",
  });
  const [bedForm, setBedForm] = useState({
    facilityId: "",
    label: "",
    notes: "",
    isSexOffenderBed: false,
  });
  const [endDateDrafts, setEndDateDrafts] = useState({});

  const availableBeds = useMemo(
    () => beds.filter((bed) => bed.bed_status === "available"),
    [beds]
  );
  const activeHolds = useMemo(
    () => holds.filter((hold) => hold.status === "active"),
    [holds]
  );

  useEffect(() => {
    const nextDrafts = {};

    beds.forEach((bed) => {
      if (bed.parolee_id && bed.housing_end_date) {
        nextDrafts[bed.parolee_id] = bed.housing_end_date;
      }
    });

    setEndDateDrafts(nextDrafts);
  }, [beds]);

  const fetchBeds = useCallback(async () => {
    try {
      setLoading(true);
      const [bedsResponse, holdsResponse, facilitiesResponse] = await Promise.all([
        apiJson("/api/provider/beds/"),
        apiJson("/api/provider/holds/"),
        apiJson("/api/provider/facilities/"),
      ]);

      if (!bedsResponse.response.ok) {
        throw new Error(bedsResponse.payload?.error || "Could not load provider beds.");
      }

      if (!holdsResponse.response.ok) {
        throw new Error(holdsResponse.payload?.error || "Could not load pending holds.");
      }

      if (!facilitiesResponse.response.ok) {
        throw new Error(facilitiesResponse.payload?.error || "Could not load provider facilities.");
      }

      setBeds(Array.isArray(bedsResponse.payload) ? bedsResponse.payload : []);
      setHolds(Array.isArray(holdsResponse.payload) ? holdsResponse.payload : []);
      setFacilities(Array.isArray(facilitiesResponse.payload) ? facilitiesResponse.payload : []);
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Could not load provider data.");
      setBeds([]);
      setHolds([]);
      setFacilities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBeds();
  }, [fetchBeds]);

  const handleLookupClient = async (event) => {
    event.preventDefault();

    if (!idocId.trim()) {
      setError("Enter an IDOC number to look up a client.");
      return;
    }

    try {
      setLookupLoading(true);
      setError("");
      setMessage("");

      const { response, payload } = await apiJson(
        `/api/provider/parolees/lookup/?idoc_id=${encodeURIComponent(idocId.trim())}`
      );

      if (!response.ok) {
        throw new Error(payload?.error || "Could not find that client.");
      }

      setLookupResult(payload);
      setMessage(`Found ${payload?.full_name || payload?.idoc_id || "client"}.`);
      fetchBeds();
    } catch (requestError) {
      setLookupResult(null);
      setError(requestError.message || "Could not find that client.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleCreateClient = async (event) => {
    event.preventDefault();

    if (!clientForm.firstName.trim() || !clientForm.lastName.trim() || !clientForm.idocId.trim()) {
      setError("Enter a first name, last name, and IDOC number.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { response, payload } = await apiJson("/api/provider/clients/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: clientForm.firstName.trim(),
          last_name: clientForm.lastName.trim(),
          idoc_id: clientForm.idocId.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(payload?.error || "Could not create client.");
      }

      setMessage(`Created ${payload?.full_name || clientForm.idocId.trim()}.`);
      setIdocId(payload?.idoc_id || clientForm.idocId.trim());
      setLookupResult(payload);
      setClientForm({ firstName: "", lastName: "", idocId: "" });
    } catch (requestError) {
      setError(requestError.message || "Could not create client.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAnonymousHold = async (event) => {
    event.preventDefault();

    if (!anonymousHoldForm.bedId) {
      setError("Choose a bed for the anonymous hold.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { response, payload } = await apiJson("/api/provider/holds/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bed_id: anonymousHoldForm.bedId,
          reason: anonymousHoldForm.reason.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(payload?.error || "Could not place anonymous hold.");
      }

      setMessage(payload?.message || "Anonymous hold placed successfully.");
      setAnonymousHoldForm({ bedId: "", reason: "" });
      fetchBeds();
    } catch (requestError) {
      setError(requestError.message || "Could not place anonymous hold.");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignClient = async (event) => {
    event.preventDefault();

    if (!selectedBedId || !idocId.trim()) {
      setError("Select a bed and enter an IDOC number.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { response, payload } = await apiJson("/api/provider/assign-client/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bed_id: selectedBedId,
          idoc_id: idocId.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(payload?.error || "Could not assign client to bed.");
      }

      setMessage(payload?.message || "Client assigned successfully.");
      setSelectedBedId("");
      setIdocId("");
      setLookupResult(null);
      fetchBeds();
    } catch (requestError) {
      setError(requestError.message || "Could not assign client to bed.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBed = async (event) => {
    event.preventDefault();

    if (!bedForm.facilityId || !bedForm.label.trim()) {
      setError("Choose a facility and provide a bed label.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { response, payload } = await apiJson("/api/provider/beds/create/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: bedForm.facilityId,
          label: bedForm.label.trim(),
          notes: bedForm.notes.trim(),
          is_sex_offender_bed: bedForm.isSexOffenderBed,
        }),
      });

      if (!response.ok) {
        throw new Error(payload?.error || "Could not create bed.");
      }

      setMessage(`Bed ${payload?.bed_label || bedForm.label.trim()} created successfully.`);
      setBedForm({
        facilityId: bedForm.facilityId,
        label: "",
        notes: "",
        isSexOffenderBed: false,
      });
      fetchBeds();
    } catch (requestError) {
      setError(requestError.message || "Could not create bed.");
    } finally {
      setSaving(false);
    }
  };

  const handleHoldDecision = async (holdId, decision) => {
    try {
      setHoldActionId(`${decision}-${holdId}`);
      setError("");
      setMessage("");

      const { response, payload } = await apiJson(`/api/provider/holds/${holdId}/${decision}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(payload?.error || `Could not ${decision} hold.`);
      }

      setMessage(payload?.message || `Hold ${decision}d successfully.`);
      fetchBeds();
    } catch (requestError) {
      setError(requestError.message || `Could not ${decision} hold.`);
    } finally {
      setHoldActionId("");
    }
  };

  const handleEndDateChange = (paroleeId, value) => {
    setEndDateDrafts((current) => ({
      ...current,
      [paroleeId]: value,
    }));
  };

  const handleUpdateEndDate = async (paroleeId) => {
    const housingEndDate = endDateDrafts[paroleeId];

    if (!housingEndDate) {
      setError("Choose a new end date first.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const { response, payload } = await apiJson(`/api/provider/placements/${paroleeId}/end-date/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ housing_end_date: housingEndDate }),
      });

      if (!response.ok) {
        throw new Error(payload?.error || "Could not update the end date.");
      }

      setMessage(payload?.message || "End date updated successfully.");
      fetchBeds();
    } catch (requestError) {
      setError(requestError.message || "Could not update the end date.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RolePageGate allowedRoles={["provider", "admin"]}>
      <PageTemplate>
        <section className="provider-page">
          <header className="provider-hero">
            <div>
              <p className="provider-kicker">Housing provider workspace</p>
              <h1>Manage beds, holds, and placements</h1>
              <p>
                Create clients from their name and IDOC number, place anonymous holds on beds, create beds for your
                facilities, approve or deny holds, and adjust placement end dates when someone leaves early.
              </p>
            </div>
            <div className="provider-stat-grid">
              <div className="provider-stat-card">
                <span>Available beds</span>
                <strong>{availableBeds.length}</strong>
              </div>
              <div className="provider-stat-card">
                <span>Pending holds</span>
                <strong>{activeHolds.length}</strong>
              </div>
              <div className="provider-stat-card">
                <span>Facilities</span>
                <strong>{facilities.length}</strong>
              </div>
            </div>
          </header>

          <div className="provider-grid">
            <article className="provider-card">
              <div className="card-heading">
                <div>
                  <p className="card-label">Client workflow</p>
                  <h2>Find and assign a client</h2>
                </div>
                <span className="card-hint">Search by IDOC number first</span>
              </div>

              <form className="provider-form" onSubmit={handleLookupClient}>
                <label>
                  IDOC number
                  <input
                    type="text"
                    value={idocId}
                    onChange={(event) => setIdocId(event.target.value)}
                    placeholder="IDOC-10001"
                  />
                </label>

                <div className="form-actions">
                  <button type="submit" className="secondary" disabled={lookupLoading}>
                    {lookupLoading ? "Looking up..." : "Find client"}
                  </button>
                </div>
              </form>

              {lookupResult && (
                <div className="lookup-result">
                  <div>
                    <strong>{lookupResult.full_name}</strong>
                    <p>{lookupResult.idoc_id}</p>
                  </div>
                  <div>
                    <span>District {lookupResult.district_number}</span>
                    <span>
                      Current placement: {lookupResult.assigned_facility_name || "Not assigned"}
                    </span>
                  </div>
                </div>
              )}

              <form className="provider-form" onSubmit={handleAssignClient}>
                <label>
                  Available bed
                  <select value={selectedBedId} onChange={(event) => setSelectedBedId(event.target.value)}>
                    <option value="">Select a bed</option>
                    {availableBeds.map((bed) => (
                      <option key={bed.bed_id} value={bed.bed_id}>
                        {bed.facility_name} - {bed.bed_label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="form-actions">
                  <button type="submit" disabled={saving || availableBeds.length === 0}>
                    {saving ? "Saving..." : "Assign 30-day placement"}
                  </button>
                </div>
              </form>
            </article>

            <article className="provider-card">
              <div className="card-heading">
                <div>
                  <p className="card-label">Client intake</p>
                  <h2>Create a client or anonymous hold</h2>
                </div>
                <span className="card-hint">Quick entry for intake workflows</span>
              </div>

              <form className="provider-form" onSubmit={handleCreateClient}>
                <label>
                  First name
                  <input
                    type="text"
                    value={clientForm.firstName}
                    onChange={(event) => setClientForm((current) => ({ ...current, firstName: event.target.value }))}
                    placeholder="Jordan"
                  />
                </label>

                <label>
                  Last name
                  <input
                    type="text"
                    value={clientForm.lastName}
                    onChange={(event) => setClientForm((current) => ({ ...current, lastName: event.target.value }))}
                    placeholder="Carter"
                  />
                </label>

                <label>
                  IDOC number
                  <input
                    type="text"
                    value={clientForm.idocId}
                    onChange={(event) => setClientForm((current) => ({ ...current, idocId: event.target.value }))}
                    placeholder="IDOC-90001"
                  />
                </label>

                <div className="form-actions">
                  <button type="submit" className="secondary" disabled={saving}>
                    {saving ? "Saving..." : "Create client"}
                  </button>
                </div>
              </form>

              <div style={{ height: "1rem" }} />

              <form className="provider-form" onSubmit={handleCreateAnonymousHold}>
                <label>
                  Anonymous hold bed
                  <select
                    value={anonymousHoldForm.bedId}
                    onChange={(event) => setAnonymousHoldForm((current) => ({ ...current, bedId: event.target.value }))}
                  >
                    <option value="">Select an available bed</option>
                    {availableBeds.map((bed) => (
                      <option key={bed.bed_id} value={bed.bed_id}>
                        {bed.facility_name} - {bed.bed_label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Reason
                  <textarea
                    rows="3"
                    value={anonymousHoldForm.reason}
                    onChange={(event) =>
                      setAnonymousHoldForm((current) => ({ ...current, reason: event.target.value }))
                    }
                    placeholder="Optional hold note"
                  />
                </label>

                <div className="form-actions">
                  <button type="submit" disabled={saving || availableBeds.length === 0}>
                    {saving ? "Saving..." : "Place anonymous hold"}
                  </button>
                </div>
              </form>
            </article>

            <article className="provider-card">
              <div className="card-heading">
                <div>
                  <p className="card-label">Bed setup</p>
                  <h2>Add a bed</h2>
                </div>
                <span className="card-hint">Provider-owned facilities only</span>
              </div>

              <form className="provider-form" onSubmit={handleCreateBed}>
                <label>
                  Facility
                  <select
                    value={bedForm.facilityId}
                    onChange={(event) => setBedForm((current) => ({ ...current, facilityId: event.target.value }))}
                  >
                    <option value="">Select a facility</option>
                    {facilities.map((facility) => (
                      <option key={facility.facility_id} value={facility.facility_id}>
                        {facility.facility_name} - District {facility.district_number}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Bed label
                  <input
                    type="text"
                    value={bedForm.label}
                    onChange={(event) => setBedForm((current) => ({ ...current, label: event.target.value }))}
                    placeholder="Room 2 - Bed A"
                  />
                </label>

                <label>
                  Notes
                  <textarea
                    rows="3"
                    value={bedForm.notes}
                    onChange={(event) => setBedForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Optional bed notes"
                  />
                </label>

                <label className="inline-checkbox">
                  <input
                    type="checkbox"
                    checked={bedForm.isSexOffenderBed}
                    onChange={(event) =>
                      setBedForm((current) => ({ ...current, isSexOffenderBed: event.target.checked }))
                    }
                  />
                  Designated sex-offender bed
                </label>

                <div className="form-actions">
                  <button type="submit" disabled={saving || facilities.length === 0}>
                    {saving ? "Saving..." : "Add bed"}
                  </button>
                </div>
              </form>
            </article>
          </div>

          <article className="provider-card provider-card-wide">
            <div className="card-heading">
              <div>
                <p className="card-label">Hold queue</p>
                <h2>Approve or deny pending holds</h2>
              </div>
            </div>

            {loading && <p>Loading provider data...</p>}
            {!loading && activeHolds.length === 0 && <p>No active holds are waiting for review.</p>}

            {!loading && activeHolds.length > 0 && (
              <div className="table-wrap">
                <table className="provider-table">
                  <thead>
                    <tr>
                      <th>Bed</th>
                      <th>Client</th>
                      <th>Reason</th>
                      <th>Expires</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeHolds.map((hold) => (
                        <tr key={hold.hold_id}>
                          <td>
                            <strong>{hold.facility_name}</strong>
                            <div>{hold.bed_label}</div>
                          </td>
                          <td>
                            <strong>{hold.client_name}</strong>
                            <div>{hold.client_id}</div>
                          </td>
                          <td>{hold.reason || "-"}</td>
                          <td>{formatDateTime(hold.expires_at)}</td>
                          <td>
                            <div className="row-actions">
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => handleHoldDecision(hold.hold_id, "deny")}
                                disabled={holdActionId === `deny-${hold.hold_id}`}
                              >
                                {holdActionId === `deny-${hold.hold_id}` ? "Denying..." : "Deny"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleHoldDecision(hold.hold_id, "approve")}
                                disabled={holdActionId === `approve-${hold.hold_id}`}
                              >
                                {holdActionId === `approve-${hold.hold_id}` ? "Approving..." : "Approve"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>

          <article className="provider-card provider-card-wide">
            <div className="card-heading">
              <div>
                <p className="card-label">Bed roster</p>
                <h2>Current bed assignments</h2>
              </div>
            </div>

            {!loading && error && <p className="status status-error">{error}</p>}
            {!loading && !error && message && <p className="status status-success">{message}</p>}

            {!loading && !error && (
              <div className="table-wrap">
                <table className="provider-table">
                  <thead>
                    <tr>
                      <th>Facility</th>
                      <th>Bed</th>
                      <th>Status</th>
                      <th>Client</th>
                      <th>Program dates</th>
                      <th>Hold</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {beds.map((bed) => (
                      <tr key={bed.bed_id}>
                        <td>
                          <strong>{bed.facility_name}</strong>
                          <div>District {bed.district_number}</div>
                        </td>
                        <td>{bed.bed_label}</td>
                        <td>
                          <span className={`status-pill status-${bed.bed_status}`}>{bed.bed_status_label}</span>
                        </td>
                        <td>
                          <strong>{bed.client_name || bed.assignment_placeholder}</strong>
                          <div>{bed.client_id || "-"}</div>
                        </td>
                        <td>
                          <div>Start: {formatDate(bed.housing_start_date)}</div>
                          <div>End: {formatDate(bed.housing_end_date)}</div>
                        </td>
                        <td>
                          {bed.hold_id ? (
                            <>
                              <strong>{bed.hold_client_name}</strong>
                              <div>Expires {formatDateTime(bed.hold_expires_at)}</div>
                            </>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                        <td>
                          {bed.parolee_id ? (
                            <div className="end-date-editor">
                              <input
                                type="date"
                                value={endDateDrafts[bed.parolee_id] || ""}
                                onChange={(event) => handleEndDateChange(bed.parolee_id, event.target.value)}
                              />
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => handleUpdateEndDate(bed.parolee_id)}
                                disabled={saving}
                              >
                                Update end date
                              </button>
                            </div>
                          ) : bed.hold_id ? (
                            <div className="row-actions">
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => handleHoldDecision(bed.hold_id, "deny")}
                                disabled={holdActionId === `deny-${bed.hold_id}`}
                              >
                                Deny hold
                              </button>
                              <button
                                type="button"
                                onClick={() => handleHoldDecision(bed.hold_id, "approve")}
                                disabled={holdActionId === `approve-${bed.hold_id}`}
                              >
                                Approve hold
                              </button>
                            </div>
                          ) : (
                            <span className="muted">No action needed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      </PageTemplate>
    </RolePageGate>
  );
}
