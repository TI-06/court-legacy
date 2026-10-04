import { findCurrentTrainingCampActivity } from "../calendar/trainingCampCalendar";
import type { GameState } from "../model/GameState";
import { selectNextOfficialEvent } from "../tournament/tournamentSelectors";
import { selectFeaturedUserRival } from "../world/rivalryHistory";
import { selectSeasonStory, type SeasonStoryId } from "./seasonStory";

export type SeasonTurningPointId = "season-direction" | "pressure-moment";
export type SeasonTurningPointChoiceId =
  | "win-now"
  | "build-future"
  | "push"
  | "recover";

export interface SeasonTurningPointChoice {
  id: SeasonTurningPointChoiceId;
  label: string;
  detail: string;
}

export interface SeasonTurningPoint {
  id: SeasonTurningPointId;
  title: string;
  detail: string;
  contextLabel: string;
  choices: [SeasonTurningPointChoice, SeasonTurningPointChoice];
}

export class SeasonTurningPointError extends Error {
  constructor(
    public readonly reason: "unavailable" | "stale" | "invalid-choice",
  ) {
    super(
      reason === "invalid-choice"
        ? "この選択肢は利用できません"
        : "この重要判断は現在利用できません",
    );
    this.name = "SeasonTurningPointError";
  }
}

function completionId(
  state: GameState,
  turningPointId: SeasonTurningPointId,
): string {
  return `season-turning:${state.calendar.academicYear}:${turningPointId}`;
}

function completed(
  state: GameState,
  turningPointId: SeasonTurningPointId,
): boolean {
  return state.calendar.completedActivityIds.includes(
    completionId(state, turningPointId),
  );
}

function openingLabels(storyId: SeasonStoryId): {
  title: string;
  detail: string;
  first: SeasonTurningPointChoice;
  second: SeasonTurningPointChoice;
} {
  if (
    storyId === "title-defense" ||
    storyId === "golden-generation" ||
    storyId === "senior-window"
  ) {
    return {
      title: "今季の戦い方を決める",
      detail: "結果を取り切るか、次の世代にも経験を渡すかを決めます。",
      first: {
        id: "win-now",
        label: "主力で勝ちに行く",
        detail: "上級生の士気を上げる代わりに、チーム全体へ少し負荷がかかります。",
      },
      second: {
        id: "build-future",
        label: "次世代も育てる",
        detail: "1年生の信頼と士気を上げ、長期的なチーム作りを優先します。",
      },
    };
  }

  if (storyId === "rebuild" || storyId === "foundation") {
    return {
      title: "育成と結果の比重を決める",
      detail: "若手へ経験を渡すか、今いる主力で結果も追うかを決めます。",
      first: {
        id: "build-future",
        label: "若手に経験を渡す",
        detail: "1年生の信頼と士気、チームの結束を伸ばします。",
      },
      second: {
        id: "win-now",
        label: "結果も取りに行く",
        detail: "上級生の士気を上げる代わりに、練習強度が少し上がります。",
      },
    };
  }

  return {
    title: "全国へ向けた方針を決める",
    detail: "今季を勝負年として押し切るか、安定した成長を優先するかを決めます。",
    first: {
      id: "win-now",
      label: "勝負強度を上げる",
      detail: "上級生の士気を上げ、今季の結果を優先します。",
    },
    second: {
      id: "build-future",
      label: "土台を整える",
      detail: "若手の信頼とチーム結束を優先します。",
    },
  };
}

function openingTurningPoint(state: GameState): SeasonTurningPoint | null {
  if (
    completed(state, "season-direction") ||
    state.calendar.weekOfYear < 2 ||
    state.calendar.weekOfYear > 6
  ) {
    return null;
  }
  const story = selectSeasonStory(state);
  const labels = openingLabels(story.id);
  return {
    id: "season-direction",
    title: labels.title,
    detail: labels.detail,
    contextLabel: story.label,
    choices: [labels.first, labels.second],
  };
}

function pressureTurningPoint(state: GameState): SeasonTurningPoint | null {
  if (completed(state, "pressure-moment")) return null;

  const nextOfficial = selectNextOfficialEvent(state);
  if (nextOfficial?.kind === "match" && nextOfficial.timing === "due") {
    const featuredRival = selectFeaturedUserRival(state);
    const rivalMatch =
      featuredRival &&
      nextOfficial.opponent.schoolId === featuredRival.opponentSchoolId;
    const highPressureRound =
      nextOfficial.level === "national" ||
      nextOfficial.round === "semifinal" ||
      nextOfficial.round === "final";

    if (rivalMatch || highPressureRound) {
      return {
        id: "pressure-moment",
        title: rivalMatch ? "因縁の一戦をどう迎えるか" : "大一番の準備",
        detail: rivalMatch
          ? `${nextOfficial.opponent.shortName}との重要戦。熱量を上げるか、冷静に整えるかを決めます。`
          : `${nextOfficial.opponent.shortName}との${nextOfficial.level === "national" ? "全国大会" : "重要戦"}。最後の仕上げ方を決めます。`,
        contextLabel: rivalMatch ? "ライバル戦" : "公式戦",
        choices: [
          {
            id: "push",
            label: "勝負モードで押す",
            detail: "全員の士気を上げる代わりに、コンディションを少し消耗します。",
          },
          {
            id: "recover",
            label: "コンディション優先",
            detail: "状態と結束を整え、安定して試合へ入ります。",
          },
        ],
      };
    }
  }

  const camp = findCurrentTrainingCampActivity(state);
  if (camp && Number(camp.metadata.campPhase) === 1) {
    return {
      id: "pressure-moment",
      title: "合宿の強度を決める",
      detail: "ここで追い込むか、状態を整えながら完成度を上げるかを決めます。",
      contextLabel: camp.title,
      choices: [
        {
          id: "push",
          label: "追い込む",
          detail: "士気を高める代わりに、コンディションを少し消耗します。",
        },
        {
          id: "recover",
          label: "整えながら鍛える",
          detail: "コンディションと結束を優先します。",
        },
      ],
    };
  }

  return null;
}

export function selectSeasonTurningPoint(
  state: GameState,
): SeasonTurningPoint | null {
  return openingTurningPoint(state) ?? pressureTurningPoint(state);
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function adjustRoster(
  state: GameState,
  change: (player: GameState["players"][string]) => {
    morale?: number;
    trust?: number;
    condition?: number;
  },
): GameState {
  const school = state.schools[state.userSchoolId];
  if (!school) return state;

  const players = { ...state.players };
  for (const playerId of school.playerIds) {
    const player = state.players[playerId];
    if (!player) continue;
    const delta = change(player);
    players[playerId] = {
      ...player,
      morale: clamp100(player.morale + (delta.morale ?? 0)),
      trust: clamp100(player.trust + (delta.trust ?? 0)),
      condition: clamp100(player.condition + (delta.condition ?? 0)),
    };
  }
  return { ...state, players };
}

function adjustCohesion(state: GameState, delta: number): GameState {
  const before = state.teamDynamics.cohesion;
  const after = clamp100(before + delta);
  return {
    ...state,
    teamDynamics: {
      ...state.teamDynamics,
      previousCohesion: before,
      cohesion: after,
      cohesionTrend:
        after > before ? "rising" : after < before ? "falling" : "stable",
    },
  };
}

function applyChoiceEffect(
  state: GameState,
  choiceId: SeasonTurningPointChoiceId,
): GameState {
  if (choiceId === "win-now") {
    return adjustCohesion(
      adjustRoster(state, (player) => ({
        morale: player.grade === 3 ? 4 : 1,
        trust: player.grade === 3 ? 1 : 0,
        condition: -2,
      })),
      1,
    );
  }
  if (choiceId === "build-future") {
    return adjustCohesion(
      adjustRoster(state, (player) => ({
        morale: player.grade === 1 ? 2 : player.grade === 3 ? -1 : 0,
        trust: player.grade === 1 ? 4 : 0,
        condition: 1,
      })),
      2,
    );
  }
  if (choiceId === "push") {
    return adjustCohesion(
      adjustRoster(state, () => ({ morale: 3, condition: -3 })),
      1,
    );
  }
  return adjustCohesion(
    adjustRoster(state, () => ({ condition: 5 })),
    2,
  );
}

export function resolveSeasonTurningPoint(
  state: GameState,
  turningPointId: SeasonTurningPointId,
  choiceId: SeasonTurningPointChoiceId,
): GameState {
  const current = selectSeasonTurningPoint(state);
  if (!current) throw new SeasonTurningPointError("unavailable");
  if (current.id !== turningPointId) throw new SeasonTurningPointError("stale");
  if (!current.choices.some((choice) => choice.id === choiceId)) {
    throw new SeasonTurningPointError("invalid-choice");
  }

  const resolved = applyChoiceEffect(state, choiceId);
  return {
    ...resolved,
    calendar: {
      ...resolved.calendar,
      completedActivityIds: [
        ...resolved.calendar.completedActivityIds,
        completionId(resolved, turningPointId),
      ],
    },
  };
}
