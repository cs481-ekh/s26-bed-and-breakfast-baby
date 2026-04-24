import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { apiJson } from "../src/apiClient";

const ManageClientsTable = forwardRef((_, ref) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [removingClientId, setRemovingClientId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredClients = clients.filter((client) => {
    if (!normalizedSearchTerm) {
      return true;
    }

    const searchableText = [
      client.idoc_id,
      client.full_name,
      client.first_name,
      client.last_name,
      client.district_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return searchableText.includes(normalizedSearchTerm);
  });

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { response, payload } = await apiJson("/api/admin/clients/");

      if (!response.ok) {
        throw new Error(payload?.error || "Could not load clients.");
      }

      setClients(Array.isArray(payload) ? payload : []);
    } catch (fetchError) {
      setClients([]);
      setError(fetchError instanceof Error ? fetchError.message : "Could not load clients.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRemoveClient = async (client) => {
    if (!client?.id) {
      return;
    }

    if (client.assigned_bed_label) {
      setActionMessage("Assigned clients cannot be removed. Unassign them first.");
      return;
    }

    const confirmed = window.confirm(
      `Remove client "${client.full_name || client.idoc_id}" from the system? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    setActionMessage("");
    setRemovingClientId(client.id);

    try {
      const { response, payload } = await apiJson(`/api/admin/clients/${client.id}/remove/`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to remove client.");
      }

      setActionMessage(payload?.message || "Client removed.");
      await fetchClients();
    } catch (removeError) {
      setActionMessage(removeError instanceof Error ? removeError.message : "Unable to remove client.");
    } finally {
      setRemovingClientId(null);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useImperativeHandle(ref, () => ({
    fetchClients,
  }));

  if (loading) {
    return (
      <div className="user-table-container">
        <p>Loading clients...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-table-container">
        <p className="error">Error loading clients: {error}</p>
        <button type="button" onClick={fetchClients}>Retry</button>
      </div>
    );
  }

  return (
    <div className="user-table-container">
      <div className="admin-client-filter-row">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by IDOC ID or client name"
          className="admin-client-filter-input"
          aria-label="Search clients"
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

      {clients.length === 0 ? (
        <p>No clients have been in the system for 24+ months yet.</p>
      ) : filteredClients.length === 0 ? (
        <p>No clients matched your search.</p>
      ) : (
        <table className="user-table">
          <thead>
            <tr>
              <th>IDOC ID</th>
              <th>Name</th>
              <th>District</th>
              <th>Date Added</th>
              <th>Months In System</th>
              <th>Assigned Bed</th>
              <th>Facility</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client) => (
              <tr key={client.id || client.idoc_id} className="user-row">
                <td>{client.idoc_id || "N/A"}</td>
                <td>{client.full_name || "N/A"}</td>
                <td>
                  {client.district_number
                    ? `District ${client.district_number}${client.district_name ? ` - ${client.district_name}` : ""}`
                    : "N/A"}
                </td>
                <td>{client.date_added || "N/A"}</td>
                <td>{typeof client.months_in_system === "number" ? client.months_in_system : "N/A"}</td>
                <td>{client.assigned_bed_label || "Unassigned"}</td>
                <td>{client.assigned_facility_name || "N/A"}</td>
                <td>
                  <button
                    type="button"
                    className="admin-danger-button"
                    onClick={() => handleRemoveClient(client)}
                    disabled={Boolean(client.assigned_bed_label) || removingClientId === client.id}
                    title={client.assigned_bed_label ? "Unassign client before removing" : "Remove client"}
                  >
                    {removingClientId === client.id ? "Removing..." : "Remove"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {actionMessage && <p className="admin-inline-message">{actionMessage}</p>}

      <p className="user-table-hint">
        Showing only clients added at least 24 months ago.
        {clients.length > 0 ? ` Displaying ${filteredClients.length} of ${clients.length}.` : ""}
      </p>
    </div>
  );
});

ManageClientsTable.displayName = "ManageClientsTable";

export default ManageClientsTable;
