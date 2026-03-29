import MainDash from "../main_dash/main_dash";

export default function MainDashboardPage() {
  return (
    <>
      <nav aria-label="Global navigation" style={{ textAlign: "left", marginBottom: "1rem" }}>
        <a href="/">Admin Dashboard</a>
        <span style={{ margin: "0 0.5rem" }}>|</span>
        <a href="/login.html">Login Page</a>
        <span style={{ margin: "0 0.5rem" }}>|</span>
        <a href="/case-manager.html">Case Manager Page</a>
        <span style={{ margin: "0 0.5rem" }}>|</span>
        <a href="/parole-officer.html">Parole Officer Page</a>
        <span style={{ margin: "0 0.5rem" }}>|</span>
        <a href="/provider-dashboard.html">Provider Page</a>
      </nav>
      <MainDash />
    </>
  );
}