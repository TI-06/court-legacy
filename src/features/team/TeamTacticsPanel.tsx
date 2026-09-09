import { useMemo, useState } from "react";
import type {
  AttackPlan,
  BlockPlan,
  MatchTacticPlan,
  ServePlan,
} from "../../domain/team/matchTactics";
import {
  attackTacticOptions,
  blockTacticOptions,
  serveTacticOptions,
  type TacticOption,
} from "./tacticsPresentation";
import "./team-tactics.css";

export interface TeamTacticsPanelProps {
  currentPlan: MatchTacticPlan;
  pending: boolean;
  onSave: (plan: MatchTacticPlan) => void;
}

interface DraftState {
  baseKey: string;
  plan: MatchTacticPlan;
}

function samePlan(left: MatchTacticPlan, right: MatchTacticPlan): boolean {
  return (
    left.serve === right.serve &&
    left.attack === right.attack &&
    left.block === right.block
  );
}

function planKey(plan: MatchTacticPlan): string {
  return `${plan.serve}:${plan.attack}:${plan.block}`;
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
    <section className="team-tactics__axis" aria-label={label} role="group">
      <div className="team-tactics__axis-title">
        <strong>{label.replace("戦術", "")}</strong>
        <span>1つ選択</span>
      </div>
      <div className="team-tactics__choices">
        {options.map((option) => (
          <button
            aria-pressed={value === option.value}
            className="team-tactics__choice"
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

export function TeamTacticsPanel({
  currentPlan,
  pending,
  onSave,
}: TeamTacticsPanelProps) {
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const authoritativeKey = planKey(currentPlan);
  const draft =
    draftState?.baseKey === authoritativeKey ? draftState.plan : currentPlan;

  const unchanged = useMemo(
    () => samePlan(draft, currentPlan),
    [currentPlan, draft],
  );

  const updateDraft = <Axis extends keyof MatchTacticPlan>(
    axis: Axis,
    value: MatchTacticPlan[Axis],
  ) => {
    setDraftState({
      baseKey: authoritativeKey,
      plan: { ...draft, [axis]: value },
    });
  };

  return (
    <main className="app-content team-tactics">
      <section className="team-tactics__hero">
        <div>
          <p className="section-kicker">チーム方針</p>
          <h2>基本戦術</h2>
          <p>普段の戦い方を決めます。試合前にはその試合だけ変更できます。</p>
        </div>
      </section>

      <TacticChoiceGroup<ServePlan>
        label="サーブ戦術"
        onChange={(serve) => updateDraft("serve", serve)}
        options={serveTacticOptions}
        pending={pending}
        value={draft.serve}
      />
      <TacticChoiceGroup<AttackPlan>
        label="攻撃戦術"
        onChange={(attack) => updateDraft("attack", attack)}
        options={attackTacticOptions}
        pending={pending}
        value={draft.attack}
      />
      <TacticChoiceGroup<BlockPlan>
        label="ブロック戦術"
        onChange={(block) => updateDraft("block", block)}
        options={blockTacticOptions}
        pending={pending}
        value={draft.block}
      />

      <button
        aria-label="基本戦術を保存"
        className="team-tactics__save"
        disabled={pending || unchanged}
        onClick={() => onSave({ ...draft })}
        type="button"
      >
        {pending ? "基本戦術を保存しています…" : "基本戦術を保存"}
      </button>
    </main>
  );
}
