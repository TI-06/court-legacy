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
import { repositionTeamSelection } from "../../domain/team/repositionTeamSelection";
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
  pending: boolean;
  onStart: (selection: TeamSelection) => void;
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

export function PreMatchLineupScreen({
  state,
  baseSelection,
  mode,
  opponentName,
  opponentStrength,
  opponentSelection,
  pending,
  onStart,
  onCancel,
}: PreMatchLineupScreenProps) {
  const [selection, setSelection] = useState<TeamSelection>(() =>
    cloneSelection(baseSelection),
  );

  const strength = useMemo(
    () => calculateSelectionStrength(state, selection),
    [selection, state],
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

      <section
        className="pre-match-lineup__versus"
        aria-label="試合前戦力比較"
      >
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
          対人戦では相手選手の詳細能力は非公開です。公開戦力を見て編成を決めます。
        </p>
      ) : null}

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
              onChange={(event) =>
                changeLibero(event.target.value as PlayerId)
              }
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
        onClick={() => onStart(cloneSelection(selection))}
        type="button"
      >
        {pending ? "試合を開始しています…" : "この編成で試合開始"}
      </button>
    </main>
  );
}
