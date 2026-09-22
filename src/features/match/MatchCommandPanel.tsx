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

const substitutionCourtOrder = [4, 3, 2, 5, 6, 1] as const;

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
  slot,
  onSelect,
}: {
  player: Player;
  pending: boolean;
  selected: boolean;
  slot?: number;
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
        <span>
          {slot ? <b>R{slot}</b> : null}
          <small>{slot ? "COURT" : "BENCH"}</small>
        </span>
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
  const [playerDirectiveOpen, setPlayerDirectiveOpen] = useState(false);
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
    reason !== "set-break" &&
    !runtime.timeoutUsedSchoolIds.includes(state.userSchoolId);
  const continueLabel =
    reason === "set-break"
      ? "このまま次セットへ"
      : reason === "critical-score"
        ? "このまま勝負する"
        : "このまま続ける";
  const quickCriticalPlans =
    reason === "critical-score"
      ? [
          {
            label: "サーブで攻める",
            plan: { ...currentPlan, serve: "aggressive" as const },
          },
          {
            label: "速攻で崩す",
            plan: { ...currentPlan, attack: "quick" as const },
          },
          {
            label: "サイドで押す",
            plan: { ...currentPlan, attack: "side" as const },
          },
        ]
      : [];
  const tacticsDraft = draftPlan ?? currentPlan;
  const courtPlayers = substitutionCourtOrder
    .map((slot) =>
      userSelection.rotation.find((assignment) => assignment.slot === slot),
    )
    .filter(
      (assignment): assignment is (typeof userSelection.rotation)[number] =>
        Boolean(assignment),
    )
    .map((assignment) => state.players[assignment.playerId])
    .filter((player): player is Player => Boolean(player));
  const courtSlotByPlayerId = new Map(
    userSelection.rotation.map(
      (assignment) => [assignment.playerId, assignment.slot] as const,
    ),
  );
  const benchPlayers = userSelection.benchPlayerIds
    .map((playerId) => state.players[playerId])
    .filter((player): player is Player => Boolean(player));
  const liberoPlayer = userSelection.liberoPlayerId
    ? (state.players[userSelection.liberoPlayerId] ?? null)
    : null;
  const directivePlayers =
    liberoPlayer &&
    !courtPlayers.some((player) => player.id === liberoPlayer.id)
      ? [...courtPlayers, liberoPlayer]
      : courtPlayers;
  const rotationPlayerIds = new Set(
    userSelection.rotation.map((assignment) => assignment.playerId),
  );
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
              : reason === "critical-score"
                ? "終盤の接戦です。次の数点をどう取りにいくか選べます"
                : "セット間の監督指示"}
          </p>
        </div>

        {quickCriticalPlans.length > 0 ? (
          <div className="match-command-quick" aria-label="重要場面の一手">
            <span>この場面の一手</span>
            <div>
              {quickCriticalPlans.map((item) => (
                <button
                  disabled={pending}
                  key={item.label}
                  onClick={() =>
                    void onCommand({
                      type: "set-match-tactics",
                      plan: { ...item.plan },
                    })
                  }
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

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
          {reason !== "set-break" ? (
            <button
              disabled={pending}
              onClick={() => setPlayerDirectiveOpen(true)}
              type="button"
            >
              選手指示
            </button>
          ) : null}
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
        description="5ラリーだけ、攻撃を集める選手か声をかける選手を指定します。"
        onClose={() => setPlayerDirectiveOpen(false)}
        open={playerDirectiveOpen}
        title="選手指示"
      >
        <div className="match-command-player-directive">
          <p>
            育てた選手に勝負を託す場面です。指示後のラリーから実際の判定に反映されます。
          </p>
          <div aria-label="選手への個別指示" role="group">
            {directivePlayers.map((player) => {
              const canFocusAttack =
                rotationPlayerIds.has(player.id) &&
                player.preferredPosition !== "L";
              return (
                <article key={player.id}>
                  <div>
                    <strong>{playerName(player)}</strong>
                    <small>{player.preferredPosition}</small>
                  </div>
                  <span>
                    総合 <b>{playerOverallGrade(player)}</b>
                  </span>
                  <div>
                    <button
                      aria-label={`攻撃を集める ${playerName(player)}`}
                      disabled={pending || !canFocusAttack}
                      onClick={() => {
                        setPlayerDirectiveOpen(false);
                        void onCommand({
                          type: "focus-attacker",
                          playerId: player.id,
                        });
                      }}
                      type="button"
                    >
                      攻撃を集める
                    </button>
                    <button
                      aria-label={`声をかける ${playerName(player)}`}
                      disabled={pending}
                      onClick={() => {
                        setPlayerDirectiveOpen(false);
                        void onCommand({
                          type: "encourage-player",
                          playerId: player.id,
                        });
                      }}
                      type="button"
                    >
                      声をかける
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <small className="match-command-player-directive__note">
            攻撃集中：指定選手へのトス選択が増加 /
            声かけ：判断・メンタルが一時上昇
          </small>
        </div>
      </BottomSheet>

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
          <div
            aria-label="交代手順"
            className="match-command-substitution__progress"
          >
            <span
              className={
                outgoingPlayer
                  ? "match-command-substitution__progress-step is-complete"
                  : "match-command-substitution__progress-step is-active"
              }
            >
              <b>1</b>
              OUTを選ぶ
            </span>
            <i aria-hidden="true" />
            <span
              className={
                outgoingPlayer
                  ? "match-command-substitution__progress-step is-active"
                  : "match-command-substitution__progress-step"
              }
            >
              <b>2</b>
              INを選ぶ
            </span>
          </div>

          {!outgoingPlayer ? (
            <>
              <div className="match-command-substitution__court-label">
                <span>ON COURT</span>
                <strong>下げる選手をタップ</strong>
              </div>
              <section
                aria-label="コートの選手"
                className="match-command-substitution__court"
                role="group"
              >
                {courtPlayers.map((player) => (
                  <SubstitutionPlayerButton
                    key={player.id}
                    onSelect={() => selectOutgoingPlayer(player.id)}
                    pending={pending}
                    player={player}
                    selected={false}
                    slot={courtSlotByPlayerId.get(player.id)}
                  />
                ))}
              </section>
            </>
          ) : (
            <>
              <div className="match-command-substitution__selected-out">
                <span>OUT</span>
                <div>
                  <small>コートから下げる選手</small>
                  <strong>{playerName(outgoingPlayer)}</strong>
                </div>
                <button
                  disabled={pending}
                  onClick={() => {
                    setOutgoingPlayerId(null);
                    setIncomingPlayerId(null);
                  }}
                  type="button"
                >
                  変更
                </button>
              </div>
              <div className="match-command-substitution__court-label">
                <span>BENCH</span>
                <strong>入れる選手をタップ</strong>
              </div>
              <section
                aria-label="ベンチ"
                className="match-command-substitution__bench"
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
                <div className="match-command-substitution__swap-preview">
                  <span>
                    <small>OUT</small>
                    <strong>{playerName(outgoingPlayer)}</strong>
                  </span>
                  <b aria-hidden="true">→</b>
                  <span>
                    <small>IN</small>
                    <strong>{playerName(incomingPlayer)}</strong>
                  </span>
                  <p aria-label="交代内容">
                    {playerName(outgoingPlayer)} → {playerName(incomingPlayer)}
                  </p>
                </div>
              ) : null}
              <button
                className="match-command-substitution__submit"
                disabled={pending || !incomingPlayer}
                onClick={submitSubstitution}
                type="button"
              >
                この交代を実行
              </button>
            </>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
