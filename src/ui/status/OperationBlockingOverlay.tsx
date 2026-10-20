import type { OperationState } from "../../app/useGameSession";
import { VolleyballLoader } from "./VolleyballLoader";
import "./operation-status.css";

export function OperationBlockingOverlay({
  operation,
}: {
  operation: OperationState;
}) {
  if (operation.status !== "submitting" || !operation.blocking) return null;
  return (
    <div
      className="operation-blocking-overlay"
      data-testid="operation-blocking-overlay"
    >
      <div
        aria-busy="true"
        aria-live="polite"
        className="operation-blocking-overlay__panel"
        role="status"
      >
        <VolleyballLoader size="large" />
        <strong>{operation.label}</strong>
        <small>処理が完了するまでお待ちください</small>
      </div>
    </div>
  );
}
