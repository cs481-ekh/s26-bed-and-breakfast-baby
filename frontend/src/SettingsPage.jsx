import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiJson } from "./apiClient";
import "./SettingsPage.css";

const INITIAL_FORM = {
  current_password: "",
  new_password: "",
  confirm_new_password: "",
};

const ROLE_LABELS = {
  admin: "Admin",
  idoc_staff: "IDOC Staff",
  provider: "Provider",
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [accountInfo, setAccountInfo] = useState({ username: "", role: "" });
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);

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

  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <div className="settings-card">
        <div className="settings-header">
          <button className="back-button" onClick={() => navigate(-1)} aria-label="Go back">
            ← Back
          </button>
          <h1 id="settings-title">Settings</h1>
        </div>

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
