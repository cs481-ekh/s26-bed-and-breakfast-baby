import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import AdminDash from "../admin/admin_dash";
import MainDash from "../main_dash/main_dash";
import PageTemplate from "./components/PageTemplate";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import { apiJson } from "./apiClient";
import RolePageGate from "./RolePageGate";
import ProviderPage from "./ProviderPage";
import SettingsPage from "./SettingsPage";
import "./App.css";

function AdminPage() {
  const handleAddUser = async (userData) => {
    const { response, payload } = await apiJson("/api/signup/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error = new Error("Sign up failed");
      error.fieldErrors = payload?.errors || {};
      throw error;
    }

    return payload;
  };

  const handleRemoveUser = async (username) => {
    try {
      const { response, payload } = await apiJson("/api/users/remove/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

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
      const { response, payload } = await apiJson("/api/users/disable/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        alert(`Failed to disable user: ${payload.error || "Unknown error"}`);
        return;
      }

      alert(`User ${username} has been disabled successfully.`);
    } catch (error) {
      alert(`Error disabling user: ${error.message}`);
    }
  };

  const handleEnableUser = async (username) => {
    const { response, payload } = await apiJson("/api/users/enable/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      throw new Error(payload?.error || "Failed to reactivate user.");
    }

    return payload;
  };

  const handleChangeRole = async (username, role) => {
    try {
      const { response, payload } = await apiJson("/api/users/update-role/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, role }),
      });

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
    <RolePageGate allowedRoles={["admin"]}>
      <PageTemplate>
        <AdminDash
          onAddUser={handleAddUser}
          onRemoveUser={handleRemoveUser}
          onDisableUser={handleDisableUser}
          onEnableUser={handleEnableUser}
          onChangeRole={handleChangeRole}
        />
      </PageTemplate>
    </RolePageGate>
  );
}

function MainDashboardPageComponent() {
  const [isReadOnly, setIsReadOnly] = useState(true);
  const [roleLoaded, setRoleLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadRole = async () => {
      const { response, payload } = await apiJson("/api/me/");

      if (cancelled) {
        return;
      }

      if (response.ok) {
        const role = payload?.role || "";
        setIsReadOnly(!(role === "admin" || role === "case_manager" || role === "parole_officer"));
      } else {
        setIsReadOnly(true);
      }

      setRoleLoaded(true);
    };

    loadRole();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <RolePageGate allowedRoles={["admin", "case_manager", "parole_officer"]}>
      <PageTemplate>
        {roleLoaded ? <MainDash readOnly={isReadOnly} /> : <p>Loading dashboard...</p>}
      </PageTemplate>
    </RolePageGate>
  );
}

function SettingsRoutePage() {
  return (
    <RolePageGate allowedRoles={["admin", "case_manager", "parole_officer", "provider"]}>
      <PageTemplate>
        <SettingsPage />
      </PageTemplate>
    </RolePageGate>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/main-dashboard" element={<MainDashboardPageComponent />} />
        <Route path="/provider-dashboard" element={<ProviderPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/settings" element={<SettingsRoutePage />} />
        <Route path="/" element={<Navigate to="/main-dashboard" replace />} />
      </Routes>
    </Router>
  );
}