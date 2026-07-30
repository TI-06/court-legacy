import type { GameDataRegistry } from "../../data/dataRegistry";
import type { EventMemory } from "../model/Event";
import {
  CURRENT_GAME_SCHEMA_VERSION,
  createDefaultGameSettings,
  createEmptyGameHistory,
  relationshipKey,
  type GameState,
} from "../model/GameState";
import type { Player } from "../model/Player";
import type { School, UniformColors } from "../model/School";
import type { PlayerId, SchoolId } from "../model/identifiers";
import { playerId, schoolId } from "../model/identifiers";
import { SeededRandom, type RandomSource } from "../random/SeededRandom";
import { weightedChoice } from "../random/weightedChoice";
import { generateInitialSquad, generatePlayer } from "./generatePlayer";
import { generateSchool } from "./generateSchool";

export interface UserSchoolSetup {
  name: string;
  shortName: string;
  regionId: string;
  coachName: string;
  uniform: UniformColors;
}

export interface GenerateWorldInput {
  seed: string;
  userSchool: UserSchoolSetup;
  data: GameDataRegistry;
}

export interface AssignGenerationalTalentInput {
  state: GameState;
  academicYear: number;
  random: RandomSource;
  data: GameDataRegistry;
}

export interface GenerationalTalentAssignment {
  schoolId: SchoolId;
  player: Player;
  nextGenerationalTalentYear: number;
}

const RIVAL_SCHOOLS: ReadonlyArray<{
  shortName: string;
  fullName: string;
}> = [
  { shortName: "青凪", fullName: "青凪高校" },
  { shortName: "白峰", fullName: "白峰学園" },
  { shortName: "黒潮", fullName: "黒潮高校" },
  { shortName: "東央", fullName: "東央学院" },
  { shortName: "皇星", fullName: "皇星高校" },
  { shortName: "鉄壁", fullName: "鉄壁工業" },
  { shortName: "南島", fullName: "南島商業" },
  { shortName: "北辰", fullName: "北辰高校" },
  { shortName: "蒼陵", fullName: "蒼陵学園" },
  { shortName: "緑川", fullName: "緑川高校" },
  { shortName: "紅葉", fullName: "紅葉学院" },
  { shortName: "明星", fullName: "明星高校" },
  { shortName: "海鳴", fullName: "海鳴工業" },
  { shortName: "天城", fullName: "天城高校" },
  { shortName: "春嶺", fullName: "春嶺学園" },
  { shortName: "光ヶ丘", fullName: "光ヶ丘高校" },
  { shortName: "桜台", fullName: "桜台高校" },
  { shortName: "城南", fullName: "城南商業" },
  { shortName: "港西", fullName: "港西高校" },
  { shortName: "瑞穂", fullName: "瑞穂学院" },
];

const COACH_NAMES = [
  "石田 監督",
  "小野 監督",
  "長谷川 監督",
  "宮本 監督",
  "上村 監督",
  "新城 監督",
  "神谷 監督",
  "平良 監督",
  "高田 監督",
  "前島 監督",
  "黒木 監督",
  "白石 監督",
  "中原 監督",
  "大浦 監督",
  "川島 監督",
] as const;

const RIVAL_UNIFORMS: ReadonlyArray<UniformColors> = [
  { primary: "#244B76", secondary: "#F3F6F8", accent: "#C69232" },
  { primary: "#6C2438", secondary: "#F7F4F1", accent: "#D4A03A" },
  { primary: "#202A35", secondary: "#E8EEF1", accent: "#3C8995" },
  { primary: "#2E6152", secondary: "#F1F5F0", accent: "#C7892B" },
  { primary: "#5A3D77", secondary: "#F5F2F8", accent: "#D09A34" },
  { primary: "#553831", secondary: "#F4F0EC", accent: "#A9533D" },
  { primary: "#1F6978", secondary: "#F3F6F6", accent: "#D79B32" },
  { primary: "#31405D", secondary: "#F0F3F7", accent: "#B76541" },
  { primary: "#3D5268", secondary: "#F1F4F5", accent: "#B98730" },
  { primary: "#42613D", secondary: "#F4F5EF", accent: "#D0A13C" },
  { primary: "#713B30", secondary: "#F6F1ED", accent: "#C5842F" },
  { primary: "#315D75", secondary: "#EEF4F6", accent: "#BE7935" },
  { primary: "#245D6C", secondary: "#EFF5F5", accent: "#D6A035" },
  { primary: "#48496D", secondary: "#F2F2F7", accent: "#C49534" },
  { primary: "#3B5B4B", secondary: "#F2F5F2", accent: "#B87534" },
];

function createEmptyEventMemory(): EventMemory {
  return {
    lastOccurredDateByEventId: {},
    occurrenceCountByEventId: {},
    occurredCareerKeys: [],
    recentEventIds: [],
    recentCategoryIds: [],
    recentPrimaryActorPlayerIds: [],
    scheduledFollowUps: [],
    history: [],
  };
}

function selectRivalSchools(
  userSchool: UserSchoolSetup,
  random: RandomSource,
): Array<{ shortName: string; fullName: string }> {
  const candidates = RIVAL_SCHOOLS.filter(
    (candidate) =>
      candidate.shortName !== userSchool.shortName &&
      candidate.fullName !== userSchool.name,
  );
  const selected: Array<{ shortName: string; fullName: string }> = [];

  while (selected.length < 15) {
    const index = random.int(0, candidates.length - 1);
    const [candidate] = candidates.splice(index, 1);
    if (!candidate) {
      throw new Error("not enough unique rival school definitions");
    }
    selected.push(candidate);
  }

  return selected;
}

function nextPlayerNumber(state: GameState): number {
  return (
    Math.max(
      0,
      ...Object.keys(state.players).map((id) => {
        const match = /player-(\d+)$/.exec(id);
        return match ? Number(match[1]) : 0;
      }),
    ) + 1
  );
}

export function scheduleNextGenerationalTalentYear(
  currentAcademicYear: number,
  random: RandomSource,
): number {
  if (!Number.isSafeInteger(currentAcademicYear) || currentAcademicYear < 1) {
    throw new Error("academic year must be a positive safe integer");
  }

  return currentAcademicYear + random.int(4, 6);
}

function createInitialRelationships(
  schools: Record<SchoolId, School>,
  random: RandomSource,
): Record<string, number> {
  const relationships: Record<string, number> = {};
  for (const school of Object.values(schools)) {
    for (
      let leftIndex = 0;
      leftIndex < school.playerIds.length;
      leftIndex += 1
    ) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < school.playerIds.length;
        rightIndex += 1
      ) {
        const left = school.playerIds[leftIndex];
        const right = school.playerIds[rightIndex];
        if (left && right) {
          relationships[relationshipKey(left, right)] = random.int(35, 65);
        }
      }
    }
  }
  return relationships;
}

export function generateWorld(input: GenerateWorldInput): GameState {
  const random = new SeededRandom(input.seed);
  const schools = {} as Record<SchoolId, School>;
  const players = {} as Record<PlayerId, Player>;
  const userSchoolId = schoolId("school-user");
  const rivalDefinitions = selectRivalSchools(input.userSchool, random);
  let playerNumber = 1;

  const createSchoolAndSquad = (
    id: SchoolId,
    setup: UserSchoolSetup,
    isUserSchool: boolean,
    uniform: UniformColors,
  ): void => {
    const squad = generateInitialSquad({
      schoolId: id,
      academicYear: 1,
      firstPlayerNumber: playerNumber,
      data: input.data,
      random,
    });
    playerNumber += squad.length;

    for (const player of squad) {
      players[player.id] = player;
    }

    const captain = squad.find((player) => player.grade === 3) ?? squad[0];
    schools[id] = generateSchool({
      id,
      name: setup.name,
      shortName: setup.shortName,
      regionId: setup.regionId,
      coachName: setup.coachName,
      uniform,
      playerIds: squad.map((player) => player.id),
      captainPlayerId: captain?.id ?? null,
      data: input.data,
      random,
      isUserSchool,
    });
  };

  createSchoolAndSquad(
    userSchoolId,
    input.userSchool,
    true,
    input.userSchool.uniform,
  );

  rivalDefinitions.forEach((definition, index) => {
    const id = schoolId(`school-${String(index + 1).padStart(3, "0")}`);
    createSchoolAndSquad(
      id,
      {
        name: definition.fullName,
        shortName: definition.shortName,
        regionId: input.userSchool.regionId,
        coachName: COACH_NAMES[index % COACH_NAMES.length],
        uniform: RIVAL_UNIFORMS[index % RIVAL_UNIFORMS.length],
      },
      false,
      RIVAL_UNIFORMS[index % RIVAL_UNIFORMS.length],
    );
  });

  const nextGenerationalTalentYear = scheduleNextGenerationalTalentYear(
    1,
    random,
  );
  const playerRelationships = createInitialRelationships(schools, random);

  return {
    schemaVersion: CURRENT_GAME_SCHEMA_VERSION,
    seed: input.seed,
    randomCursor: random.cursor,
    date: "2026-04-01",
    yearIndex: 1,
    userSchoolId,
    schools,
    players,
    playerRelationships,
    calendar: {
      currentDate: "2026-04-01",
      academicYear: 1,
      weekOfYear: 1,
      monthPolicyId: null,
      activities: [],
      completedActivityIds: [],
    },
    activeMatch: null,
    pendingEvent: null,
    history: createEmptyGameHistory(),
    eventMemory: createEmptyEventMemory(),
    settings: createDefaultGameSettings(),
    world: {
      nextGenerationalTalentYear,
      generationalTalentPlayerIds: [],
      rivalryScores: {},
      destinyRivalSchoolId: null,
    },
  };
}

export function assignGenerationalTalent(
  input: AssignGenerationalTalentInput,
): GenerationalTalentAssignment {
  const school = weightedChoice(
    Object.values(input.state.schools).map((candidate) => ({
      value: candidate,
      weight: Math.max(1, 40 + candidate.reputationPoints / 5),
    })),
    input.random,
  );
  if (!school) {
    throw new Error("generational talent requires at least one school");
  }
  const existingPlayers = Object.values(input.state.players);
  const nextNumber = nextPlayerNumber(input.state);
  const player = generatePlayer({
    id: playerId(`player-${nextNumber}`),
    schoolId: school.id,
    enrolledYear: input.academicYear,
    grade: 1,
    data: input.data,
    random: input.random,
    tier: "generational",
    excludedFullNames: new Set(
      existingPlayers.map(
        (candidate) => `${candidate.lastName} ${candidate.firstName}`,
      ),
    ),
    excludedAppearanceSeeds: new Set(
      existingPlayers.map((candidate) => candidate.appearanceSeed),
    ),
  });

  return {
    schoolId: school.id,
    player,
    nextGenerationalTalentYear: scheduleNextGenerationalTalentYear(
      input.academicYear,
      input.random,
    ),
  };
}
