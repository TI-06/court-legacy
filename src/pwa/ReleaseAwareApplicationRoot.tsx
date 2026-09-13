import { ApplicationRoot } from "../app/ApplicationRoot";
import { useAppUpdate } from "./useAppUpdate";

export function ReleaseAwareApplicationRoot() {
  const { updateReady, refresh } = useAppUpdate();
  return <ApplicationRoot updateReady={updateReady} onAppRefresh={refresh} />;
}
