import { ApplicationRoot } from "../app/ApplicationRoot";
import { useAppUpdate } from "./useAppUpdate";

const PWA_UPDATES_ENABLED = import.meta.env.MODE !== "e2e";

function PwaEnabledApplicationRoot() {
  const { updateReady, refresh } = useAppUpdate();
  return <ApplicationRoot updateReady={updateReady} onAppRefresh={refresh} />;
}

export function ReleaseAwareApplicationRoot() {
  if (!PWA_UPDATES_ENABLED) return <ApplicationRoot />;
  return <PwaEnabledApplicationRoot />;
}
