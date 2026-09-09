import { useMemo, useState } from "react";
import { isWeeklyActionCompleted } from "../../domain/calendar/weekProgression";
import type {
  PlayerConcernCode,
  PlayerRole,
} from "../../domain/dynamics/teamDynamicsTypes";
import type { GameState } from "../../domain/model/GameState";
import type { Player } from "../../domain/model/Player";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import type { PlayerId } from "../../domain/model/identifiers";
import {
  deriveMatchTacticPlan,
  type MatchTacticPlan,
} from "../../domain/team/matchTactics";
import type { SavedLineupSlot } from "../../domain/team/teamPlanningTypes";
import { getPlayerConditionPresentation } from "../../domain/player/playerCondition";
import { getPlayerDevelopmentPresentation } from "../../domain/player/playerDevelopmentPresentation";
import {
  calculatePlayerDisplayPower,
  summarizePlayerAbilities,
} from "../../domain/selectors/playerPresentation";
import { ratingToGrade } from "../../domain/selectors/ratingGrades";
import { individualTrainingInstructions } from "../../data/individualTrainingInstructions";
import { BottomSheet } from "../../ui/BottomSheet";
import { StatBar } from "../../ui/theme/StatBar";
import { TeamDynamicsPanel } from "./TeamDynamicsPanel";
import { TeamScreen } from "./TeamScreen";
import { TeamTacticsPanel } from "./TeamTacticsPanel";
import { TeamTacticsPanel } from "./TeamTacticsPanel";
import {
  selectPlayerHubRoster,
  summarizePlayerGrowth,
  type PlayerHubFilter,
  type PlayerHubSort,
} from "./playerHubRoster";
import "./player-hub.css";

interface PlayerHubScreenProps {
  state: GameState;
  selection: TeamSelection;
  onChange: (selection: TeamSelection) => void;
  onAssignLeadership: (
    captainPlayerId: PlayerId,
    viceCaptainPlayerId: PlayerId,
  ) => void | Promise<void>;
  initialPlayerId?: PlayerId | null;
  leadershipPending?: boolean;
  trainingPending?: boolean;
  planningPending?: boolean;
  tacticsPending?: boolean;
  onChangeTraining?: (
    playerId: PlayerId,
    instructionId: string,
  ) => void | Promise<void>;
  onSetDevelopmentPriorities?: (playerIds: PlayerId[]) => void | Promise<void>;
  onSetTeamTactics?: (plan: MatchTacticPlan) => void | Promise<void>;
  onSaveLineupPreset?: (
    slot: SavedLineupSlot,
    name: string,
    selection: TeamSelection,
  ) => void | Promise<void>;
  onDeleteLineupPreset?: (slot: SavedLineupSlot) => void | Promise<void>;
}

type HubMode = "roster" | "lineup" | "dynamics" | "tactics";

const abilityLabels = {
  attack: "攻撃",
  defense: "守備",
  jump: "跳躍",
  stamina: "スタミナ",
  mental: "メンタル",
} as const;

const roleLabels: Record<PlayerRole, string> = {
  ace: "エース",
  starter: "先発",
  rotation: "ローテーション",
  development: "育成枠",
  reserve: "控え",
};

const concernLabels: Record<PlayerConcernCode, string> = {
  "playing-time": "出場機会",
  "role-mismatch": "役割への不満",
  "injury-overuse": "怪我・起用負荷",
  "team-slump": "チーム不調",
};

const filterOptions: ReadonlyArray<{
  value: PlayerHubFilter;
  label: string;
}> = [
  { value: "all", label: "全員" },
  { value: "grade-1", label: "1年" },
  { value: "grade-2", label: "2年" },
  { value: "grade-3", label: "3年" },
  { value: "position-OH", label: "OH" },
  { value: "position-MB", label: "MB" },
  { value: "position-OP", label: "OP" },
  { value: "position-S", label: "S" },
  { value: "position-L", label: "L" },
  { value: "starter", label: "スタメン" },
  { value: "bench", label: "控え" },
  { value: "priority", label: "重点育成" },
  { value: "injured", label: "怪我中" },
];

const sortOptions: ReadonlyArray<{ value: PlayerHubSort; label: string }> = [
  { value: "power", label: "総合力順" },
  { value: "potential", label: "将来性順" },
  { value: "condition", label: "調子順" },
  { value: "growth-4w", label: "直近4週の成長順" },
  { value: "grade", label: "学年順" },
];

const playerName = (player: Player) => `${player.lastName} ${player.firstName}`;
const playerOverall = (player: Player) =>
  Math.round(calculatePlayerDisplayPower(player) / 100);
const growthLabel = (weeks: 4 | 12, value: number | null) =>
  `${weeks}週 ${value === null ? "--" : `+${value}`}`;

function HubTabs({
  mode,
  onChange,
}: {
  mode: HubMode;
  onChange: (mode: HubMode) => void;
}) {
  return (
    <nav className="player-hub__tabs" aria-label="選手画面の表示切替">
      {(
        [
          ["roster", "選手一覧"],
          ["lineup", "編成"],
          ["dynamics", "チーム状態"],
          ["tactics", "戦術"],
        ] as const
      ).map(([id, label]) => (
        <button
          aria-current={mode === id ? "page" : undefined}
          key={id}
          onClick={() => onChange(id)}
          type="button"
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

export function PlayerHubScreen({
  state,
  selection,
  onChange,
  onAssignLeadership,
  initialPlayerId = null,
  leadershipPending = false,
  trainingPending = false,
  planningPending = false,
  tacticsPending = false,
  onChangeTraining,
  onSetDevelopmentPriorities,
  onSetTeamTactics,
  onSaveLineupPreset,
  onDeleteLineupPreset,
}: PlayerHubScreenProps) {
  const [mode, setMode] = useState<HubMode>("roster");
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(
    initialPlayerId,
  );
  const [trainingPlayerId, setTrainingPlayerId] = useState<PlayerId | null>(
    null,
  );
  const [filter, setFilter] = useState<PlayerHubFilter>("all");
  const [sort, setSort] = useState<PlayerHubSort>("power");

  const school = state.schools[state.userSchoolId]!;
  const players = useMemo(
    () =>
      school.playerIds
        .map((id) => state.players[id])
        .filter((player): player is Player => Boolean(player)),
    [school.playerIds, state.players],
  );
  const rosterItems = useMemo(
    () => selectPlayerHubRoster({ state, selection, filter, sort }),
    [state, selection, filter, sort],
  );
  const selectedPlayer = selectedPlayerId
    ? (state.players[selectedPlayerId] ?? null)
    : null;
  const trainingPlayer = trainingPlayerId
    ? (state.players[trainingPlayerId] ?? null)
    : null;
  const trainingDone = isWeeklyActionCompleted(state, "training");
  const priorityIds = state.teamPlanning.developmentPriorityPlayerIds;

  const assignmentName = (id: PlayerId) => {
    const assignment =
      state.weeklySchedule.trainingPlan.individualAssignments.find(
        (candidate) => candidate.playerId === id,
      );
    return (
      individualTrainingInstructions.find(
        (instruction) =>
          instruction.id ===
          (assignment?.instructionId ?? "instruction.overall"),
      )?.name ?? "全体"
    );
  };

  const togglePriority = (playerId: PlayerId) => {
    const selected = priorityIds.includes(playerId);
    const nextIds = selected
      ? priorityIds.filter((id) => id !== playerId)
      : [...priorityIds, playerId];
    if (!selected && nextIds.length > 3) return;
    void onSetDevelopmentPriorities?.(nextIds);
  };

  if (mode === "lineup") {
    return (
      <div className="player-hub">
        <HubTabs mode={mode} onChange={setMode} />
        <TeamScreen
          onChange={onChange}
          onDeleteLineupPreset={onDeleteLineupPreset}
          onSaveLineupPreset={onSaveLineupPreset}
          pending={planningPending}
          planningPending={planningPending}
          selection={selection}
          state={state}
        />
      </div>
    );
  }

  if (mode === "dynamics") {
    return (
      <main className="app-content player-hub">
        <HubTabs mode={mode} onChange={setMode} />
        <TeamDynamicsPanel
          onAssignLeadership={onAssignLeadership}
          pending={leadershipPending}
          state={state}
        />
      </main>
    );
  }

  if (mode === "tactics") {
    return (
      <main className="app-content player-hub">
        <HubTabs mode={mode} onChange={setMode} />
        <TeamTacticsPanel
          currentPlan={deriveMatchTacticPlan(school.tactics)}
          onSave={(plan) => void onSetTeamTactics?.(plan)}
          pending={tacticsPending}
        />
      </main>
    );
  }

  if (mode === "tactics") {
    return (
      <main className="app-content player-hub">
        <HubTabs mode={mode} onChange={setMode} />
        <TeamTacticsPanel
          currentPlan={deriveMatchTacticPlan(school.tactics)}
          onSave={(plan) => void onSetTeamTactics?.(plan)}
          pending={tacticsPending}
        />
      </main>
    );
  }

  if (selectedPlayer) {
    const abilities = summarizePlayerAbilities(selectedPlayer);
    const role = state.teamDynamics.playerRoles[selectedPlayer.id] ?? "reserve";
    const concerns = state.teamDynamics.playerConcerns[selectedPlayer.id] ?? [];
    const condition = getPlayerConditionPresentation(selectedPlayer.condition);
    const development = getPlayerDevelopmentPresentation(selectedPlayer);
    const growth = summarizePlayerGrowth(state, selectedPlayer.id);
    const maxTrendGrowth = Math.max(
      1,
      ...growth.trend12.map((point) => point.totalAbilityGrowth),
    );

    return (
      <main className="app-content player-hub player-detail">
        <button
          aria-label="選手一覧へ戻る"
          className="player-detail__back"
          onClick={() => setSelectedPlayerId(null)}
          type="button"
        >
          ‹ 選手一覧
        </button>

        <section className="player-detail__summary">
          <div className="player-detail__identity">
            <h2>{playerName(selectedPlayer)}</h2>
            <span>
              {selectedPlayer.grade}年・{selectedPlayer.preferredPosition}・
              {selectedPlayer.heightCm}cm
            </span>
          </div>
          <div className="player-detail__power">
            <span>総合力</span>
            <strong>{playerOverall(selectedPlayer)}</strong>
          </div>
        </section>

        <section
          className="player-detail__development"
          aria-label="成長タイプと才能"
        >
          <article>
            <span>成長タイプ</span>
            <strong>{development.growthLabel}</strong>
            <small>{development.growthDescription}</small>
          </article>
          <article>
            <span>才能</span>
            <strong>{development.talentLabel}</strong>
            <small>
              {development.potential === null
                ? "将来性は未判定"
                : `将来性 ${development.potentialGrade}・${development.potential}`}
            </small>
          </article>
        </section>

        <section
          className="player-detail__growth-summary"
          aria-label="最近の成長"
        >
          <div className="player-detail__growth-heading">
            <h3>最近の成長</h3>
            <span>{growth.observedWeeks12}週記録</span>
          </div>
          <div className="player-detail__growth-metrics">
            <strong>{growthLabel(4, growth.fourWeekGrowth)}</strong>
            <strong>{growthLabel(12, growth.twelveWeekGrowth)}</strong>
          </div>
          {growth.trend12.length === 0 ? (
            <p className="player-detail__growth-empty">
              成長履歴はまだありません
            </p>
          ) : (
            <div className="player-growth-trend" aria-label="直近の成長推移">
              {growth.trend12.map((point, index) => {
                const percent = Math.max(
                  8,
                  Math.round((point.totalAbilityGrowth / maxTrendGrowth) * 100),
                );
                return (
                  <span
                    aria-label={`${point.gameDate} 成長 +${point.totalAbilityGrowth}`}
                    className="player-growth-trend__bar"
                    data-growth={point.totalAbilityGrowth}
                    data-testid="player-growth-trend-bar"
                    key={`${point.gameDate}:${index}`}
                    style={{ height: `${percent}%` }}
                  />
                );
              })}
            </div>
          )}
        </section>

        <section className="player-detail__stats" aria-label="選手能力">
          {Object.entries(abilities).map(([key, value]) => (
            <StatBar
              key={key}
              label={abilityLabels[key as keyof typeof abilityLabels]}
              tone="accent"
              value={value}
              valueLabel={ratingToGrade(value)}
            />
          ))}
        </section>

        <section className="player-detail__metrics" aria-label="選手状態">
          <article
            className={`player-condition player-condition--${condition.colorToken}`}
          >
            <span>調子</span>
            <strong>
              {condition.icon} {condition.label}
            </strong>
          </article>
          <article>
            <span>士気</span>
            <strong>{selectedPlayer.morale}</strong>
          </article>
          <article>
            <span>役割</span>
            <strong>{roleLabels[role]}</strong>
          </article>
          <article>
            <span>信頼</span>
            <strong>{selectedPlayer.trust}</strong>
          </article>
        </section>

        {concerns.length ? (
          <section
            className="player-detail__concerns"
            aria-label="選手の気になる状態"
          >
            <h3>気になる状態</h3>
            <ul>
              {concerns.map((concern, index) => (
                <li key={`${concern.code}:${index}`}>
                  {concernLabels[concern.code]}・重要度 {concern.severity}/3
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    );
  }

  return (
    <main className="app-content player-hub">
      <HubTabs mode={mode} onChange={setMode} />

      <section className="player-hub__heading">
        <div>
          <p className="section-kicker">登録選手</p>
          <h2>選手一覧</h2>
        </div>
        <span>
          表示 {rosterItems.length} / 全 {players.length}人
        </span>
      </section>

      <section className="player-hub__controls" aria-label="選手一覧の表示設定">
        <label>
          <span>絞り込み</span>
          <select
            aria-label="選手絞り込み"
            onChange={(event) =>
              setFilter(event.currentTarget.value as PlayerHubFilter)
            }
            value={filter}
          >
            {filterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>並び替え</span>
          <select
            aria-label="並び替え"
            onChange={(event) =>
              setSort(event.currentTarget.value as PlayerHubSort)
            }
            value={sort}
          >
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <div className="player-roster">
        {rosterItems.length === 0 ? (
          <p className="player-roster__empty">条件に該当する選手はいません</p>
        ) : null}
        {rosterItems.map((item, index) => {
          const player = item.player;
          const condition = getPlayerConditionPresentation(player.condition);
          const development = getPlayerDevelopmentPresentation(player);
          const training = assignmentName(player.id);
          const isPriority = item.isPriority;
          const priorityCapReached = priorityIds.length >= 3;

          return (
            <article
              className="player-roster__row"
              data-testid="roster-player-row"
              key={player.id}
            >
              <button
                aria-label={`選手詳細 ${playerName(player)}`}
                className="player-roster__main"
                onClick={() => setSelectedPlayerId(player.id)}
                type="button"
              >
                <span className="player-roster__number">{index + 1}</span>
                <span className="player-roster__name">
                  <strong>{playerName(player)}</strong>
                  <small>
                    {player.grade}年・{player.preferredPosition}・
                    {player.heightCm}cm
                  </small>
                  <span className="player-roster__growth">
                    {development.growthLabel}・{development.talentLabel}
                  </span>
                </span>
                <span
                  className={`player-roster__condition player-condition--${condition.colorToken}`}
                  title={condition.label}
                >
                  <b aria-hidden="true">{condition.icon}</b>
                  <small>{condition.label}</small>
                </span>
                <span className="player-roster__overall">
                  <small>総合</small>
                  <strong>{playerOverall(player)}</strong>
                </span>
              </button>

              <div className="player-roster__actions">
                <span className="player-roster__recent-growth">
                  {growthLabel(4, item.growth.fourWeekGrowth)}
                </span>
                <button
                  aria-label={
                    isPriority
                      ? `重点育成から外す ${playerName(player)}`
                      : `重点育成に追加 ${playerName(player)}`
                  }
                  className={`player-priority-chip${isPriority ? " player-priority-chip--active" : ""}`}
                  disabled={
                    planningPending || (!isPriority && priorityCapReached)
                  }
                  onClick={() => togglePriority(player.id)}
                  type="button"
                >
                  {isPriority ? "重点解除" : "重点"}
                </button>
                <button
                  aria-label={`${playerName(player)} 練習 ${training}`}
                  className="player-training-chip"
                  disabled={trainingPending || trainingDone}
                  onClick={() => setTrainingPlayerId(player.id)}
                  type="button"
                >
                  {training}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <BottomSheet
        open={Boolean(trainingPlayer)}
        onClose={() => setTrainingPlayerId(null)}
        title={
          trainingPlayer
            ? `${playerName(trainingPlayer)}の個人練習`
            : "個人練習"
        }
        description="今週の練習を選択"
      >
        <div className="player-training-options">
          {individualTrainingInstructions.map((item) => (
            <button
              key={item.id}
              disabled={trainingPending || trainingDone}
              onClick={() => {
                if (trainingPlayer) {
                  void onChangeTraining?.(trainingPlayer.id, item.id);
                }
                setTrainingPlayerId(null);
              }}
              type="button"
            >
              <strong>{item.name}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </div>
      </BottomSheet>
    </main>
  );
}
