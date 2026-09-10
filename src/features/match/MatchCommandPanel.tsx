import { useState } from "react";
import type { GameState } from "../../domain/model/GameState";
import type { MatchCommand, MatchState } from "../../domain/model/Match";
import type { MatchTacticPlan } from "../../domain/team/matchTactics";
import {
  attackTacticOptions,
  blockTacticOptions,
  serveTacticOptions,
  type TacticOption,
} from "../team/tacticsPresentation";
import { BottomSheet } from "../../ui/BottomSheet";

interface MatchCommandPanelProps {
  state: GameState;
  match: MatchState;
  pending: boolean;
  onCommand: (command: MatchCommand) => void | Promise<void>;
}

function TacticChoiceGroup<Value extends string>({
  label,
  value,
  options,
  pending,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly TacticOption<Value>[];
  pending: boolean;
  onChange: (value: Value) => void;
}) {
  return (
    <section
      aria-label={label}
      className="match-command-tactics__axis"
      role="group"
    >
      <strong>{label}</strong>
      <div className="match-command-tactics__choices">
        {options.map((option) => (
          <button
            aria-pressed={value === option.value}
            disabled={pending}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <strong>{option.label}</strong>
            <small>{option.description}</small>
          </button>
        ))}
      </div>
    </section>
  );
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

  // Draft changes stay match-local until one complete command is submitted.
  const currentPlan =
    runtime && match.homeSchoolId === state.userSchoolId
      ? runtime.homeTactics
      : runtime?.awayTactics;
  const [tacticsOpen, setTacticsOpen] = useState(false);
  const [draftPlan, setDraftPlan] = useState<MatchTacticPlan | null>(null);

  if (!isUserDecision || !currentPlan) {
    return null;
  }

  const timeoutAvailable =
    reason === "opponent-run" &&
    !runtime.timeoutUsedSchoolIds.includes(state.userSchoolId);
  const continueLabel =
    reason === "set-break" ? "このまま次セットへ" : "このまま続ける";
  const tacticsDraft = draftPlan ?? currentPlan;

  const openTactics = () => {
    setDraftPlan({ ...currentPlan });
    setTacticsOpen(true);
  };

  const updateTactics = <Axis extends keyof MatchTacticPlan>(
    axis: Axis,
    value: MatchTacticPlan[Axis],
  ) => {
    setDraftPlan((current) => ({ ...(current ?? currentPlan), [axis]: value }));
  };

  const submitTactics = () => {
    void onCommand({ type: "set-match-tactics", plan: { ...tacticsDraft } });
    setTacticsOpen(false);
  };

  return (
    <>
      <section className="match-command-panel" aria-label="監督指示">
        <div className="match-command-panel__heading">
          <span>判断タイミング</span>
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
          <button disabled={pending} onClick={openTactics} type="button">
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

      <BottomSheet
        description="この試合だけの戦術を3項目まとめて変更します。"
        onClose={() => setTacticsOpen(false)}
        open={tacticsOpen}
        title="戦術変更"
      >
        <div className="match-command-tactics">
          <TacticChoiceGroup
            label="サーブ方針"
            onChange={(serve) => updateTactics("serve", serve)}
            options={serveTacticOptions}
            pending={pending}
            value={tacticsDraft.serve}
          />
          <TacticChoiceGroup
            label="攻撃方針"
            onChange={(attack) => updateTactics("attack", attack)}
            options={attackTacticOptions}
            pending={pending}
            value={tacticsDraft.attack}
          />
          <TacticChoiceGroup
            label="ブロック方針"
            onChange={(block) => updateTactics("block", block)}
            options={blockTacticOptions}
            pending={pending}
            value={tacticsDraft.block}
          />
          <button
            className="match-command-tactics__submit"
            disabled={pending}
            onClick={submitTactics}
            type="button"
          >
            この戦術で続ける
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
