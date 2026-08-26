import { z } from "zod";
import { createInitialGame } from "../../src/app/createInitialGame";
import { autoSelectTeam } from "../../src/domain/team/autoSelectTeam";
import type { AuthenticatedRequestHandler } from "../router";
import type { GameStore } from "../data/GameStore";
import { GameAlreadyExistsError } from "../data/GameStore";
import { json, jsonError } from "../http/json";

export const REGION_IDS = [
  "region.hokkaido",
  "region.aomori",
  "region.iwate",
  "region.miyagi",
  "region.akita",
  "region.yamagata",
  "region.fukushima",
  "region.ibaraki",
  "region.tochigi",
  "region.gunma",
  "region.saitama",
  "region.chiba",
  "region.tokyo",
  "region.kanagawa",
  "region.niigata",
  "region.toyama",
  "region.ishikawa",
  "region.fukui",
  "region.yamanashi",
  "region.nagano",
  "region.gifu",
  "region.shizuoka",
  "region.aichi",
  "region.mie",
  "region.shiga",
  "region.kyoto",
  "region.osaka",
  "region.hyogo",
  "region.nara",
  "region.wakayama",
  "region.tottori",
  "region.shimane",
  "region.okayama",
  "region.hiroshima",
  "region.yamaguchi",
  "region.tokushima",
  "region.kagawa",
  "region.ehime",
  "region.kochi",
  "region.fukuoka",
  "region.saga",
  "region.nagasaki",
  "region.kumamoto",
  "region.oita",
  "region.miyazaki",
  "region.kagoshima",
  "region.okinawa",
] as const;

const trimmedString = (minimum: number, maximum: number) =>
  z.string().transform((value) => value.trim()).pipe(z.string().min(minimum).max(maximum));

const onboardingSchema = z.object({
  displayName: trimmedString(1, 40),
  schoolName: trimmedString(1, 60),
  schoolShortName: trimmedString(1, 30),
  coachName: trimmedString(1, 40),
  regionId: z.enum(REGION_IDS),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

const DEFAULT_UNIFORM = {
  primary: "#17365D",
  secondary: "#FFFFFF",
  accent: "#D99B2B",
} as const;

export interface OnboardingDependencies {
  store: GameStore;
  createCreationNonce?: () => string;
}

function invalidOnboarding(): Response {
  return jsonError(400, "invalid_onboarding", "学校設定を確認してください");
}

function alreadyExists(): Response {
  return jsonError(
    409,
    "game_already_exists",
    "すでに学校データが作成されています",
  );
}

export function createOnboardingHandler(
  deps: OnboardingDependencies,
): AuthenticatedRequestHandler {
  return async (request, user) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidOnboarding();
    }

    const parsed = onboardingSchema.safeParse(body);
    if (!parsed.success) {
      return invalidOnboarding();
    }

    if (await deps.store.getSnapshot(user.id)) {
      return alreadyExists();
    }

    const nonce = (deps.createCreationNonce?.() ?? crypto.randomUUID()).trim();
    if (!nonce) {
      throw new Error("creation nonce must not be empty");
    }

    const state = createInitialGame({
      seed: `${user.id}:${nonce}`,
      schoolName: parsed.data.schoolName,
      schoolShortName: parsed.data.schoolShortName,
      coachName: parsed.data.coachName,
      regionId: parsed.data.regionId,
      uniform: DEFAULT_UNIFORM,
    });
    const teamSelection = autoSelectTeam({
      state,
      schoolId: state.userSchoolId,
    });

    try {
      const game = await deps.store.createGame({
        userId: user.id,
        displayName: parsed.data.displayName,
        schoolName: parsed.data.schoolName,
        schoolShortName: parsed.data.schoolShortName,
        coachName: parsed.data.coachName,
        regionId: parsed.data.regionId,
        state,
        teamSelection,
      });
      return json({ status: "ready", game }, { status: 201 });
    } catch (error) {
      if (error instanceof GameAlreadyExistsError) {
        return alreadyExists();
      }
      throw error;
    }
  };
}
