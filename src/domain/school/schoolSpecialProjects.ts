import type { GameState } from "../model/GameState";
import type { FacilityKey } from "./facilityUpgrade";
import { applySchoolFundsChange } from "./schoolEconomy";

export const SCHOOL_SPECIAL_PROJECT_YEARLY_LIMIT = 2;

export type SchoolSpecialProjectId =
  | "national-data-bank"
  | "medical-support"
  | "alumni-development"
  | "academic-support"
  | "elite-expedition"
  | "university-joint-training"
  | "top-team-clinic"
  | "invitational-cup";

export type SchoolSpecialProjectKind = "annual-contract" | "special-activity";

export interface SchoolSpecialProjectState {
  yearIndex: number;
  purchasedProjectIds: SchoolSpecialProjectId[];
}

export interface SchoolSpecialProjectDefinition {
  id: SchoolSpecialProjectId;
  name: string;
  kind: SchoolSpecialProjectKind;
  cost: number;
  summary: string;
  requiredFacilities: Partial<Record<FacilityKey, number>>;
  minimumReputationPoints?: number;
  minimumNationalTitles?: number;
  effectReady: boolean;
}

export const SCHOOL_SPECIAL_PROJECT_DEFINITIONS = [
  {
    id: "national-data-bank",
    name: "全国データバンク",
    kind: "annual-contract",
    cost: 900,
    summary: "試合前分析で相手主力の情報を詳しく確認できます。",
    requiredFacilities: { analysisRoom: 50 },
    effectReady: false,
  },
  {
    id: "medical-support",
    name: "専属メディカルサポート",
    kind: "annual-contract",
    cost: 1000,
    summary: "練習時の怪我リスクを抑え、選手管理を強化します。",
    requiredFacilities: { recoveryRoom: 50 },
    effectReady: false,
  },
  {
    id: "alumni-development",
    name: "OB育成支援プログラム",
    kind: "annual-contract",
    cost: 900,
    summary: "若手選手の通常練習をOBが継続支援します。",
    requiredFacilities: { alumniAssociation: 50 },
    effectReady: false,
  },
  {
    id: "academic-support",
    name: "学習サポート",
    kind: "annual-contract",
    cost: 750,
    summary: "学業面の支援で低学業選手の練習制限を緩和します。",
    requiredFacilities: { studyRoom: 50 },
    effectReady: false,
  },
  {
    id: "elite-expedition",
    name: "全国強豪遠征",
    kind: "special-activity",
    cost: 1200,
    summary: "全国クラスの強豪校との対戦機会を作ります。",
    requiredFacilities: { analysisRoom: 50, scoutingNetwork: 50 },
    minimumReputationPoints: 400,
    effectReady: false,
  },
  {
    id: "university-joint-training",
    name: "大学チーム合同練習",
    kind: "special-activity",
    cost: 1300,
    summary: "大学チームとの合同練習でチーム全体を刺激します。",
    requiredFacilities: { gym: 50, trainingRoom: 50, dormitory: 50 },
    minimumReputationPoints: 620,
    effectReady: false,
  },
  {
    id: "top-team-clinic",
    name: "トップチーム講習",
    kind: "special-activity",
    cost: 1500,
    summary: "選手1名がトップレベルの専門指導を受けます。",
    requiredFacilities: { gym: 50, analysisRoom: 50 },
    minimumReputationPoints: 620,
    effectReady: false,
  },
  {
    id: "invitational-cup",
    name: "全国招待大会",
    kind: "special-activity",
    cost: 1800,
    summary: "全国上位校を集めた4校招待大会へ挑戦します。",
    requiredFacilities: { gym: 50, analysisRoom: 50 },
    minimumReputationPoints: 850,
    minimumNationalTitles: 1,
    effectReady: false,
  },
] as const satisfies readonly SchoolSpecialProjectDefinition[];

const definitionById = new Map(
  SCHOOL_SPECIAL_PROJECT_DEFINITIONS.map((definition) => [
    definition.id,
    definition,
  ]),
);

export type SchoolSpecialProjectEvaluationReason =
  | "available"
  | "already-purchased"
  | "yearly-limit"
  | "requirements-not-met"
  | "insufficient-funds";

export interface SchoolSpecialProjectRequirementStatus {
  facilitiesMet: boolean;
  reputationMet: boolean;
  nationalTitlesMet: boolean;
  unmetFacilities: FacilityKey[];
}

export interface SchoolSpecialProjectEvaluation {
  allowed: boolean;
  reason: SchoolSpecialProjectEvaluationReason;
  cost: number;
  fundsAfter: number;
  purchasedCount: number;
  remainingSlots: number;
  requirements: SchoolSpecialProjectRequirementStatus;
}

export function getSchoolSpecialProjectDefinition(
  projectId: SchoolSpecialProjectId,
): SchoolSpecialProjectDefinition {
  const definition = definitionById.get(projectId);
  if (!definition) {
    throw new Error(`unknown school special project: ${projectId}`);
  }
  return definition;
}

export function activeSchoolSpecialProjects(
  state: GameState,
): SchoolSpecialProjectState | null {
  const current = state.schoolManagement.specialProjects;
  return current?.yearIndex === state.yearIndex ? current : null;
}

export function schoolSpecialProjectRemainingSlots(state: GameState): number {
  return Math.max(
    0,
    SCHOOL_SPECIAL_PROJECT_YEARLY_LIMIT -
      (activeSchoolSpecialProjects(state)?.purchasedProjectIds.length ?? 0),
  );
}

function requirementStatus(
  state: GameState,
  definition: SchoolSpecialProjectDefinition,
): SchoolSpecialProjectRequirementStatus {
  const school = state.schools[state.userSchoolId];
  if (!school) throw new Error("user school is missing");

  const unmetFacilities = (
    Object.entries(definition.requiredFacilities) as Array<
      [FacilityKey, number]
    >
  )
    .filter(([facility, requiredLevel]) => {
      return school.facilities[facility] < requiredLevel;
    })
    .map(([facility]) => facility);

  return {
    facilitiesMet: unmetFacilities.length === 0,
    reputationMet:
      definition.minimumReputationPoints === undefined ||
      school.reputationPoints >= definition.minimumReputationPoints,
    nationalTitlesMet:
      definition.minimumNationalTitles === undefined ||
      school.history.nationalTitles >= definition.minimumNationalTitles,
    unmetFacilities,
  };
}

export function evaluateSchoolSpecialProject(
  state: GameState,
  projectId: SchoolSpecialProjectId,
): SchoolSpecialProjectEvaluation {
  const school = state.schools[state.userSchoolId];
  if (!school) throw new Error("user school is missing");
  const definition = getSchoolSpecialProjectDefinition(projectId);
  const current = activeSchoolSpecialProjects(state);
  const purchasedProjectIds = current?.purchasedProjectIds ?? [];
  const purchasedCount = purchasedProjectIds.length;
  const remainingSlots = Math.max(
    0,
    SCHOOL_SPECIAL_PROJECT_YEARLY_LIMIT - purchasedCount,
  );
  const requirements = requirementStatus(state, definition);
  const requirementsMet =
    requirements.facilitiesMet &&
    requirements.reputationMet &&
    requirements.nationalTitlesMet;
  const alreadyPurchased = purchasedProjectIds.includes(projectId);

  const reason: SchoolSpecialProjectEvaluationReason = alreadyPurchased
    ? "already-purchased"
    : remainingSlots === 0
      ? "yearly-limit"
      : !requirementsMet
        ? "requirements-not-met"
        : school.funds < definition.cost
          ? "insufficient-funds"
          : "available";

  return {
    allowed: reason === "available",
    reason,
    cost: definition.cost,
    fundsAfter: school.funds - definition.cost,
    purchasedCount,
    remainingSlots,
    requirements,
  };
}

export function purchaseSchoolSpecialProject(
  state: GameState,
  projectId: SchoolSpecialProjectId,
): GameState {
  const evaluation = evaluateSchoolSpecialProject(state, projectId);
  if (!evaluation.allowed) return state;

  const definition = getSchoolSpecialProjectDefinition(projectId);
  const current =
    activeSchoolSpecialProjects(state) ??
    ({ yearIndex: state.yearIndex, purchasedProjectIds: [] } as const);
  const funded = applySchoolFundsChange(state, {
    id: `special-project:${state.yearIndex}:${projectId}`,
    kind: "special-project",
    amount: -definition.cost,
    label: definition.name,
    relatedId: projectId,
  }).state;

  return {
    ...funded,
    schoolManagement: {
      ...funded.schoolManagement,
      specialProjects: {
        yearIndex: state.yearIndex,
        purchasedProjectIds: [...current.purchasedProjectIds, projectId],
      },
    },
  };
}
