import { useState } from "react";
import type { GameState } from "../../domain/model/GameState";
import type { MatchCommand, MatchState } from "../../domain/model/Match";
import type { Player } from "../../domain/model/Player";
import type { PlayerId } from "../../domain/model/identifiers";
import { getPlayerConditionPresentation } from "../../domain/player/playerCondition";
import { calculatePlayerDisplayPower } from "../../domain/selectors/playerPresentation";
import { ratingToGrade } from "../../domain/selectors/ratingGrades";
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

function playerName(player: Player): string {
  return `${player.lastName} ${player.firstName}`;
}

function playerOverallGrade(player: Player): string {
  const overall = Math.round(calculatePlayerDisplayPower(player) / 100);
  return ratingToGrade(overall);
}

function SubstitutionPlayerButton({
  player,
  pending,
  selected,
  onSelect,
}: {
  player: Player;
  pending: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const condition = getPlayerConditionPresentation(player.condition);

  return (
    <button
      aria-label={playerName(player)}
      aria-pressed={selected}
      className="match-command-substitution__player"
      disabled={pending}
      onClick={onSelect}
      type="button"
    >
      <span className="match-command-substitution__identity">
        <strong>{playerName(player)}</strong>
        <small>{player.preferredPosition}</small>
      </span>
      <span
        className={`match-command-substitution__condition player-condition--${condition.colorToken}`}
      >
        <b aria-hidden="true">{condition.icon}</b>
        <small>{condition.label}</small>
      </span>
      <span className="match-command-substitution__grade">
        <small>総合</small>
        <strong>{playerOverallGrade(player)}</strong>
      </span>
    </button>
  );
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
            aria-label={option.label}
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
  const userSelection =
    match.homeSchoolId === state.userSchoolId
      ? match.homeSelection
      : match.awaySelection;
  const [tacticsOpen, setTacticsOpen] = useState(false);
  const [draftPlan, setDraftPlan] = useState<MatchTacticPlan | null>(null);
  const [substitutionOpen, setSubstitutionOpen] = useState(false);
  const [outgoingPlayerId, setOutgoingPlayerId] = useState<PlayerId | null>(
    null,
  );
  const [incomingPlayerId, setIncomingPlayerId] = useState<PlayerId | null>(
    null,
  );

  if (!isUserDecision || !currentPlan) {
    return null;
  }

  const timeoutAvailable =
    reason === "opponent-run" &&
    !runtime.timeoutUsedSchoolIds.includes(state.userSchoolId);
  const continueLabel =
    reason === "set-break" ? "このまま次セットへ" : "このまま続ける";
  const tacticsDraft = draftPlan ?? currentPlan;
  const courtPlayers = userSelection.rotation
    .map((assignment) => state.players[assignment.playerId])
    .filter((player): player is Player => Boolean(player));
  const benchPlayers = userSelection.benchPlayerIds
    .map((playerId) => state.players[playerId])
    .filter((player): player is Player => Boolean(player));
  const outgoingPlayer = outgoingPlayerId
    ? (state.players[outgoingPlayerId] ?? null)
    : null;
  const incomingPlayer = incomingPlayerId
    ? (state.players[incomingPlayerId] ?? null)
    : null;

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

  const closeSubstitution = () => {
    setSubstitutionOpen(false);
    setOutgoingPlayerId(null);
    setIncomingPlayerId(null);
  };

  const openSubstitution = () => {
    setOutgoingPlayerId(null);
    setIncomingPlayerId(null);
    setSubstitutionOpen(true);
  };

  const selectOutgoingPlayer = (playerId: PlayerId) => {
    setOutgoingPlayerId(playerId);
    setIncomingPlayerId(null);
  };

  const submitSubstitution = () => {
    if (!outgoingPlayerId || !incomingPlayerId) return;
    void onCommand({
      type: "substitute",
      outgoingPlayerId,
      incomingPlayerId,
    });
    closeSubstitution();
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
          <button disabled={pending} onClick={openSubstitution} type="button">
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

      <BottomSheet
        description={
          outgoingPlayer
            ? "ベンチから交代で入る選手を選んでください。"
            : "現在コートにいる6人から交代する選手を選んでください。"
        }
        onClose={closeSubstitution}
        open={substitutionOpen}
        title="選手交代"
      >
        <div className="match-command-substitution">
          {!outgoingPlayer ? (
            <section
              aria-label="コートの選手"
              className="match-command-substitution__list"
              role="group"
            >
              {courtPlayers.map((player) => (
                <SubstitutionPlayerButton
                  key={player.id}
                  onSelect={() => selectOutgoingPlayer(player.id)}
                  pending={pending}
                  player={player}
                  selected={false}
                />
              ))}
            </section>
          ) : (
            <>
              <div className="match-command-substitution__step">
                <button
                  disabled={pending}
                  onClick={() => {
                    setOutgoingPlayerId(null);
                    setIncomingPlayerId(null);
                  }}
                  type="button"
                >
                  戻る
                </button>
                <span>
                  OUT <strong>{playerName(outgoingPlayer)}</strong>
                </span>
              </div>
              <section
                aria-label="ベンチ"
                className="match-command-substitution__list"
                role="group"
              >
                {benchPlayers.map((player) => (
                  <SubstitutionPlayerButton
                    key={player.id}
                    onSelect={() => setIncomingPlayerId(player.id)}
                    pending={pending}
                    player={player}
                    selected={player.id === incomingPlayerId}
                  />
                ))}
              </section>
              {incomingPlayer ? (
                <p className="match-command-substitution__confirmation">
                  {playerName(outgoingPlayer)} → {playerName(incomingPlayer)}
                </p>
              ) : null}
              <button
                className="match-command-substitution__submit"
                disabled={pending || !incomingPlayer}
                onClick={submitSubstitution}
                type="button"
              >
                この交代で続ける
              </button>
            </>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
