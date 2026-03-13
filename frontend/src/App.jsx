import { useRef } from "react";
import AdminDash from "../admin/admin_dash";
import MainDash from "../main_dash/main_dash";
import UserTable from "../admin/user_table";
import "./App.css";

export default function App() {
  const currentPath = window.location.pathname;
  const isMainDashboardPage = currentPath === "/main-dashboard";
  const userTableRef = useRef(null);

  const handleAddUser = async (userData) => {
    const response = await fetch("/api/signup/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    const payload = await response.json();

    if (!response.ok) {
      const error = new Error("Sign up failed");
      error.fieldErrors = payload?.errors || {};
      throw error;
    }

    // Optional: refresh user table if UserTable exposes a method on its ref
    userTableRef.current?.fetchUsers?.();

    return payload;
  };

  const handleRemoveUser = async (username) => {
    try {
      const response = await fetch("/api/users/remove/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      const payload = await response.json();

      if (!response.ok) {
        alert(`Failed to remove user: ${payload.error || "Unknown error"}`);
        return;
      }

      alert(`User ${username} has been removed successfully.`);
      userTableRef.current?.fetchUsers?.();
    } catch (error) {
      alert(`Error removing user: ${error.message}`);
    }
  };

  const handleDisableUser = async (username) => {
    try {
      const response = await fetch("/api/users/disable/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      const payload = await response.json();

      if (!response.ok) {
        alert(`Failed to disable user: ${payload.error || "Unknown error"}`);
        return;
      }

      alert(`User ${username} has been disabled successfully.`);
      
      // Refresh the user table if available
      userTableRef.current?.fetchUsers?.();
    } catch (error) {
      alert(`Error disabling user: ${error.message}`);
    }
  };

  const handleChangeRole = async (username, role) => {
    try {
      const response = await fetch("/api/users/update-role/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, role }),
      });

      const payload = await response.json();

      if (!response.ok) {
        alert(`Failed to update role: ${payload.error || "Unknown error"}`);
        return;
      }

      alert(`User ${username} role updated successfully.`);
      userTableRef.current?.fetchUsers?.();
    } catch (error) {
      alert(`Error updating role: ${error.message}`);
    }
  };

  if (isMainDashboardPage) {
    return (
      <>
        <div style={{ textAlign: "left", marginBottom: "1rem" }}>
          <a href="/">Back To Admin Dashboard</a>
        </div>
        <MainDash />
      </>
    );
  }

  return (
    <>
      <div style={{ textAlign: "left", marginBottom: "1rem" }}>
        <a href="/main-dashboard">Open Main Bed Dashboard</a>
      </div>
      <AdminDash 
        onAddUser={handleAddUser} 
        onRemoveUser={handleRemoveUser} 
        onDisableUser={handleDisableUser}
        onChangeRole={handleChangeRole}
      />
      <UserTable ref={userTableRef} />
    </>
  );
}