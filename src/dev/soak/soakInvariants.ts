import { ABILITY_KEYS } from "../../domain/model/Player";
import { FACILITY_MAX_LEVEL } from "../../domain/school/facilityUpgrade";
import { validateTeamSelection } from "../../domain/team/validateTeamSelection";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";

export interface SoakInvariantViolation {
  code: string;
  message: string;
  path?: string;
}

export interface SoakReproductionContext {
  actionCount?: number;
}

export class SoakInvariantError extends Error {
  constructor(
    public readonly violations: readonly SoakInvariantViolation[],
    public readonly seed: string,
    public readonly date: string,
    public readonly actionCount: number | undefined,
  ) {
    const codes = violations.map((item) => item.code).join(",");
    super(
      `soak invariant failure: seed=${seed} date=${date} actionCount=${actionCount ?? "n/a"} codes=${codes}`,
    );
    this.name = "SoakInvariantError";
  }
}

function violation(
  items: SoakInvariantViolation[],
  code: string,
  message: string,
  path?: string,
): void {
  items.push({ code, message, ...(path ? { path } : {}) });
}

function inspectFinite(
  items: SoakInvariantViolation[],
  value: number,
  path: string,
): boolean {
  if (Number.isFinite(value)) return true;
  violation(items, "non_finite", "数値が有限値ではありません", path);
  return false;
}

function inspectBoundedPlayerValue(
  items: SoakInvariantViolation[],
  value: number,
  path: string,
): void {
  if (!inspectFinite(items, value, path)) return;
  if (value < 0 || value > 100) {
    violation(
      items,
      "player_value_out_of_range",
      "選手の数値が0..100の範囲外です",
      path,
    );
  }
}

export function inspectSoakInvariants(
  snapshot: CloudGameSnapshot,
): SoakInvariantViolation[] {
  const items: SoakInvariantViolation[] = [];
  const state = snapshot.state;

  inspectFinite(items, state.randomCursor, "state.randomCursor");
  if (state.date !== state.calendar.currentDate) {
    violation(
      items,
      "calendar_date_mismatch",
      "ゲーム日付とカレンダー日付が一致しません",
      "state.calendar.currentDate",
    );
  }

  const rosterOwners = new Map<string, string>();
  for (const [schoolId, school] of Object.entries(state.schools)) {
    const schoolPath = `state.schools.${schoolId}`;
    if (
      inspectFinite(items, school.funds, `${schoolPath}.funds`) &&
      school.funds < 0
    ) {
      violation(
        items,
        "negative_school_funds",
        "学校資金が負数です",
        `${schoolPath}.funds`,
      );
    }
    inspectFinite(
      items,
      school.reputationPoints,
      `${schoolPath}.reputationPoints`,
    );

    for (const [facility, level] of Object.entries(school.facilities)) {
      const path = `${schoolPath}.facilities.${facility}`;
      if (!inspectFinite(items, level, path)) continue;
      if (!Number.isInteger(level) || level < 0 || level > FACILITY_MAX_LEVEL) {
        violation(
          items,
          "facility_level_out_of_range",
          `施設レベルが0..${FACILITY_MAX_LEVEL}の範囲外です`,
          path,
        );
      }
    }

    const seen = new Set<string>();
    for (const playerId of school.playerIds) {
      const playerPath = `${schoolPath}.playerIds`;
      if (seen.has(playerId)) {
        violation(
          items,
          "duplicate_roster_player",
          "同じ学校のロスターに選手が重複しています",
          playerPath,
        );
        continue;
      }
      seen.add(playerId);

      const previousOwner = rosterOwners.get(playerId);
      if (previousOwner && previousOwner !== schoolId) {
        violation(
          items,
          "duplicate_roster_player",
          "選手が複数校のロスターに所属しています",
          playerPath,
        );
      } else {
        rosterOwners.set(playerId, schoolId);
      }

      const player = state.players[playerId];
      if (!player) {
        violation(
          items,
          "missing_roster_player",
          "ロスターが存在しない選手を参照しています",
          `${playerPath}.${playerId}`,
        );
        continue;
      }
      if (player.career.schoolId !== school.id) {
        violation(
          items,
          "roster_school_mismatch",
          "選手の所属校とロスターの学校が一致しません",
          `state.players.${playerId}.career.schoolId`,
        );
      }
    }
  }

  for (const [playerId, player] of Object.entries(state.players)) {
    const playerPath = `state.players.${playerId}`;
    for (const ability of ABILITY_KEYS) {
      inspectBoundedPlayerValue(
        items,
        player.abilities[ability],
        `${playerPath}.abilities.${ability}`,
      );
    }
    for (const field of [
      "condition",
      "fatigue",
      "morale",
      "trust",
      "academic",
    ] as const) {
      inspectBoundedPlayerValue(items, player[field], `${playerPath}.${field}`);
    }
    if (player.injury) {
      const path = `${playerPath}.injury.remainingWeeks`;
      if (inspectFinite(items, player.injury.remainingWeeks, path)) {
        if (
          !Number.isInteger(player.injury.remainingWeeks) ||
          player.injury.remainingWeeks < 0
        ) {
          violation(
            items,
            "invalid_injury_weeks",
            "怪我の残り週が不正です",
            path,
          );
        }
      }
    }
  }

  for (const [key, value] of Object.entries(state.playerRelationships)) {
    inspectFinite(items, value, `state.playerRelationships.${key}`);
  }

  try {
    const selectionIssues = validateTeamSelection({
      state,
      schoolId: state.userSchoolId,
      selection: snapshot.teamSelection,
    });
    if (selectionIssues.length > 0) {
      violation(
        items,
        "invalid_team_selection",
        selectionIssues.map((item) => item.message).join(" / "),
        "teamSelection",
      );
    }
  } catch (error) {
    violation(
      items,
      "invalid_team_selection",
      error instanceof Error ? error.message : "チーム編成を検証できません",
      "teamSelection",
    );
  }

  const activeMatch = state.activeMatch;
  if (activeMatch) {
    inspectFinite(
      items,
      activeMatch.randomCursor,
      "state.activeMatch.randomCursor",
    );
    if (
      activeMatch.phase === "coach-decision" &&
      activeMatch.pendingCoachCommandForSchoolId === null
    ) {
      violation(
        items,
        "match_decision_without_school",
        "監督指示待ちなのに対象校がありません",
        "state.activeMatch.pendingCoachCommandForSchoolId",
      );
    }
    if (
      activeMatch.phase !== "coach-decision" &&
      activeMatch.pendingCoachCommandForSchoolId !== null
    ) {
      violation(
        items,
        "match_pending_school_without_decision",
        "監督指示待ち以外のphaseに対象校が残っています",
        "state.activeMatch.pendingCoachCommandForSchoolId",
      );
    }
  }

  return items;
}

export function assertSoakInvariants(
  snapshot: CloudGameSnapshot,
  context: SoakReproductionContext = {},
): void {
  const violations = inspectSoakInvariants(snapshot);
  if (violations.length === 0) return;

  throw new SoakInvariantError(
    violations,
    snapshot.state.seed,
    snapshot.state.date,
    context.actionCount,
  );
}
