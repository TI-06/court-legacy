import type {
  CoachDecisionReason,
  MatchCommand,
} from "../../src/domain/model/Match";
import type { School } from "../../src/domain/model/School";

export type AutomaticDefenderCommand = Extract<
  MatchCommand,
  { type: "timeout" } | { type: "continue" }
>;

export interface AutomaticDefenderCoachInput {
  school: School;
  reason: CoachDecisionReason;
  timeoutAlreadyUsed: boolean;
}

const TIMEOUT_COACH_SCORE_THRESHOLD = 70;

export function chooseAutomaticDefenderCommand(
  input: AutomaticDefenderCoachInput,
): AutomaticDefenderCommand {
  if (input.reason === "set-break" || input.timeoutAlreadyUsed) {
    return { type: "continue" };
  }

  const coachScore =
    input.school.coach.leadership * 0.55 + input.school.coach.tactics * 0.45;
  return coachScore >= TIMEOUT_COACH_SCORE_THRESHOLD
    ? { type: "timeout" }
    : { type: "continue" };
}
