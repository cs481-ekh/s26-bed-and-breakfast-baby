import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import AdminDash from "../admin/admin_dash";
import MainDash from "../main_dash/main_dash";
import PageTemplate from "./components/PageTemplate";
import LoginPage from "./LoginPage";
import "./App.css";

function AdminPage() {
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
    } catch (error) {
      alert(`Error updating role: ${error.message}`);
    }
  };

  return (
    <>
      <div style={{ textAlign: "left", marginBottom: "1rem" }}>
        <Link to="/main-dashboard">Open Main Bed Dashboard</Link>
        <span style={{ margin: "0 0.5rem" }}>|</span>
        <Link to="/login">Open Login Page</Link>
        <span style={{ margin: "0 0.5rem" }}>|</span>
        <a href="/case-manager.html">Case Manager Page</a>
        <span style={{ margin: "0 0.5rem" }}>|</span>
        <a href="/parole-officer.html">Parole Officer Page</a>
        <span style={{ margin: "0 0.5rem" }}>|</span>
        <a href="/provider-dashboard.html">Provider Page</a>
      </div>
      <PageTemplate>
        <AdminDash
          onAddUser={handleAddUser}
          onRemoveUser={handleRemoveUser}
          onDisableUser={handleDisableUser}
          onChangeRole={handleChangeRole}
        />
      </PageTemplate>
    </>
  );
}

function MainDashboardPageComponent() {
  return (
    <PageTemplate>
      <MainDash />
    </PageTemplate>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/main-dashboard" element={<MainDashboardPageComponent />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/" element={<MainDashboardPageComponent />} />
      </Routes>
    </Router>
  );
}