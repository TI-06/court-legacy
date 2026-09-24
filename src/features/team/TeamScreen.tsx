import { useMemo, useState } from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { GameState } from "../../domain/model/GameState";
import type { Player, Position } from "../../domain/model/Player";
import type { PlayerId } from "../../domain/model/identifiers";
import type {
  RotationSlot,
  SubstitutionPolicy,
  TeamSelection,
} from "../../domain/model/TeamSelection";
import {
  calculatePlayerDisplayPower,
  summarizePlayerAbilities,
} from "../../domain/selectors/playerPresentation";
import {
  autoSelectTeam,
  resolveLockedStarters,
  type StarterReplacement,
} from "../../domain/team/autoSelectTeam";
import {
  repositionTeamSelection,
  type TeamPlacement,
} from "../../domain/team/repositionTeamSelection";
import { selectSavedLineupSlots } from "../../domain/team/savedLineupSelectors";
import type { SavedLineupSlot } from "../../domain/team/teamPlanningTypes";
import { validateTeamSelection } from "../../domain/team/validateTeamSelection";
import { BottomSheet } from "../../ui/BottomSheet";
import { LineupDragSurface } from "./LineupDragSurface";
import "../../ui/ui.css";
import "./team.css";
import "./team-direct.css";
import "./team-dynamics.css";

interface TeamScreenProps {
  state: GameState;
  selection: TeamSelection;
  onChange: (selection: TeamSelection) => void;
  pending?: boolean;
  planningPending?: boolean;
  onSaveLineupPreset?: (
    slot: SavedLineupSlot,
    name: string,
    selection: TeamSelection,
  ) => void | Promise<void>;
  onDeleteLineupPreset?: (slot: SavedLineupSlot) => void | Promise<void>;
}

type PickerTarget =
  { type: "rotation"; slot: RotationSlot } | { type: "libero" };

type LineupSettingsView = "saved" | "policy" | null;

const ROTATION_ROLES: Record<RotationSlot, Position> = {
  1: "S",
  2: "MB",
  3: "MB",
  4: "OH",
  5: "OH",
  6: "OP",
};

function playerName(player: Player): string {
  return `${player.lastName} ${player.firstName}`;
}

function playerOverall(player: Player): number {
  return Math.round(calculatePlayerDisplayPower(player) / 100);
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

function placementPlayerId(
  selection: TeamSelection,
  placement: TeamPlacement | null,
): PlayerId | null {
  if (!placement) return null;
  if (placement.type === "rotation") {
    return (
      selection.rotation.find(
        (assignment) => assignment.slot === placement.slot,
      )?.playerId ?? null
    );
  }
  if (placement.type === "bench") return placement.playerId;
  return selection.liberoPlayerId;
}

function replacementText(
  replacement: StarterReplacement,
  players: Readonly<Record<PlayerId, Player>>,
): string {
  const outgoing = players[replacement.playerId];
  const incoming = players[replacement.replacementPlayerId];
  const reason = replacement.reason === "injury" ? "怪我" : "状態";

  return `${outgoing ? playerName(outgoing) : replacement.playerId}を${reason}のためベンチへ変更し、${incoming ? playerName(incoming) : replacement.replacementPlayerId}を起用しました。`;
}

export function TeamScreen({
  state,
  selection,
  onChange,
  pending = false,
  planningPending = false,
  onSaveLineupPreset,
  onDeleteLineupPreset,
}: TeamScreenProps) {
  const [replacements, setReplacements] = useState<StarterReplacement[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savedLineupNames, setSavedLineupNames] = useState<
    Partial<Record<SavedLineupSlot, string>>
  >({});
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [lineupSettingsView, setLineupSettingsView] =
    useState<LineupSettingsView>(null);
  const [activePlacement, setActivePlacement] = useState<TeamPlacement | null>(
    null,
  );
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
  );
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
    if (selection.liberoPlayerId) ids.add(selection.liberoPlayerId);
    return ids;
  }, [selection.liberoPlayerId, selection.rotation]);
  const issues = validateTeamSelection({
    state,
    schoolId: state.userSchoolId,
    selection,
  });
  const savedLineupSlots = useMemo(
    () => selectSavedLineupSlots(state),
    [state],
  );
  const currentLineupValid = issues.length === 0;
  const savedLineupCount = savedLineupSlots.filter(
    (slotView) => slotView.status !== "empty",
  ).length;
  const enabledPolicyCount = [
    selection.substitutionPolicy.allowInjuryBenching,
    selection.substitutionPolicy.automaticSubstitutions,
    selection.substitutionPolicy.automaticSetChanges,
  ].filter(Boolean).length;
  const lockedIds = new Set(selection.substitutionPolicy.starterLockPlayerIds);
  const captain = state.teamDynamics.captainPlayerId
    ? playerById[state.teamDynamics.captainPlayerId]
    : null;
  const activeDragPlayerId = placementPlayerId(selection, activePlacement);
  const activeDragPlayer = activeDragPlayerId
    ? playerById[activeDragPlayerId]
    : null;

  const savedLineupName = (
    slot: SavedLineupSlot,
    presetName: string | null,
  ): string => savedLineupNames[slot] ?? presetName ?? "";

  const clearSavedLineupNameOverride = (slot: SavedLineupSlot) => {
    setSavedLineupNames((current) => {
      const next = { ...current };
      delete next[slot];
      return next;
    });
  };

  const saveCurrentLineupToSlot = (
    slot: SavedLineupSlot,
    presetName: string | null,
  ) => {
    const name = savedLineupName(slot, presetName).trim();
    if (
      planningPending ||
      !currentLineupValid ||
      !name ||
      !onSaveLineupPreset
    ) {
      return;
    }
    const result = onSaveLineupPreset(slot, name, structuredClone(selection));
    if (result instanceof Promise) {
      void result.then(() => clearSavedLineupNameOverride(slot));
    } else {
      clearSavedLineupNameOverride(slot);
    }
  };

  const emitSelection = (next: TeamSelection) => {
    setReplacements([]);
    setActionError(null);
    onChange(next);
  };

  const replaceRotationPlayer = (slot: RotationSlot, incomingId: PlayerId) => {
    if (pending) return;
    const next = cloneSelection(selection);
    const assignment = next.rotation.find((item) => item.slot === slot);
    if (!assignment || assignment.playerId === incomingId) {
      setPickerTarget(null);
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
    setPickerTarget(null);
  };

  const replaceLibero = (incomingId: PlayerId) => {
    if (pending) return;
    if (!selection.liberoPlayerId || selection.liberoPlayerId === incomingId) {
      setPickerTarget(null);
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
    setPickerTarget(null);
  };

  const toggleStarterLock = (playerId: PlayerId) => {
    if (pending) return;
    const next = cloneSelection(selection);
    const current = new Set(next.substitutionPolicy.starterLockPlayerIds);
    if (current.has(playerId)) current.delete(playerId);
    else current.add(playerId);
    next.substitutionPolicy.starterLockPlayerIds = [...current];
    emitSelection(next);
  };

  const updatePolicy = (
    key: keyof Omit<SubstitutionPolicy, "starterLockPlayerIds">,
    checked: boolean,
  ) => {
    if (pending) return;
    const next = cloneSelection(selection);
    next.substitutionPolicy[key] = checked;
    emitSelection(next);
  };

  const rebuildAutomatically = () => {
    if (pending) return;
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
    if (pending) return;
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

  const handleDragStart = (event: DragStartEvent) => {
    const placement = event.active.data.current?.placement as
      TeamPlacement | undefined;
    setActivePlacement(placement ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const source = event.active.data.current?.placement as
      TeamPlacement | undefined;
    const target = event.over?.data.current?.placement as
      TeamPlacement | undefined;
    setActivePlacement(null);
    if (pending || !source || !target) return;

    const next = repositionTeamSelection({ selection, source, target });
    if (!next) return;
    const nextIssues = validateTeamSelection({
      state,
      schoolId: state.userSchoolId,
      selection: next,
    });
    if (nextIssues.length > 0) {
      setActionError(nextIssues[0]!.message);
      return;
    }
    emitSelection(next);
  };

  const currentPickerPlayerId =
    pickerTarget?.type === "rotation"
      ? (selection.rotation.find((item) => item.slot === pickerTarget.slot)
          ?.playerId ?? null)
      : pickerTarget?.type === "libero"
        ? selection.liberoPlayerId
        : null;
  const currentPickerPlayer = currentPickerPlayerId
    ? playerById[currentPickerPlayerId]
    : null;
  const currentPickerRole: Position | null =
    pickerTarget?.type === "rotation"
      ? ROTATION_ROLES[pickerTarget.slot]
      : pickerTarget?.type === "libero"
        ? "L"
        : null;

  const pickerCandidates = useMemo(() => {
    if (!currentPickerRole) return [];
    return players
      .filter(
        (player) =>
          player.id !== currentPickerPlayerId && !activeIds.has(player.id),
      )
      .sort((left, right) => {
        const aptitudeDifference =
          right.positionAptitudes[currentPickerRole] -
          left.positionAptitudes[currentPickerRole];
        if (aptitudeDifference !== 0) return aptitudeDifference;

        const overallDifference = playerOverall(right) - playerOverall(left);
        if (overallDifference !== 0) return overallDifference;

        const conditionDifference = right.condition - left.condition;
        if (conditionDifference !== 0) return conditionDifference;

        const fatigueDifference = left.fatigue - right.fatigue;
        if (fatigueDifference !== 0) return fatigueDifference;

        return left.id.localeCompare(right.id);
      });
  }, [activeIds, currentPickerPlayerId, currentPickerRole, players]);

  const choosePickerPlayer = (playerId: PlayerId) => {
    if (pickerTarget?.type === "rotation") {
      replaceRotationPlayer(pickerTarget.slot, playerId);
    } else if (pickerTarget?.type === "libero") {
      replaceLibero(playerId);
    }
  };

  const pickerTitle =
    pickerTarget?.type === "rotation"
      ? `ローテーション${pickerTarget.slot}を入れ替え`
      : pickerTarget?.type === "libero"
        ? "リベロを入れ替え"
        : "選手を入れ替え";

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragCancel={() => setActivePlacement(null)}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <main className="app-content team-screen team-screen--direct">
        <header className="team-screen__header">
          <div>
            <h2>チーム編成</h2>
            <p>長押しで移動・タップで編集</p>
          </div>
          <button
            className="team-secondary-action"
            disabled={pending}
            onClick={rebuildAutomatically}
            type="button"
          >
            自動編成
          </button>
        </header>

        <section
          className="team-dynamics-inline"
          aria-label="チーム状態サマリー"
        >
          <span>
            結束 <strong>{state.teamDynamics.cohesion}</strong>
          </span>
          <span>
            主将 <strong>{captain ? playerName(captain) : "未設定"}</strong>
          </span>
          <span>
            固定 <strong>{lockedIds.size}</strong>
          </span>
        </section>

        <section
          className="team-panel team-court-panel"
          aria-labelledby="rotation-heading"
        >
          <div className="team-section-heading">
            <div>
              <p className="section-kicker">先発6人</p>
              <h3 id="rotation-heading">コート配置</h3>
            </div>
            <span
              className={issues.length === 0 ? "team-valid" : "team-invalid"}
            >
              {issues.length === 0
                ? "編成は有効です"
                : `${issues.length}件の問題`}
            </span>
          </div>

          <div className="volleyball-court" aria-label="スターティングコート">
            {[...selection.rotation]
              .sort((first, second) => first.slot - second.slot)
              .map((assignment) => {
                const player = playerById[assignment.playerId]!;
                const locked = lockedIds.has(player.id);
                const placement: TeamPlacement = {
                  type: "rotation",
                  slot: assignment.slot,
                };
                return (
                  <LineupDragSurface
                    className="court-slot"
                    disabled={pending}
                    key={assignment.slot}
                    placement={placement}
                  >
                    <button
                      aria-label={`ローテーション${assignment.slot}を変更`}
                      className="court-player-button"
                      data-testid="court-player"
                      disabled={pending}
                      onClick={() =>
                        setPickerTarget({
                          type: "rotation",
                          slot: assignment.slot,
                        })
                      }
                      type="button"
                    >
                      <span className="court-player-button__top">
                        <b>{ROTATION_ROLES[assignment.slot]}</b>
                        <small>R{assignment.slot}</small>
                        {locked ? <small>固定</small> : null}
                      </span>
                      <strong>{player.lastName}</strong>
                      <span>
                        本{player.preferredPosition} 適
                        {
                          player.positionAptitudes[
                            ROTATION_ROLES[assignment.slot]
                          ]
                        }{" "}
                        総{playerOverall(player)}
                      </span>
                    </button>
                  </LineupDragSurface>
                );
              })}
          </div>
        </section>

        {selection.liberoPlayerId ? (
          <section
            className="team-panel team-special-panel"
            aria-labelledby="libero-heading"
          >
            <div className="team-section-heading team-section-heading--compact">
              <div>
                <p className="section-kicker">守備専門</p>
                <h3 id="libero-heading">リベロ</h3>
              </div>
            </div>
            {(() => {
              const player = playerById[selection.liberoPlayerId]!;
              return (
                <LineupDragSurface
                  disabled={pending}
                  placement={{ type: "libero" }}
                >
                  <button
                    aria-label="リベロを変更"
                    className="libero-player-button"
                    disabled={pending}
                    onClick={() => setPickerTarget({ type: "libero" })}
                    type="button"
                  >
                    <span className="libero-player-button__mark">L</span>
                    <span className="libero-player-button__main">
                      <strong>{playerName(player)}</strong>
                      <small>
                        {player.grade}年・{player.preferredPosition}・総合
                        {playerOverall(player)}
                      </small>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                </LineupDragSurface>
              );
            })()}
          </section>
        ) : null}

        <section
          className="team-panel team-bench-panel"
          aria-labelledby="bench-heading"
        >
          <div className="team-section-heading team-section-heading--compact">
            <div>
              <p className="section-kicker">控え選手</p>
              <h3 id="bench-heading">ベンチ</h3>
            </div>
            <span className="bench-count">
              {selection.benchPlayerIds.length}人
            </span>
          </div>
          <div className="bench-rail">
            {selection.benchPlayerIds.map((playerId) => {
              const player = playerById[playerId];
              if (!player) return null;
              return (
                <LineupDragSurface
                  disabled={pending}
                  key={player.id}
                  placement={{ type: "bench", playerId: player.id }}
                >
                  <article
                    className="bench-player-card"
                    data-testid="bench-player"
                  >
                    <strong>{player.lastName}</strong>
                    <span>
                      {player.preferredPosition}・{player.grade}年
                    </span>
                    <small>総合 {playerOverall(player)}</small>
                  </article>
                </LineupDragSurface>
              );
            })}
          </div>
        </section>

        <section className="team-lineup-tools" aria-label="編成設定">
          <button
            aria-label="保存編成を開く"
            className="team-lineup-tool"
            onClick={() => setLineupSettingsView("saved")}
            type="button"
          >
            <span>
              <small>編成スロット</small>
              <strong>保存編成</strong>
            </span>
            <b>{savedLineupCount}/3</b>
            <i aria-hidden="true">›</i>
          </button>
          <button
            aria-label="交代方針を開く"
            className="team-lineup-tool"
            onClick={() => setLineupSettingsView("policy")}
            type="button"
          >
            <span>
              <small>試合中の自動設定</small>
              <strong>交代方針</strong>
            </span>
            <b>{enabledPolicyCount}/3 ON</b>
            <i aria-hidden="true">›</i>
          </button>
        </section>

        {issues.length > 0 ? (
          <section
            className="selection-feedback selection-feedback--error"
            role="alert"
          >
            <strong>編成を確認してください</strong>
            {issues.map((issue, index) => (
              <p key={`${issue.code}-${issue.playerId ?? index}`}>
                {issue.message}
              </p>
            ))}
          </section>
        ) : null}

        {actionError ? (
          <section
            className="selection-feedback selection-feedback--error"
            role="alert"
          >
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

        <BottomSheet
          className="ui-bottom-sheet--game-choice"
          description="現在の編成を3つまで登録し、試合前にすぐ呼び出せます。"
          onClose={() => setLineupSettingsView(null)}
          open={lineupSettingsView === "saved"}
          title="保存編成"
        >
          <div className="saved-lineup-grid saved-lineup-grid--sheet">
            {savedLineupSlots.map((slotView) => {
              const name = savedLineupName(
                slotView.slot,
                slotView.preset?.name ?? null,
              );
              const saveDisabled =
                planningPending ||
                !currentLineupValid ||
                !name.trim() ||
                !onSaveLineupPreset;
              return (
                <article
                  className={`saved-lineup-card saved-lineup-card--${slotView.status}`}
                  data-testid={`saved-lineup-slot-${slotView.slot}`}
                  key={slotView.slot}
                >
                  <div className="saved-lineup-card__heading">
                    <strong>スロット{slotView.slot}</strong>
                    <span>
                      {slotView.status === "empty"
                        ? "未保存"
                        : slotView.status === "valid"
                          ? "使用可能"
                          : "再設定が必要"}
                    </span>
                  </div>
                  <input
                    aria-label={`保存編成名 スロット${slotView.slot}`}
                    disabled={planningPending}
                    maxLength={24}
                    onChange={(event) => {
                      const nextName = event.currentTarget.value;
                      setSavedLineupNames((current) => ({
                        ...current,
                        [slotView.slot]: nextName,
                      }));
                    }}
                    placeholder={`スロット${slotView.slot}の名前`}
                    type="text"
                    value={name}
                  />
                  {slotView.status === "invalid" && slotView.issueMessage ? (
                    <p className="saved-lineup-card__issue">
                      {slotView.issueMessage}
                    </p>
                  ) : null}
                  <div className="saved-lineup-card__actions">
                    {slotView.status === "empty" ? (
                      <button
                        disabled={saveDisabled}
                        onClick={() =>
                          saveCurrentLineupToSlot(slotView.slot, null)
                        }
                        type="button"
                      >
                        現在の編成を保存
                      </button>
                    ) : (
                      <>
                        <button
                          disabled={
                            planningPending || slotView.status !== "valid"
                          }
                          onClick={() => {
                            if (
                              slotView.status === "valid" &&
                              slotView.preset
                            ) {
                              onChange(
                                structuredClone(slotView.preset.selection),
                              );
                            }
                          }}
                          type="button"
                        >
                          適用
                        </button>
                        <button
                          disabled={saveDisabled}
                          onClick={() =>
                            saveCurrentLineupToSlot(
                              slotView.slot,
                              slotView.preset?.name ?? null,
                            )
                          }
                          type="button"
                        >
                          上書き保存
                        </button>
                        <button
                          disabled={planningPending || !onDeleteLineupPreset}
                          onClick={() => {
                            if (!onDeleteLineupPreset) return;
                            const result = onDeleteLineupPreset(slotView.slot);
                            if (result instanceof Promise) {
                              void result.then(() =>
                                clearSavedLineupNameOverride(slotView.slot),
                              );
                            } else {
                              clearSavedLineupNameOverride(slotView.slot);
                            }
                          }}
                          type="button"
                        >
                          削除
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </BottomSheet>

        <BottomSheet
          className="ui-bottom-sheet--game-choice"
          description="怪我や状態に応じた自動交代とセット間調整を設定します。"
          onClose={() => setLineupSettingsView(null)}
          open={lineupSettingsView === "policy"}
          title="交代方針"
        >
          <div className="team-policy-sheet">
            <div className="policy-list">
              <button
                aria-checked={selection.substitutionPolicy.allowInjuryBenching}
                aria-label="怪我時はベンチを許可"
                disabled={pending}
                onClick={() =>
                  updatePolicy(
                    "allowInjuryBenching",
                    !selection.substitutionPolicy.allowInjuryBenching,
                  )
                }
                role="switch"
                type="button"
              >
                <span>
                  <strong>怪我時はベンチを許可</strong>
                  <small>先発固定より安全を優先します。</small>
                </span>
                <span className="team-policy-switch" aria-hidden="true">
                  <i />
                </span>
              </button>
              <button
                aria-checked={
                  selection.substitutionPolicy.automaticSubstitutions
                }
                aria-label="試合中の自動交代"
                disabled={pending}
                onClick={() =>
                  updatePolicy(
                    "automaticSubstitutions",
                    !selection.substitutionPolicy.automaticSubstitutions,
                  )
                }
                role="switch"
                type="button"
              >
                <span>
                  <strong>試合中の自動交代</strong>
                  <small>試合中に状態を見て安全交代します。</small>
                </span>
                <span className="team-policy-switch" aria-hidden="true">
                  <i />
                </span>
              </button>
              <button
                aria-checked={selection.substitutionPolicy.automaticSetChanges}
                aria-label="セット間の自動変更"
                disabled={pending}
                onClick={() =>
                  updatePolicy(
                    "automaticSetChanges",
                    !selection.substitutionPolicy.automaticSetChanges,
                  )
                }
                role="switch"
                type="button"
              >
                <span>
                  <strong>セット間の自動変更</strong>
                  <small>セット終了時に編成を見直します。</small>
                </span>
                <span className="team-policy-switch" aria-hidden="true">
                  <i />
                </span>
              </button>
            </div>
            <button
              className="team-primary-action"
              disabled={pending}
              onClick={applySafetyAdjustment}
              type="button"
            >
              安全調整
            </button>
          </div>
        </BottomSheet>

        <BottomSheet
          description="コートで使用中の選手は重複選択できません。"
          onClose={() => setPickerTarget(null)}
          open={pickerTarget !== null}
          title={pickerTitle}
        >
          {currentPickerPlayer && pickerTarget ? (
            <div className="slot-editor-context">
              <div>
                <span>変更する枠</span>
                <strong>
                  {pickerTarget.type === "rotation"
                    ? `ローテーション${pickerTarget.slot}`
                    : "リベロ"}
                </strong>
                {currentPickerRole ? <b>{currentPickerRole}</b> : null}
              </div>
              <p>
                現在：{playerName(currentPickerPlayer)}・
                {currentPickerPlayer.preferredPosition}・総合
                {playerOverall(currentPickerPlayer)}
              </p>
            </div>
          ) : null}
          {currentPickerPlayer ? (
            <button
              aria-label={`先発固定 ${playerName(currentPickerPlayer)}`}
              aria-pressed={lockedIds.has(currentPickerPlayer.id)}
              className={
                lockedIds.has(currentPickerPlayer.id)
                  ? "slot-editor-lock is-active"
                  : "slot-editor-lock"
              }
              disabled={pending}
              onClick={() => toggleStarterLock(currentPickerPlayer.id)}
              type="button"
            >
              <span>先発固定</span>
              <strong>
                {lockedIds.has(currentPickerPlayer.id) ? "ON" : "OFF"}
              </strong>
            </button>
          ) : null}
          <div className="team-picker-summary">
            <strong>入れ替え候補</strong>
            <span>候補 {pickerCandidates.length}人・適性順</span>
          </div>
          <div className="team-picker-list">
            {pickerCandidates.map((player, index) => {
              const abilities = summarizePlayerAbilities(player);
              const aptitude = currentPickerRole
                ? player.positionAptitudes[currentPickerRole]
                : 0;
              return (
                <button
                  className="team-picker-card"
                  data-testid="player-picker-option"
                  disabled={pending}
                  key={player.id}
                  onClick={() => choosePickerPlayer(player.id)}
                  type="button"
                >
                  <span className="team-picker-card__identity">
                    <span>
                      {index === 0 ? <b>おすすめ</b> : null}
                      <strong>{playerName(player)}</strong>
                    </span>
                    <small>
                      {player.grade}年・{player.preferredPosition}・
                      {player.heightCm}cm
                    </small>
                  </span>
                  <span className="team-picker-card__score">
                    <small>総合</small>
                    <strong>{playerOverall(player)}</strong>
                  </span>
                  <span className="team-picker-card__aptitude">
                    <small>{currentPickerRole}</small>
                    <strong>適性 {aptitude}</strong>
                  </span>
                  <span className="team-picker-card__abilities">
                    <small>攻 {Math.round(abilities.attack)}</small>
                    <small>守 {Math.round(abilities.defense)}</small>
                    <small>跳 {Math.round(abilities.jump)}</small>
                  </span>
                  <span className="team-picker-card__state">
                    状態 {player.condition}・疲労 {player.fatigue}
                  </span>
                  <span className="team-picker-card__action">入替</span>
                </button>
              );
            })}
          </div>
        </BottomSheet>
      </main>

      <DragOverlay>
        {activeDragPlayer ? (
          <div className="lineup-drag-overlay">
            <strong>{playerName(activeDragPlayer)}</strong>
            <span>
              {activeDragPlayer.preferredPosition}・総合
              {playerOverall(activeDragPlayer)}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
