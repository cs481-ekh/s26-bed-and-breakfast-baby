import { useRef } from "react";
import AdminDash from "../admin/admin_dash";
import UserTable from "../admin/user_table";
import "./App.css";

export default function App() {
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

  // Optional: implement later; for now avoid breaking the UI
  const handleRemoveUser = async (_username) => {
    alert("Remove user not implemented yet.");
  };

  return (
    <>
      <AdminDash onAddUser={handleAddUser} onRemoveUser={handleRemoveUser} />
      <UserTable ref={userTableRef} />
    </>
  );
}