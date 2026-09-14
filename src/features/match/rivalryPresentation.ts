import type { GameState } from "../../domain/model/GameState";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import type { SchoolId } from "../../domain/model/identifiers";
import { selectUserHeadToHead } from "../../domain/world/rivalryHistory";

const chipLabels = {
  "destiny-rival": "宿敵",
  rivalry: "因縁",
  nemesis: "天敵",
  revenge: "雪辱戦",
  "winning-streak": "連勝中",
  "losing-streak": "連敗中",
} as const;

export interface PreMatchRivalryPresentation {
  headline: string;
  recordLabel: string;
  previousResultLabel: string | null;
  chips: string[];
}

export function resolveLocalOpponentSchoolId(
  state: GameState,
  selection: TeamSelection,
): SchoolId | null {
  const playerIds = [
    ...selection.rotation.map((assignment) => assignment.playerId),
    ...(selection.liberoPlayerId ? [selection.liberoPlayerId] : []),
    ...selection.benchPlayerIds,
  ];
  const schoolIds = new Set(
    playerIds
      .map((playerId) => state.players[playerId]?.career.schoolId)
      .filter((schoolId): schoolId is SchoolId => Boolean(schoolId)),
  );
  if (schoolIds.size !== 1) return null;
  const [schoolId] = schoolIds;
  if (!schoolId || schoolId === state.userSchoolId || !state.schools[schoolId]) {
    return null;
  }
  return schoolId;
}

export function buildPreMatchRivalryPresentation(
  state: GameState,
  opponentSchoolId: SchoolId,
): PreMatchRivalryPresentation | null {
  if (!state.schools[opponentSchoolId]) return null;
  const summary = selectUserHeadToHead(state, opponentSchoolId);
  if (summary.totalMeetings === 0) return null;

  const opponent = state.schools[opponentSchoolId]!;
  const previous = summary.lastMeeting;
  const previousResultLabel = previous
    ? `前回 ${previous.result === "win" ? "勝利" : "敗戦"} ${previous.userSetsWon}-${previous.opponentSetsWon}`
    : null;
  const chips = summary.labels.slice(0, 3).map((label) => chipLabels[label]);
  const hasRivalIdentity = summary.labels.some(
    (label) => label === "destiny-rival" || label === "rivalry" || label === "nemesis",
  );

  return {
    headline: hasRivalIdentity ? `${opponent.shortName}との因縁` : "過去の対戦",
    recordLabel: `通算 ${summary.wins}勝${summary.losses}敗`,
    previousResultLabel,
    chips,
  };
}

export function buildPreMatchRivalryPresentationFromSelection(
  state: GameState,
  opponentSelection: TeamSelection,
): PreMatchRivalryPresentation | null {
  const opponentSchoolId = resolveLocalOpponentSchoolId(state, opponentSelection);
  return opponentSchoolId
    ? buildPreMatchRivalryPresentation(state, opponentSchoolId)
    : null;
}
