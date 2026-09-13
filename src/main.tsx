import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApplicationRoot } from "./app/ApplicationRoot";
import "./app.css";
import "./features/home/home-week.css";
import "./mobile-layout.css";
import "./pwa/app-update-banner.css";
import { useAppUpdate } from "./pwa/useAppUpdate";
import "./ui/theme/game-theme.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Application root element was not found");

function ReleaseAwareApplicationRoot() {
  const { updateReady, refresh } = useAppUpdate();
  return <ApplicationRoot updateReady={updateReady} onAppRefresh={refresh} />;
}

createRoot(rootElement).render(
  <StrictMode>
    <ReleaseAwareApplicationRoot />
  </StrictMode>,
);
