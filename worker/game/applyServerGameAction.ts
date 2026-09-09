import type { Player } from "../../src/domain/model/Player";
import { applyMatchTacticPlan } from "../../src/domain/team/matchTactics";
import type { CloudGameSnapshot } from "../data/GameStore";
import type { GameAction } from "./actionSchema";
import { applyGameAction, type AppliedGameAction } from "./applyGameAction";

export interface ServerGameActionContext {
  userIntake?: readonly Player[];
}

export function applyServerGameAction(
  snapshot: CloudGameSnapshot,
  action: GameAction,
  context: ServerGameActionContext = {},
): AppliedGameAction {
  if (
    action.type !== "advance-week" ||
    (!action.matchSelection && !action.matchTactics)
  ) {
    return applyGameAction(snapshot, action, context);
  }

  const savedSelection = structuredClone(snapshot.teamSelection);
  const userSchool = snapshot.state.schools[snapshot.state.userSchoolId];
  if (!userSchool) {
    throw new Error("authoritative user school is missing");
  }
  const savedTactics = structuredClone(userSchool.tactics);

  let teamSelection = savedSelection;
  if (action.matchSelection) {
    const validated = applyGameAction(
      snapshot,
      { type: "team-selection", selection: action.matchSelection },
      context,
    );
    teamSelection = validated.teamSelection;
  }

  const state = action.matchTactics
    ? {
        ...snapshot.state,
        schools: {
          ...snapshot.state.schools,
          [userSchool.id]: {
            ...userSchool,
            tactics: applyMatchTacticPlan(userSchool.tactics, action.matchTactics),
          },
        },
      }
    : snapshot.state;

  const applied = applyGameAction(
    {
      ...snapshot,
      state,
      teamSelection,
    },
    action,
    context,
  );

  if (!action.matchTactics) {
    return {
      ...applied,
      teamSelection: savedSelection,
    };
  }

  const returnedUserSchool = applied.state.schools[applied.state.userSchoolId];
  if (!returnedUserSchool) {
    throw new Error("returned authoritative user school is missing");
  }

  return {
    ...applied,
    state: {
      ...applied.state,
      schools: {
        ...applied.state.schools,
        [returnedUserSchool.id]: {
          ...returnedUserSchool,
          tactics: savedTactics,
        },
      },
    },
    teamSelection: savedSelection,
  };
}
