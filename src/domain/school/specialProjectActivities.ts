import type { GameDataRegistry } from "../../data/dataRegistry";
import { calculateSelectionAverageAbility } from "../player/playerDevelopment";
import { SeededRandom } from "../random/SeededRandom";
import { autoSelectTeam } from "../team/autoSelectTeam";
import {
  resolvePlayerTrainingActivity,
  type PlayerGrowthLog,
  type TrainingActivity,
} from "../training/resolveWeeklyTraining";
import { addWeeks } from "../events/eventDate";
import type { GameState } from "../model/GameState";
import { eventId, type PlayerId, type SchoolId } from "../model/identifiers";
import type { Player } from "../model/Player";
import type { AbilityKey } from "../validation/gameDataSchema";
import type { UniversityJointTrainingFocus } from "./schoolSpecialProjects";

export type TopTeamClinicFocus =
  | "attack"
  | "defense"
  | "serve"
  | "setting"
  | "block"
  | "mental";

export interface UniversityJointTrainingResult {
  focus: UniversityJointTrainingFocus;
  participantCount: number;
  grewPlayerCount: number;
  totalAbilityGrowth: number;
  injuredPlayerIds: PlayerId[];
  averageFatigueChange: number;
  playerLogs: PlayerGrowthLog[];
}

const UNIVERSITY_FOCUS_ABILITIES: Record<
  UniversityJointTrainingFocus,
  readonly AbilityKey[]
> = {
  attack: ["spike", "serve", "set"],
  defense: ["receive", "block", "decision"],
  physical: ["jump", "speed", "stamina"],
};

const TOP_TEAM_CLINIC_EVENT_IDS: Record<TopTeamClinicFocus, string> = {
  attack: "event.phase51-clinic-attack",
  defense: "event.phase51-clinic-defense",
  serve: "event.phase51-clinic-serve",
  setting: "event.phase51-clinic-setting",
  block: "event.phase51-clinic-block",
  mental: "event.phase51-clinic-mental",
};

function clampState(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function schoolStrength(state: GameState, schoolId: SchoolId): number {
  try {
    const selection = autoSelectTeam({ state, schoolId });
    return calculateSelectionAverageAbility(state, selection);
  } catch {
    return 0;
  }
}
