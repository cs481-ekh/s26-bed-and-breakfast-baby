import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import MainDash from "../main_dash/main_dash";
import "./index.css";

function MainDashboardPage() {
  return (
    <>
      <div style={{ textAlign: "left", marginBottom: "1rem" }}>
        <a href="/">Back To Admin Dashboard</a>
      </div>
      <MainDash />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MainDashboardPage />
  </StrictMode>
);
