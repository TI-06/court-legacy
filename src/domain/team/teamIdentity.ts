import type { GameState } from "../model/GameState";
import type { TeamTactics } from "../model/School";
import { deriveMatchTacticPlan, type MatchTacticPlan } from "./matchTactics";
import type { TeamIdentityState, TeamIdentityStyle } from "./teamPlanningTypes";

export interface TeamIdentityDefinition {
  id: TeamIdentityStyle;
  label: string;
  description: string;
}

export type TeamIdentityMasteryTier =
  "forming" | "established" | "mature" | "signature";

export type TeamIdentityExecutionPhase =
  "serve" | "receive" | "set" | "attack" | "block" | "dig";

export const TEAM_IDENTITY_DEFINITIONS: readonly TeamIdentityDefinition[] = [
  {
    id: "quick-combination",
    label: "高速コンビ",
    description: "MB参加とテンポの速い攻撃を軸にする",
  },
  {
    id: "serve-block",
    label: "サーブ＆ブロック",
    description: "強いサーブで崩し、ブロックで仕留める",
  },
  {
    id: "defense-rally",
    label: "守備粘り型",
    description: "ミスを抑え、守備とラリー継続を重視する",
  },
  {
    id: "ace-centered",
    label: "エース中心",
    description: "サイド攻撃を軸に勝負所をエースへ託す",
  },
  {
    id: "balanced",
    label: "バランス",
    description: "大きな偏りを作らず総合力で戦う",
  },
] as const;

const DEFAULT_TEAM_IDENTITY: TeamIdentityState = {
  style: "balanced",
  mastery: 50,
  weeksInStyle: 0,
  changeCount: 0,
};

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function createDefaultTeamIdentity(): TeamIdentityState {
  return { ...DEFAULT_TEAM_IDENTITY };
}

export function resolveTeamIdentity(state: GameState): TeamIdentityState {
  const identity = state.teamPlanning.teamIdentity;
  return identity
    ? {
        ...identity,
        mastery: clampPercent(identity.mastery),
        weeksInStyle: Math.max(0, Math.trunc(identity.weeksInStyle)),
        changeCount: Math.max(0, Math.trunc(identity.changeCount)),
      }
    : createDefaultTeamIdentity();
}

export function teamIdentityMasteryTier(
  mastery: number,
): TeamIdentityMasteryTier {
  const value = clampPercent(mastery);
  if (value >= 85) return "signature";
  if (value >= 60) return "mature";
  if (value >= 30) return "established";
  return "forming";
}

function boolPoints(condition: boolean, points: number): number {
  return condition ? points : 0;
}

export function calculateTeamIdentityAlignment(
  style: TeamIdentityStyle,
  plan: MatchTacticPlan,
  defenseBias: TeamTactics["defenseBias"],
): number {
  switch (style) {
    case "quick-combination":
      return clampPercent(
        boolPoints(plan.attack === "quick", 60) +
          boolPoints(plan.serve !== "safe", 20) +
          boolPoints(plan.block !== "read", 20),
      );
    case "serve-block":
      return clampPercent(
        boolPoints(plan.serve === "aggressive", 50) +
          boolPoints(plan.block === "commit", 50),
      );
    case "defense-rally":
      return clampPercent(
        boolPoints(plan.serve === "safe", 35) +
          boolPoints(plan.block === "read", 35) +
          boolPoints(defenseBias === "balanced", 30),
      );
    case "ace-centered":
      return clampPercent(
        boolPoints(plan.attack === "side", 65) +
          boolPoints(plan.serve !== "safe", 20) +
          boolPoints(plan.block !== "commit", 15),
      );
    case "balanced":
      return clampPercent(
        boolPoints(plan.serve === "balanced", 25) +
          boolPoints(plan.attack === "balanced", 25) +
          boolPoints(plan.block === "mixed", 25) +
          boolPoints(defenseBias === "balanced", 25),
      );
  }
}

const TEAM_IDENTITY_PHASE_MAX: Record<
  TeamIdentityStyle,
  Partial<Record<TeamIdentityExecutionPhase, number>>
> = {
  "quick-combination": { set: 2, attack: 2 },
  "serve-block": { serve: 2, block: 2 },
  "defense-rally": { receive: 2, dig: 2 },
  "ace-centered": { attack: 2 },
  balanced: {
    serve: 0.8,
    receive: 0.8,
    set: 0.8,
    attack: 0.8,
    block: 0.8,
    dig: 0.8,
  },
};

function teamIdentityMasteryFactor(mastery: number): number {
  const value = clampPercent(mastery);
  if (value < 30) return 0;
  if (value < 60) return ((value - 30) / 30) * 0.6;
  if (value < 85) return 0.6 + ((value - 60) / 25) * 0.25;
  return 0.85 + ((value - 85) / 15) * 0.15;
}

function teamIdentityAlignmentFactor(alignment: number): number {
  const value = clampPercent(alignment);
  return value <= 40 ? 0 : (value - 40) / 60;
}

export function calculateTeamIdentityExecutionBonus(
  identity: TeamIdentityState,
  plan: MatchTacticPlan,
  defenseBias: TeamTactics["defenseBias"],
  phase: TeamIdentityExecutionPhase,
): number {
  const maximum = TEAM_IDENTITY_PHASE_MAX[identity.style][phase] ?? 0;
  if (maximum === 0) return 0;

  const alignment = calculateTeamIdentityAlignment(
    identity.style,
    plan,
    defenseBias,
  );
  const bonus =
    maximum *
    teamIdentityMasteryFactor(identity.mastery) *
    teamIdentityAlignmentFactor(alignment);

  return Math.round(bonus * 1_000) / 1_000;
}

export function setTeamIdentityStyle(
  state: GameState,
  style: TeamIdentityStyle,
): GameState {
  const current = resolveTeamIdentity(state);
  if (current.style === style) return state;

  return {
    ...state,
    teamPlanning: {
      ...state.teamPlanning,
      teamIdentity: {
        style,
        mastery: Math.min(current.mastery, 30),
        weeksInStyle: 0,
        changeCount: current.changeCount + 1,
      },
    },
  };
}

export function progressTeamIdentityWeek(state: GameState): GameState {
  const school = state.schools[state.userSchoolId];
  if (!school) return state;

  const identity = resolveTeamIdentity(state);
  const plan = deriveMatchTacticPlan(school.tactics);
  const alignment = calculateTeamIdentityAlignment(
    identity.style,
    plan,
    school.tactics.defenseBias,
  );

  const gain =
    2 + (alignment >= 80 ? 3 : alignment >= 60 ? 2 : alignment >= 40 ? 1 : 0);
  const mastery = Math.min(100, identity.mastery + gain);

  return {
    ...state,
    teamPlanning: {
      ...state.teamPlanning,
      teamIdentity: {
        ...identity,
        mastery,
        weeksInStyle: identity.weeksInStyle + 1,
      },
    },
  };
}
