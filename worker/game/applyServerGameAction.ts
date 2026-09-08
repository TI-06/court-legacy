import type { Player } from "../../src/domain/model/Player";
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
  if (action.type !== "advance-week" || !action.matchSelection) {
    return applyGameAction(snapshot, action, context);
  }

  const savedSelection = structuredClone(snapshot.teamSelection);
  const validated = applyGameAction(
    snapshot,
    { type: "team-selection", selection: action.matchSelection },
    context,
  );
  const applied = applyGameAction(
    {
      ...snapshot,
      teamSelection: validated.teamSelection,
    },
    action,
    context,
  );

  return {
    ...applied,
    teamSelection: savedSelection,
  };
}
