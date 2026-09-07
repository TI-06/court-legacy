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
  return applyGameAction(snapshot, action, context);
}
