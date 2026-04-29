import React, { useEffect, useRef, useState } from "react";
import UserTable from "./user_table";
import ManageClientsTable from "./manage_clients_table";
import ManageFacilitiesTable from "./manage_facilities_table";
import "./admin_dash.css";
import { apiJson } from "../src/apiClient";

const ROLES = [
    { value: "admin", label: "Admin" },
    { value: "idoc_staff", label: "IDOC Staff" },
    { value: "provider", label: "Housing Provider" },
];

export default function AdminDash({ onRemoveUser, onDisableUser, onEnableUser, onChangeRole }) {
    const userTableRef = useRef(null);
    const manageClientsTableRef = useRef(null);
    const manageFacilitiesTableRef = useRef(null);
    const [activePanel, setActivePanel] = useState("users");

    const [selectedUser, setSelectedUser] = useState(null);
    const [selectedRole, setSelectedRole] = useState("idoc_staff");
    const [userActionMessage, setUserActionMessage] = useState("");

    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("idoc_staff");
    const [inviteProviderId, setInviteProviderId] = useState("");
    const [inviteLink, setInviteLink] = useState("");
    const [inviteMessage, setInviteMessage] = useState("");
    const [copyFeedback, setCopyFeedback] = useState("");
    const [providers, setProviders] = useState([]);
    const [districts, setDistricts] = useState([]);

    const [providerName, setProviderName] = useState("");
    const [providerContactName, setProviderContactName] = useState("");
    const [providerContactEmail, setProviderContactEmail] = useState("");
    const [providerContactPhone, setProviderContactPhone] = useState("");
    const [providerDistrictId, setProviderDistrictId] = useState("");
    const [providerAddress, setProviderAddress] = useState("");
    const [providerNotes, setProviderNotes] = useState("");
    const [providerWebsite, setProviderWebsite] = useState("");
    const [providerMessage, setProviderMessage] = useState("");

    const loadProviders = async () => {
        const { response, payload } = await apiJson("/api/admin/providers/");
        if (!response.ok) {
            throw new Error(payload?.error || "Could not load providers.");
        }
        setProviders(Array.isArray(payload) ? payload : []);
    };

    const loadDistricts = async () => {
        const { response, payload } = await apiJson("/api/admin/districts/");
        if (!response.ok) {
            throw new Error(payload?.error || "Could not load districts.");
        }
        setDistricts(Array.isArray(payload) ? payload : []);
    };

    useEffect(() => {
        Promise.all([loadProviders(), loadDistricts()]).catch(() => {
            setInviteMessage("Could not load providers/districts.");
        });
    }, []);

    const refreshUsers = () => {
        userTableRef.current?.fetchUsers?.();
    };

    const refreshClients = () => {
        manageClientsTableRef.current?.fetchClients?.();
    };

    const refreshFacilities = () => {
        manageFacilitiesTableRef.current?.fetchFacilities?.();
    };

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setSelectedRole(user?.role || "idoc_staff");
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
        if (inviteRole === "provider" && !inviteProviderId) {
            setInviteMessage("Select which housing provider this account should be linked to.");
            return;
        }

        try {
            const { response, payload } = await apiJson("/api/users/create-invite/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: inviteEmail.trim(),
                    role: inviteRole,
                    provider_id: inviteRole === "provider" ? Number(inviteProviderId) : null,
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

    const handleCreateProvider = async (event) => {
        event.preventDefault();
        setProviderMessage("");

        if (!providerName.trim()) {
            setProviderMessage("Provider name is required.");
            return;
        }
        if (!providerContactName.trim()) {
            setProviderMessage("Contact name is required.");
            return;
        }
        if (!providerContactPhone.trim()) {
            setProviderMessage("Contact phone is required.");
            return;
        }
        if (!providerContactEmail.trim()) {
            setProviderMessage("Contact email is required.");
            return;
        }
        if (!providerDistrictId) {
            setProviderMessage("District is required.");
            return;
        }
        if (!providerAddress.trim()) {
            setProviderMessage("Address is required.");
            return;
        }

        try {
            const { response, payload } = await apiJson("/api/admin/providers/create/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: providerName.trim(),
                    contact_name: providerContactName.trim(),
                    contact_email: providerContactEmail.trim(),
                    contact_phone: providerContactPhone.trim(),
                    district_id: Number(providerDistrictId),
                    address: providerAddress.trim(),
                    notes: providerNotes.trim(),
                    website: providerWebsite.trim(),
                }),
            });

            if (!response.ok) {
                setProviderMessage(payload?.error || "Could not create provider.");
                return;
            }

            setProviderMessage(payload?.message || "Provider created.");
            setProviderName("");
            setProviderContactName("");
            setProviderContactEmail("");
            setProviderContactPhone("");
            setProviderDistrictId("");
            setProviderAddress("");
            setProviderNotes("");
            setProviderWebsite("");
            await loadProviders();
        } catch {
            setProviderMessage("Could not create provider.");
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
                        className={`admin-nav-button ${activePanel === "create-user-account" ? "active" : ""}`}
                        onClick={() => setActivePanel("create-user-account")}
                    >
                        Create User Account
                    </button>
                    <button
                        type="button"
                        className={`admin-nav-button ${activePanel === "providers" ? "active" : ""}`}
                        onClick={() => setActivePanel("providers")}
                    >
                        Providers
                    </button>
                    <button
                        type="button"
                        className={`admin-nav-button ${activePanel === "manage-clients" ? "active" : ""}`}
                        onClick={() => setActivePanel("manage-clients")}
                    >
                        Clients
                    </button>
                    <button
                        type="button"
                        className={`admin-nav-button ${activePanel === "manage-facilities" ? "active" : ""}`}
                        onClick={() => setActivePanel("manage-facilities")}
                    >
                        Facilities
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
                ) : activePanel === "create-user-account" ? (
                    <div className="admin-panel-card admin-create-card">
                        <h2>Create User Account</h2>
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
                                onChange={(event) => {
                                    const nextRole = event.target.value;
                                    setInviteRole(nextRole);
                                    if (nextRole !== "provider") {
                                        setInviteProviderId("");
                                    }
                                }}
                            >
                                {ROLES.map((role) => (
                                    <option key={role.value} value={role.value}>
                                        {role.label}
                                    </option>
                                ))}
                            </select>
                            {inviteRole === "provider" && (
                                <>
                                    <label htmlFor="invite-provider">Housing Provider</label>
                                    <select
                                        id="invite-provider"
                                        value={inviteProviderId}
                                        onChange={(event) => setInviteProviderId(event.target.value)}
                                        required
                                    >
                                        <option value="">Select a provider</option>
                                        {providers
                                            .filter((provider) => provider.is_active)
                                            .map((provider) => (
                                                <option key={provider.provider_id} value={provider.provider_id}>
                                                    {provider.provider_name}
                                                </option>
                                            ))}
                                    </select>
                                </>
                            )}

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
                ) : activePanel === "providers" ? (
                    <div className="admin-panel-card admin-create-card">
                        <div className="admin-panel-header">
                            <h2>Providers</h2>
                            <div className="admin-header-actions">
                                <button type="button" className="admin-secondary-button" onClick={loadProviders}>
                                    Refresh Providers
                                </button>
                            </div>
                        </div>

                        <div className="admin-providers-list">
                            <table className="admin-provider-table">
                                <thead>
                                    <tr>
                                        <th>Provider</th>
                                        <th>Contact</th>
                                        <th>District</th>
                                        <th>Address</th>
                                        <th>Notes</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {providers.map((provider) => (
                                        <tr key={provider.provider_id}>
                                            <td>
                                                <strong>{provider.provider_name}</strong>
                                                <div className="admin-provider-subtext">{provider.contact_name || ""}</div>
                                            </td>
                                            <td>
                                                <div className="admin-provider-subtext">{provider.contact_phone || ""}</div>
                                                <div className="admin-provider-subtext">{provider.contact_email || ""}</div>
                                            </td>
                                            <td>
                                                {provider.district_number ? `${provider.district_number} - ${provider.district_name || ""}` : (provider.district_name || "")}
                                            </td>
                                            <td className="admin-provider-multiline">{provider.address || ""}</td>
                                            <td className="admin-provider-multiline">{provider.notes || ""}</td>
                                            <td>{provider.is_active ? "Active" : "Inactive"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <h3 className="admin-providers-create-title">Create Provider</h3>
                        <p>Create a new housing provider organization (not a user account).</p>

                        <form onSubmit={handleCreateProvider} className="admin-form admin-create-form">
                            <label htmlFor="provider-name">Provider Name</label>
                            <input
                                id="provider-name"
                                type="text"
                                value={providerName}
                                onChange={(event) => setProviderName(event.target.value)}
                                placeholder="North Star Housing"
                                required
                            />

                            <label htmlFor="provider-contact-name">Contact Name</label>
                            <input
                                id="provider-contact-name"
                                type="text"
                                value={providerContactName}
                                onChange={(event) => setProviderContactName(event.target.value)}
                                placeholder="Jane Smith"
                                required
                            />

                            <label htmlFor="provider-contact-email">Contact Email</label>
                            <input
                                id="provider-contact-email"
                                type="email"
                                value={providerContactEmail}
                                onChange={(event) => setProviderContactEmail(event.target.value)}
                                placeholder="contact@provider.org"
                                required
                            />

                            <label htmlFor="provider-contact-phone">Contact Phone</label>
                            <input
                                id="provider-contact-phone"
                                type="text"
                                value={providerContactPhone}
                                onChange={(event) => setProviderContactPhone(event.target.value)}
                                placeholder="(208) 555-0142"
                                required
                            />

                            <label htmlFor="provider-district">District</label>
                            <select
                                id="provider-district"
                                value={providerDistrictId}
                                onChange={(event) => setProviderDistrictId(event.target.value)}
                                required
                            >
                                <option value="">Select a district</option>
                                {districts.map((district) => (
                                    <option key={district.district_id} value={district.district_id}>
                                        {district.district_number} - {district.district_name}
                                    </option>
                                ))}
                            </select>

                            <label htmlFor="provider-address">Home Address</label>
                            <textarea
                                id="provider-address"
                                value={providerAddress}
                                onChange={(event) => setProviderAddress(event.target.value)}
                                placeholder="123 Main St, City, ID 83701"
                                required
                            />

                            <label htmlFor="provider-notes">Notes (optional)</label>
                            <textarea
                                id="provider-notes"
                                value={providerNotes}
                                onChange={(event) => setProviderNotes(event.target.value)}
                                placeholder="Any extra notes about this provider..."
                            />

                            <label htmlFor="provider-website">Website (optional)</label>
                            <input
                                id="provider-website"
                                type="url"
                                value={providerWebsite}
                                onChange={(event) => setProviderWebsite(event.target.value)}
                                placeholder="https://provider.org"
                            />

                            <button type="submit" className="admin-primary-button">Create Provider</button>
                        </form>

                        {providerMessage && <p className="admin-inline-message">{providerMessage}</p>}
                    </div>
                ) : activePanel === "manage-clients" ? (
                    <div className="admin-panel-card admin-create-card">
                        <h2>Clients</h2>
                        <div className="admin-panel-header">
                            <p>Review clients who have been in the system for 24 months or longer.</p>
                            <div className="admin-header-actions">
                                <button type="button" className="admin-secondary-button" onClick={refreshClients}>
                                    Refresh Table
                                </button>
                            </div>
                        </div>
                        <ManageClientsTable ref={manageClientsTableRef} />
                    </div>
                ) : (
                    <div className="admin-panel-card admin-create-card">
                        <h2>Facilities</h2>
                        <div className="admin-panel-header">
                            <p>Review facility capacity and availability, including inactive facilities.</p>
                            <div className="admin-header-actions">
                                <button type="button" className="admin-secondary-button" onClick={refreshFacilities}>
                                    Refresh Table
                                </button>
                            </div>
                        </div>
                        <ManageFacilitiesTable ref={manageFacilitiesTableRef} />
                    </div>
                )}
            </div>
        </section>
    );
}
