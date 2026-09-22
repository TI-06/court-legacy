import { useState } from "react";
import { BottomSheet } from "../../ui/BottomSheet";
import type {
  CharacterTraitDiscoveredNotification,
  DevelopmentGoalAchievementNotification,
  SeasonGoalAchievementNotification,
  SpecialRelationshipNotification,
  TrainingResultNotification,
} from "../../domain/notifications/gameNotifications";
import type {
  HomeCommandAction,
  HomeCommandCenterModel,
  HomeCommandPriority,
  HomeCommandTask,
} from "./homeCommandCenter";
import "./home-command-center.css";
import "./home-season-card.css";

interface HomeCommandCenterProps {
  model: HomeCommandCenterModel;
  operationPending: boolean;
  onCommand: (action: HomeCommandAction) => void;
  onAcceptPracticeOffer: () => void;
  onDeclinePracticeOffer: () => void;
  onOpenTrainingNotification: (
    notification: TrainingResultNotification,
  ) => void;
  onOpenRelationshipNotification: (
    notification: SpecialRelationshipNotification,
  ) => void;
  onOpenDevelopmentGoalAchievement: (
    notification: DevelopmentGoalAchievementNotification,
  ) => void;
  onOpenSeasonGoalAchievement: (
    notification: SeasonGoalAchievementNotification,
  ) => void;
  onAcknowledgeCharacterTraitNotification: (
    notification: CharacterTraitDiscoveredNotification,
  ) => void;
}

const priorityLabels: Record<HomeCommandPriority, string> = {
  critical: "重要",
  attention: "注意",
  normal: "今週",
  complete: "完了",
};

function rankMovementLabel(movement: number): string {
  if (movement > 0) return `▲${movement}`;
  if (movement < 0) return `▼${Math.abs(movement)}`;
  return "→0";
}

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
  onOpenRelationshipNotification,
  onOpenDevelopmentGoalAchievement,
  onOpenSeasonGoalAchievement,
  onAcknowledgeCharacterTraitNotification,
}: HomeCommandCenterProps) {
  const [tasksOpen, setTasksOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const { summary } = model;
  const visibleTasks = model.tasks.slice(0, 2);
  const visibleNews = model.news.slice(0, 1);

  const renderTask = (task: HomeCommandTask) => {
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
  };

  const renderNews = (news: HomeCommandCenterModel["news"][number]) => {
    if (news.kind === "training-result") {
      const unread = news.notification.readAtGameDate === null;
      return (
        <button
          aria-label={`今週の練習結果 ${news.notification.payload.teamTrainingMenuName}`}
          className={`home-command-news-row${unread ? " is-unread" : ""}`}
          data-testid="home-command-news"
          key={news.id}
          onClick={() => onOpenTrainingNotification(news.notification)}
          type="button"
        >
          <span>
            <strong>
              {unread ? "NEW" : "確認済み"} {news.title}
            </strong>
            <small>{news.detail}</small>
          </span>
          <b aria-hidden="true">›</b>
        </button>
      );
    }
    if (news.kind === "season-goal-achieved") {
      const unread = news.notification.readAtGameDate === null;
      return (
        <button
          aria-label={`${news.title} ${news.detail}`}
          className={`home-command-news-row${unread ? " is-unread" : ""}`}
          data-testid="home-command-news"
          key={news.id}
          onClick={() => onOpenSeasonGoalAchievement(news.notification)}
          type="button"
        >
          <span>
            <strong>{unread ? `NEW ${news.title}` : news.title}</strong>
            <small>{news.detail}</small>
          </span>
          <b aria-hidden="true">›</b>
        </button>
      );
    }
    if (news.kind === "development-goal-achieved") {
      const unread = news.notification.readAtGameDate === null;
      return (
        <button
          aria-label={`${news.title} ${news.detail}`}
          className={`home-command-news-row${unread ? " is-unread" : ""}`}
          data-testid="home-command-news"
          key={news.id}
          onClick={() => onOpenDevelopmentGoalAchievement(news.notification)}
          type="button"
        >
          <span>
            <strong>{unread ? `NEW ${news.title}` : news.title}</strong>
            <small>{news.detail}</small>
          </span>
          <b aria-hidden="true">›</b>
        </button>
      );
    }
    if (news.kind === "special-relationship") {
      const unread = news.notification.readAtGameDate === null;
      return (
        <button
          aria-label={`${news.title} ${news.detail}`}
          className={`home-command-news-row${unread ? " is-unread" : ""}`}
          data-testid="home-command-news"
          key={news.id}
          onClick={() => onOpenRelationshipNotification(news.notification)}
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
    if (news.kind === "character-trait-discovered") {
      const unread = news.notification.readAtGameDate === null;
      return (
        <button
          aria-label={`${news.title} ${news.detail}`}
          className={`home-command-news-row${unread ? " is-unread" : ""}`}
          data-testid="home-command-news"
          key={news.id}
          onClick={() =>
            onAcknowledgeCharacterTraitNotification(news.notification)
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
  };

  return (
    <div className="home-command-center" data-testid="home-command-center">
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

        <div className="home-command-summary__briefing">
          {summary.official ? (
            <div
              className={`home-command-objective home-official-card${summary.official.due ? " is-due" : ""}`}
            >
              <div>
                <span>次の公式戦</span>
                <strong>{summary.official.competitionLabel}</strong>
                <small title={summary.official.detailTitle ?? undefined}>
                  {summary.official.detailLabel}
                </small>
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

          {summary.featuredRival ? (
            <button
              aria-label={`注目ライバル ${summary.featuredRival.displayName} ${summary.featuredRival.recordLabel}`}
              className="home-featured-rival"
              disabled={operationPending}
              onClick={() => onCommand({ target: "school", view: "records" })}
              type="button"
            >
              <span>{summary.featuredRival.badge}</span>
              <strong>{summary.featuredRival.displayName}</strong>
              <small>
                {summary.featuredRival.recordLabel}・
                {summary.featuredRival.contextLabel}
              </small>
              <b aria-hidden="true">›</b>
            </button>
          ) : null}

          {summary.season ? (
            <section className="home-season-card" aria-label="今季目標">
              <div className="home-season-card__goal">
                <span>
                  今季目標・{summary.season.ambitionLabel}・残り報酬 +
                  {summary.season.remainingRewardFunds}
                </span>
                <strong>
                  {summary.season.primaryGoal?.label ?? "目標達成"}
                </strong>
                <small>
                  {summary.season.primaryGoal?.progressLabel ?? "全目標達成"}
                  {summary.season.primaryGoal
                    ? `・年度末 +${summary.season.primaryGoal.rewardFunds}`
                    : ""}
                  ・{summary.season.achievedCount}/{summary.season.goalCount}
                  達成
                </small>
              </div>
              <div className="home-season-card__ranks">
                <article>
                  <span>県内</span>
                  <strong>{summary.season.regional.rank}位</strong>
                  <small>
                    {rankMovementLabel(summary.season.regional.movement)}
                  </small>
                </article>
                <article>
                  <span>全国</span>
                  <strong>{summary.season.national.rank}位</strong>
                  <small>
                    {rankMovementLabel(summary.season.national.movement)}
                  </small>
                </article>
              </div>
              <button
                aria-label="今季の記録を見る"
                disabled={operationPending}
                onClick={() => onCommand({ target: "school", view: "records" })}
                type="button"
              >
                記録
              </button>
            </section>
          ) : null}
        </div>

        <section
          className="home-command-summary__metrics"
          data-testid="home-team-status"
          aria-label="チーム状況"
        >
          <article>
            <span>戦力</span>
            <strong>{summary.strengthGrade}</strong>
            <small>{summary.strength}</small>
          </article>
          <article
            className={`player-condition--${summary.condition.colorToken}`}
          >
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
        </section>
      </section>

      <section
        className="home-command-section home-command-section--tasks"
        aria-labelledby="home-command-tasks-heading"
      >
        <div className="home-command-section__heading">
          <div>
            <span>COACH DESK</span>
            <h3 id="home-command-tasks-heading">今週やること</h3>
          </div>
          <div className="home-command-section__heading-actions">
            <small>{model.tasks.length}件</small>
            {model.tasks.length > 2 ? (
              <button
                aria-label="やることをすべて見る"
                onClick={() => setTasksOpen(true)}
                type="button"
              >
                一覧
              </button>
            ) : null}
          </div>
        </div>

        {visibleTasks.length === 0 ? (
          <p className="home-command-empty">今週の準備は整っています</p>
        ) : (
          <div className="home-command-task-list">
            {visibleTasks.map(renderTask)}
          </div>
        )}
      </section>

      {visibleNews.length > 0 ? (
        <section
          className="home-command-section home-command-news home-notification-list"
          aria-labelledby="home-command-news-heading"
        >
          <div className="home-command-section__heading home-command-section__heading--news">
            <div>
              <span>NEWS</span>
              <h3 id="home-command-news-heading">最近の動き</h3>
            </div>
            {model.news.length > 1 ? (
              <button
                aria-label="ニュースをすべて見る"
                onClick={() => setNewsOpen(true)}
                type="button"
              >
                一覧
              </button>
            ) : null}
          </div>
          <div className="home-command-news-list">
            {visibleNews.map(renderNews)}
          </div>
        </section>
      ) : null}

      <BottomSheet
        description="優先度順に、今週確認したい項目をまとめています。"
        onClose={() => setTasksOpen(false)}
        open={tasksOpen}
        title="今週やること"
      >
        <div className="home-command-sheet-list">
          {model.tasks.map(renderTask)}
        </div>
      </BottomSheet>

      <BottomSheet
        description="練習・選手・試合などの最近の変化です。"
        onClose={() => setNewsOpen(false)}
        open={newsOpen}
        title="最近の動き"
      >
        <div className="home-command-sheet-list">
          {model.news.map(renderNews)}
        </div>
      </BottomSheet>
    </div>
  );
}
