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
      <nav aria-label="Global navigation" style={{ marginBottom: "1rem" }}>
        <a href="/">Admin Dashboard</a>
        <span style={{ margin: "0 0.5rem" }}>|</span>
        <a href="/main-dashboard.html">Main Bed Dashboard</a>
      </nav>
      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title">Log In</h1>
        <p className="login-subtitle">Enter your email and password.</p>

        <form className="login-form" onSubmit={handleSubmit}>
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

          <button type="submit">Log In</button>
        </form>

        {submitted && <p className="status-message">Login submitted for {email}.</p>}
      </section>
    </main>
  );
}
