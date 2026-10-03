import type { GameState } from "../model/GameState";
import type { PlayerTier } from "../model/Player";

export type SeasonStoryId =
  | "title-defense"
  | "golden-generation"
  | "senior-window"
  | "rebuild"
  | "national-chase"
  | "breakthrough"
  | "foundation";

export interface SeasonStory {
  id: SeasonStoryId;
  label: string;
  headline: string;
  detail: string;
  focusLabel: string;
}

const STAR_TIERS = new Set<PlayerTier>(["elite", "generational", "monster"]);

function previousNationalChampion(state: GameState): boolean {
  const previousAcademicYear = state.calendar.academicYear - 1;
  if (previousAcademicYear < 1) return false;

  return state.history.officialTournaments.some(
    (tournament) =>
      tournament.academicYear === previousAcademicYear &&
      tournament.level === "national" &&
      tournament.userResult.champion,
  );
}

export function selectSeasonStory(state: GameState): SeasonStory {
  const school = state.schools[state.userSchoolId];
  if (!school) {
    return {
      id: "foundation",
      label: "土台づくり",
      headline: "まずはチームの軸を作るシーズン",
      detail: "育成とスカウトを積み上げ、次の勝負年へつなげます。",
      focusLabel: "育成・スカウト",
    };
  }

  const roster = school.playerIds
    .map((playerId) => state.players[playerId])
    .filter((player) => player !== undefined);
  const firstYears = roster.filter((player) => player.grade === 1).length;
  const thirdYears = roster.filter((player) => player.grade === 3).length;
  const starPlayers = roster.filter((player) => STAR_TIERS.has(player.tier));
  const exceptionalPlayers = roster.filter(
    (player) => player.tier === "generational" || player.tier === "monster",
  );
  const startingRegionalRank = state.seasonGoals?.startingRanks.regional ?? 999;
  const startingNationalRank = state.seasonGoals?.startingRanks.national ?? 999;

  if (previousNationalChampion(state)) {
    return {
      id: "title-defense",
      label: "王者防衛",
      headline: "追われる立場で迎えるシーズン",
      detail: "前年の全国制覇を再現できるか。主力管理と勝負所の完成度が問われます。",
      focusLabel: "連覇・主力管理",
    };
  }

  if (exceptionalPlayers.length >= 1 || starPlayers.length >= 2) {
    return {
      id: "golden-generation",
      label: "黄金世代",
      headline: "特別な才能を結果へ変えるシーズン",
      detail: `注目級の選手が${starPlayers.length}名。全国で結果を残せる世代です。`,
      focusLabel: "全国・主力育成",
    };
  }

  if (thirdYears >= 6 && thirdYears >= firstYears + 2) {
    return {
      id: "senior-window",
      label: "集大成",
      headline: "3年生中心の勝負年",
      detail: `3年生が${thirdYears}名。今の主力で取れる結果を取りに行くシーズンです。`,
      focusLabel: "勝負・コンディション",
    };
  }

  if (firstYears >= 6 && firstYears >= thirdYears + 2) {
    return {
      id: "rebuild",
      label: "再構築",
      headline: "若い戦力を次の柱へ育てるシーズン",
      detail: `1年生が${firstYears}名。目先の結果と将来への投資を両立します。`,
      focusLabel: "育成・経験",
    };
  }

  if (startingNationalRank <= 16 || school.reputationPoints >= 850) {
    return {
      id: "national-chase",
      label: "全国上位挑戦",
      headline: "全国の壁を越えるシーズン",
      detail:
        startingNationalRank <= 16
          ? `全国${startingNationalRank}位スタート。上位定着を狙います。`
          : "全国常連として、さらに上の結果が求められるシーズンです。",
      focusLabel: "全国・分析",
    };
  }

  if (startingRegionalRank <= 4 || school.reputationPoints >= 400) {
    return {
      id: "breakthrough",
      label: "突破の年",
      headline: "県内上位から全国へ踏み出すシーズン",
      detail:
        startingRegionalRank <= 4
          ? `県内${startingRegionalRank}位スタート。全国出場が現実的な目標です。`
          : "県大会を勝ち切り、全国への扉を開く段階に来ています。",
      focusLabel: "県大会・戦術",
    };
  }

  return {
    id: "foundation",
    label: "土台づくり",
    headline: "チームの基礎を積み上げるシーズン",
    detail: "育成・設備・スカウトを整え、次の勝負年へつなげます。",
    focusLabel: "育成・基盤",
  };
}
