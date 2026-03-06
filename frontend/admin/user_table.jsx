import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";

const UserTable = forwardRef((props, ref) => {
  // Always initialize as an array
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch("/api/users/");;

      // If fetch returned something non-Response-ish, fail gracefully
      if (!response || typeof response.ok !== "boolean") {
        throw new Error("Invalid response from server.");
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Normalize to an array no matter what the API returns
      const normalizedUsers = Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.users)
            ? data.users
            : [];

      setUsers(normalizedUsers);
      setError(null);
    } catch (err) {
      // Important: keep users as an array in the error case too
      setUsers([]);
      setError(err instanceof Error ? err.message : String(err));
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useImperativeHandle(ref, () => ({
    fetchUsers,
  }));

  if (loading) {
    return (
      <div className="user-table-container">
        <p>Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-table-container">
        <p className="error">Error loading users: {error}</p>
        <button onClick={fetchUsers}>Retry</button>
      </div>
    );
  }

  // Option B hardening: even if state is somehow corrupted, never call `.map` on a non-array.
  const safeUsers = Array.isArray(users) ? users : [];

  return (
    <div className="user-table-container">
      <h2>Users</h2>

      {safeUsers.length === 0 ? (
        <p>No users found.</p>
      ) : (
        <table className="user-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
            </tr>
          </thead>

          <tbody>
            {safeUsers.map((user) => (
              <tr key={user?.id ?? user?.username ?? crypto.randomUUID()}>
                <td>{user?.username ?? "N/A"}</td>
                <td>
                  {`${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() ||
                    "N/A"}
                </td>
                <td>{user?.email ?? "N/A"}</td>
                <td>{user?.phone ?? "N/A"}</td>
                <td>{user?.role ?? "N/A"}</td>
                <td>{user?.is_active ? "Active" : "Inactive"}</td>
                <td>
                  {user?.date_joined
                    ? new Date(user.date_joined).toLocaleDateString()
                    : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <button onClick={fetchUsers}>Refresh</button>
    </div>
  );
});

UserTable.displayName = "UserTable";

export default UserTable;