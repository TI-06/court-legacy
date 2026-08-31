import { useMemo } from "react";
import type { ActivityType } from "../../domain/model/Calendar";
import type { GameState } from "../../domain/model/GameState";
import type { GameDate } from "../../domain/model/identifiers";
import { BottomSheet } from "../../ui/BottomSheet";
import "../../ui/ui.css";
import "./calendar-sheet.css";

interface CalendarSheetProps {
  open: boolean;
  state: GameState;
  trainingCompleted: boolean;
  practiceMatchCompleted: boolean;
  onAdvanceWeek: () => void;
  onClose: () => void;
}

const activityLabels: Record<ActivityType, string> = {
  practice: "練習",
  exam: "定期試験",
  camp: "合宿",
  "practice-match": "練習試合",
  qualifier: "予選",
  "prefectural-tournament": "県大会",
  "national-tournament": "全国大会",
  graduation: "卒業式",
  intake: "新入生入部",
  recovery: "休養",
};

function parseDate(value: GameDate): Date {
  return new Date(`${value}T00:00:00Z`);
}

function formatDate(value: GameDate): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(parseDate(value));
}

function addDays(value: GameDate, amount: number): GameDate {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as GameDate;
}

export function CalendarSheet({
  open,
  state,
  trainingCompleted,
  practiceMatchCompleted,
  onAdvanceWeek,
  onClose,
}: CalendarSheetProps) {
  const futureActivities = useMemo(
    () =>
      state.calendar.activities
        .filter((activity) => activity.date >= state.date)
        .sort((left, right) => left.date.localeCompare(right.date))
        .slice(0, 8),
    [state.calendar.activities, state.date],
  );
  const weeklyGuide = useMemo(
    () => [0, 7, 14, 21].map((days) => addDays(state.date, days)),
    [state.date],
  );

  return (
    <BottomSheet
      description="今週の進捗と今後の予定を確認します。"
      onClose={onClose}
      open={open}
      title="週間カレンダー"
    >
      <div className="calendar-sheet-body">
        <section className="calendar-current-week">
          <p className="section-kicker">今週</p>
          <strong>現在日付 {formatDate(state.date)}</strong>
          <div className="calendar-week-meta">
            <span>学年度 {state.calendar.academicYear}</span>
            <span>第{state.calendar.weekOfYear}週</span>
          </div>
          <div className="calendar-action-status">
            <span
              className={
                trainingCompleted ? "calendar-status--done" : undefined
              }
            >
              練習 {trainingCompleted ? "完了" : "週送りで実施"}
            </span>
            <span
              className={
                practiceMatchCompleted ? "calendar-status--done" : undefined
              }
            >
              練習試合 {practiceMatchCompleted ? "完了" : "未実施"}
            </span>
          </div>
        </section>

        <section
          className="calendar-section"
          aria-labelledby="schedule-heading"
        >
          <div className="calendar-section-heading">
            <div>
              <p className="section-kicker">予定</p>
              <h3 id="schedule-heading">今後の予定</h3>
            </div>
            <span>最大8件</span>
          </div>
          {futureActivities.length === 0 ? (
            <p className="calendar-empty-state">
              登録された公式予定はありません
            </p>
          ) : (
            <div className="calendar-activity-list">
              {futureActivities.map((activity) => (
                <article data-testid="calendar-activity" key={activity.id}>
                  <time>{formatDate(activity.date)}</time>
                  <div>
                    <strong>{activity.title}</strong>
                    <span>{activityLabels[activity.type]}</span>
                  </div>
                  {activity.mandatory ? <em>必須</em> : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="calendar-section" aria-labelledby="guide-heading">
          <div className="calendar-section-heading">
            <div>
              <p className="section-kicker">4週間</p>
              <h3 id="guide-heading">4週間の進行目安</h3>
            </div>
          </div>
          <div className="calendar-week-guide">
            {weeklyGuide.map((date, index) => (
              <article key={date}>
                <span>{index === 0 ? "今週" : `${index}週後`}</span>
                <time>{formatDate(date)}</time>
              </article>
            ))}
          </div>
          <p className="calendar-guide-note">
            大会日程ではなく、7日単位の進行を確認するための目安です。
          </p>
        </section>

        <section className="calendar-advance-panel">
          <div>
            <strong>次の週へ</strong>
            <p>
              {trainingCompleted
                ? "疲労と怪我を更新して次の週へ進みます。"
                : "設定済みの練習を実施して次の週へ進みます。"}
            </p>
          </div>
          <button
            className="primary-action"
            onClick={onAdvanceWeek}
            type="button"
          >
            次の週へ進む
          </button>
        </section>
      </div>
    </BottomSheet>
  );
}
