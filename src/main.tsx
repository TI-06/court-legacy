import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import "./features/home/home-week.css";
import "./mobile-layout.css";
import "./pwa/app-update-banner.css";
import { ReleaseAwareApplicationRoot } from "./pwa/ReleaseAwareApplicationRoot";
import "./ui/theme/game-theme.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Application root element was not found");

createRoot(rootElement).render(
  <StrictMode>
    <ReleaseAwareApplicationRoot />
  </StrictMode>,
);
