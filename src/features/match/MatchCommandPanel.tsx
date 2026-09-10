import type { GameState } from "../../domain/model/GameState";
import type { MatchCommand, MatchState } from "../../domain/model/Match";

interface MatchCommandPanelProps {
  state: GameState;
  match: MatchState;
  pending: boolean;
  onCommand: (command: MatchCommand) => void | Promise<void>;
}

export function MatchCommandPanel({
  state,
  match,
  pending,
  onCommand,
}: MatchCommandPanelProps) {
  const runtime = match.runtime;
  const reason = runtime?.pendingDecisionReason;
  const isUserDecision =
    match.phase === "coach-decision" &&
    match.pendingCoachCommandForSchoolId === state.userSchoolId &&
    runtime?.controlledSchoolId === state.userSchoolId &&
    reason !== null &&
    reason !== undefined;

  if (!isUserDecision) {
    return null;
  }

  const timeoutAvailable =
    reason === "opponent-run" &&
    !runtime.timeoutUsedSchoolIds.includes(state.userSchoolId);
  const continueLabel =
    reason === "set-break" ? "このまま次セットへ" : "このまま続ける";

  return (
    <section className="match-command-panel" aria-label="監督指示">
      <div className="match-command-panel__heading">
        <span>COACH DECISION</span>
        <h2>監督指示</h2>
        <p>
          {reason === "opponent-run"
            ? "相手に4連続ポイントを許しています"
            : "セット間の監督指示"}
        </p>
      </div>

      <div className="match-command-actions">
        {timeoutAvailable ? (
          <button
            disabled={pending}
            onClick={() => void onCommand({ type: "timeout" })}
            type="button"
          >
            タイムアウト
          </button>
        ) : null}
        <button disabled={pending} type="button">
          戦術変更
        </button>
        <button disabled={pending} type="button">
          選手交代
        </button>
        <button
          className="match-command-actions__continue"
          disabled={pending}
          onClick={() => void onCommand({ type: "continue" })}
          type="button"
        >
          {continueLabel}
        </button>
      </div>
    </section>
  );
}
