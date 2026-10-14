import type { Player, PlayerAbilities } from "../model/Player";
import { getSpecialAbilityDefinition } from "./specialAbilities";
import {
  getServeSpecialAbilityAdjustment,
  getSpecialAbilityAbilityDelta,
  type MatchSpecialAbilitySituation,
} from "./specialAbilityMatchModifiers";

type ScoringPhase = "serve" | "attack" | "block" | "receive";

const RELEVANT_ABILITIES: Record<ScoringPhase, readonly (keyof PlayerAbilities)[]> = {
  serve: ["serve", "mental"],
  attack: ["spike", "jump", "decision"],
  block: ["block", "jump", "decision"],
  receive: ["receive", "speed", "decision"],
};

const RARITY_WEIGHT = { gold: 300, elite: 200, positive: 100 } as const;

/**
 * Select one real, positive contribution to the scored rally. It reads
 * the SAME delta and serve-adjustment rules used by the match engine.
 * Pure calculation: never consumes match RNG or changes the outcome.
 *
 * Passive modifiers are correctly described as "発揮", not a random proc.
 * A maxed-out stat alone is not sufficient: capped additions do not count.
 */
export function getScoringSpecialAbilityId(
  player: Player,
  phase: ScoringPhase,
  situation: MatchSpecialAbilitySituation,
): string | null {
  let bestId: string | null = null;
  let bestScore = 0;

  for (const id of player.specialAbilityIds ?? []) {
    const definition = getSpecialAbilityDefinition(id);
    if (!definition || definition.kind === "negative") continue;
    const ownedOnly = { ...player, specialAbilityIds: [id] };
    let contribution = 0;
    for (const ability of RELEVANT_ABILITIES[phase]) {
      const delta = getSpecialAbilityAbilityDelta(
        ownedOnly,
        ability,
        situation,
      );
      const raw = player.abilities[ability];
      contribution += Math.max(
        0,
        Math.min(100, raw + delta) - raw,
      );
    }
    if (phase === "serve") {
      const serve = getServeSpecialAbilityAdjustment(ownedOnly, situation);
      contribution += Math.max(0, -serve.errorChanceDelta) * 100;
      contribution += Math.max(0, serve.aceChanceDelta) * 100;
      contribution += Math.max(0, -serve.receiveQualityDelta);
    }
    if (contribution <= 0) continue;
    const score = contribution + RARITY_WEIGHT[definition.kind];
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }

  return bestId;
}
