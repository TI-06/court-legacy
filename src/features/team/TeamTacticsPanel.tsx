import { useMemo, useState } from "react";
import type {
  AttackPlan,
  BlockPlan,
  MatchTacticPlan,
  ServePlan,
} from "../../domain/team/matchTactics";
import {
  calculateTeamIdentityAlignment,
  TEAM_IDENTITY_DEFINITIONS,
  teamIdentityMasteryTier,
} from "../../domain/team/teamIdentity";
import type {
  TeamIdentityState,
  TeamIdentityStyle,
} from "../../domain/team/teamPlanningTypes";
import {
  attackTacticOptions,
  blockTacticOptions,
  defenseBiasOptions,
  serveTacticOptions,
  type DefenseBias,
  type TacticOption,
} from "./tacticsPresentation";
import "./team-tactics.css";

export interface TeamTacticsPanelProps {
  currentPlan: MatchTacticPlan;
  currentDefenseBias: DefenseBias;
  currentIdentity: TeamIdentityState;
  pending: boolean;
  onSave: (plan: MatchTacticPlan) => void;
  onSaveDefenseBias: (defenseBias: DefenseBias) => void;
  onSaveIdentity: (style: TeamIdentityStyle) => void;
}

interface DraftState {
  baseKey: string;
  plan: MatchTacticPlan;
}

interface DefenseDraftState {
  baseValue: DefenseBias;
  value: DefenseBias;
}

interface IdentityDraftState {
  baseStyle: TeamIdentityStyle;
  style: TeamIdentityStyle;
}

const masteryTierLabels = {
  forming: "形成中",
  established: "定着",
  mature: "熟練",
  signature: "完成",
} as const;

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
  currentDefenseBias,
  currentIdentity,
  pending,
  onSave,
  onSaveDefenseBias,
  onSaveIdentity,
}: TeamTacticsPanelProps) {
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [defenseDraftState, setDefenseDraftState] =
    useState<DefenseDraftState | null>(null);
  const [identityDraftState, setIdentityDraftState] =
    useState<IdentityDraftState | null>(null);
  const authoritativeKey = planKey(currentPlan);
  const draft =
    draftState?.baseKey === authoritativeKey ? draftState.plan : currentPlan;

  const unchanged = useMemo(
    () => samePlan(draft, currentPlan),
    [currentPlan, draft],
  );
  const defenseDraft =
    defenseDraftState?.baseValue === currentDefenseBias
      ? defenseDraftState.value
      : currentDefenseBias;
  const defenseUnchanged = defenseDraft === currentDefenseBias;
  const identityDraft =
    identityDraftState?.baseStyle === currentIdentity.style
      ? identityDraftState.style
      : currentIdentity.style;
  const identityUnchanged = identityDraft === currentIdentity.style;
  const currentIdentityDefinition =
    TEAM_IDENTITY_DEFINITIONS.find(
      (definition) => definition.id === currentIdentity.style,
    ) ?? TEAM_IDENTITY_DEFINITIONS.at(-1)!;
  const identityAlignment = calculateTeamIdentityAlignment(
    identityDraft,
    draft,
    defenseDraft,
  );
  const masteryTier =
    masteryTierLabels[teamIdentityMasteryTier(currentIdentity.mastery)];

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

      <section className="team-tactics__identity" aria-label="チーム哲学">
        <div className="team-tactics__identity-heading">
          <div>
            <p className="section-kicker">TEAM IDENTITY</p>
            <h3>チーム哲学</h3>
          </div>
          <span>
            {masteryTier} {currentIdentity.mastery}
          </span>
        </div>

        <div className="team-tactics__identity-current">
          <div>
            <span>現在</span>
            <strong>{currentIdentityDefinition.label}</strong>
            <small>{currentIdentityDefinition.description}</small>
          </div>
          <div
            aria-label={`チーム哲学习熟度 ${currentIdentity.mastery}`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={currentIdentity.mastery}
            className="team-tactics__identity-meter"
            role="progressbar"
          >
            <i style={{ width: `${currentIdentity.mastery}%` }} />
          </div>
        </div>

        <div
          aria-label="チーム哲学を選択"
          className="team-tactics__identity-choices"
          role="group"
        >
          {TEAM_IDENTITY_DEFINITIONS.map((definition) => (
            <button
              aria-pressed={identityDraft === definition.id}
              className="team-tactics__identity-choice"
              disabled={pending}
              key={definition.id}
              onClick={() =>
                setIdentityDraftState({
                  baseStyle: currentIdentity.style,
                  style: definition.id,
                })
              }
              type="button"
            >
              <strong>{definition.label}</strong>
              <small>{definition.description}</small>
            </button>
          ))}
        </div>

        <div className="team-tactics__identity-fit">
          <span>現在の戦術との一致度</span>
          <strong>{identityAlignment}%</strong>
        </div>

        {!identityUnchanged ? (
          <p className="team-tactics__identity-warning">
            方針を変更すると、習熟度は最大30から再スタートします。
          </p>
        ) : null}

        <button
          aria-label="チーム哲学を保存"
          className="team-tactics__save"
          disabled={pending || identityUnchanged}
          onClick={() => onSaveIdentity(identityDraft)}
          type="button"
        >
          {pending ? "チーム哲学を保存しています…" : "チーム哲学を保存"}
        </button>
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

      <TacticChoiceGroup<DefenseBias>
        label="守備配置"
        onChange={(value) =>
          setDefenseDraftState({ baseValue: currentDefenseBias, value })
        }
        options={defenseBiasOptions}
        pending={pending}
        value={defenseDraft}
      />

      <button
        aria-label="守備配置を保存"
        className="team-tactics__save"
        disabled={pending || defenseUnchanged}
        onClick={() => onSaveDefenseBias(defenseDraft)}
        type="button"
      >
        {pending ? "守備配置を保存しています…" : "守備配置を保存"}
      </button>

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
