import { useState } from "react";
import AdminDash from "../admin/admin_dash";
import "./App.css";

export default function App() {
  const handleAddUser = (userData) => {
    console.log("Adding user:", userData);
    // TODO: Add link to user table
  };

  const handleRemoveUser = (username) => {
    console.log("Removing user:", username);
    // TODO: Add link to user table
  };

  return (
    <>
      <AdminDash onAddUser={handleAddUser} onRemoveUser={handleRemoveUser} />
    </>
  );
}
