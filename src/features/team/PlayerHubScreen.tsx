import { useMemo, useState } from "react";
import { isWeeklyActionCompleted } from "../../domain/calendar/weekProgression";
import type {
  PlayerConcernCode,
  PlayerRole,
} from "../../domain/dynamics/teamDynamicsTypes";
import type { GameState } from "../../domain/model/GameState";
import type { Player, Position } from "../../domain/model/Player";
import type { TeamTactics } from "../../domain/model/School";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import type { PlayerId } from "../../domain/model/identifiers";
import {
  selectPlayerRelationships,
  specialRelationshipKindLabel,
} from "../../domain/relationships/relationshipPresentation";
import {
  deriveMatchTacticPlan,
  type MatchTacticPlan,
} from "../../domain/team/matchTactics";
import type {
  DevelopmentGoalArea,
  PlayerDevelopmentGoal,
  SavedLineupSlot,
} from "../../domain/team/teamPlanningTypes";
import {
  buildCoachTrainingRecommendations,
  coachRecommendationQuality,
  coachRecommendationQualityLabel,
} from "../../domain/training/coachTrainingRecommendations";
import type { IndividualTrainingAssignment } from "../../domain/training/resolveWeeklyTraining";
import { getPlayerConditionPresentation } from "../../domain/player/playerCondition";
import {
  developmentGoalAreaLabels,
  getPlayerDevelopmentGoalProgress,
  nextDevelopmentTargetGrade,
  playerDevelopmentAreaValue,
} from "../../domain/player/playerDevelopmentGoals";
import { getPlayerDevelopmentPresentation } from "../../domain/player/playerDevelopmentPresentation";
import { positionConversionWeeks } from "../../domain/player/positionConversion";
import { getPlayerPersonalityPresentation } from "../../domain/player/playerPersonalityPresentation";
import {
  getSpecialAbilityDefinition,
  type SpecialAbilityKind,
} from "../../domain/player/specialAbilities";
import {
  calculatePlayerDisplayPower,
  summarizePlayerAbilities,
} from "../../domain/selectors/playerPresentation";
import { ratingToGrade } from "../../domain/selectors/ratingGrades";
import {
  buildPlayerCareerPresentation,
  buildPlayerSeasonPresentation,
} from "./playerCareerPresentation";
import { buildTeamSeasonLeaderboard } from "./playerSeasonLeaderboard";
import { buildSchoolLegacyLeaderboard } from "./playerLegacyLeaderboard";
import type { GameDataRegistry } from "../../data/dataRegistry";
import { individualTrainingInstructions } from "../../data/individualTrainingInstructions";
import { BottomSheet } from "../../ui/BottomSheet";
import { MobileChoiceSheet } from "../../ui/MobileChoiceSheet";
import { StatBar } from "../../ui/theme/StatBar";
import { TeamDynamicsPanel } from "./TeamDynamicsPanel";
import { TeamScreen } from "./TeamScreen";
import { TeamTacticsPanel } from "./TeamTacticsPanel";
import {
  playerGrowthMomentumLabels,
  selectPlayerHubRoster,
  summarizePlayerGrowth,
  type PlayerHubFilter,
  type PlayerHubSort,
} from "./playerHubRoster";
import "./player-hub.css";
import "./player-special-abilities.css";

interface PlayerHubScreenProps {
  state: GameState;
  data: GameDataRegistry;
  selection: TeamSelection;
  onChange: (selection: TeamSelection) => void;
  onAssignLeadership: (
    captainPlayerId: PlayerId,
    viceCaptainPlayerId: PlayerId,
  ) => void | Promise<void>;
  initialPlayerId?: PlayerId | null;
  initialDetailMode?: PlayerDetailMode;
  leadershipPending?: boolean;
  trainingPending?: boolean;
  planningPending?: boolean;
  tacticsPending?: boolean;
  onSaveTrainingAssignments?: (
    assignments: IndividualTrainingAssignment[],
  ) => void | Promise<void>;
  onSetTeamTrainingMenu?: (teamTrainingMenuId: string) => void | Promise<void>;
  onSetDevelopmentPriorities?: (playerIds: PlayerId[]) => void | Promise<void>;
  onSetPlayerDevelopmentGoal?: (
    playerId: PlayerId,
    goal: PlayerDevelopmentGoal | null,
  ) => void | Promise<void>;
  onStartPositionConversion?: (
    playerId: PlayerId,
    targetPosition: Position,
  ) => void | Promise<void>;
  onCancelPositionConversion?: (playerId: PlayerId) => void | Promise<void>;
  onSetTeamTactics?: (plan: MatchTacticPlan) => void | Promise<void>;
  onSetTeamDefenseBias?: (
    defenseBias: TeamTactics["defenseBias"],
  ) => void | Promise<void>;
  onSaveLineupPreset?: (
    slot: SavedLineupSlot,
    name: string,
    selection: TeamSelection,
  ) => void | Promise<void>;
  onDeleteLineupPreset?: (slot: SavedLineupSlot) => void | Promise<void>;
}

type HubMode = "roster" | "lineup" | "dynamics" | "tactics";
export type PlayerDetailMode = "ability" | "growth" | "personality" | "record";

const abilityLabels = {
  attack: "攻撃",
  defense: "守備",
  jump: "跳躍",
  stamina: "スタミナ",
  mental: "メンタル",
} as const;

const rosterAbilityLabels = [
  ["attack", "攻"],
  ["defense", "守"],
  ["jump", "跳"],
  ["stamina", "ス"],
  ["mental", "メ"],
] as const;

const roleLabels: Record<PlayerRole, string> = {
  ace: "エース",
  starter: "先発",
  rotation: "ローテーション",
  development: "育成枠",
  reserve: "控え",
};

type CoachDevelopmentDirective = "position-specialist" | "all-rounder";

const positionSpecialistInstructionId: Record<Position, string> = {
  OH: "instruction.oh-specialist",
  MB: "instruction.mb-specialist",
  OP: "instruction.op-specialist",
  S: "instruction.s-specialist",
  L: "instruction.l-specialist",
};

const concernLabels: Record<PlayerConcernCode, string> = {
  "playing-time": "出場機会",
  "role-mismatch": "役割への不満",
  "injury-overuse": "怪我・起用負荷",
  "team-slump": "チーム不調",
};

const specialAbilityKindAriaLabels: Record<SpecialAbilityKind, string> = {
  positive: "プラス特殊能力",
  negative: "マイナス特殊能力",
  elite: "レア特殊能力",
  gold: "金特殊能力",
};

const specialAbilityKindShortLabels: Record<SpecialAbilityKind, string> = {
  positive: "N",
  negative: "NEG",
  elite: "R",
  gold: "SR",
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
  { value: "growth-attention", label: "成長要見直し" },
];

const sortOptions: ReadonlyArray<{ value: PlayerHubSort; label: string }> = [
  { value: "power", label: "総合力順" },
  { value: "potential", label: "将来性順" },
  { value: "condition", label: "調子順" },
  { value: "growth-4w", label: "直近4週の成長順" },
  { value: "growth-attention", label: "育成見直し順" },
  { value: "grade", label: "学年順" },
];

const playerName = (player: Player) => `${player.lastName} ${player.firstName}`;
const playerOverall = (player: Player) =>
  Math.round(calculatePlayerDisplayPower(player) / 100);
const growthLabel = (weeks: 4 | 12, value: number | null) =>
  `${weeks}週 ${value === null ? "--" : `+${value}`}`;
const compactGrowthLabel = (
  growth: ReturnType<typeof summarizePlayerGrowth>,
) =>
  growth.fourWeekGrowth === null
    ? "計測前"
    : `+${growth.fourWeekGrowth}・${playerGrowthMomentumLabels[growth.momentum]}`;

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
          ["roster", "選手"],
          ["lineup", "編成"],
          ["dynamics", "チーム"],
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

function PlayerDetailTabs({
  mode,
  onChange,
}: {
  mode: PlayerDetailMode;
  onChange: (mode: PlayerDetailMode) => void;
}) {
  return (
    <nav className="player-detail__tabs" aria-label="選手詳細の表示切替">
      {(
        [
          ["ability", "能力"],
          ["growth", "成長"],
          ["personality", "人物"],
          ["record", "成績"],
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
  data,
  selection,
  onChange,
  onAssignLeadership,
  initialPlayerId = null,
  initialDetailMode = "ability",
  leadershipPending = false,
  trainingPending = false,
  planningPending = false,
  tacticsPending = false,
  onSaveTrainingAssignments,
  onSetTeamTrainingMenu,
  onSetDevelopmentPriorities,
  onSetPlayerDevelopmentGoal,
  onStartPositionConversion,
  onCancelPositionConversion,
  onSetTeamTactics,
  onSetTeamDefenseBias,
  onSaveLineupPreset,
  onDeleteLineupPreset,
}: PlayerHubScreenProps) {
  const [mode, setMode] = useState<HubMode>("roster");
  const [detailMode, setDetailMode] =
    useState<PlayerDetailMode>(initialDetailMode);
  const [selectedPlayerId, setSelectedPlayerId] = useState<PlayerId | null>(
    initialPlayerId,
  );
  const [trainingPlayerId, setTrainingPlayerId] = useState<PlayerId | null>(
    null,
  );
  const [trainingDrafts, setTrainingDrafts] = useState<Record<string, string>>(
    {},
  );
  const [coachRecommendationsOpen, setCoachRecommendationsOpen] =
    useState(false);
  const [seasonStatsOpen, setSeasonStatsOpen] = useState(false);
  const [statsScope, setStatsScope] = useState<"season" | "legacy">("season");
  const [coachTargetPlayerIds, setCoachTargetPlayerIds] = useState<PlayerId[]>(
    [],
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
  const coachRecommendations = useMemo(
    () => buildCoachTrainingRecommendations(state),
    [state],
  );
  const seasonLeaderboard = useMemo(
    () => buildTeamSeasonLeaderboard(state),
    [state],
  );
  const legacyLeaderboard = useMemo(
    () => buildSchoolLegacyLeaderboard(state),
    [state],
  );
  const recommendationQuality = coachRecommendationQuality(state);
  const selectedPlayer = selectedPlayerId
    ? (state.players[selectedPlayerId] ?? null)
    : null;
  const trainingPlayer = trainingPlayerId
    ? (state.players[trainingPlayerId] ?? null)
    : null;
  const trainingPlayerAbilities = trainingPlayer
    ? summarizePlayerAbilities(trainingPlayer)
    : null;
  const trainingPlayerGrowth = trainingPlayer
    ? summarizePlayerGrowth(state, trainingPlayer.id)
    : null;
  const trainingDone = isWeeklyActionCompleted(state, "training");
  const priorityIds = state.teamPlanning.developmentPriorityPlayerIds;
  const priorityCapReached = priorityIds.length >= 3;

  const persistedInstructionId = (id: PlayerId) =>
    state.weeklySchedule.trainingPlan.individualAssignments.find(
      (candidate) => candidate.playerId === id,
    )?.instructionId ?? "instruction.overall";

  const effectiveInstructionId = (id: PlayerId) =>
    trainingDrafts[id] ?? persistedInstructionId(id);

  const assignmentName = (id: PlayerId) =>
    individualTrainingInstructions.find(
      (instruction) => instruction.id === effectiveInstructionId(id),
    )?.name ?? "全体";

  const trainingDraftCount = Object.keys(trainingDrafts).length;
  const coachTargetIdSet = useMemo(
    () => new Set(coachTargetPlayerIds),
    [coachTargetPlayerIds],
  );
  const coachRecommendationChangeCount = coachRecommendations.filter(
    (recommendation) =>
      coachTargetIdSet.has(recommendation.playerId) &&
      trainingDrafts[recommendation.playerId] === undefined &&
      recommendation.instructionId !==
        persistedInstructionId(recommendation.playerId),
  ).length;

  const stageTrainingAssignment = (
    playerId: PlayerId,
    instructionId: string,
  ) => {
    setTrainingDrafts((current) => {
      const next = { ...current };
      if (instructionId === persistedInstructionId(playerId)) {
        delete next[playerId];
      } else {
        next[playerId] = instructionId;
      }
      return next;
    });
  };

  const setCoachTargetGroup = (grade: 1 | 2 | 3 | "all" | "none") => {
    if (grade === "none") {
      setCoachTargetPlayerIds([]);
      return;
    }
    setCoachTargetPlayerIds(
      players
        .filter((player) => grade === "all" || player.grade === grade)
        .map((player) => player.id),
    );
  };

  const toggleCoachTarget = (playerId: PlayerId) => {
    setCoachTargetPlayerIds((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId],
    );
  };

  const openCoachRecommendations = () => {
    setCoachTargetPlayerIds(players.map((player) => player.id));
    setCoachRecommendationsOpen(true);
  };

  const stageCoachDirective = (directive: CoachDevelopmentDirective) => {
    if (trainingPending || trainingDone || coachTargetPlayerIds.length === 0) {
      return;
    }

    setTrainingDrafts((current) => {
      const next = { ...current };
      for (const player of players) {
        if (!coachTargetIdSet.has(player.id)) continue;
        const instructionId =
          directive === "all-rounder"
            ? "instruction.overall"
            : positionSpecialistInstructionId[player.preferredPosition];
        if (instructionId === persistedInstructionId(player.id)) {
          delete next[player.id];
        } else {
          next[player.id] = instructionId;
        }
      }
      return next;
    });
    setCoachRecommendationsOpen(false);
  };

  const stageCoachRecommendations = () => {
    if (trainingPending || trainingDone || coachTargetPlayerIds.length === 0) {
      return;
    }

    setTrainingDrafts((current) => {
      const next = { ...current };
      for (const recommendation of coachRecommendations) {
        if (!coachTargetIdSet.has(recommendation.playerId)) continue;
        if (current[recommendation.playerId] !== undefined) continue;
        if (
          recommendation.instructionId ===
          persistedInstructionId(recommendation.playerId)
        ) {
          continue;
        }
        next[recommendation.playerId] = recommendation.instructionId;
      }
      return next;
    });
    setCoachRecommendationsOpen(false);
  };

  const saveTrainingDrafts = async () => {
    if (
      trainingDraftCount === 0 ||
      trainingPending ||
      trainingDone ||
      !onSaveTrainingAssignments
    ) {
      return;
    }

    const changedPlayerIds = new Set(Object.keys(trainingDrafts));
    const assignments: IndividualTrainingAssignment[] = [
      ...state.weeklySchedule.trainingPlan.individualAssignments.filter(
        (assignment) => !changedPlayerIds.has(String(assignment.playerId)),
      ),
      ...Object.entries(trainingDrafts).map(([playerId, instructionId]) => ({
        playerId: playerId as PlayerId,
        instructionId,
      })),
    ];

    await onSaveTrainingAssignments(assignments);
    setTrainingDrafts({});
  };

  const trainingSaveBar =
    trainingDraftCount > 0 ? (
      <aside
        aria-label="個人練習の未保存変更"
        className="player-training-save-bar"
      >
        <div>
          <span>個人練習</span>
          <strong>{trainingDraftCount}人変更中</strong>
        </div>
        <button
          disabled={trainingPending || trainingDone}
          onClick={() => void saveTrainingDrafts()}
          type="button"
        >
          {trainingPending
            ? "保存中…"
            : `まとめて保存（${trainingDraftCount}人）`}
        </button>
      </aside>
    ) : null;

  const trainingSheet = (
    <BottomSheet
      description="選択内容はまだ保存されません。全選手を調整してからまとめて保存できます。"
      onClose={() => setTrainingPlayerId(null)}
      open={Boolean(trainingPlayer)}
      title={
        trainingPlayer ? `${playerName(trainingPlayer)}の個人練習` : "個人練習"
      }
    >
      {trainingPlayer && trainingPlayerAbilities && trainingPlayerGrowth ? (
        <section
          aria-label="個人練習の判断材料"
          className="player-training-context"
        >
          <div className="player-training-context__summary">
            <span>直近4週</span>
            <strong>{compactGrowthLabel(trainingPlayerGrowth)}</strong>
            <small>
              現在 {assignmentName(trainingPlayer.id)}
              {trainingDrafts[trainingPlayer.id] ? "・未保存" : ""}
            </small>
          </div>
          <div
            aria-label={`${playerName(trainingPlayer)} 能力と4週成長`}
            className="player-training-context__abilities"
          >
            {rosterAbilityLabels.map(([key, label]) => {
              const growth =
                trainingPlayerGrowth.fourWeekAbilityGrowth?.[key] ?? null;
              return (
                <span
                  aria-label={`${abilityLabels[key]} ${ratingToGrade(
                    trainingPlayerAbilities[key],
                  )} 4週成長 ${growth === null ? "未計測" : `+${growth}`}`}
                  key={key}
                >
                  <small>{label}</small>
                  <strong>{ratingToGrade(trainingPlayerAbilities[key])}</strong>
                  <b>{growth === null ? "--" : `+${growth}`}</b>
                </span>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="player-training-options">
        {individualTrainingInstructions
          .filter((item) => !item.tags.includes("coach-only"))
          .map((item) => {
            const selected =
              trainingPlayer !== null &&
              effectiveInstructionId(trainingPlayer.id) === item.id;
            return (
              <button
                aria-pressed={selected}
                className={
                  selected ? "player-training-option--selected" : undefined
                }
                disabled={trainingPending || trainingDone}
                key={item.id}
                onClick={() => {
                  if (trainingPlayer) {
                    stageTrainingAssignment(trainingPlayer.id, item.id);
                  }
                  setTrainingPlayerId(null);
                }}
                type="button"
              >
                <strong>{item.name}</strong>
                <small>{item.description}</small>
              </button>
            );
          })}
      </div>
    </BottomSheet>
  );

  const coachRecommendationSheet = (
    <BottomSheet
      className="player-coach-proposal-sheet"
      description={`監督育成力 ${school.coach.development}・${coachRecommendationQualityLabel(
        recommendationQuality,
      )}。育成目標、調子、年間コーチ、弱点の順に判断します。`}
      onClose={() => setCoachRecommendationsOpen(false)}
      open={coachRecommendationsOpen}
      title="コーチの個人練習提案"
    >
      <div className="player-coach-proposal">
        <section
          aria-label="コーチ育成方針"
          className="player-coach-proposal__directives"
        >
          <div>
            <strong>育成方針を指示</strong>
            <small>下で選んだ選手だけ個人練習をまとめて設定</small>
          </div>
          <div
            aria-label="コーチ育成方針を選択"
            className="player-coach-proposal__directive-options"
            role="group"
          >
            <button
              disabled={
                trainingPending ||
                trainingDone ||
                coachTargetPlayerIds.length === 0
              }
              onClick={() => stageCoachDirective("position-specialist")}
              type="button"
            >
              <strong>ポジション特化</strong>
              <small>役割に必要な能力を重点育成</small>
            </button>
            <button
              disabled={
                trainingPending ||
                trainingDone ||
                coachTargetPlayerIds.length === 0
              }
              onClick={() => stageCoachDirective("all-rounder")}
              type="button"
            >
              <strong>オールラウンダー</strong>
              <small>全能力をバランス育成</small>
            </button>
          </div>
          <p>特化能力が上限に達した選手は、自動で全体育成へ切り替わります。</p>
        </section>

        <section
          aria-label="提案を反映する選手"
          className="player-coach-proposal__targets"
        >
          <div className="player-coach-proposal__targets-heading">
            <strong>反映する選手</strong>
            <span>{coachTargetPlayerIds.length}人選択中</span>
          </div>
          <div
            aria-label="反映対象を学年で選択"
            className="player-coach-proposal__target-groups"
            role="group"
          >
            <button
              aria-pressed={coachTargetPlayerIds.length === players.length}
              onClick={() => setCoachTargetGroup("all")}
              type="button"
            >
              全員
            </button>
            {([1, 2, 3] as const).map((grade) => {
              const gradeIds = players
                .filter((player) => player.grade === grade)
                .map((player) => player.id);
              const allSelected =
                gradeIds.length > 0 &&
                gradeIds.every((playerId) => coachTargetIdSet.has(playerId));
              return (
                <button
                  aria-pressed={allSelected}
                  key={grade}
                  onClick={() => setCoachTargetGroup(grade)}
                  type="button"
                >
                  {grade}年
                </button>
              );
            })}
            <button
              aria-pressed={coachTargetPlayerIds.length === 0}
              onClick={() => setCoachTargetGroup("none")}
              type="button"
            >
              解除
            </button>
          </div>
          <small>下の選手をタップすると1人ずつ追加・解除できます。</small>
        </section>

        <div className="player-coach-proposal__summary">
          <strong>{coachRecommendationChangeCount}人を変更提案</strong>
          <span>手動で変更中の選手は上書きしません</span>
        </div>
        <div
          aria-label="コーチの練習提案一覧"
          className="player-coach-proposal__list"
        >
          {coachRecommendations.map((recommendation) => {
            const player = state.players[recommendation.playerId];
            if (!player) return null;
            const currentInstruction = assignmentName(recommendation.playerId);
            const changed =
              recommendation.instructionId !==
              effectiveInstructionId(recommendation.playerId);
            const selected = coachTargetIdSet.has(recommendation.playerId);
            return (
              <button
                aria-label={`${playerName(player)}を反映対象${
                  selected ? "から外す" : "に追加"
                }`}
                aria-pressed={selected}
                className={`player-coach-proposal__row${
                  changed ? " player-coach-proposal__row--changed" : ""
                }${selected ? " player-coach-proposal__row--selected" : ""}`}
                key={recommendation.playerId}
                onClick={() => toggleCoachTarget(recommendation.playerId)}
                type="button"
              >
                <div>
                  <strong>{playerName(player)}</strong>
                  <small>
                    {player.grade}年・{player.preferredPosition}・
                    {recommendation.reasonLabel}
                  </small>
                </div>
                <span>
                  {currentInstruction}
                  {changed ? ` → ${recommendation.instructionName}` : " 維持"}
                </span>
              </button>
            );
          })}
        </div>
        <button
          className="player-coach-proposal__apply"
          disabled={
            coachTargetPlayerIds.length === 0 ||
            coachRecommendationChangeCount === 0 ||
            trainingPending ||
            trainingDone
          }
          onClick={stageCoachRecommendations}
          type="button"
        >
          {trainingDone
            ? "今週の練習は実施済み"
            : `提案をセット（${coachRecommendationChangeCount}人）`}
        </button>
      </div>
    </BottomSheet>
  );
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
          onSetTeamTrainingMenu={onSetTeamTrainingMenu}
          pending={leadershipPending}
          state={state}
          trainingPending={trainingPending}
        />
      </main>
    );
  }

  if (mode === "tactics") {
    return (
      <main className="app-content player-hub">
        <HubTabs mode={mode} onChange={setMode} />
        <TeamTacticsPanel
          currentDefenseBias={school.tactics.defenseBias}
          currentPlan={deriveMatchTacticPlan(school.tactics)}
          onSave={(plan) => void onSetTeamTactics?.(plan)}
          onSaveDefenseBias={(defenseBias) =>
            void onSetTeamDefenseBias?.(defenseBias)
          }
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
    const personalityDefinition = data.personalities.get(
      selectedPlayer.personalityId,
    );
    const personality = personalityDefinition
      ? getPlayerPersonalityPresentation(personalityDefinition)
      : null;
    const growth = summarizePlayerGrowth(state, selectedPlayer.id);
    const relationships = selectPlayerRelationships(state, selectedPlayer.id);
    const revealedCharacterTraits = (
      selectedPlayer.revealedHiddenTraitIds ?? []
    )
      .map((traitId) => data.characterTraits.get(traitId))
      .filter((trait) => trait !== undefined);
    const specialAbilities = (selectedPlayer.specialAbilityIds ?? [])
      .map((abilityId) => getSpecialAbilityDefinition(abilityId))
      .filter((ability) => ability !== undefined);
    const maxTrendGrowth = Math.max(
      1,
      ...growth.trend12.map((point) => point.totalAbilityGrowth),
    );
    const selectedIsPriority = priorityIds.includes(selectedPlayer.id);
    const selectedGoal =
      state.teamPlanning.developmentGoalsByPlayerId?.[selectedPlayer.id] ??
      null;
    const selectedGoalProgress = selectedGoal
      ? getPlayerDevelopmentGoalProgress(selectedPlayer, selectedGoal)
      : null;
    const developmentGoalAreas = Object.keys(
      developmentGoalAreaLabels,
    ) as DevelopmentGoalArea[];
    const positionOptions = ["OH", "MB", "OP", "S", "L"] as const;
    const activeConversion = selectedPlayer.positionConversion;
    const seasonStats = buildPlayerSeasonPresentation(
      selectedPlayer,
      state.calendar.academicYear,
    );
    const career = buildPlayerCareerPresentation(selectedPlayer);

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

        <PlayerDetailTabs mode={detailMode} onChange={setDetailMode} />

        {detailMode === "ability" ? (
          <div
            className="player-detail__tab-panel"
            data-testid="player-detail-ability"
          >
            <section
              className="player-detail__quick-actions"
              aria-label="選手設定"
            >
              <button
                aria-label={
                  selectedIsPriority
                    ? `重点育成から外す ${playerName(selectedPlayer)}`
                    : `重点育成に追加 ${playerName(selectedPlayer)}`
                }
                className={`player-priority-chip player-priority-chip--detail${selectedIsPriority ? " player-priority-chip--active" : ""}`}
                disabled={
                  planningPending || (!selectedIsPriority && priorityCapReached)
                }
                onClick={() => togglePriority(selectedPlayer.id)}
                type="button"
              >
                <span>重点育成</span>
                <strong>{selectedIsPriority ? "設定中" : "設定する"}</strong>
              </button>
              <button
                aria-label={`${playerName(selectedPlayer)} 個人練習 ${assignmentName(selectedPlayer.id)}`}
                className="player-training-chip player-training-chip--detail"
                disabled={trainingPending || trainingDone}
                onClick={() => setTrainingPlayerId(selectedPlayer.id)}
                type="button"
              >
                <span>個人練習</span>
                <strong>{assignmentName(selectedPlayer.id)}</strong>
              </button>
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

            <section
              className="player-detail__special-abilities"
              aria-label="特殊能力"
            >
              <div className="player-detail__special-abilities-heading">
                <h3>特殊能力</h3>
                <span>{specialAbilities.length}個</span>
              </div>
              {specialAbilities.length > 0 ? (
                <div className="player-detail__special-ability-list">
                  {specialAbilities.map((ability) => (
                    <article
                      aria-label={`${ability.name} ${specialAbilityKindAriaLabels[ability.kind]}`}
                      className="player-special-ability"
                      data-kind={ability.kind}
                      key={ability.id}
                    >
                      <div className="player-special-ability__heading">
                        <strong>{ability.name}</strong>
                      </div>
                      <small>{ability.description}</small>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="player-detail__special-ability-empty">
                  まだ特殊能力はありません
                </p>
              )}
            </section>
          </div>
        ) : null}

        {detailMode === "growth" ? (
          <div
            className="player-detail__tab-panel"
            data-testid="player-detail-growth"
          >
            <section className="player-development-goal" aria-label="育成目標">
              <div className="player-development-goal__heading">
                <div>
                  <span>育成目標</span>
                  <strong>
                    {selectedGoalProgress
                      ? `${selectedGoalProgress.areaLabel} ${selectedGoalProgress.currentGrade} → ${selectedGoalProgress.targetGrade}`
                      : "未設定"}
                  </strong>
                </div>
                {selectedGoalProgress ? (
                  <span
                    className={
                      selectedGoalProgress.achieved
                        ? "player-development-goal__status player-development-goal__status--done"
                        : "player-development-goal__status"
                    }
                  >
                    {selectedGoalProgress.achieved ? "達成" : "育成中"}
                  </span>
                ) : null}
              </div>
              <div
                className="player-development-goal__choices"
                aria-label="伸ばす能力を選択"
              >
                {developmentGoalAreas.map((area) => {
                  const currentValue = playerDevelopmentAreaValue(
                    selectedPlayer,
                    area,
                  );
                  const currentGrade = ratingToGrade(currentValue);
                  const targetGrade = nextDevelopmentTargetGrade(
                    selectedPlayer,
                    area,
                  );
                  const selected = selectedGoal?.area === area;
                  const maxed = currentGrade === "A";

                  return (
                    <button
                      aria-pressed={selected}
                      className={
                        selected
                          ? "player-development-goal__choice player-development-goal__choice--selected"
                          : "player-development-goal__choice"
                      }
                      disabled={planningPending || maxed}
                      key={area}
                      onClick={() =>
                        void onSetPlayerDevelopmentGoal?.(selectedPlayer.id, {
                          area,
                          targetGrade,
                        })
                      }
                      type="button"
                    >
                      <span>{developmentGoalAreaLabels[area]}</span>
                      <strong>
                        {maxed ? "A・最高" : `${currentGrade} → ${targetGrade}`}
                      </strong>
                    </button>
                  );
                })}
              </div>
              {selectedGoal ? (
                <button
                  className="player-development-goal__clear"
                  disabled={planningPending}
                  onClick={() =>
                    void onSetPlayerDevelopmentGoal?.(selectedPlayer.id, null)
                  }
                  type="button"
                >
                  目標を解除
                </button>
              ) : (
                <p>次に伸ばしたい能力を選ぶと、次ランクを目標に設定します。</p>
              )}
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
              className="player-position-conversion"
              aria-label="ポジション転向"
            >
              <div className="player-position-conversion__heading">
                <div>
                  <span>ポジション転向</span>
                  <strong>
                    {activeConversion
                      ? `${activeConversion.fromPosition} → ${activeConversion.targetPosition}`
                      : `現在 ${selectedPlayer.preferredPosition}`}
                  </strong>
                </div>
                {activeConversion ? (
                  <b>
                    残り{activeConversion.remainingWeeks}/
                    {activeConversion.totalWeeks}週
                  </b>
                ) : null}
              </div>
              {activeConversion ? (
                <>
                  <div className="player-position-conversion__progress">
                    <span
                      style={{
                        width: `${Math.round(
                          ((activeConversion.totalWeeks -
                            activeConversion.remainingWeeks) /
                            activeConversion.totalWeeks) *
                            100,
                        )}%`,
                      }}
                    />
                  </div>
                  <p>
                    {activeConversion.targetPosition}適性{" "}
                    {
                      selectedPlayer.positionAptitudes[
                        activeConversion.targetPosition
                      ]
                    }{" "}
                    {ratingToGrade(
                      selectedPlayer.positionAptitudes[
                        activeConversion.targetPosition
                      ],
                    )}
                    。週進行ごとに適性が上がり、完了時に本職が切り替わります。
                  </p>
                  <button
                    className="player-position-conversion__cancel"
                    disabled={planningPending}
                    onClick={() =>
                      void onCancelPositionConversion?.(selectedPlayer.id)
                    }
                    type="button"
                  >
                    転向を中止
                  </button>
                </>
              ) : (
                <>
                  <div className="player-position-conversion__choices">
                    {positionOptions
                      .filter(
                        (position) =>
                          position !== selectedPlayer.preferredPosition,
                      )
                      .map((position) => {
                        const weeks = positionConversionWeeks(
                          selectedPlayer,
                          position,
                        );
                        const aptitude =
                          selectedPlayer.positionAptitudes[position];
                        return (
                          <button
                            disabled={planningPending}
                            key={position}
                            onClick={() =>
                              void onStartPositionConversion?.(
                                selectedPlayer.id,
                                position,
                              )
                            }
                            type="button"
                          >
                            <strong>{position}</strong>
                            <span>
                              適性 {aptitude} {ratingToGrade(aptitude)}
                            </span>
                            <small>目安 {weeks}週</small>
                          </button>
                        );
                      })}
                  </div>
                  <p>
                    現在の適性が高いほど短期間です。転向型の選手はさらに短縮されます。
                  </p>
                </>
              )}
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
              <div
                className="player-detail__growth-momentum"
                data-momentum={growth.momentum}
              >
                <span>成長ペース</span>
                <strong>{playerGrowthMomentumLabels[growth.momentum]}</strong>
                <small>
                  直近4週{" "}
                  {growth.fourWeekGrowth === null
                    ? "--"
                    : `+${growth.fourWeekGrowth}`}
                  {" / "}
                  前4週{" "}
                  {growth.previousFourWeekGrowth === null
                    ? "--"
                    : `+${growth.previousFourWeekGrowth}`}
                </small>
              </div>
              {growth.trend12.length === 0 ? (
                <p className="player-detail__growth-empty">
                  成長履歴はまだありません
                </p>
              ) : (
                <div
                  className="player-growth-trend"
                  aria-label="直近の成長推移"
                >
                  {growth.trend12.map((point, index) => {
                    const percent = Math.max(
                      8,
                      Math.round(
                        (point.totalAbilityGrowth / maxTrendGrowth) * 100,
                      ),
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
          </div>
        ) : null}

        {detailMode === "record" ? (
          <div
            className="player-detail__tab-panel"
            data-testid="player-detail-record"
          >
            <section
              className="player-season-record"
              aria-label="今季公式戦成績"
            >
              <div className="player-career-record__heading">
                <div>
                  <span>THIS SEASON</span>
                  <h3>{seasonStats.academicYear}年度</h3>
                </div>
                <small>公式戦のみ集計</small>
              </div>
              <div className="player-season-record__grid">
                <article>
                  <span>出場</span>
                  <strong>{seasonStats.appearances}</strong>
                </article>
                <article>
                  <span>得点</span>
                  <strong>{seasonStats.points}</strong>
                </article>
                <article>
                  <span>ブロック</span>
                  <strong>{seasonStats.blocks}</strong>
                </article>
                <article>
                  <span>ACE</span>
                  <strong>{seasonStats.serviceAces}</strong>
                </article>
                <article>
                  <span>ATT</span>
                  <strong>
                    {seasonStats.attackAttempts >= 5
                      ? `${seasonStats.attackSuccessRate}%`
                      : "--"}
                  </strong>
                </article>
                <article>
                  <span>REC</span>
                  <strong>
                    {seasonStats.receiveAttempts >= 5
                      ? `${seasonStats.perfectReceiveRate}%`
                      : "--"}
                  </strong>
                </article>
              </div>
            </section>

            <section
              className="player-career-record"
              aria-label="公式戦キャリア成績"
            >
              <div className="player-career-record__heading">
                <div>
                  <span>CAREER RECORD</span>
                  <h3>公式戦キャリア</h3>
                </div>
                <small>公式戦のみ集計</small>
              </div>

              <div className="player-career-record__primary">
                <article>
                  <span>出場</span>
                  <strong>{career.appearances}</strong>
                  <small>試合</small>
                </article>
                <article>
                  <span>得点</span>
                  <strong>{career.points}</strong>
                  <small>通算</small>
                </article>
                <article>
                  <span>平均得点</span>
                  <strong>{career.pointsPerAppearance.toFixed(1)}</strong>
                  <small>1試合</small>
                </article>
              </div>

              <div className="player-career-record__secondary">
                <article>
                  <span>セット出場</span>
                  <strong>{career.setsPlayed}</strong>
                </article>
                <article>
                  <span>ブロック</span>
                  <strong>{career.blocks}</strong>
                </article>
                <article>
                  <span>サービスエース</span>
                  <strong>{career.serviceAces}</strong>
                </article>
              </div>

              <div className="player-career-record__legacy">
                <article>
                  <span>最高大会成績</span>
                  <strong>{career.bestTournamentResultLabel}</strong>
                </article>
                <article>
                  <span>主将経験</span>
                  <strong>{career.captainSeasons}シーズン</strong>
                </article>
                <article>
                  <span>表彰</span>
                  <strong>{career.awardCount}件</strong>
                </article>
              </div>
            </section>
          </div>
        ) : null}

        {detailMode === "personality" ? (
          <div
            className="player-detail__tab-panel"
            data-testid="player-detail-personality"
          >
            {personality ? (
              <section className="player-detail__personality" aria-label="性格">
                <div className="player-detail__personality-heading">
                  <h3>性格</h3>
                  <strong>{personality.name}</strong>
                </div>
                <p>{personality.description}</p>
                <div
                  className="player-detail__personality-tendencies"
                  aria-label="性格の傾向"
                >
                  <span>練習 {personality.trainingStability}</span>
                  <span>関係構築 {personality.relationshipBuilding}</span>
                  <span>プレッシャー {personality.pressureResponse}</span>
                  <span>士気 {personality.moraleVolatility}</span>
                </div>
              </section>
            ) : null}

            {revealedCharacterTraits.length > 0 ? (
              <section
                className="player-detail__character-traits"
                aria-label="発見した個性"
              >
                <div className="player-detail__character-traits-heading">
                  <h3>発見した個性</h3>
                  <span>{revealedCharacterTraits.length}件</span>
                </div>
                <div className="player-detail__character-trait-list">
                  {revealedCharacterTraits.map((trait) => (
                    <article key={trait.id}>
                      <strong>{trait.name}</strong>
                      <p>{trait.description}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            <section
              className="player-detail__relationships"
              aria-label="人間関係"
            >
              <div className="player-detail__relationships-heading">
                <h3>人間関係</h3>
                <span>{relationships.length}人</span>
              </div>
              <div className="player-detail__relationship-list">
                {relationships.map((relationship) => (
                  <article
                    className="player-detail__relationship-row"
                    key={relationship.playerId}
                  >
                    <div className="player-detail__relationship-copy">
                      <strong>{relationship.displayName}</strong>
                      <small>{relationship.label}</small>
                    </div>
                    {relationship.specialKinds.length > 0 ? (
                      <div
                        className="player-detail__relationship-tags"
                        aria-label="特殊関係"
                      >
                        {relationship.specialKinds.map((kind) => (
                          <span key={kind}>
                            {specialRelationshipKindLabel(kind)}
                          </span>
                        ))}
                        {relationship.mentorDirection ? (
                          <small>
                            {relationship.mentorDirection === "mentor"
                              ? "教える側"
                              : "教わる側"}
                          </small>
                        ) : null}
                      </div>
                    ) : null}
                    <span
                      aria-label={`関係値 ${relationship.score}`}
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={relationship.score}
                      className="player-detail__relationship-meter"
                      role="meter"
                    >
                      <span
                        className="player-detail__relationship-meter-fill"
                        style={{ width: `${relationship.score}%` }}
                      />
                    </span>
                  </article>
                ))}
              </div>
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
          </div>
        ) : null}

        {trainingSaveBar}
        {trainingSheet}
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
        <MobileChoiceSheet
          ariaLabel="選手絞り込み"
          label="絞り込み"
          layout="grid"
          onChange={setFilter}
          options={filterOptions}
          title="表示する選手"
          value={filter}
        />
        <MobileChoiceSheet
          ariaLabel="並び替え"
          label="並び替え"
          onChange={setSort}
          options={sortOptions}
          title="並び順"
          value={sort}
        />
        <button
          aria-label="コーチの個人練習提案"
          className="player-hub__coach-proposal"
          disabled={trainingPending || trainingDone}
          onClick={openCoachRecommendations}
          type="button"
        >
          <span>COACH</span>
          <strong>練習提案</strong>
          <small>
            {coachRecommendationQualityLabel(recommendationQuality)}
          </small>
        </button>
        <button
          aria-label="今季の公式戦成績"
          className="player-hub__season-stats"
          onClick={() => {
            setStatsScope("season");
            setSeasonStatsOpen(true);
          }}
          type="button"
        >
          <span>SEASON</span>
          <strong>今季成績</strong>
          <small>
            {seasonLeaderboard.hasOfficialStats
              ? `延べ出場 ${seasonLeaderboard.totalAppearances}`
              : "公式戦前"}
          </small>
        </button>
      </section>

      <div className="player-roster">
        {rosterItems.length === 0 ? (
          <p className="player-roster__empty">条件に該当する選手はいません</p>
        ) : null}
        {rosterItems.map((item, index) => {
          const player = item.player;
          const condition = getPlayerConditionPresentation(player.condition);
          const abilities = summarizePlayerAbilities(player);
          const isPriority = item.isPriority;
          const isCaptain = state.teamDynamics.captainPlayerId === player.id;
          const potentialGrade =
            item.potential === null ? null : ratingToGrade(item.potential);
          const growthType = data.growthTypes.get(player.growthTypeId);
          const trainingDraft = Boolean(trainingDrafts[player.id]);
          const specialAbilityCounts = (player.specialAbilityIds ?? []).reduce<
            Record<SpecialAbilityKind, number>
          >(
            (counts, abilityId) => {
              const ability = getSpecialAbilityDefinition(abilityId);
              if (ability) counts[ability.kind] += 1;
              return counts;
            },
            { positive: 0, negative: 0, elite: 0, gold: 0 },
          );
          const hasSpecialAbilitySummary = Object.values(
            specialAbilityCounts,
          ).some((count) => count > 0);

          return (
            <article
              className="player-roster__row player-roster__row--compact"
              data-testid="roster-player-row"
              key={player.id}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (
                  target.closest(
                    "button, a, input, select, textarea, [role='button']",
                  )
                ) {
                  return;
                }
                setDetailMode("ability");
                setSelectedPlayerId(player.id);
              }}
            >
              <div className="player-roster__main">
                <span className="player-roster__number">{index + 1}</span>
                <span className="player-roster__name">
                  <button
                    aria-label={`選手詳細 ${playerName(player)}`}
                    className="player-roster__detail-link"
                    onClick={() => {
                      setDetailMode("ability");
                      setSelectedPlayerId(player.id);
                    }}
                    type="button"
                  >
                    <strong>{playerName(player)}</strong>
                  </button>
                  <span className="player-roster__meta">
                    <small>
                      {player.grade}年・{player.preferredPosition}
                    </small>
                    {player.tier === "generational" ? (
                      <span className="player-roster__info-badge player-roster__info-badge--genius">
                        天才
                      </span>
                    ) : null}
                    {potentialGrade ? (
                      <span className="player-roster__info-badge">
                        将来性{potentialGrade}
                      </span>
                    ) : null}
                    {growthType ? (
                      <span className="player-roster__info-badge">
                        {growthType.name}
                      </span>
                    ) : null}
                    {hasSpecialAbilitySummary ? (
                      <span
                        aria-label={`${playerName(player)} 特殊能力サマリー`}
                        className="player-roster__special-summary"
                      >
                        {(
                          ["positive", "negative", "elite", "gold"] as const
                        ).map((kind) =>
                          specialAbilityCounts[kind] > 0 ? (
                            <b data-kind={kind} key={kind}>
                              {specialAbilityKindShortLabels[kind]}
                              {specialAbilityCounts[kind]}
                            </b>
                          ) : null,
                        )}
                      </span>
                    ) : null}
                    <span className="player-roster__status-badges">
                      {isCaptain ? (
                        <span className="player-roster__status-badge">
                          主将
                        </span>
                      ) : null}
                      {item.isInjured ? (
                        <span className="player-roster__status-badge player-roster__status-badge--danger">
                          怪我
                        </span>
                      ) : null}
                      {state.teamPlanning.developmentGoalsByPlayerId?.[
                        player.id
                      ] ? (
                        <span className="player-roster__status-badge">
                          目標
                        </span>
                      ) : null}
                      {player.positionConversion ? (
                        <span className="player-roster__status-badge player-roster__status-badge--conversion">
                          {player.positionConversion.targetPosition}転向
                          {player.positionConversion.remainingWeeks}週
                        </span>
                      ) : null}
                    </span>
                    <button
                      aria-label={
                        isPriority
                          ? `重点育成から外す ${playerName(player)}`
                          : `重点育成に追加 ${playerName(player)}`
                      }
                      className={`player-roster__priority-action${
                        isPriority
                          ? " player-roster__priority-action--active"
                          : ""
                      }`}
                      disabled={
                        planningPending || (!isPriority && priorityCapReached)
                      }
                      onClick={() => togglePriority(player.id)}
                      title={
                        !isPriority && priorityCapReached
                          ? "重点育成は3名まで"
                          : undefined
                      }
                      type="button"
                    >
                      <span aria-hidden="true">{isPriority ? "★" : "☆"}</span>
                      <strong>重点</strong>
                    </button>
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
              </div>
              <div
                aria-label={`${playerName(player)} 能力ランク`}
                className="player-roster__abilities"
              >
                {rosterAbilityLabels.map(([key, label]) => {
                  const grade = ratingToGrade(abilities[key]);
                  return (
                    <span
                      aria-label={`${abilityLabels[key]} ${grade}`}
                      data-grade={grade}
                      key={key}
                    >
                      <small>{label}</small>
                      <strong>{grade}</strong>
                    </span>
                  );
                })}
                <button
                  aria-label={`${playerName(player)} 個人練習 ${assignmentName(player.id)}`}
                  className="player-roster__training-action"
                  data-draft={trainingDraft ? "true" : undefined}
                  data-momentum={
                    trainingDone || trainingDraft
                      ? undefined
                      : item.growth.momentum
                  }
                  disabled={trainingPending || trainingDone}
                  onClick={() => setTrainingPlayerId(player.id)}
                  title={compactGrowthLabel(item.growth)}
                  type="button"
                >
                  <small>練習</small>
                  <strong>{assignmentName(player.id)}</strong>
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <BottomSheet
        className="player-season-leaderboard-sheet"
        description={
          statsScope === "season"
            ? "今季の公式戦だけを集計します。選手をタップすると個人成績を開きます。"
            : "現役と卒業生の公式戦キャリア記録から歴代上位を表示します。"
        }
        onClose={() => setSeasonStatsOpen(false)}
        open={seasonStatsOpen}
        title={
          statsScope === "season"
            ? `${seasonLeaderboard.academicYear}年度 今季成績`
            : "学校歴代記録"
        }
      >
        <nav className="player-stats-scope" aria-label="成績ランキング切替">
          <button
            aria-pressed={statsScope === "season"}
            onClick={() => setStatsScope("season")}
            type="button"
          >
            今季
          </button>
          <button
            aria-pressed={statsScope === "legacy"}
            onClick={() => setStatsScope("legacy")}
            type="button"
          >
            歴代
          </button>
        </nav>

        {statsScope === "season" ? (
        <section
          aria-label="今季公式戦ランキング"
          className="player-season-leaderboard"
        >
          {!seasonLeaderboard.hasOfficialStats ? (
            <p className="player-season-leaderboard__empty">
              今季の公式戦成績はまだありません
            </p>
          ) : (
            seasonLeaderboard.sections.map((section) => (
              <section key={section.id}>
                <div className="player-season-leaderboard__heading">
                  <strong>{section.label}</strong>
                  {section.id === "attack-rate" ||
                  section.id === "receive-rate" ? (
                    <small>5回以上で集計</small>
                  ) : null}
                </div>
                {section.rows.length > 0 ? (
                  <div className="player-season-leaderboard__rows">
                    {section.rows.map((row, index) => (
                      <button
                        key={row.playerId}
                        onClick={() => {
                          setSeasonStatsOpen(false);
                          setDetailMode("record");
                          setSelectedPlayerId(row.playerId);
                        }}
                        type="button"
                      >
                        <b>{index + 1}</b>
                        <span>
                          <strong>{row.displayName}</strong>
                          <small>{row.position}</small>
                        </span>
                        <em>{row.valueLabel}</em>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="player-season-leaderboard__no-sample">
                    集計対象なし
                  </p>
                )}
              </section>
            ))
          )}
        </section>
        ) : (
          <section
            aria-label="学校歴代ランキング"
            className="player-season-leaderboard player-legacy-leaderboard"
          >
            {!legacyLeaderboard.hasRecords ? (
              <p className="player-season-leaderboard__empty">
                公式戦の歴代記録はまだありません
              </p>
            ) : (
              legacyLeaderboard.sections.map((section) => (
                <section key={section.id}>
                  <div className="player-season-leaderboard__heading">
                    <strong>{section.label}</strong>
                    <small>歴代TOP5</small>
                  </div>
                  <div className="player-season-leaderboard__rows">
                    {section.rows.map((row, index) => (
                      <button
                        disabled={!row.active}
                        key={`${section.id}-${row.playerId}`}
                        onClick={() => {
                          if (!row.active) return;
                          setSeasonStatsOpen(false);
                          setDetailMode("record");
                          setSelectedPlayerId(row.playerId);
                        }}
                        type="button"
                      >
                        <b>{index + 1}</b>
                        <span>
                          <strong>{row.displayName}</strong>
                          <small>
                            {row.position}・{row.statusLabel}
                          </small>
                        </span>
                        <em>{row.valueLabel}</em>
                      </button>
                    ))}
                  </div>
                </section>
              ))
            )}
          </section>
        )}
      </BottomSheet>

      {trainingSaveBar}
      {trainingSheet}
      {coachRecommendationSheet}
    </main>
  );
}
