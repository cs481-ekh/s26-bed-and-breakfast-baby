import { useEffect, useState } from "react";
import { apiJson, ensureCsrfCookie } from "./apiClient";
import "./login.css";

export default function LoginPage() {
  const idocLogoUrl = `${import.meta.env.BASE_URL}logo1.png`;
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const params = new URLSearchParams(window.location.search);
  const [statusMessage, setStatusMessage] = useState(
    params.get("reason") === "idle" ? "You were logged out due to inactivity." : ""
  );

  useEffect(() => {
    let cancelled = false;

    const redirectIfAuthenticated = async () => {
      try {
        const { response, payload } = await apiJson("/api/me/");
        if (cancelled) {
          return;
        }

        if (response.ok) {
          const role = payload?.role;
          if (role === "provider") {
            window.location.replace("/provider-dashboard");
          } else {
            window.location.replace("/main-dashboard");
          }
          return;
        }
      } finally {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      }
    };

    redirectIfAuthenticated();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage("");

    try {
      setIsSubmitting(true);
      await ensureCsrfCookie();

      const loginResult = await apiJson("/api/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: identifier.trim(),
          password,
        }),
      });

      if (!loginResult.response.ok) {
        const fallback = `Login failed (HTTP ${loginResult.response.status}).`;
        setStatusMessage(loginResult.payload?.error || fallback);
        setPassword("");
        return;
      }

      const meResult = await apiJson("/api/me/");
      if (!meResult.response.ok) {
        setStatusMessage("Login succeeded, but user session could not be loaded.");
        return;
      }

      const role = meResult.payload?.role;
      setStatusMessage(`Logged in as ${identifier.trim()} (${role || "unknown role"}).`);
      setPassword("");
      if (role === "provider") {
        window.location.assign("/provider-dashboard");
      } else {
        window.location.assign("/main-dashboard");
      }
    } catch {
      setStatusMessage("Unable to reach the server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <div className="login-container">
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-top-nav" aria-label="Page navigation">
            <a href="/about" className="about-link">About</a>
          </div>

          <div className="logo-container">
            <img src={idocLogoUrl} alt="Idaho Department of Correction" className="logo" />
          </div>

          <h1 id="login-title">Log In</h1>
          <p className="login-subtitle">Sign in to manage bed assignments</p>

          {isCheckingSession && <p className="status-message">Checking session...</p>}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="identifier">Username or Email</label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                placeholder="Enter your username"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <button type="submit" className="login-button" disabled={isSubmitting || isCheckingSession}>
              {isCheckingSession ? "Checking session..." : isSubmitting ? "Logging in..." : "Log In"}
            </button>
          </form>

          {statusMessage && <p className="status-message">{statusMessage}</p>}
        </section>
      </div>
    </main>
  );
}
