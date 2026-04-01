import MainDash from "../main_dash/main_dash";
import RolePageGate from "./RolePageGate";

export default function ParoleOfficerPage() {
  return (
    <RolePageGate allowedRoles={["parole_officer"]}>
      <main>
        <nav aria-label="Global navigation" style={{ textAlign: "left", marginBottom: "1rem" }}>
          <a href="/">Admin Dashboard</a>
          <span style={{ margin: "0 0.5rem" }}>|</span>
          <a href="/main-dashboard.html">Main Bed Dashboard</a>
          <span style={{ margin: "0 0.5rem" }}>|</span>
          <a href="/case-manager.html">Case Manager View</a>
          <span style={{ margin: "0 0.5rem" }}>|</span>
          <a href="/provider-dashboard.html">Provider Page</a>
          <span style={{ margin: "0 0.5rem" }}>|</span>
          <a href="/login.html">Login Page</a>
        </nav>
        <h1>Parole Officer Bed Availability</h1>
        <p>Read-only availability view with district and placement filters.</p>
        <MainDash readOnly />
      </main>
    </RolePageGate>
  );
}
