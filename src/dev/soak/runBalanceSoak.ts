import { createInitialGame } from "../../app/createInitialGame";
import { autoSelectTeam } from "../../domain/team/autoSelectTeam";
import type { CloudGameSnapshot } from "../../../worker/data/GameStore";
import type { GameAction } from "../../../worker/game/actionSchema";
import { applyGameAction } from "../../../worker/game/applyGameAction";

const DEFAULT_MAX_ACTIONS_PER_WEEK = 512;

export interface AdvanceSoakWeekOptions {
  maxActionsPerWeek?: number;
}

export interface AdvanceSoakWeekResult {
  snapshot: CloudGameSnapshot;
  actionCount: number;
  resolvedEvents: number;
  completedMatches: number;
}

export class SoakActionGuardError extends Error {
  constructor(
    public readonly seed: string,
    public readonly date: string,
    public readonly yearIndex: number,
    public readonly weekOfYear: number,
    public readonly actionCount: number,
    public readonly maximum: number,
  ) {
    super(
      `soak action guard exhausted: seed=${seed} date=${date} year=${yearIndex} week=${weekOfYear} actionCount=${actionCount} maxActionsPerWeek=${maximum}`,
    );
    this.name = "SoakActionGuardError";
  }
}

export function createSoakSnapshot(seed: string): CloudGameSnapshot {
  const state = createInitialGame({
    seed,
    schoolName: "Soak高校",
    schoolShortName: "Soak",
    coachName: "Soak監督",
    regionId: "region.chiba",
    uniform: {
      primary: "#17365D",
      secondary: "#FFFFFF",
      accent: "#D99B2B",
    },
  });

  return {
    userId: `soak:${seed}`,
    schoolDbId: `soak:${seed}`,
    revision: 1,
    state,
    teamSelection: autoSelectTeam({ state, schoolId: state.userSchoolId }),
  };
}

function applyAction(
  snapshot: CloudGameSnapshot,
  action: GameAction,
): CloudGameSnapshot {
  const applied = applyGameAction(snapshot, action);
  return {
    ...snapshot,
    revision: snapshot.revision + 1,
    state: applied.state,
    teamSelection: applied.teamSelection,
  };
}

function actionGuardError(
  snapshot: CloudGameSnapshot,
  actionCount: number,
  maximum: number,
): SoakActionGuardError {
  return new SoakActionGuardError(
    snapshot.state.seed,
    snapshot.state.date,
    snapshot.state.yearIndex,
    snapshot.state.calendar.weekOfYear,
    actionCount,
    maximum,
  );
}

function nextAction(snapshot: CloudGameSnapshot): GameAction {
  const pendingEvent = snapshot.state.pendingEvent;
  if (pendingEvent) {
    const choiceId = pendingEvent.choiceIds[0];
    if (!choiceId) {
      throw new Error(
        `soak pending event has no choices: seed=${snapshot.state.seed} date=${snapshot.state.date} event=${pendingEvent.eventId}`,
      );
    }
    return { type: "event-choice", choiceId };
  }

  const activeMatch = snapshot.state.activeMatch;
  if (activeMatch && activeMatch.phase !== "match-complete") {
    if (
      activeMatch.phase !== "coach-decision" ||
      activeMatch.pendingCoachCommandForSchoolId !== snapshot.state.userSchoolId
    ) {
      throw new Error(
        `soak match cannot progress automatically: seed=${snapshot.state.seed} date=${snapshot.state.date} match=${activeMatch.id} phase=${activeMatch.phase}`,
      );
    }
    return { type: "match-command", command: { type: "continue" } };
  }

  return { type: "advance-week" };
}

export function advanceSoakUntilWeekChanges(
  snapshot: CloudGameSnapshot,
  options: AdvanceSoakWeekOptions = {},
): AdvanceSoakWeekResult {
  const maximum = options.maxActionsPerWeek ?? DEFAULT_MAX_ACTIONS_PER_WEEK;
  const startingDate = snapshot.state.date;
  let current = snapshot;
  let actionCount = 0;
  let resolvedEvents = 0;
  let completedMatches = 0;

  while (current.state.date === startingDate) {
    if (actionCount >= maximum) {
      throw actionGuardError(current, actionCount, maximum);
    }

    const action = nextAction(current);
    const historyCount = current.state.history.matches.length;
    const next = applyAction(current, action);

    if (action.type === "event-choice") {
      resolvedEvents += 1;
    }
    completedMatches += Math.max(
      0,
      next.state.history.matches.length - historyCount,
    );

    current = next;
    actionCount += 1;
  }

  return {
    snapshot: current,
    actionCount,
    resolvedEvents,
    completedMatches,
  };
}
