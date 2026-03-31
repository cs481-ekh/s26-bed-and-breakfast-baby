import { useState } from "react";
import "./login.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
    setPassword("");
  };

  return (
    <main className="login-page">
      <div className="login-container">
        <section className="login-card" aria-labelledby="login-title">
          <div className="logo-container">
            <img src="/logo1.png" alt="Idaho Department of Correction" className="logo" />
          </div>
          
          <h1 id="login-title">Log In</h1>
          <p className="login-subtitle">Sign in to manage bed assignments</p>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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

            <button type="submit" className="login-button">Log In</button>
          </form>

          {submitted && <p className="status-message">Login submitted for {email}.</p>}

          <nav className="footer-nav" aria-label="Quick navigation">
            <a href="/admin">Admin Dashboard</a>
            <span className="divider">•</span>
            <a href="/main-dashboard">Bed Dashboard</a>
            <span className="nav-note">(Testing Links)</span>
          </nav>
        </section>
      </div>
    </main>
  );
}
