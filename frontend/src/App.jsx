import AdminDash from "../admin/admin_dash";
import "./App.css";

export default function App() {
  const handleAddUser = async (userData) => {
    const response = await fetch("/api/signup/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    const payload = await response.json();
    if (!response.ok) {
      const error = new Error("Sign up failed");
      error.fieldErrors = payload.errors || {};
      throw error;
    }

    return payload;
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
