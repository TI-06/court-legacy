import type { TrainingResultNotification } from "../../domain/notifications/gameNotifications";
import type {
  HomeCommandAction,
  HomeCommandCenterModel,
  HomeCommandPriority,
  HomeCommandTask,
} from "./homeCommandCenter";
import "./home-command-center.css";

interface HomeCommandCenterProps {
  model: HomeCommandCenterModel;
  operationPending: boolean;
  onCommand: (action: HomeCommandAction) => void;
  onAcceptPracticeOffer: () => void;
  onDeclinePracticeOffer: () => void;
  onOpenTrainingNotification: (
    notification: TrainingResultNotification,
  ) => void;
}

const priorityLabels: Record<HomeCommandPriority, string> = {
  critical: "重要",
  attention: "注意",
  normal: "今週",
  complete: "完了",
};

function actionTask(
  task: Extract<HomeCommandTask, { kind: "action" }>,
  operationPending: boolean,
  onCommand: (action: HomeCommandAction) => void,
) {
  return (
    <article
      className={`home-command-task home-command-task--${task.priority}`}
      data-testid="home-command-task"
      key={task.id}
    >
      <span className="home-command-task__badge">
        {priorityLabels[task.priority]}
      </span>
      <div className="home-command-task__copy">
        <strong>{task.title}</strong>
        <small>{task.detail}</small>
      </div>
      {task.action ? (
        <button
          aria-label={`${task.title} ${task.actionLabel ?? "確認"}`}
          disabled={operationPending}
          onClick={() => onCommand(task.action!)}
          type="button"
        >
          {task.actionLabel ?? "確認"} <span aria-hidden="true">›</span>
        </button>
      ) : null}
    </article>
  );
}

export function HomeCommandCenter({
  model,
  operationPending,
  onCommand,
  onAcceptPracticeOffer,
  onDeclinePracticeOffer,
  onOpenTrainingNotification,
}: HomeCommandCenterProps) {
  const { summary } = model;

  return (
    <>
      <section
        className="home-command-summary"
        data-testid="home-command-summary"
        aria-labelledby="home-week-heading"
      >
        <div className="home-command-summary__top">
          <div>
            <span>今週</span>
            <h2 id="home-week-heading">
              {summary.dateLabel}・{summary.weekLabel}
            </h2>
          </div>
          <strong title={summary.schoolName}>{summary.schoolName}</strong>
        </div>

        {summary.official ? (
          <div
            className={`home-command-objective home-official-card${summary.official.due ? " is-due" : ""}`}
          >
            <div>
              <span>次の公式戦</span>
              <strong>{summary.official.competitionLabel}</strong>
              <small>{summary.official.detailLabel}</small>
            </div>
            <div className="home-command-objective__action">
              <b>{summary.official.timingLabel}</b>
              <button
                disabled={operationPending}
                onClick={() => onCommand({ target: "tournament" })}
                type="button"
              >
                大会表を見る
              </button>
            </div>
          </div>
        ) : null}

        <div
          className="home-command-summary__metrics"
          data-testid="home-team-status"
          aria-label="チーム状況"
        >
          <article>
            <span>戦力</span>
            <strong>{summary.strengthGrade}</strong>
            <small>{summary.strength}</small>
          </article>
          <article className={`player-condition--${summary.condition.colorToken}`}>
            <span>調子</span>
            <strong aria-label={summary.condition.label}>
              {summary.condition.icon}
            </strong>
            <small>{summary.condition.label}</small>
          </article>
          <article>
            <span>結束</span>
            <strong>{summary.cohesion}</strong>
            <small>
              {summary.cohesionTrend === "rising"
                ? "上向き"
                : summary.cohesionTrend === "falling"
                  ? "低下"
                  : "横ばい"}
            </small>
          </article>
        </div>
      </section>

      <section className="home-command-section" aria-labelledby="home-command-tasks-heading">
        <div className="home-command-section__heading">
          <div>
            <span>COACHING</span>
            <h3 id="home-command-tasks-heading">今週やること</h3>
          </div>
          <small>{model.tasks.length}件</small>
        </div>

        {model.tasks.length === 0 ? (
          <p className="home-command-empty">今週の準備は整っています</p>
        ) : (
          <div className="home-command-task-list">
            {model.tasks.map((task) => {
              if (task.kind === "action") {
                return actionTask(task, operationPending, onCommand);
              }
              return (
                <article
                  className="home-command-task home-command-task--critical home-command-task--offer"
                  data-testid="home-command-task"
                  key={task.id}
                  aria-label="練習試合の申し込み"
                >
                  <span className="home-command-task__badge">判断</span>
                  <div className="home-command-task__copy">
                    <strong>{task.title}</strong>
                    <small>
                      {task.offer.schoolName}
                      {task.offer.strength !== null
                        ? `・戦力 ${task.offer.strength} (${task.offer.strengthGrade})`
                        : ""}
                    </small>
                    <small>
                      成長 {task.offer.growthRating}/5・負荷 {task.offer.loadRating}/5
                    </small>
                  </div>
                  <div className="home-command-offer-actions">
                    <button
                      className="is-secondary"
                      disabled={operationPending}
                      onClick={onDeclinePracticeOffer}
                      type="button"
                    >
                      断る
                    </button>
                    <button
                      className="is-primary"
                      disabled={operationPending}
                      onClick={onAcceptPracticeOffer}
                      type="button"
                    >
                      受ける
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {model.news.length > 0 ? (
        <section
          className="home-command-section home-command-news home-notification-list"
          aria-labelledby="home-command-news-heading"
        >
          <div className="home-command-section__heading">
            <div>
              <span>NEWS</span>
              <h3 id="home-command-news-heading">最近の動き</h3>
            </div>
          </div>
          <div className="home-command-news-list">
            {model.news.map((news) => {
              if (news.kind === "training-result") {
                return (
                  <button
                    aria-label={`今週の練習結果 ${news.notification.payload.teamTrainingMenuName}`}
                    className="home-command-news-row"
                    data-testid="home-command-news"
                    key={news.id}
                    onClick={() => onOpenTrainingNotification(news.notification)}
                    type="button"
                  >
                    <span>
                      <strong>{news.title}</strong>
                      <small>{news.detail}</small>
                    </span>
                    <b aria-hidden="true">›</b>
                  </button>
                );
              }
              if (news.kind === "growth") {
                return (
                  <button
                    aria-label={`${news.title} ${news.detail}`}
                    className="home-command-news-row"
                    data-testid="home-command-news"
                    key={news.id}
                    onClick={() =>
                      onCommand({ target: "player", playerId: news.playerId })
                    }
                    type="button"
                  >
                    <span>
                      <strong>{news.title}</strong>
                      <small>{news.detail}</small>
                    </span>
                    <b aria-hidden="true">›</b>
                  </button>
                );
              }
              return (
                <article
                  className="home-command-news-row is-static"
                  data-testid="home-command-news"
                  key={news.id}
                >
                  <span>
                    <strong>{news.title}</strong>
                    <small>{news.detail}</small>
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
