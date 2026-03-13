import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import MainDashboardPage from "./MainDashboardPage";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MainDashboardPage />
  </StrictMode>
);
