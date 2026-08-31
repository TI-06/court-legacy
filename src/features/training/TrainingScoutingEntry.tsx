import type { GameState } from "../../domain/model/GameState";
import { reputationGrade } from "../../domain/school/reputation";
import "./training-scouting-entry.css";

interface TrainingScoutingEntryProps {
  state: GameState;
  onOpen: () => void;
}

export function TrainingScoutingEntry({
  state,
  onOpen,
}: TrainingScoutingEntryProps) {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    throw new Error(`user school not found: ${state.userSchoolId}`);
  }

  const cycleKey = `${state.userSchoolId}:year-${state.yearIndex}`;
  const committedCount =
    state.recruiting?.cycleKey === cycleKey
      ? state.recruiting.committedCandidateIds.length
      : 0;
  const status =
    committedCount > 0 ? `獲得 ${committedCount}人` : "候補を確認";

  return (
    <button
      aria-label={`新入生スカウト 評判 ${reputationGrade(school.reputationPoints)} スカウト網 Lv.${school.facilities.scoutingNetwork} ${status}`}
      className="training-scouting-entry"
      onClick={onOpen}
      type="button"
    >
      <span className="training-scouting-entry__main">
        <strong>新入生スカウト</strong>
        <small>
          評判 {reputationGrade(school.reputationPoints)}・スカウト網 Lv.
          {school.facilities.scoutingNetwork}
        </small>
      </span>
      <span className="training-scouting-entry__status">{status}</span>
      <span className="training-scouting-entry__chevron" aria-hidden="true">
        ›
      </span>
    </button>
  );
}
