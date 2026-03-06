import { useRef } from "react";
import AdminDash from "../admin/admin_dash";
import UserTable from "../admin/user_table";
import "./App.css";

export default function App() {
<<<<<<< HEAD
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
=======
  const userTableRef = useRef();

  const handleAddUser = async (userData) => {
    try {
      const response = await fetch('http://localhost:8000/api/users/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        throw new Error('Failed to add user');
      }
      alert('User added successfully!');
      // Refresh the user table
      if (userTableRef.current) {
        userTableRef.current.fetchUsers?.();
      }
    } catch (error) {
      alert(`Error adding user: ${error.message}`);
      console.error('Error adding user:', error);
    }
>>>>>>> f0f32d66962b75194dabb20063062788644f3bdd
  };

  const handleRemoveUser = async (username) => {
    try {
      // First, find the user by username
      const listResponse = await fetch('http://localhost:8000/api/users/');
      const users = await listResponse.json();
      const user = users.find(u => u.username === username);
      
      if (!user) {
        throw new Error('User not found');
      }

      const response = await fetch(`http://localhost:8000/api/users/${user.id}/`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to remove user');
      }
      alert('User removed successfully!');
      // Refresh the user table
      if (userTableRef.current) {
        userTableRef.current.fetchUsers?.();
      }
    } catch (error) {
      alert(`Error removing user: ${error.message}`);
      console.error('Error removing user:', error);
    }
  };

  return (
    <>
      <AdminDash onAddUser={handleAddUser} onRemoveUser={handleRemoveUser} />
      <UserTable ref={userTableRef} />
    </>
  );
}
