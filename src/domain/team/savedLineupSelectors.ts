import type { GameState } from "../model/GameState";
import type { SavedLineupPreset, SavedLineupSlot } from "./teamPlanningTypes";
import { validateTeamSelection } from "./validateTeamSelection";

export type SavedLineupStatus = "empty" | "valid" | "invalid";

export interface SavedLineupSlotView {
  slot: SavedLineupSlot;
  preset: SavedLineupPreset | null;
  status: SavedLineupStatus;
  issueMessage: string | null;
}

const slots = [1, 2, 3] as const satisfies readonly SavedLineupSlot[];

export function selectSavedLineupSlots(
  state: GameState,
): SavedLineupSlotView[] {
  return slots.map((slot) => {
    const preset =
      state.teamPlanning.savedLineups.find(
        (candidate) => candidate.slot === slot,
      ) ?? null;

    if (!preset) {
      return {
        slot,
        preset: null,
        status: "empty",
        issueMessage: null,
      };
    }

    const issues = validateTeamSelection({
      state,
      schoolId: state.userSchoolId,
      selection: preset.selection,
    });

    return {
      slot,
      preset,
      status: issues.length === 0 ? "valid" : "invalid",
      issueMessage: issues[0]?.message ?? null,
    };
  });
}
