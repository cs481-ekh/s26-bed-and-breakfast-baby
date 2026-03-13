import MainDash from "../main_dash/main_dash";

export default function MainDashboardPage() {
  return (
    <>
      <div style={{ textAlign: "left", marginBottom: "1rem" }}>
        <a href="/">Back To Admin Dashboard</a>
      </div>
      <MainDash />
    </>
  );
}