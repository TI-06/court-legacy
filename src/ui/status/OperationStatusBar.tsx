import type { OperationState } from "../../app/useGameSession";
import "./operation-status.css";

export function OperationStatusBar({ state }: { state: OperationState }) {
  if (state.status === "submitting") {
    return (
      <span aria-live="polite" className="operation-status" role="status">
        保存中…
      </span>
    );
  }

  if (state.status === "offline" || state.status === "error") {
    return (
      <span aria-live="polite" className="operation-status" role="status">
        <span>{state.status === "offline" ? "オフライン" : state.label}</span>
        <button onClick={state.retry} type="button">
          再試行
        </button>
      </span>
    );
  }

  return (
    <span aria-live="polite" className="operation-status" role="status">
      保存済み ✓
    </span>
  );
}
