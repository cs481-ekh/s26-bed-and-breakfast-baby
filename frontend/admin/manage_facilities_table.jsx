import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { apiJson } from "../src/apiClient";

const ManageFacilitiesTable = forwardRef((_, ref) => {
  const [facilities, setFacilities] = useState([]);
  const [providers, setProviders] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [removingFacilityId, setRemovingFacilityId] = useState(null);
  const [togglingFacilityId, setTogglingFacilityId] = useState(null);

  const [newFacilityForm, setNewFacilityForm] = useState({
    providerId: "",
    districtId: "",
    name: "",
    address: "",
    city: "",
    state: "ID",
    zipCode: "",
    track: "basic",
    acceptsMale: true,
    acceptsFemale: true,
    acceptsSexOffender: false,
  });
  const normalizeText = (value) => (value || "").toString().trim().toLowerCase();
  const normalizedSearchTerm = normalizeText(searchTerm);

  const filteredFacilities = facilities
    .filter((facility) => {
      if (!normalizedSearchTerm) {
        return true;
      }

      const districtLabel = facility.district_number
        ? `District ${facility.district_number}${facility.district_name ? ` - ${facility.district_name}` : ""}`
        : "";

      const searchableText = [
        facility.facility_name,
        facility.provider_name,
        districtLabel,
        facility.track,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearchTerm);
    })
    .sort((left, right) => {
      if (left.is_active !== right.is_active) {
        return left.is_active ? -1 : 1;
      }

      const leftAvailable = Number(left.available_beds) || 0;
      const rightAvailable = Number(right.available_beds) || 0;
      if (leftAvailable !== rightAvailable) {
        return rightAvailable - leftAvailable;
      }

      return (left.facility_name || "").localeCompare(right.facility_name || "");
    });

  const fetchFacilities = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [facilityResult, providerResult, districtResult] = await Promise.all([
        apiJson("/api/facilities/availability/?include_inactive=true"),
        apiJson("/api/admin/providers/"),
        apiJson("/api/admin/districts/"),
      ]);

      if (!facilityResult.response.ok) {
        throw new Error(facilityResult.payload?.error || "Could not load facilities.");
      }

      if (!providerResult.response.ok) {
        throw new Error(providerResult.payload?.error || "Could not load providers.");
      }

      if (!districtResult.response.ok) {
        throw new Error(districtResult.payload?.error || "Could not load districts.");
      }

      const providerRows = Array.isArray(providerResult.payload) ? providerResult.payload : [];
      const districtRows = Array.isArray(districtResult.payload) ? districtResult.payload : [];
      const facilityRows = Array.isArray(facilityResult.payload) ? facilityResult.payload : [];

      setProviders(providerRows);
      setDistricts(districtRows);
      setFacilities(facilityRows);

      setNewFacilityForm((current) => ({
        ...current,
        providerId: current.providerId || (providerRows[0]?.provider_id ? String(providerRows[0].provider_id) : ""),
        districtId: current.districtId || (districtRows[0]?.district_id ? String(districtRows[0].district_id) : ""),
      }));

    } catch (fetchError) {
      setFacilities([]);
      setProviders([]);
      setDistricts([]);
      setError(fetchError instanceof Error ? fetchError.message : "Could not load facilities.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddFacility = async (event) => {
    event.preventDefault();
    setActionMessage("");

    if (!newFacilityForm.providerId || !newFacilityForm.districtId || !newFacilityForm.name.trim()) {
      setActionMessage("Provider, district, and facility name are required.");
      return;
    }

    setSubmittingAdd(true);
    try {
      const { response, payload } = await apiJson("/api/admin/facilities/create/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: Number(newFacilityForm.providerId),
          district_id: Number(newFacilityForm.districtId),
          name: newFacilityForm.name.trim(),
          address: newFacilityForm.address.trim(),
          city: newFacilityForm.city.trim(),
          state: (newFacilityForm.state || "ID").trim().toUpperCase().slice(0, 2),
          zip_code: newFacilityForm.zipCode.trim(),
          track: newFacilityForm.track,
          accepts_male: newFacilityForm.acceptsMale,
          accepts_female: newFacilityForm.acceptsFemale,
          accepts_sex_offender: newFacilityForm.acceptsSexOffender,
        }),
      });

      if (!response.ok) {
        throw new Error(payload?.error || "Could not add facility.");
      }

      setActionMessage(payload?.message || "Facility added.");
      setNewFacilityForm((current) => ({
        ...current,
        name: "",
        address: "",
        city: "",
        zipCode: "",
        acceptsSexOffender: false,
      }));
      await fetchFacilities();
    } catch (requestError) {
      setActionMessage(requestError instanceof Error ? requestError.message : "Could not add facility.");
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleToggleFacilityActive = async (facility) => {
    setActionMessage("");

    if (!facility?.facility_id) {
      setActionMessage("Invalid facility selection.");
      return;
    }

    const facilityName = facility.facility_name || `Facility ${facility.facility_id}`;
    const nextStateLabel = facility.is_active ? "deactivate" : "reactivate";
    const confirmed = window.confirm(
      `Are you sure you want to ${nextStateLabel} "${facilityName}"?`
    );
    if (!confirmed) {
      return;
    }

    setTogglingFacilityId(facility.facility_id);
    try {
      const { response, payload } = await apiJson(`/api/admin/facilities/${facility.facility_id}/toggle-active/`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(payload?.error || "Could not update facility status.");
      }

      setActionMessage(payload?.message || "Facility status updated.");
      await fetchFacilities();
    } catch (requestError) {
      setActionMessage(requestError instanceof Error ? requestError.message : "Could not update facility status.");
    } finally {
      setTogglingFacilityId(null);
    }
  };

  const handleRemoveFacility = async (facility) => {
    setActionMessage("");

    if (!facility?.facility_id) {
      setActionMessage("Invalid facility selection.");
      return;
    }

    const facilityName = facility.facility_name || `Facility ${facility.facility_id}`;
    const confirmed = window.confirm(
      `Permanently delete "${facilityName}"? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setRemovingFacilityId(facility.facility_id);
    try {
      const { response, payload } = await apiJson(`/api/admin/facilities/${facility.facility_id}/remove/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deletion_type: "hard" }),
      });

      if (!response.ok) {
        throw new Error(payload?.error || "Could not delete facility.");
      }

      setActionMessage(payload?.message || "Facility deleted.");
      await fetchFacilities();
    } catch (requestError) {
      setActionMessage(requestError instanceof Error ? requestError.message : "Could not delete facility.");
    } finally {
      setRemovingFacilityId(null);
    }
  };

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  useImperativeHandle(ref, () => ({
    fetchFacilities,
  }));

  if (loading) {
    return (
      <div className="user-table-container">
        <p>Loading facilities...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-table-container">
        <p className="error">Error loading facilities: {error}</p>
        <button type="button" onClick={fetchFacilities}>Retry</button>
      </div>
    );
  }

  return (
    <div className="user-table-container">
      <div className="admin-facility-management-grid">
        <section className="admin-facility-section" aria-label="Add facility section">
          <h3>Add New Facility</h3>
          <p>Add a new facility under an existing provider.</p>

          <form className="admin-form admin-facility-form" onSubmit={handleAddFacility}>
            <label htmlFor="facility-provider">Provider</label>
            <select
              id="facility-provider"
              value={newFacilityForm.providerId}
              onChange={(event) => setNewFacilityForm((current) => ({
                ...current,
                providerId: event.target.value,
              }))}
              required
            >
              <option value="" disabled>Select a provider</option>
              {providers.map((provider) => (
                <option key={provider.provider_id} value={provider.provider_id}>
                  {provider.provider_name}
                </option>
              ))}
            </select>

            <label htmlFor="facility-name">Facility Name</label>
            <input
              id="facility-name"
              type="text"
              value={newFacilityForm.name}
              onChange={(event) => setNewFacilityForm((current) => ({
                ...current,
                name: event.target.value,
              }))}
              placeholder="Sunrise House"
              required
            />

            <label htmlFor="facility-district">District</label>
            <select
              id="facility-district"
              value={newFacilityForm.districtId}
              onChange={(event) => setNewFacilityForm((current) => ({
                ...current,
                districtId: event.target.value,
              }))}
              required
            >
              <option value="" disabled>Select a district</option>
              {districts.map((district) => (
                <option key={district.district_id} value={district.district_id}>
                  District {district.district_number} - {district.district_name}
                </option>
              ))}
            </select>

            <label htmlFor="facility-city">City</label>
            <input
              id="facility-city"
              type="text"
              value={newFacilityForm.city}
              onChange={(event) => setNewFacilityForm((current) => ({
                ...current,
                city: event.target.value,
              }))}
              placeholder="Boise"
              required
            />

            <div className="admin-facility-two-col">
              <div>
                <label htmlFor="facility-state">State</label>
                <input
                  id="facility-state"
                  type="text"
                  value={newFacilityForm.state}
                  onChange={(event) => setNewFacilityForm((current) => ({
                    ...current,
                    state: event.target.value.toUpperCase().slice(0, 2),
                  }))}
                  placeholder="ID"
                  maxLength={2}
                  required
                />
              </div>
              <div>
                <label htmlFor="facility-zip">ZIP Code</label>
                <input
                  id="facility-zip"
                  type="text"
                  value={newFacilityForm.zipCode}
                  onChange={(event) => setNewFacilityForm((current) => ({
                    ...current,
                    zipCode: event.target.value,
                  }))}
                  placeholder="83701"
                  required
                />
              </div>
            </div>

            <label htmlFor="facility-address">Address (optional)</label>
            <input
              id="facility-address"
              type="text"
              value={newFacilityForm.address}
              onChange={(event) => setNewFacilityForm((current) => ({
                ...current,
                address: event.target.value,
              }))}
              placeholder="123 Main St"
            />

            <label htmlFor="facility-track">Track</label>
            <select
              id="facility-track"
              value={newFacilityForm.track}
              onChange={(event) => setNewFacilityForm((current) => ({
                ...current,
                track: event.target.value,
              }))}
            >
              <option value="basic">Basic</option>
              <option value="plus">Plus</option>
              <option value="hotel">Hotel</option>
            </select>

            <div className="admin-facility-checkboxes">
              <label>
                <input
                  type="checkbox"
                  checked={newFacilityForm.acceptsMale}
                  onChange={(event) => setNewFacilityForm((current) => ({
                    ...current,
                    acceptsMale: event.target.checked,
                  }))}
                />
                Accepts male
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={newFacilityForm.acceptsFemale}
                  onChange={(event) => setNewFacilityForm((current) => ({
                    ...current,
                    acceptsFemale: event.target.checked,
                  }))}
                />
                Accepts female
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={newFacilityForm.acceptsSexOffender}
                  onChange={(event) => setNewFacilityForm((current) => ({
                    ...current,
                    acceptsSexOffender: event.target.checked,
                  }))}
                />
                Accepts sex offender
              </label>
            </div>

            <button type="submit" className="admin-primary-button" disabled={submittingAdd}>
              {submittingAdd ? "Adding..." : "Add Facility"}
            </button>
          </form>
        </section>
      </div>

      {actionMessage && <p className="admin-inline-message">{actionMessage}</p>}

      <div className="admin-client-filter-row">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by facility, provider, district, or track"
          className="admin-client-filter-input"
          aria-label="Search facilities"
        />
        <button
          type="button"
          className="admin-secondary-button"
          onClick={() => setSearchTerm("")}
          disabled={!searchTerm}
        >
          Clear
        </button>
      </div>

      {facilities.length === 0 ? (
        <p>No facilities found.</p>
      ) : filteredFacilities.length === 0 ? (
        <p>No facilities matched your search.</p>
      ) : (
        <table className="user-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Facility</th>
              <th>Provider</th>
              <th>District</th>
              <th>Track</th>
              <th>Total Beds</th>
              <th>Assigned Beds</th>
              <th>Available Beds</th>
              <th>S/O Beds</th>
              <th>Eligibility</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFacilities.map((facility) => {
              const districtLabel = facility.district_number
                ? `District ${facility.district_number}${facility.district_name ? ` - ${facility.district_name}` : ""}`
                : "N/A";

              const eligibilityParts = [];
              if (facility.accepts_male) {
                eligibilityParts.push("Male");
              }
              if (facility.accepts_female) {
                eligibilityParts.push("Female");
              }
              if (facility.accepts_sex_offender) {
                eligibilityParts.push("Sex Offender");
              }

              const isRemovingRow = removingFacilityId === facility.facility_id;
              const isTogglingRow = togglingFacilityId === facility.facility_id;

              return (
                <tr key={facility.facility_id} className="user-row">
                  <td>
                    <span
                      className={`admin-facility-status ${facility.is_active ? "active" : "inactive"}`}
                      title={facility.is_active ? "Active facility" : "Inactive facility"}
                    >
                      {facility.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{facility.facility_name || "N/A"}</td>
                  <td>{facility.provider_name || "N/A"}</td>
                  <td>{districtLabel}</td>
                  <td>{facility.track || "N/A"}</td>
                  <td>{typeof facility.total_beds === "number" ? facility.total_beds : "N/A"}</td>
                  <td>{typeof facility.assigned_beds === "number" ? facility.assigned_beds : "N/A"}</td>
                  <td>{typeof facility.available_beds === "number" ? facility.available_beds : "N/A"}</td>
                  <td>{facility.has_sex_offender_beds ? "Yes" : "No"}</td>
                  <td>{eligibilityParts.length > 0 ? eligibilityParts.join(", ") : "N/A"}</td>
                  <td>
                    <div className="admin-facility-row-actions">
                      <button
                        type="button"
                        className={`admin-facility-action-button admin-facility-action-toggle ${facility.is_active ? "active" : "inactive"}`}
                        onClick={() => handleToggleFacilityActive(facility)}
                        disabled={isTogglingRow}
                        title={facility.is_active ? "Deactivate facility" : "Reactivate facility"}
                      >
                        {isTogglingRow
                          ? (facility.is_active ? "Deactivating..." : "Reactivating...")
                          : (facility.is_active ? "Deactivate" : "Reactivate")}
                      </button>
                      <button
                        type="button"
                        className="admin-facility-action-button admin-facility-action-delete"
                        onClick={() => handleRemoveFacility(facility)}
                        disabled={isRemovingRow}
                        title="Permanently delete facility"
                      >
                        {isRemovingRow ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <p className="user-table-hint">
        Showing facilities sorted by active status and available bed capacity.
        {facilities.length > 0 ? ` Displaying ${filteredFacilities.length} of ${facilities.length}.` : ""}
      </p>
    </div>
  );
});

ManageFacilitiesTable.displayName = "ManageFacilitiesTable";

export default ManageFacilitiesTable;