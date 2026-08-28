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

  return (
    <section className="training-scouting-entry" aria-label="新入生スカウト案内">
      <div className="training-scouting-entry__copy">
        <p className="section-kicker">RECRUITING</p>
        <h2>来年度の戦力候補</h2>
        <p>
          評判 {reputationGrade(school.reputationPoints)}・スカウト網 Lv.
          {school.facilities.scoutingNetwork} から届く候補を確認します。
        </p>
      </div>
      <div className="training-scouting-entry__action">
        <span>{committedCount > 0 ? `獲得 ${committedCount}人` : "候補を調査"}</span>
        <button onClick={onOpen} type="button">
          新入生スカウト
        </button>
      </div>
    </section>
  );
}
