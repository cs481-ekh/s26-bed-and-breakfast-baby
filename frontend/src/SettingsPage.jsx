import { useEffect, useState } from "react";
import { apiJson } from "./apiClient";
import "./SettingsPage.css";

const INITIAL_FORM = {
  current_password: "",
  new_password: "",
  confirm_new_password: "",
};

const ROLE_LABELS = {
  admin: "Admin",
  case_manager: "Case Manager",
  parole_officer: "Parole Officer",
  provider: "Provider",
};

export default function SettingsPage() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountInfo, setAccountInfo] = useState({ username: "", role: "" });
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  const [notificationPrefs, setNotificationPrefs] = useState({
    bed_assignment_updates: true,
    hold_request_updates: true,
    weekly_summary: false,
  });

  useEffect(() => {
    let cancelled = false;

    const loadAccountInfo = async () => {
      try {
        const { response, payload } = await apiJson("/api/me/");
        if (!cancelled && response.ok) {
          setAccountInfo({
            username: payload?.username || "",
            role: payload?.role || "",
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAccount(false);
        }
      }
    };

    loadAccountInfo();
    return () => {
      cancelled = true;
    };
  }, []);

  const onChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage("");
    setFieldErrors({});

    try {
      setIsSubmitting(true);
      const { response, payload } = await apiJson("/api/auth/change-password/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        setFieldErrors(payload?.errors || {});
        setStatusMessage(payload?.error || "Could not update password.");
        return;
      }

      setFormData(INITIAL_FORM);
      setStatusMessage(payload?.message || "Password updated successfully.");
    } catch {
      setStatusMessage("Unable to reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNotificationToggle = (event) => {
    const { name, checked } = event.target;
    setNotificationPrefs((prev) => ({ ...prev, [name]: checked }));
  };

  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <div className="settings-card">
        <h1 id="settings-title">Settings</h1>

        <section className="settings-section" aria-labelledby="account-section-title">
          <h2 id="account-section-title">Account</h2>
          <div className="account-readonly-text">
            <p>
              Username: {isLoadingAccount ? "Loading..." : accountInfo.username}
            </p>
            <p>
              Role: {isLoadingAccount ? "Loading..." : ROLE_LABELS[accountInfo.role] || accountInfo.role || "Unknown"}
            </p>
          </div>
        </section>

        <section className="settings-section" aria-labelledby="notification-section-title">
          <h2 id="notification-section-title">Email Notification Preferences</h2>
          <div className="notification-options">
            <label className="checkbox-option">
              <input
                type="checkbox"
                name="bed_assignment_updates"
                checked={notificationPrefs.bed_assignment_updates}
                onChange={handleNotificationToggle}
              />
              Bed assignment updates
            </label>

            <label className="checkbox-option">
              <input
                type="checkbox"
                name="hold_request_updates"
                checked={notificationPrefs.hold_request_updates}
                onChange={handleNotificationToggle}
              />
              Hold request updates
            </label>

            <label className="checkbox-option">
              <input
                type="checkbox"
                name="weekly_summary"
                checked={notificationPrefs.weekly_summary}
                onChange={handleNotificationToggle}
              />
              Weekly summary email
            </label>
          </div>
          <button type="button" className="primary-action-button">
            Save (not implemented yet)
          </button>
        </section>

        <section className="settings-section" aria-labelledby="password-section-title">
          <h2 id="password-section-title">Change Password</h2>
          <p className="section-subtitle">Update your sign-in password.</p>

          <form className="settings-form" onSubmit={handleSubmit}>
            <label htmlFor="current_password">Current Password</label>
            <input
              id="current_password"
              name="current_password"
              type="password"
              autoComplete="current-password"
              value={formData.current_password}
              onChange={onChange}
              required
            />
            {fieldErrors.current_password && <p className="field-error">{fieldErrors.current_password}</p>}

            <label htmlFor="new_password">New Password</label>
            <input
              id="new_password"
              name="new_password"
              type="password"
              autoComplete="new-password"
              value={formData.new_password}
              onChange={onChange}
              required
            />
            {fieldErrors.new_password && <p className="field-error">{fieldErrors.new_password}</p>}

            <label htmlFor="confirm_new_password">Confirm New Password</label>
            <input
              id="confirm_new_password"
              name="confirm_new_password"
              type="password"
              autoComplete="new-password"
              value={formData.confirm_new_password}
              onChange={onChange}
              required
            />
            {fieldErrors.confirm_new_password && <p className="field-error">{fieldErrors.confirm_new_password}</p>}

            <button type="submit" className="primary-action-button" disabled={isSubmitting}>
              {isSubmitting ? "Updating..." : "Update Password"}
            </button>
          </form>

          {statusMessage && <p className="settings-status">{statusMessage}</p>}
        </section>
      </div>
    </section>
  );
}
