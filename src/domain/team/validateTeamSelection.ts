import type { GameState } from "../model/GameState";
import type { PlayerId, SchoolId } from "../model/identifiers";
import type { TeamSelection, TeamSelectionIssue } from "../model/TeamSelection";

export interface ValidateTeamSelectionInput {
  state: GameState;
  schoolId: SchoolId;
  selection: TeamSelection;
}

function duplicateIds(ids: readonly PlayerId[]): Set<PlayerId> {
  const seen = new Set<PlayerId>();
  const duplicates = new Set<PlayerId>();

  for (const id of ids) {
    if (seen.has(id)) {
      duplicates.add(id);
    }
    seen.add(id);
  }

  return duplicates;
}

function sameIdSet(
  first: readonly PlayerId[],
  second: readonly PlayerId[],
): boolean {
  if (first.length !== second.length) {
    return false;
  }
  const firstSet = new Set(first);
  const secondSet = new Set(second);
  if (firstSet.size !== first.length || secondSet.size !== second.length) {
    return false;
  }
  return [...firstSet].every((id) => secondSet.has(id));
}

export function validateTeamSelection(
  input: ValidateTeamSelectionInput,
): TeamSelectionIssue[] {
  const school = input.state.schools[input.schoolId];
  if (!school) {
    throw new Error(`unknown selection school: ${input.schoolId}`);
  }

  const issues: TeamSelectionIssue[] = [];
  const schoolPlayerIds = new Set(school.playerIds);
  const rotationIds = input.selection.rotation.map(
    (assignment) => assignment.playerId,
  );
  const slots = input.selection.rotation.map((assignment) => assignment.slot);
  const expectedSlots = new Set([1, 2, 3, 4, 5, 6]);

  if (input.selection.rotation.length !== 6) {
    issues.push({
      code: "rotation-size",
      playerId: null,
      message: "ローテーションは6人で設定してください。",
    });
  }

  const slotSet = new Set(slots);
  if (
    slots.length !== 6 ||
    slotSet.size !== 6 ||
    [...expectedSlots].some((slot) => !slotSet.has(slot as never))
  ) {
    issues.push({
      code: "invalid-slot",
      playerId: null,
      message: "ローテーション番号1〜6を重複なく設定してください。",
    });
  }

  for (const playerId of duplicateIds(rotationIds)) {
    issues.push({
      code: "duplicate-player",
      playerId,
      message: "同じ選手をローテーションへ複数回設定できません。",
    });
  }

  if (
    input.selection.liberoPlayerId &&
    rotationIds.includes(input.selection.liberoPlayerId)
  ) {
    issues.push({
      code: "libero-in-rotation",
      playerId: input.selection.liberoPlayerId,
      message: "リベロは6人ローテーションの外から選択してください。",
    });
  }

  for (const playerId of duplicateIds(input.selection.benchPlayerIds)) {
    issues.push({
      code: "duplicate-bench-player",
      playerId,
      message: "ベンチに同じ選手を複数回設定できません。",
    });
  }

  const activeIds = new Set(rotationIds);
  if (input.selection.liberoPlayerId) {
    activeIds.add(input.selection.liberoPlayerId);
  }
  for (const playerId of input.selection.benchPlayerIds) {
    if (activeIds.has(playerId)) {
      issues.push({
        code: "bench-overlap",
        playerId,
        message: "ベンチ選手はローテーションまたはリベロと重複できません。",
      });
    }
  }

  if (!sameIdSet(input.selection.servingOrderPlayerIds, rotationIds)) {
    issues.push({
      code: "serving-order-mismatch",
      playerId: null,
      message: "サーブ順はローテーションの6人と一致させてください。",
    });
  }

  const referencedIds = new Set<PlayerId>([
    ...rotationIds,
    ...input.selection.benchPlayerIds,
    ...input.selection.servingOrderPlayerIds,
    ...(input.selection.liberoPlayerId ? [input.selection.liberoPlayerId] : []),
  ]);
  for (const playerId of referencedIds) {
    if (!input.state.players[playerId]) {
      issues.push({
        code: "unknown-player",
        playerId,
        message: `存在しない選手が編成に含まれています: ${playerId}`,
      });
    } else if (!schoolPlayerIds.has(playerId)) {
      issues.push({
        code: "player-not-in-school",
        playerId,
        message: "所属校が異なる選手を編成できません。",
      });
    }
  }

  const selectedIds = new Set<PlayerId>([
    ...rotationIds,
    ...input.selection.benchPlayerIds,
    ...(input.selection.liberoPlayerId ? [input.selection.liberoPlayerId] : []),
  ]);
  for (const playerId of input.selection.substitutionPolicy
    .starterLockPlayerIds) {
    if (!selectedIds.has(playerId)) {
      issues.push({
        code: "invalid-starter-lock",
        playerId,
        message: "先発固定選手は現在の登録メンバーから選択してください。",
      });
    }
  }

  return issues;
}
