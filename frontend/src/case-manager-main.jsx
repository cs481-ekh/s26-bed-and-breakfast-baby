import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CaseManagerPage from "./CaseManagerPage";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CaseManagerPage />
  </StrictMode>
);