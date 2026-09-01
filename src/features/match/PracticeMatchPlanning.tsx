import type { GameState } from "../../domain/model/GameState";
import type { SchoolId } from "../../domain/model/identifiers";
import type {
  PracticeMatchCandidateTier,
  PracticeRating,
} from "../../domain/weekly/weeklyScheduleTypes";
import "./practice-match-planning.css";

interface PracticeMatchPlanningProps {
  state: GameState;
  pending: boolean;
  onAcceptOffer: () => void;
  onDeclineOffer: () => void;
  onRequest: (schoolId: SchoolId) => void;
}

const tierLabels: Record<PracticeMatchCandidateTier, string> = {
  same: "同程度",
  stronger: "格上",
  challenge: "強豪",
};

function ratingDots(rating: PracticeRating): string {
  return "●".repeat(rating) + "○".repeat(5 - rating);
}

export function PracticeMatchPlanning({
  state,
  pending,
  onAcceptOffer,
  onDeclineOffer,
  onRequest,
}: PracticeMatchPlanningProps) {
  const schedule = state.weeklySchedule.practiceMatch;
  const scheduledSchool = schedule.scheduledOpponentId
    ? state.schools[schedule.scheduledOpponentId]
    : null;
  const incomingSchool = schedule.incomingOffer
    ? state.schools[schedule.incomingOffer.schoolId]
    : null;

  return (
    <section
      className="practice-planning"
      aria-labelledby="practice-planning-heading"
    >
      <div className="practice-planning__heading">
        <div>
          <h2 id="practice-planning-heading">練習試合の予定</h2>
          <p>
            練習試合は週1回まで。申し込みの受諾か候補校への申込で決定します。
          </p>
        </div>
        {scheduledSchool ? <strong>対戦決定</strong> : <span>未決定</span>}
      </div>

      {scheduledSchool ? (
        <article className="practice-planning__scheduled">
          <div>
            <span>
              {schedule.scheduledBy === "incoming"
                ? "相手校からの申し込み"
                : "こちらからの申し込み"}
            </span>
            <strong>{scheduledSchool.name}</strong>
          </div>
          <b>ホームの「次の週へ進む」で実施</b>
        </article>
      ) : (
        <>
          <div className="practice-planning__offer">
            <h3>届いた申し込み</h3>
            {schedule.incomingOffer && incomingSchool ? (
              <article>
                <div className="practice-planning__school-copy">
                  <strong>{incomingSchool.name}から申し込み</strong>
                  <span>
                    成長度 {ratingDots(schedule.incomingOffer.growthRating)} ・
                    負荷 {ratingDots(schedule.incomingOffer.loadRating)}
                  </span>
                </div>
                <div className="practice-planning__offer-actions">
                  <button
                    disabled={pending}
                    onClick={onDeclineOffer}
                    type="button"
                  >
                    断る
                  </button>
                  <button
                    disabled={pending}
                    onClick={onAcceptOffer}
                    type="button"
                  >
                    受ける
                  </button>
                </div>
              </article>
            ) : (
              <p className="practice-planning__empty">
                今週届いている申し込みはありません
              </p>
            )}
          </div>

          <div className="practice-planning__candidates">
            <h3>こちらから申し込む</h3>
            {schedule.outgoingCandidates.length > 0 ? (
              <div className="practice-planning__candidate-list">
                {schedule.outgoingCandidates.map((candidate) => {
                  const school = state.schools[candidate.schoolId];
                  if (!school) return null;
                  const available = candidate.status === "available";
                  return (
                    <article key={candidate.schoolId}>
                      <div className="practice-planning__school-copy">
                        <strong>{school.name}</strong>
                        <span>
                          {tierLabels[candidate.tier]} ・ 成立しやすさ{" "}
                          {candidate.acceptancePercent}% ・ 成長度{" "}
                          {ratingDots(candidate.growthRating)}
                        </span>
                      </div>
                      <button
                        aria-label={`${school.name}に申し込む`}
                        disabled={pending || !available}
                        onClick={() => onRequest(candidate.schoolId)}
                        type="button"
                      >
                        {candidate.status === "rejected"
                          ? "不成立"
                          : candidate.status === "accepted"
                            ? "成立"
                            : "申し込む"}
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="practice-planning__empty">
                今週の候補校はありません
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
