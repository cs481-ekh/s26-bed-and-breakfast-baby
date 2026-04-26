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

  const isFlaggedForRemoval = (client) => {
    const monthsInSystem = Number(client.months_in_system) || 0;
    return !client.assigned_bed_label && monthsInSystem >= 24;
  };

  const normalizeDate = (value) => {
    const parsed = Date.parse(value || "");
    return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
  };

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredClients = clients
    .filter((client) => {
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
    })
    .sort((left, right) => {
      const leftFlagged = isFlaggedForRemoval(left);
      const rightFlagged = isFlaggedForRemoval(right);

      if (leftFlagged !== rightFlagged) {
        return leftFlagged ? -1 : 1;
      }

      const leftCreatedAt = normalizeDate(left.date_added);
      const rightCreatedAt = normalizeDate(right.date_added);

      if (leftCreatedAt !== rightCreatedAt) {
        return leftCreatedAt - rightCreatedAt;
      }

      return (left.idoc_id || "").localeCompare(right.idoc_id || "");
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

    if (removingClientId !== null) {
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
        <p>No clients found.</p>
      ) : filteredClients.length === 0 ? (
        <p>No clients matched your search.</p>
      ) : (
        <table className="user-table">
          <thead>
            <tr>
              <th>Status</th>
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
                <td>
                  {isFlaggedForRemoval(client) ? (
                    <span
                      className="admin-client-indicator admin-client-indicator-unassigned"
                      title="Flagged for removal"
                      aria-label="Flagged for removal"
                    >
                      Flagged
                    </span>
                  ) : (
                    <span
                      className="admin-client-indicator admin-client-indicator-assigned"
                      title="Not flagged"
                      aria-label="Client not flagged for removal"
                    />
                  )}
                </td>
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
                    className={`admin-danger-button ${removingClientId === client.id ? "is-loading" : ""}`}
                    onClick={() => handleRemoveClient(client)}
                    disabled={Boolean(client.assigned_bed_label)}
                    title={
                      client.assigned_bed_label
                        ? "Unassign client before removing"
                        : removingClientId === client.id
                          ? "Removing client"
                          : "Remove client"
                    }
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
        Showing all clients sorted by Date Added, with flagged-for-removal clients prioritized at the top.
        {clients.length > 0 ? ` Displaying ${filteredClients.length} of ${clients.length}.` : ""}
      </p>
    </div>
  );
});

ManageClientsTable.displayName = "ManageClientsTable";

export default ManageClientsTable;
