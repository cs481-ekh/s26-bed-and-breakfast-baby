import React, { useRef, useState } from "react";
import UserTable from "./user_table";
import "./admin_dash.css";

const ROLES = [
    { value: "admin", label: "Admin" },
    { value: "case_manager", label: "Case Manager" },
    { value: "parole_officer", label: "Parole Officer" },
    { value: "provider", label: "Housing Provider" },
];

export default function AdminDash({ onRemoveUser, onDisableUser, onEnableUser, onChangeRole }) {
    const userTableRef = useRef(null);
    const [activePanel, setActivePanel] = useState("users");

    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedRole, setSelectedRole] = useState("case_manager");
    const [userActionMessage, setUserActionMessage] = useState("");

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("case_manager");
    const [inviteLink, setInviteLink] = useState("");
    const [inviteMessage, setInviteMessage] = useState("");

    const refreshUsers = () => {
        userTableRef.current?.fetchUsers?.();
    };

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setSelectedRole(user?.role || "case_manager");
        setUserActionMessage("");
    };

    const handleRemoveSelectedUser = async () => {
        if (!selectedUser?.username) {
            return;
        }

        const confirmed = window.confirm(
            `Remove account "${selectedUser.username}"? This action cannot be undone.`
        );

        if (!confirmed) {
            return;
        }

        try {
            if (onRemoveUser) {
                await onRemoveUser(selectedUser.username);
            }
            setUserActionMessage(`Removed user ${selectedUser.username}.`);
            setSelectedUser(null);
            refreshUsers();
        } catch {
            setUserActionMessage("Unable to remove user right now.");
        }
    };

    const handleToggleSelectedUserActive = async () => {
        if (!selectedUser?.username) {
        return;
        }

        const isCurrentlyActive = Boolean(selectedUser.is_active);

        const confirmed = window.confirm(
        isCurrentlyActive
            ? `Deactivate account "${selectedUser.username}"? They will remain in the list but will not be able to sign in.`
            : `Reactivate account "${selectedUser.username}"?`
        );

        if (!confirmed) {
        return;
        }

        try {
        if (isCurrentlyActive) {
            if (onDisableUser) {
            await onDisableUser(selectedUser.username);
            }

            setSelectedUser((current) =>
            current ? { ...current, is_active: false } : current
            );
            setUserActionMessage(`Deactivated user ${selectedUser.username}.`);
        } else {
            if (onEnableUser) {
            await onEnableUser(selectedUser.username);
            }

            setSelectedUser((current) =>
            current ? { ...current, is_active: true } : current
            );
            setUserActionMessage(`Reactivated user ${selectedUser.username}.`);
        }

        refreshUsers();
        } catch (error) {
        setUserActionMessage(
            error instanceof Error
            ? error.message
            : "Unable to update account status right now."
        );
        }
    };

    const handleUpdateSelectedRole = async () => {
        if (!selectedUser?.username) {
            return;
        }

        try {
            if (onChangeRole) {
                await onChangeRole(selectedUser.username, selectedRole);
            }
            setUserActionMessage(`Updated role for ${selectedUser.username}.`);
            setSelectedUser({ ...selectedUser, role: selectedRole });
            refreshUsers();
        } catch {
            setUserActionMessage("Unable to update role right now.");
        }
    };

    const handleGenerateInvite = (event) => {
        event.preventDefault();

        if (!inviteEmail.trim()) {
            setInviteMessage("Enter an email address first.");
            return;
        }

        const token = Math.random().toString(36).slice(2, 12);
        const link = `${window.location.origin}/register?token=${token}`;

        setInviteLink(link);
        setInviteMessage(
            "Stub only: invite link generated locally. Email delivery is not implemented yet."
        );
    };

    return (
        <section className="admin-layout" aria-label="Admin dashboard layout">
            <aside className="admin-sidebar" aria-label="Admin sections">
                <h1 className="admin-title">Admin Dashboard</h1>
                <p className="admin-subtitle">Manage users and account onboarding from one screen.</p>

                <div className="admin-sidebar-buttons">
                    <button
                        type="button"
                        className={`admin-nav-button ${activePanel === "users" ? "active" : ""}`}
                        onClick={() => setActivePanel("users")}
                    >
                        Users
                    </button>
                    <button
                        type="button"
                        className={`admin-nav-button ${activePanel === "create-account" ? "active" : ""}`}
                        onClick={() => setActivePanel("create-account")}
                    >
                        Create Account
                    </button>
                </div>
            </aside>

            <div className="admin-main-panel">
                {activePanel === "users" ? (
                    <div className="admin-users-grid">
                        <div className="admin-panel-card">
                            <div className="admin-panel-header">
                                <h2>Users</h2>
                                <button type="button" className="admin-secondary-button" onClick={refreshUsers}>
                                    Refresh Table
                                </button>
                            </div>
                            <UserTable
                                ref={userTableRef}
                                onSelectUser={handleSelectUser}
                                selectedUsername={selectedUser?.username}
                            />
                        </div>

                        <div className="admin-action-card">
                            <h3>User Actions</h3>
                            {selectedUser ? (
                                <>
                                    <p className="admin-selection-label">Selected: <strong>{selectedUser.username}</strong></p>
                                    <div className="admin-form">
                                        <label htmlFor="selected-role">Role</label>
                                        <select
                                            id="selected-role"
                                            value={selectedRole}
                                            onChange={(event) => setSelectedRole(event.target.value)}
                                        >
                                            {ROLES.map((role) => (
                                                <option key={role.value} value={role.value}>
                                                    {role.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    
                                    <p className="admin-selection-label">
                                        Status: <strong>{selectedUser.is_active ? "Active" : "Inactive"}</strong>
                                    </p>

                                    <div className="admin-action-buttons">
                                        <button
                                        type="button"
                                        className="admin-primary-button"
                                        onClick={handleUpdateSelectedRole}
                                        >
                                        Update User
                                        </button>

                                        <button
                                        type="button"
                                        className={
                                            selectedUser.is_active
                                            ? "admin-secondary-button"
                                            : "admin-primary-button"
                                        }
                                        onClick={handleToggleSelectedUserActive}
                                        >
                                        {selectedUser.is_active ? "Deactivate User" : "Reactivate User"}
                                        </button>

                                        <button
                                        type="button"
                                        className="admin-danger-button"
                                        onClick={handleRemoveSelectedUser}
                                        >
                                        Remove User Permanently
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <p>Click a row in the users table to open actions.</p>
                            )}
                            {userActionMessage && <p className="admin-inline-message">{userActionMessage}</p>}
                        </div>
                    </div>
                ) : (
                    <div className="admin-panel-card admin-create-card">
                        <h2>Create Account (Stub)</h2>
                        <p>
                            Fill out email and role, then generate an invite link. Sending email is intentionally not
                            implemented yet.
                        </p>

                        <form onSubmit={handleGenerateInvite} className="admin-form admin-create-form">
                            <label htmlFor="invite-email">Email</label>
                            <input
                                id="invite-email"
                                type="email"
                                value={inviteEmail}
                                onChange={(event) => setInviteEmail(event.target.value)}
                                placeholder="new.user@agency.gov"
                                required
                            />

                            <label htmlFor="invite-role">Role</label>
                            <select
                                id="invite-role"
                                value={inviteRole}
                                onChange={(event) => setInviteRole(event.target.value)}
                            >
                                {ROLES.map((role) => (
                                    <option key={role.value} value={role.value}>
                                        {role.label}
                                    </option>
                                ))}
                            </select>

                            <button type="submit" className="admin-primary-button">Generate Link</button>
                        </form>

                        {inviteMessage && <p className="admin-inline-message">{inviteMessage}</p>}

                        {inviteLink && (
                            <div className="admin-link-preview">
                                <h3>Generated Link</h3>
                                <p>{inviteLink}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
