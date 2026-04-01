import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import ProviderPage from "./ProviderPage";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ProviderPage />
  </StrictMode>
);