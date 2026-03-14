import MainDash from "../main_dash/main_dash";

export default function MainDashboardPage() {
  return (
    <>
      <nav aria-label="Global navigation" style={{ textAlign: "left", marginBottom: "1rem" }}>
        <a href="/">Admin Dashboard</a>
        <span style={{ margin: "0 0.5rem" }}>|</span>
        <a href="/login.html">Login Page</a>
      </nav>
      <MainDash />
    </>
  );
}