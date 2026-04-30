import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiJson } from "./apiClient";
// just gonna reuse the styling for the login page - alex
import "./login.css";

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [token, setToken] = useState("");
  const [inviteData, setInviteData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const isProviderInvite = inviteData?.role === "provider";

  // Validate token on component mount
  useEffect(() => {
    // SECURITY: Extract token from URL fragment (#token) instead of query parameter
    // The fragment is never sent to the server, so it won't appear in server logs
    const tokenParam = location.hash ? location.hash.substring(1) : '';
    
    if (!tokenParam) {
      setError("No invitation token provided.");
      setLoading(false);
      return;
    }

    setToken(tokenParam);

    // Validate the token
    const validateToken = async () => {
      try {
        const { response, payload } = await apiJson("/api/invites/validate/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: tokenParam }),
        });

        if (!response.ok) {
          setError(payload.error || "Invalid invitation token.");
          return;
        }

        setInviteData(payload);
      } catch {
        setError("Failed to validate invitation. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [location.hash]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormErrors({});
    setSubmitting(true);

    // Basic client-side validation
    const errors = {};
    if (!firstName.trim()) errors.first_name = "First name is required.";
    if (!lastName.trim()) errors.last_name = "Last name is required.";
    if (!isProviderInvite && !employeeId.trim()) errors.employee_id = "Employee ID is required.";
    if (!password) errors.password = "Password is required.";
    if (!confirmPassword) errors.confirm_password = "Please confirm your password.";
    if (password && confirmPassword && password !== confirmPassword) {
      errors.confirm_password = "Passwords do not match.";
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      setSubmitting(false);
      return;
    }

    try {
      const { response, payload } = await apiJson("/api/signup-with-invite/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          employee_id: employeeId.trim(),
          password,
          confirm_password: confirmPassword,
        }),
      });

      if (!response.ok) {
        if (payload.errors) {
          setFormErrors(payload.errors);
        } else {
          setError(payload.error || "Failed to create account.");
        }
        return;
      }

      // Success - redirect to login
      alert("Account created successfully! Please log in with your credentials.");
      navigate("/login");
    } catch {
      setError("Failed to create account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="login-container">
        <div className="login-form">
          <h1>Validating Invitation...</h1>
          <p>Please wait while we validate your invitation.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="login-container">
        <div className="login-form">
          <h1>Invalid Invitation</h1>
          <p className="error-message">{error}</p>
          <button
            type="button"
            className="login-button"
            onClick={() => navigate("/login")}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>Complete Your Account</h1>
        <p>
          Welcome! You've been invited to create an account for{" "}
          <strong>{inviteData?.email}</strong> with the role of{" "}
          <strong>{inviteData?.role?.replace("_", " ")}</strong>.
        </p>

        <label htmlFor="first-name">First Name</label>
        <input
          id="first-name"
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="John"
          required
        />
        {formErrors.first_name && <p className="error-message">{formErrors.first_name}</p>}

        <label htmlFor="last-name">Last Name</label>
        <input
          id="last-name"
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Doe"
          required
        />
        {formErrors.last_name && <p className="error-message">{formErrors.last_name}</p>}

        {!isProviderInvite && (
          <>
            <label htmlFor="employee-id">Employee ID</label>
            <input
              id="employee-id"
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="EMP001"
              required
            />
            {formErrors.employee_id && <p className="error-message">{formErrors.employee_id}</p>}
          </>
        )}

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {formErrors.password && <p className="error-message">{formErrors.password}</p>}

        <label htmlFor="confirm-password">Confirm Password</label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
        {formErrors.confirm_password && <p className="error-message">{formErrors.confirm_password}</p>}

        <button type="submit" className="login-button" disabled={submitting}>
          {submitting ? "Creating Account..." : "Create Account"}
        </button>

        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  );
}