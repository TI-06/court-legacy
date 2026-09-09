import { useMemo, useState } from "react";
import {
  buildPreMatchLineupPreset,
  type PreMatchLineupPreset,
} from "../../domain/match/preMatchLineup";
import type { GameState } from "../../domain/model/GameState";
import type { PlayerId } from "../../domain/model/identifiers";
import type {
  RotationSlot,
  TeamSelection,
} from "../../domain/model/TeamSelection";
import { getPlayerConditionPresentation } from "../../domain/player/playerCondition";
import { calculateSelectionStrength } from "../../domain/selectors/matchSelectors";
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
import { PreMatchComparison } from "./MatchStatPanels";
import { ratingToGrade } from "./teamRatingGrade";
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

const rotationSlots = [
  1, 2, 3, 4, 5, 6,
] as const satisfies readonly RotationSlot[];

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
      opponentTactics
        ? summarizeTacticMatchup(tactics, opponentTactics)
        : null,
    [opponentTactics, tactics],
  );

  const starterIds = useMemo(
    () => selection.rotation.map(({ playerId }) => playerId),
    [selection],
  );
  const starterOptions = useMemo(
    () => [...starterIds, ...selection.benchPlayerIds],
    [selection, starterIds],
  );
  const liberoOptions = useMemo(
    () => [
      ...(selection.liberoPlayerId ? [selection.liberoPlayerId] : []),
      ...selection.benchPlayerIds,
    ],
    [selection],
  );

  const playerLabel = (playerId: PlayerId): string => {
    const player = state.players[playerId];
    if (!player) return String(playerId);
    const condition = getPlayerConditionPresentation(player.condition);
    return `${player.lastName} ${player.firstName}・${player.grade}年・${player.preferredPosition}・${condition.icon}${condition.label}`;
  };

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
            {ratingToGrade(strength)}・戦力 {strength}
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
            <p className="section-kicker">スタメン</p>
            <h3 id="pre-match-lineup-heading">この試合の6人</h3>
          </div>
          <span>変更は保存されません</span>
        </div>

        <div className="pre-match-lineup__slots">
          {rotationSlots.map((slot) => {
            const assignment = selection.rotation.find(
              (item) => item.slot === slot,
            );
            if (!assignment) return null;
            return (
              <label className="pre-match-lineup__slot" key={slot}>
                <span>ローテーション {slot}</span>
                <select
                  aria-label={`ローテーション${slot}`}
                  disabled={pending}
                  onChange={(event) =>
                    changeStarter(slot, event.target.value as PlayerId)
                  }
                  value={assignment.playerId}
                >
                  {starterOptions.map((playerId) => (
                    <option key={playerId} value={playerId}>
                      {playerLabel(playerId)}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>

        {selection.liberoPlayerId ? (
          <label className="pre-match-lineup__libero">
            <span>リベロ</span>
            <select
              aria-label="リベロ"
              disabled={pending}
              onChange={(event) => changeLibero(event.target.value as PlayerId)}
              value={selection.liberoPlayerId}
            >
              {liberoOptions.map((playerId) => (
                <option key={playerId} value={playerId}>
                  {playerLabel(playerId)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section
        className="pre-match-lineup__bench"
        aria-labelledby="pre-match-bench-heading"
      >
        <h3 id="pre-match-bench-heading">ベンチ</h3>
        <div>
          {selection.benchPlayerIds.map((playerId) => (
            <span key={playerId}>{playerLabel(playerId)}</span>
          ))}
        </div>
      </section>

      <button
        className="pre-match-lineup__start"
        disabled={pending}
        onClick={() =>
          onStart(cloneSelection(selection), cloneTactics(tactics))
        }
        type="button"
      >
        {pending
          ? "試合を開始しています…"
          : "この編成・戦術で試合開始"}
      </button>
    </main>
  );
}
