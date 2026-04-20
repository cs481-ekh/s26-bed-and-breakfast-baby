import React, { useRef, useState } from "react";
import UserTable from "./user_table";
import "./admin_dash.css";
import { apiJson } from "../src/apiClient";

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
    const [copyFeedback, setCopyFeedback] = useState("");

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

    const handleGenerateInvite = async (event) => {
        event.preventDefault();
        setInviteMessage("");
        setInviteLink("");

        if (!inviteEmail.trim()) {
            setInviteMessage("Enter an email address first.");
            return;
        }

        try {
            const { response, payload } = await apiJson("/api/users/create-invite/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: inviteEmail.trim(),
                    role: inviteRole,
                }),
            });

            if (!response.ok) {
                setInviteMessage(`Failed to create invite: ${payload.error || "Unknown error"}`);
                return;
            }

            setInviteLink(payload.invite_link);
            setInviteMessage(
                `Invite created successfully! Copy this link and send it to ${inviteEmail}. The link expires in 3 days.`
            );
        } catch {
            setInviteMessage("Failed to create invite. Please try again.");
        }
    };

    const handleCopyLink = async () => {
        if (!inviteLink) return;

        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopyFeedback("Copied!");
            setTimeout(() => setCopyFeedback(""), 2000);
        } catch {
            setCopyFeedback("Failed to copy");
            setTimeout(() => setCopyFeedback(""), 2000);
        }
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
                    <div className="admin-users-panel">
                        <div className="admin-panel-card">
                            <div className="admin-panel-header">
                                <h2>Users</h2>
                                <div className="admin-header-actions">
                                    <button type="button" className="admin-secondary-button" onClick={refreshUsers}>
                                        Refresh Table
                                    </button>
                                </div>
                            </div>
                            
                            {selectedUser && (
                                <div className="admin-selected-user-bar">
                                    <div className="admin-selected-user-info">
                                        <span className="admin-selected-label">Selected: <strong>{selectedUser.username}</strong></span>
                                        <span className="admin-selected-role">Role: {selectedUser.role}</span>
                                    </div>
                                    <div className="admin-selected-user-actions">
                                        <select
                                            id="selected-role"
                                            value={selectedRole}
                                            onChange={(event) => setSelectedRole(event.target.value)}
                                            className="admin-role-select"
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
                                </div>
                            )}
                            
                            <UserTable
                                ref={userTableRef}
                                onSelectUser={handleSelectUser}
                                selectedUsername={selectedUser?.username}
                            />
                            
                            {userActionMessage && (
                                <div className="admin-message-bar">
                                    <p className="admin-inline-message">{userActionMessage}</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="admin-panel-card admin-create-card">
                        <h2>Create Account</h2>
                        <p>
                            Generate a secure invitation link for a new user. The link will be valid for 3 days and can only be used once.
                            Copy the generated link and send it to the user via email.
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
                                <div className="admin-link-header">
                                    <h3>Generated Link</h3>
                                    <button
                                        type="button"
                                        className="admin-secondary-button"
                                        onClick={handleCopyLink}
                                        title="Copy link to clipboard"
                                    >
                                        {copyFeedback || "Copy"}
                                    </button>
                                </div>
                                <p>{inviteLink}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}
