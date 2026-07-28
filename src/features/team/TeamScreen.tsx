import { useMemo, useState } from "react";
import type { GameState } from "../../domain/model/GameState";
import type { Player, Position } from "../../domain/model/Player";
import type { PlayerId } from "../../domain/model/identifiers";
import type {
  RotationSlot,
  SubstitutionPolicy,
  TeamSelection,
} from "../../domain/model/TeamSelection";
import {
  autoSelectTeam,
  resolveLockedStarters,
  type StarterReplacement,
} from "../../domain/team/autoSelectTeam";
import { validateTeamSelection } from "../../domain/team/validateTeamSelection";
import "./team.css";

interface TeamScreenProps {
  state: GameState;
  selection: TeamSelection;
  onChange: (selection: TeamSelection) => void;
}

const positionLabels: Record<Position, string> = {
  OH: "アウトサイド",
  MB: "ミドル",
  OP: "オポジット",
  S: "セッター",
  L: "リベロ",
};

function playerName(player: Player): string {
  return `${player.lastName} ${player.firstName}`;
}

function cloneSelection(selection: TeamSelection): TeamSelection {
  return {
    rotation: selection.rotation.map((assignment) => ({ ...assignment })),
    liberoPlayerId: selection.liberoPlayerId,
    benchPlayerIds: [...selection.benchPlayerIds],
    servingOrderPlayerIds: [...selection.servingOrderPlayerIds],
    substitutionPolicy: {
      ...selection.substitutionPolicy,
      starterLockPlayerIds: [
        ...selection.substitutionPolicy.starterLockPlayerIds,
      ],
    },
  };
}

function statusLabel(player: Player): string {
  if (player.injury) {
    return `怪我 ${player.injury.remainingWeeks}週`;
  }
  if (player.fatigue >= 85) {
    return "疲労危険";
  }
  if (player.fatigue >= 65) {
    return "疲労注意";
  }
  return "出場可能";
}

function replacementText(
  replacement: StarterReplacement,
  players: Readonly<Record<PlayerId, Player>>,
): string {
  const outgoing = players[replacement.playerId];
  const incoming = players[replacement.replacementPlayerId];
  const reason = replacement.reason === "injury" ? "怪我" : "重度疲労";

  return `${outgoing ? playerName(outgoing) : replacement.playerId}を${reason}のためベンチへ変更し、${incoming ? playerName(incoming) : replacement.replacementPlayerId}を起用しました。`;
}

export function TeamScreen({ state, selection, onChange }: TeamScreenProps) {
  const [replacements, setReplacements] = useState<StarterReplacement[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const school = state.schools[state.userSchoolId]!;
  const players = useMemo(
    () =>
      school.playerIds
        .map((playerId) => state.players[playerId])
        .filter((player): player is Player => Boolean(player)),
    [school.playerIds, state.players],
  );
  const playerById = state.players;
  const activeIds = useMemo(() => {
    const ids = new Set(
      selection.rotation.map((assignment) => assignment.playerId),
    );
    if (selection.liberoPlayerId) {
      ids.add(selection.liberoPlayerId);
    }
    return ids;
  }, [selection.liberoPlayerId, selection.rotation]);
  const issues = validateTeamSelection({
    state,
    schoolId: state.userSchoolId,
    selection,
  });
  const lockedIds = new Set(selection.substitutionPolicy.starterLockPlayerIds);

  const emitSelection = (next: TeamSelection) => {
    setReplacements([]);
    setActionError(null);
    onChange(next);
  };

  const replaceRotationPlayer = (slot: RotationSlot, incomingId: PlayerId) => {
    const next = cloneSelection(selection);
    const assignment = next.rotation.find((item) => item.slot === slot);
    if (!assignment || assignment.playerId === incomingId) {
      return;
    }

    const outgoingId = assignment.playerId;
    assignment.playerId = incomingId;
    next.servingOrderPlayerIds = next.servingOrderPlayerIds.map((playerId) =>
      playerId === outgoingId ? incomingId : playerId,
    );
    next.benchPlayerIds = next.benchPlayerIds
      .filter((playerId) => playerId !== incomingId)
      .concat(outgoingId);
    next.substitutionPolicy.starterLockPlayerIds =
      next.substitutionPolicy.starterLockPlayerIds.filter(
        (playerId) => playerId !== outgoingId,
      );
    emitSelection(next);
  };

  const replaceLibero = (incomingId: PlayerId) => {
    if (!selection.liberoPlayerId || selection.liberoPlayerId === incomingId) {
      return;
    }

    const next = cloneSelection(selection);
    const outgoingId = next.liberoPlayerId!;
    next.liberoPlayerId = incomingId;
    next.benchPlayerIds = next.benchPlayerIds
      .filter((playerId) => playerId !== incomingId)
      .concat(outgoingId);
    next.substitutionPolicy.starterLockPlayerIds =
      next.substitutionPolicy.starterLockPlayerIds.filter(
        (playerId) => playerId !== outgoingId,
      );
    emitSelection(next);
  };

  const toggleStarterLock = (playerId: PlayerId) => {
    const next = cloneSelection(selection);
    const current = new Set(next.substitutionPolicy.starterLockPlayerIds);
    if (current.has(playerId)) {
      current.delete(playerId);
    } else {
      current.add(playerId);
    }
    next.substitutionPolicy.starterLockPlayerIds = [...current];
    emitSelection(next);
  };

  const updatePolicy = (
    key: keyof Omit<SubstitutionPolicy, "starterLockPlayerIds">,
    checked: boolean,
  ) => {
    const next = cloneSelection(selection);
    next.substitutionPolicy[key] = checked;
    emitSelection(next);
  };

  const rebuildAutomatically = () => {
    try {
      const rebuilt = autoSelectTeam({ state, schoolId: state.userSchoolId });
      rebuilt.substitutionPolicy = {
        ...selection.substitutionPolicy,
        starterLockPlayerIds: [
          ...selection.substitutionPolicy.starterLockPlayerIds,
        ],
      };
      const resolved = resolveLockedStarters({
        state,
        schoolId: state.userSchoolId,
        selection: rebuilt,
      });
      setActionError(null);
      setReplacements(resolved.replacements);
      onChange(resolved.selection);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "自動編成に失敗しました。",
      );
    }
  };

  const applySafetyAdjustment = () => {
    try {
      const resolved = resolveLockedStarters({
        state,
        schoolId: state.userSchoolId,
        selection,
      });
      setActionError(null);
      setReplacements(resolved.replacements);
      onChange(resolved.selection);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "安全調整に失敗しました。",
      );
    }
  };

  const renderPlayerOptions = (currentPlayerId: PlayerId) =>
    players.map((player) => (
      <option
        disabled={activeIds.has(player.id) && player.id !== currentPlayerId}
        key={player.id}
        value={player.id}
      >
        {playerName(player)} / {player.preferredPosition} / 疲労{player.fatigue}
      </option>
    ));

  return (
    <main className="app-content team-screen">
      <section className="team-hero" aria-labelledby="team-heading">
        <div>
          <p className="section-kicker">MATCH ROSTER</p>
          <h2 id="team-heading">チーム編成</h2>
          <p>{school.name}の試合登録メンバーを調整します。</p>
        </div>
        <button className="team-secondary-action" onClick={rebuildAutomatically} type="button">
          自動編成
        </button>
      </section>

      <section className="team-summary" aria-label="編成サマリー">
        <article>
          <span>コート</span>
          <strong>6</strong>
        </article>
        <article>
          <span>リベロ</span>
          <strong>{selection.liberoPlayerId ? 1 : 0}</strong>
        </article>
        <article>
          <span>ベンチ</span>
          <strong>{selection.benchPlayerIds.length}</strong>
        </article>
        <article>
          <span>固定</span>
          <strong>{lockedIds.size}</strong>
        </article>
      </section>

      <section className="team-panel" aria-labelledby="rotation-heading">
        <div className="team-section-heading">
          <div>
            <p className="section-kicker">STARTING SIX</p>
            <h3 id="rotation-heading">ローテーション</h3>
          </div>
          <span className={issues.length === 0 ? "team-valid" : "team-invalid"}>
            {issues.length === 0 ? "編成は有効です" : `${issues.length}件の問題`}
          </span>
        </div>

        <div className="rotation-list">
          {[...selection.rotation]
            .sort((first, second) => first.slot - second.slot)
            .map((assignment) => {
              const player = playerById[assignment.playerId]!;
              return (
                <article className="rotation-card" key={assignment.slot}>
                  <div className="rotation-number">{assignment.slot}</div>
                  <div className="rotation-card__body">
                    <label htmlFor={`rotation-${assignment.slot}`}>
                      ローテーション{assignment.slot}
                    </label>
                    <select
                      aria-label={`ローテーション${assignment.slot}`}
                      id={`rotation-${assignment.slot}`}
                      onChange={(event) =>
                        replaceRotationPlayer(
                          assignment.slot,
                          event.target.value as PlayerId,
                        )
                      }
                      value={assignment.playerId}
                    >
                      {renderPlayerOptions(assignment.playerId)}
                    </select>
                    <div className="player-status-line">
                      <span>{positionLabels[player.preferredPosition]}</span>
                      <span>身長 {player.heightCm}cm</span>
                      <span>疲労 {player.fatigue}</span>
                      <span>状態 {player.condition}</span>
                    </div>
                    <label className="lock-control">
                      <input
                        aria-label={`先発固定 ${playerName(player)}`}
                        checked={lockedIds.has(player.id)}
                        onChange={() => toggleStarterLock(player.id)}
                        type="checkbox"
                      />
                      <span>先発固定</span>
                    </label>
                  </div>
                  <span
                    className={
                      player.injury || player.fatigue >= 85
                        ? "availability availability--danger"
                        : "availability"
                    }
                  >
                    {statusLabel(player)}
                  </span>
                </article>
              );
            })}
        </div>
      </section>

      {selection.liberoPlayerId ? (
        <section className="team-panel libero-panel" aria-labelledby="libero-heading">
          <div className="team-section-heading">
            <div>
              <p className="section-kicker">DEFENSE SPECIALIST</p>
              <h3 id="libero-heading">リベロ</h3>
            </div>
          </div>
          {(() => {
            const player = playerById[selection.liberoPlayerId]!;
            return (
              <article className="libero-card">
                <div className="libero-mark">L</div>
                <div className="rotation-card__body">
                  <label htmlFor="libero-player">リベロ</label>
                  <select
                    aria-label="リベロ"
                    id="libero-player"
                    onChange={(event) =>
                      replaceLibero(event.target.value as PlayerId)
                    }
                    value={selection.liberoPlayerId}
                  >
                    {renderPlayerOptions(selection.liberoPlayerId)}
                  </select>
                  <div className="player-status-line">
                    <span>{positionLabels[player.preferredPosition]}</span>
                    <span>レシーブ {player.abilities.receive}</span>
                    <span>疲労 {player.fatigue}</span>
                    <span>状態 {player.condition}</span>
                  </div>
                  <label className="lock-control">
                    <input
                      aria-label={`先発固定 ${playerName(player)}`}
                      checked={lockedIds.has(player.id)}
                      onChange={() => toggleStarterLock(player.id)}
                      type="checkbox"
                    />
                    <span>先発固定</span>
                  </label>
                </div>
              </article>
            );
          })()}
        </section>
      ) : null}

      <section className="team-panel" aria-labelledby="bench-heading">
        <div className="team-section-heading">
          <div>
            <p className="section-kicker">SUBSTITUTES</p>
            <h3 id="bench-heading">ベンチ</h3>
          </div>
          <span className="bench-count">{selection.benchPlayerIds.length}人</span>
        </div>
        <div className="bench-grid">
          {selection.benchPlayerIds.map((playerId) => {
            const player = playerById[playerId];
            if (!player) {
              return null;
            }
            return (
              <article data-testid="bench-player" key={player.id}>
                <strong>{playerName(player)}</strong>
                <span>
                  {player.preferredPosition}・{player.grade}年・疲労{player.fatigue}
                </span>
                <small>{statusLabel(player)}</small>
              </article>
            );
          })}
        </div>
      </section>

      <section className="team-panel" aria-labelledby="policy-heading">
        <div className="team-section-heading">
          <div>
            <p className="section-kicker">SAFETY POLICY</p>
            <h3 id="policy-heading">交代方針</h3>
          </div>
        </div>
        <div className="policy-list">
          <label>
            <span>
              <strong>怪我時はベンチを許可</strong>
              <small>先発固定より安全を優先します。</small>
            </span>
            <input
              aria-label="怪我時はベンチを許可"
              checked={selection.substitutionPolicy.allowInjuryBenching}
              onChange={(event) =>
                updatePolicy("allowInjuryBenching", event.target.checked)
              }
              type="checkbox"
            />
          </label>
          <label>
            <span>
              <strong>重度疲労時はベンチを許可</strong>
              <small>疲労85以上を安全交代の対象にします。</small>
            </span>
            <input
              aria-label="重度疲労時はベンチを許可"
              checked={selection.substitutionPolicy.allowFatigueBenching}
              onChange={(event) =>
                updatePolicy("allowFatigueBenching", event.target.checked)
              }
              type="checkbox"
            />
          </label>
          <label>
            <span>
              <strong>試合中の自動交代</strong>
              <small>試合エンジン実装時に使用します。</small>
            </span>
            <input
              aria-label="試合中の自動交代"
              checked={selection.substitutionPolicy.automaticSubstitutions}
              onChange={(event) =>
                updatePolicy("automaticSubstitutions", event.target.checked)
              }
              type="checkbox"
            />
          </label>
          <label>
            <span>
              <strong>セット間の自動変更</strong>
              <small>セット終了時に編成を見直します。</small>
            </span>
            <input
              aria-label="セット間の自動変更"
              checked={selection.substitutionPolicy.automaticSetChanges}
              onChange={(event) =>
                updatePolicy("automaticSetChanges", event.target.checked)
              }
              type="checkbox"
            />
          </label>
        </div>
        <button className="team-primary-action" onClick={applySafetyAdjustment} type="button">
          安全調整
        </button>
      </section>

      {issues.length > 0 ? (
        <section className="selection-feedback selection-feedback--error" role="alert">
          <strong>編成を確認してください</strong>
          {issues.map((issue, index) => (
            <p key={`${issue.code}-${issue.playerId ?? index}`}>{issue.message}</p>
          ))}
        </section>
      ) : null}

      {actionError ? (
        <section className="selection-feedback selection-feedback--error" role="alert">
          <strong>処理できませんでした</strong>
          <p>{actionError}</p>
        </section>
      ) : null}

      {replacements.length > 0 ? (
        <section className="selection-feedback" aria-live="polite">
          <strong>安全調整を適用しました</strong>
          {replacements.map((replacement) => (
            <p key={replacement.playerId}>
              {replacementText(replacement, playerById)}
            </p>
          ))}
        </section>
      ) : null}
    </main>
  );
}
