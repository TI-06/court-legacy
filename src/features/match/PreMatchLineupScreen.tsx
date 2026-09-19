import { useMemo, useState } from "react";
import {
  buildPreMatchLineupPreset,
  type PreMatchLineupPreset,
} from "../../domain/match/preMatchLineup";
import type { GameState } from "../../domain/model/GameState";
import type { Player } from "../../domain/model/Player";
import type { PlayerId } from "../../domain/model/identifiers";
import type {
  RotationSlot,
  TeamSelection,
} from "../../domain/model/TeamSelection";
import { getPlayerConditionPresentation } from "../../domain/player/playerCondition";
import { calculateSelectionStrength } from "../../domain/selectors/matchSelectors";
import { calculatePlayerDisplayPower } from "../../domain/selectors/playerPresentation";
import { ratingToGrade as ratingToPlayerGrade } from "../../domain/selectors/ratingGrades";
import {
  deriveMatchTacticPlan,
  summarizeTacticMatchup,
  type MatchTacticPlan,
  type PublicTacticSummary,
} from "../../domain/team/matchTactics";
import { repositionTeamSelection } from "../../domain/team/repositionTeamSelection";
import { selectSavedLineupSlots } from "../../domain/team/savedLineupSelectors";
import {
  attackTacticOptions,
  blockTacticOptions,
  matchupRatingLabels,
  serveTacticOptions,
  tacticOptionLabel,
} from "../team/tacticsPresentation";
import { BottomSheet } from "../../ui/BottomSheet";
import { PreMatchComparison } from "./MatchStatPanels";
import { ratingToGrade as ratingToTeamGrade } from "./teamRatingGrade";
import "./pre-match-lineup.css";

interface PreMatchLineupScreenProps {
  state: GameState;
  baseSelection: TeamSelection;
  mode: "pve" | "pvp";
  opponentName: string;
  opponentStrength?: number;
  opponentSelection?: TeamSelection;
  opponentTactics?: PublicTacticSummary;
  pending: boolean;
  onStart: (selection: TeamSelection, tactics: MatchTacticPlan) => void;
  onCancel: () => void;
}

const courtOrder = [
  4, 3, 2, 5, 6, 1,
] as const satisfies readonly RotationSlot[];

type LineupPickerTarget =
  { type: "rotation"; slot: RotationSlot } | { type: "libero" };

const presets: Array<{ preset: PreMatchLineupPreset; label: string }> = [
  { preset: "best", label: "ベスト" },
  { preset: "grade-1", label: "1年中心" },
  { preset: "grade-2", label: "2年中心" },
  { preset: "grade-3", label: "3年中心" },
  { preset: "condition", label: "調子優先" },
];

function cloneSelection(selection: TeamSelection): TeamSelection {
  return structuredClone(selection);
}

function cloneTactics(tactics: MatchTacticPlan): MatchTacticPlan {
  return { ...tactics };
}

function playerName(player: Player): string {
  return `${player.lastName} ${player.firstName}`;
}

function playerOverallGrade(player: Player): string {
  return ratingToPlayerGrade(
    Math.round(calculatePlayerDisplayPower(player) / 100),
  );
}

export function PreMatchLineupScreen({
  state,
  baseSelection,
  mode,
  opponentName,
  opponentStrength,
  opponentSelection,
  opponentTactics,
  pending,
  onStart,
  onCancel,
}: PreMatchLineupScreenProps) {
  const baseTactics = useMemo(
    () => deriveMatchTacticPlan(state.schools[state.userSchoolId]!.tactics),
    [state],
  );
  const [selection, setSelection] = useState<TeamSelection>(() =>
    cloneSelection(baseSelection),
  );
  const [tactics, setTactics] = useState<MatchTacticPlan>(() =>
    cloneTactics(baseTactics),
  );
  const [pickerTarget, setPickerTarget] = useState<LineupPickerTarget | null>(
    null,
  );

  const strength = useMemo(
    () => calculateSelectionStrength(state, selection),
    [selection, state],
  );
  const savedLineupSlots = useMemo(
    () => selectSavedLineupSlots(state),
    [state],
  );
  const matchup = useMemo(
    () =>
      opponentTactics ? summarizeTacticMatchup(tactics, opponentTactics) : null,
    [opponentTactics, tactics],
  );

  const starterIds = useMemo(
    () => selection.rotation.map(({ playerId }) => playerId),
    [selection],
  );
  const starterCandidateIds = useMemo(
    () => [...starterIds, ...selection.benchPlayerIds],
    [selection, starterIds],
  );
  const liberoCandidateIds = useMemo(
    () => [
      ...(selection.liberoPlayerId ? [selection.liberoPlayerId] : []),
      ...selection.benchPlayerIds,
    ],
    [selection],
  );

  const currentPickerPlayerId =
    pickerTarget?.type === "rotation"
      ? (selection.rotation.find((item) => item.slot === pickerTarget.slot)
          ?.playerId ?? null)
      : pickerTarget?.type === "libero"
        ? selection.liberoPlayerId
        : null;
  const pickerCandidateIds =
    pickerTarget?.type === "rotation"
      ? starterCandidateIds
      : pickerTarget?.type === "libero"
        ? liberoCandidateIds
        : [];
  const pickerTitle =
    pickerTarget?.type === "rotation"
      ? `ローテーション${pickerTarget.slot}を変更`
      : "リベロを変更";
  const liberoPlayer = selection.liberoPlayerId
    ? (state.players[selection.liberoPlayerId] ?? null)
    : null;
  const liberoCondition = liberoPlayer
    ? getPlayerConditionPresentation(liberoPlayer.condition)
    : null;

  const applyPreset = (preset: PreMatchLineupPreset) => {
    setSelection(
      buildPreMatchLineupPreset({
        state,
        schoolId: state.userSchoolId,
        baseSelection,
        preset,
      }),
    );
  };

  const changeStarter = (slot: RotationSlot, nextPlayerId: PlayerId) => {
    const current = selection.rotation.find((item) => item.slot === slot);
    if (!current || current.playerId === nextPlayerId) return;

    const otherStarter = selection.rotation.find(
      (item) => item.playerId === nextPlayerId,
    );
    const next = repositionTeamSelection({
      selection,
      source: otherStarter
        ? { type: "rotation", slot: otherStarter.slot }
        : { type: "bench", playerId: nextPlayerId },
      target: { type: "rotation", slot },
    });
    if (next) setSelection(next);
  };

  const changeLibero = (nextPlayerId: PlayerId) => {
    if (selection.liberoPlayerId === nextPlayerId) return;
    const next = repositionTeamSelection({
      selection,
      source: { type: "bench", playerId: nextPlayerId },
      target: { type: "libero" },
    });
    if (next) setSelection(next);
  };

  const choosePickerPlayer = (playerId: PlayerId) => {
    if (pickerTarget?.type === "rotation") {
      changeStarter(pickerTarget.slot, playerId);
    } else if (pickerTarget?.type === "libero") {
      changeLibero(playerId);
    }
    setPickerTarget(null);
  };

  return (
    <main className="app-content pre-match-lineup">
      <section className="pre-match-lineup__hero">
        <div>
          <p className="section-kicker">
            {mode === "pvp" ? "対人戦" : "試合前確認"}
          </p>
          <h2>試合準備</h2>
          <p>この試合だけの編成です</p>
        </div>
        <button disabled={pending} onClick={onCancel} type="button">
          戻る
        </button>
      </section>

      <section className="pre-match-lineup__versus" aria-label="試合前戦力比較">
        <article>
          <span>自校</span>
          <strong>
            {state.schools[state.userSchoolId]?.shortName ?? "自校"}
          </strong>
          <b>
            {ratingToTeamGrade(strength)}・戦力 {strength}
          </b>
        </article>
        <span className="pre-match-lineup__vs">VS</span>
        <article>
          <span>相手</span>
          <strong>{opponentName}</strong>
          {opponentStrength === undefined ? (
            <b>戦力 非公開</b>
          ) : (
            <b>戦力 {opponentStrength}</b>
          )}
        </article>
      </section>

      {opponentSelection && opponentStrength !== undefined ? (
        <PreMatchComparison
          awaySelection={opponentSelection}
          awayStrength={opponentStrength}
          homeSelection={selection}
          homeStrength={strength}
          state={state}
        />
      ) : mode === "pvp" ? (
        <p className="pre-match-lineup__privacy-note">
          対人戦では相手選手の詳細能力は非公開です。公開戦力と戦術傾向を見て編成を決めます。
        </p>
      ) : null}

      <section
        className="pre-match-lineup__tactics"
        aria-labelledby="pre-match-tactics-heading"
      >
        <div className="pre-match-lineup__section-heading">
          <div>
            <p className="section-kicker">MATCH PLAN</p>
            <h3 id="pre-match-tactics-heading">今回の戦術</h3>
          </div>
          <button
            disabled={pending}
            onClick={() => setTactics(cloneTactics(baseTactics))}
            type="button"
          >
            基本戦術に戻す
          </button>
        </div>

        <div className="pre-match-lineup__opponent-tactics">
          <div>
            <span>相手の戦術傾向</span>
            {opponentTactics ? (
              <div className="pre-match-lineup__tactic-chips">
                <span>
                  サーブ {tacticOptionLabel("serve", opponentTactics.serve)}
                </span>
                <span>
                  攻撃 {tacticOptionLabel("attack", opponentTactics.attack)}
                </span>
                <span>
                  ブロック {tacticOptionLabel("block", opponentTactics.block)}
                </span>
              </div>
            ) : (
              <strong>戦術傾向 非公開</strong>
            )}
          </div>
          {matchup ? (
            <strong
              className={`pre-match-lineup__matchup pre-match-lineup__matchup--${matchup.headline}`}
            >
              {matchupRatingLabels[matchup.headline]}
            </strong>
          ) : null}
        </div>

        <div className="pre-match-lineup__tactic-axis">
          <div className="pre-match-lineup__tactic-axis-heading">
            <strong>サーブ</strong>
            <span>ミスと崩しのバランス</span>
          </div>
          <div
            aria-label="今回のサーブ戦術"
            className="pre-match-lineup__tactic-options"
            role="group"
          >
            {serveTacticOptions.map((option) => (
              <button
                aria-pressed={tactics.serve === option.value}
                disabled={pending}
                key={option.value}
                onClick={() =>
                  setTactics((current) => ({
                    ...current,
                    serve: option.value,
                  }))
                }
                type="button"
              >
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="pre-match-lineup__tactic-axis">
          <div className="pre-match-lineup__tactic-axis-heading">
            <strong>攻撃</strong>
            <span>相手ブロックとの駆け引き</span>
          </div>
          <div
            aria-label="今回の攻撃戦術"
            className="pre-match-lineup__tactic-options"
            role="group"
          >
            {attackTacticOptions.map((option) => (
              <button
                aria-pressed={tactics.attack === option.value}
                disabled={pending}
                key={option.value}
                onClick={() =>
                  setTactics((current) => ({
                    ...current,
                    attack: option.value,
                  }))
                }
                type="button"
              >
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </div>

        <div className="pre-match-lineup__tactic-axis">
          <div className="pre-match-lineup__tactic-axis-heading">
            <strong>ブロック</strong>
            <span>相手攻撃への読み方</span>
          </div>
          <div
            aria-label="今回のブロック戦術"
            className="pre-match-lineup__tactic-options"
            role="group"
          >
            {blockTacticOptions.map((option) => (
              <button
                aria-pressed={tactics.block === option.value}
                disabled={pending}
                key={option.value}
                onClick={() =>
                  setTactics((current) => ({
                    ...current,
                    block: option.value,
                  }))
                }
                type="button"
              >
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section
        className="pre-match-lineup__presets"
        aria-labelledby="pre-match-preset-heading"
      >
        <div className="pre-match-lineup__section-heading">
          <div>
            <p className="section-kicker">編成プリセット</p>
            <h3 id="pre-match-preset-heading">今回の起用</h3>
          </div>
          <button
            disabled={pending}
            onClick={() => setSelection(cloneSelection(baseSelection))}
            type="button"
          >
            元に戻す
          </button>
        </div>
        <div className="pre-match-lineup__preset-grid">
          {presets.map((item) => (
            <button
              disabled={pending}
              key={item.preset}
              onClick={() => applyPreset(item.preset)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="pre-match-lineup__saved-heading">
          <strong>保存編成</strong>
          <span>通常編成で登録した3枠</span>
        </div>
        <div className="pre-match-lineup__saved-presets" aria-label="保存編成">
          {savedLineupSlots.map((slot) => (
            <button
              aria-label={
                slot.status === "valid" && slot.preset
                  ? `保存編成 ${slot.preset.name}`
                  : slot.status === "invalid" && slot.preset
                    ? `保存編成 ${slot.preset.name} 再設定が必要`
                    : `保存編成 スロット${slot.slot} 未保存`
              }
              disabled={pending || slot.status !== "valid" || !slot.preset}
              key={slot.slot}
              onClick={() => {
                if (slot.status === "valid" && slot.preset) {
                  setSelection(cloneSelection(slot.preset.selection));
                }
              }}
              type="button"
            >
              <span>スロット{slot.slot}</span>
              <strong>{slot.preset?.name ?? "未保存"}</strong>
              {slot.status === "invalid" ? (
                <small>再設定が必要</small>
              ) : slot.status === "valid" ? (
                <small>この試合に読込</small>
              ) : null}
              {slot.status === "invalid" && slot.issueMessage ? (
                <small className="pre-match-lineup__saved-issue">
                  {slot.issueMessage}
                </small>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <section
        className="pre-match-lineup__lineup"
        aria-labelledby="pre-match-lineup-heading"
      >
        <div className="pre-match-lineup__section-heading">
          <div>
            <p className="section-kicker">STARTING SIX</p>
            <h3 id="pre-match-lineup-heading">この試合の6人</h3>
          </div>
          <span>選手をタップして変更</span>
        </div>

        <div className="pre-match-lineup__court-shell">
          <div className="pre-match-lineup__net" aria-hidden="true">
            <span>NET</span>
          </div>
          <div
            aria-label="この試合のコート配置"
            className="pre-match-lineup__court"
            role="group"
          >
            {courtOrder.map((slot) => {
              const assignment = selection.rotation.find(
                (item) => item.slot === slot,
              );
              if (!assignment) return null;
              const player = state.players[assignment.playerId];
              if (!player) return null;
              const condition = getPlayerConditionPresentation(
                player.condition,
              );
              return (
                <button
                  aria-label={`ローテーション${slot}を変更`}
                  className="pre-match-lineup__court-player"
                  disabled={pending}
                  key={slot}
                  onClick={() => setPickerTarget({ type: "rotation", slot })}
                  type="button"
                >
                  <span className="pre-match-lineup__court-player-top">
                    <b>R{slot}</b>
                    <small>{player.preferredPosition}</small>
                  </span>
                  <strong>{player.lastName}</strong>
                  <span
                    className={`pre-match-lineup__condition player-condition--${condition.colorToken}`}
                  >
                    {condition.icon} {condition.label}
                  </span>
                  <small>
                    {player.grade}年・総合 {playerOverallGrade(player)}
                  </small>
                </button>
              );
            })}
          </div>
          <div
            className="pre-match-lineup__court-orientation"
            aria-hidden="true"
          >
            <span>上段・前衛</span>
            <span>下段・後衛</span>
          </div>
        </div>

        {liberoPlayer && liberoCondition ? (
          <button
            aria-label="リベロを変更"
            className="pre-match-lineup__libero-card"
            disabled={pending}
            onClick={() => setPickerTarget({ type: "libero" })}
            type="button"
          >
            <b>L</b>
            <span>
              <small>LIBERO</small>
              <strong>{playerName(liberoPlayer)}</strong>
              <em>
                {liberoPlayer.preferredPosition}・{liberoPlayer.grade}年・
                {liberoCondition.icon}
                {liberoCondition.label}
              </em>
            </span>
            <strong>総合 {playerOverallGrade(liberoPlayer)}</strong>
          </button>
        ) : null}
      </section>

      <section
        className="pre-match-lineup__bench"
        aria-labelledby="pre-match-bench-heading"
      >
        <div className="pre-match-lineup__bench-heading">
          <div>
            <p className="section-kicker">BENCH</p>
            <h3 id="pre-match-bench-heading">控え選手</h3>
          </div>
          <span>{selection.benchPlayerIds.length}人</span>
        </div>
        <div
          className="pre-match-lineup__bench-rail"
          data-layout-scroll-x="true"
        >
          {selection.benchPlayerIds.map((playerId) => {
            const player = state.players[playerId];
            if (!player) return null;
            const condition = getPlayerConditionPresentation(player.condition);
            return (
              <article
                className="pre-match-lineup__bench-player"
                key={playerId}
              >
                <strong>{player.lastName}</strong>
                <span>
                  {player.preferredPosition}・{player.grade}年
                </span>
                <small>
                  {condition.icon}
                  {condition.label}・総合 {playerOverallGrade(player)}
                </small>
              </article>
            );
          })}
        </div>
      </section>

      <BottomSheet
        description={
          pickerTarget?.type === "rotation"
            ? "コート内の選手はその場で入れ替わります。ベンチ選手を選ぶと交代します。"
            : "ベンチからこの試合のリベロを選びます。"
        }
        onClose={() => setPickerTarget(null)}
        open={pickerTarget !== null}
        title={pickerTitle}
      >
        <div className="pre-match-lineup__picker">
          <div className="pre-match-lineup__picker-heading">
            <span>
              {pickerTarget?.type === "rotation"
                ? `R${pickerTarget.slot}`
                : "L"}
            </span>
            <div>
              <small>CHANGE PLAYER</small>
              <strong>交代候補</strong>
            </div>
          </div>
          <div
            aria-label="試合前の交代候補"
            className="pre-match-lineup__picker-list"
            role="group"
          >
            {pickerCandidateIds.map((playerId) => {
              const player = state.players[playerId];
              if (!player) return null;
              const condition = getPlayerConditionPresentation(
                player.condition,
              );
              const isCurrent = player.id === currentPickerPlayerId;
              const isCourtPlayer = starterIds.includes(player.id);
              const targetLabel =
                pickerTarget?.type === "rotation"
                  ? `ローテーション${pickerTarget.slot}`
                  : "リベロ";
              return (
                <button
                  aria-label={`${playerName(player)}を${targetLabel}に入れる`}
                  aria-pressed={isCurrent}
                  className={
                    isCurrent
                      ? "pre-match-lineup__picker-player is-current"
                      : "pre-match-lineup__picker-player"
                  }
                  disabled={pending || isCurrent}
                  key={player.id}
                  onClick={() => choosePickerPlayer(player.id)}
                  type="button"
                >
                  <span className="pre-match-lineup__picker-identity">
                    <strong>{playerName(player)}</strong>
                    <small>
                      {player.preferredPosition}・{player.grade}年
                    </small>
                  </span>
                  <span className="pre-match-lineup__picker-condition">
                    <b aria-hidden="true">{condition.icon}</b>
                    <small>{condition.label}</small>
                  </span>
                  <span className="pre-match-lineup__picker-grade">
                    <small>
                      {isCurrent ? "現在" : isCourtPlayer ? "コート" : "ベンチ"}
                    </small>
                    <strong>{playerOverallGrade(player)}</strong>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </BottomSheet>

      <button
        className="pre-match-lineup__start"
        disabled={pending}
        onClick={() =>
          onStart(cloneSelection(selection), cloneTactics(tactics))
        }
        type="button"
      >
        {pending ? "試合を開始しています…" : "この編成・戦術で試合開始"}
      </button>
    </main>
  );
}
