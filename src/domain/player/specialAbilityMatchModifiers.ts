import type { Player, PlayerAbilities } from "../model/Player";

export interface MatchSpecialAbilitySituation {
  ownScore: number;
  opponentScore: number;
  setNumber: number;
  bestOfSets: 3 | 5;
}

export interface ServeSpecialAbilityAdjustment {
  errorChanceDelta: number;
  aceChanceDelta: number;
  receiveQualityDelta: number;
}

type AbilityDeltaMap = Partial<Record<keyof PlayerAbilities, number>>;

const ZERO_SERVE_ADJUSTMENT: ServeSpecialAbilityAdjustment = {
  errorChanceDelta: 0,
  aceChanceDelta: 0,
  receiveQualityDelta: 0,
};

const STATIC_ABILITY_DELTAS: Readonly<Record<string, AbilityDeltaMap>> = {
  serve_stable: { serve: 2, mental: 1 },
  serve_aim: { serve: 2, decision: 2 },
  serve_streak: { serve: 1, mental: 1 },
  float_mastery: { serve: 3 },
  jump_serve_mastery: { serve: 4, jump: 1 },
  receive_breaker: { serve: 3, decision: 1 },

  attack_course: { spike: 2, decision: 3 },
  attack_blockout: { spike: 3, decision: 2 },
  attack_line: { spike: 3 },
  attack_cross: { spike: 3 },
  attack_tip: { spike: 1, decision: 4 },
  attack_high_contact: { spike: 2, jump: 3 },
  attack_quick: { spike: 2, jump: 2, decision: 2 },
  attack_backrow: { spike: 3, jump: 1 },
  attack_out_of_system: { spike: 2, decision: 3 },
  attack_transition: { spike: 2, speed: 2 },
  attack_streak: { spike: 1, mental: 1 },

  set_stable: { set: 3, mental: 1 },
  set_quick_link: { set: 2, decision: 2 },
  set_side_link: { set: 2, decision: 1 },
  set_back: { set: 2, decision: 2 },
  set_second_ball: { set: 3 },
  set_distribution: { set: 2, decision: 4 },
  set_emergency: { set: 3, mental: 2 },

  receive_serve: { receive: 3, decision: 1 },
  receive_dig: { receive: 3 },
  receive_range: { receive: 2, speed: 3 },
  receive_power: { receive: 3, mental: 1 },
  receive_tip: { receive: 2, decision: 3 },
  receive_touch: { receive: 2, decision: 2 },
  receive_connect: { receive: 2, mental: 2 },
  receive_cover: { receive: 2, speed: 2 },

  block_read: { block: 2, decision: 4 },
  block_commit: { block: 3, jump: 1 },
  block_side: { block: 2, speed: 2 },
  block_touch: { block: 3 },
  block_close: { block: 2, decision: 2 },
  block_team: { block: 3, decision: 1 },

  mental_start: { mental: 2, decision: 1 },
  team_mood: { mental: 1 },
  team_captaincy: { mental: 2, decision: 1 },
  mental_reset: { mental: 2 },
  mental_focus: { mental: 3, decision: 1 },
  mental_calm: { mental: 3, decision: 2 },
  mental_tournament: { mental: 2 },

  physical_stamina: { stamina: 3 },
  physical_injury_resist: { mental: 1 },

  serve_unstable: { serve: -4, mental: -1 },
  serve_overhit: { serve: 2, decision: -2 },
  attack_low_finish: { spike: -4, mental: -1 },
  attack_block_fear: { spike: -3, mental: -3 },
  attack_predictable: { spike: -2, decision: -3 },
  attack_quick_bad: { spike: -2, decision: -2 },
  set_unstable: { set: -4, mental: -2 },
  set_bias: { set: -2, decision: -4 },
  set_emergency_bad: { set: -3, mental: -2 },
  receive_weak: { receive: -4 },
  receive_power_fear: { receive: -3, mental: -3 },
  receive_tip_bad: { receive: -2, decision: -3 },
  receive_cover_slow: { receive: -2, speed: -3 },
  block_slow: { block: -3, speed: -2 },
  block_tooling: { block: -4, decision: -1 },
  physical_tires: { stamina: -4 },
  physical_injury_prone: { mental: -1 },

  elite_serve_craftsman: { serve: 6, decision: 3 },
  elite_service_ace: { serve: 7, mental: 2 },
  elite_serve_hunter: { serve: 5, decision: 5 },
  elite_court_hitter: { spike: 6, decision: 5 },
  elite_block_crusher: { spike: 6, jump: 2 },
  elite_fast_finisher: { spike: 5, jump: 3, decision: 2 },
  elite_allround_attacker: { spike: 5, receive: 2, decision: 3 },
  elite_game_maker: { set: 7, decision: 5 },
  elite_deception_set: { set: 5, decision: 6 },
  elite_defense_craftsman: { receive: 7, speed: 3, decision: 3 },
  elite_receive_wall: { receive: 8, mental: 2 },
  elite_block_commander: { block: 7, decision: 5 },
  elite_shutdown: { block: 8, jump: 3 },
  elite_clutch: { mental: 4, decision: 3 },
  elite_steel_mental: { mental: 7, decision: 2 },

  gold_absolute_ace: { spike: 9, jump: 3, mental: 5 },
  gold_serve_king: { serve: 10, mental: 4, decision: 3 },
  gold_commander: { set: 10, decision: 7 },
  gold_guardian: { receive: 10, speed: 4, decision: 4 },
  gold_iron_wall: { block: 10, jump: 4, decision: 4 },
  gold_flow_controller: { mental: 6, decision: 4 },
  gold_indomitable: { mental: 10, decision: 3 },
  gold_total_player: {
    spike: 4,
    jump: 4,
    receive: 4,
    serve: 4,
    set: 4,
    block: 4,
    speed: 4,
    stamina: 4,
    decision: 4,
    mental: 4,
  },
  gold_ultra_quick: { spike: 8, jump: 5, decision: 5 },
  gold_court_brain: { set: 5, block: 5, receive: 4, decision: 10 },
};

function isCriticalScore(situation: MatchSpecialAbilitySituation): boolean {
  const decidingTarget =
    situation.setNumber === situation.bestOfSets ? 15 : 25;
  return (
    Math.max(situation.ownScore, situation.opponentScore) >=
      decidingTarget - 5 &&
    Math.abs(situation.ownScore - situation.opponentScore) <= 3
  );
}

function isBehind(situation: MatchSpecialAbilitySituation): boolean {
  return situation.opponentScore - situation.ownScore >= 3;
}

function isOpening(situation: MatchSpecialAbilitySituation): boolean {
  return situation.ownScore + situation.opponentScore <= 10;
}

function contextualAbilityDelta(
  abilityId: string,
  ability: keyof PlayerAbilities,
  situation: MatchSpecialAbilitySituation,
): number {
  let delta = 0;

  if (
    abilityId === "serve_bold" &&
    isBehind(situation) &&
    (ability === "serve" || ability === "mental")
  ) {
    delta += ability === "serve" ? 4 : 2;
  }
  if (
    abilityId === "serve_late_game" &&
    isCriticalScore(situation) &&
    (ability === "serve" || ability === "mental")
  ) {
    delta += ability === "serve" ? 5 : 2;
  }
  if (
    abilityId === "attack_clutch" &&
    isCriticalScore(situation) &&
    (ability === "spike" || ability === "mental")
  ) {
    delta += ability === "spike" ? 5 : 3;
  }
  if (
    abilityId === "mental_clutch" &&
    isCriticalScore(situation) &&
    (ability === "mental" || ability === "decision")
  ) {
    delta += ability === "mental" ? 5 : 2;
  }
  if (
    abilityId === "mental_comeback" &&
    isBehind(situation) &&
    (ability === "mental" || ability === "decision")
  ) {
    delta += ability === "mental" ? 5 : 2;
  }
  if (
    abilityId === "mental_start" &&
    isOpening(situation) &&
    (ability === "mental" || ability === "decision")
  ) {
    delta += 2;
  }

  if (
    abilityId === "serve_pressure_bad" &&
    isCriticalScore(situation) &&
    (ability === "serve" || ability === "mental")
  ) {
    delta -= ability === "serve" ? 5 : 3;
  }
  if (
    abilityId === "mental_choke" &&
    isCriticalScore(situation) &&
    (ability === "mental" || ability === "decision")
  ) {
    delta -= ability === "mental" ? 6 : 3;
  }
  if (
    abilityId === "mental_run_bad" &&
    isBehind(situation) &&
    (ability === "mental" || ability === "decision")
  ) {
    delta -= ability === "mental" ? 4 : 2;
  }

  if (
    abilityId === "elite_clutch" &&
    isCriticalScore(situation) &&
    (ability === "spike" ||
      ability === "serve" ||
      ability === "receive" ||
      ability === "block")
  ) {
    delta += 4;
  }
  if (
    abilityId === "elite_steel_mental" &&
    isBehind(situation) &&
    ability === "mental"
  ) {
    delta += 4;
  }
  if (
    abilityId === "gold_absolute_ace" &&
    isCriticalScore(situation) &&
    ability === "spike"
  ) {
    delta += 5;
  }
  if (
    abilityId === "gold_indomitable" &&
    (isBehind(situation) || isCriticalScore(situation)) &&
    (ability === "mental" || ability === "decision")
  ) {
    delta += ability === "mental" ? 6 : 3;
  }

  return delta;
}

export function getSpecialAbilityAbilityDelta(
  player: Player,
  ability: keyof PlayerAbilities,
  situation: MatchSpecialAbilitySituation,
): number {
  let delta = 0;
  for (const abilityId of player.specialAbilityIds ?? []) {
    delta += STATIC_ABILITY_DELTAS[abilityId]?.[ability] ?? 0;
    delta += contextualAbilityDelta(abilityId, ability, situation);
  }
  return delta;
}

export function getServeSpecialAbilityAdjustment(
  player: Player,
  situation: MatchSpecialAbilitySituation,
): ServeSpecialAbilityAdjustment {
  const result = { ...ZERO_SERVE_ADJUSTMENT };
  const ids = new Set(player.specialAbilityIds ?? []);

  if (ids.has("serve_stable")) result.errorChanceDelta -= 0.008;
  if (ids.has("serve_aim")) result.receiveQualityDelta -= 1.5;
  if (ids.has("float_mastery")) result.receiveQualityDelta -= 2;
  if (ids.has("jump_serve_mastery")) result.aceChanceDelta += 0.008;
  if (ids.has("receive_breaker")) result.receiveQualityDelta -= 2.5;
  if (ids.has("serve_unstable")) result.errorChanceDelta += 0.016;
  if (ids.has("serve_overhit")) {
    result.errorChanceDelta += 0.012;
    result.aceChanceDelta += 0.008;
  }
  if (ids.has("serve_pressure_bad") && isCriticalScore(situation)) {
    result.errorChanceDelta += 0.018;
    result.aceChanceDelta -= 0.008;
  }
  if (ids.has("serve_late_game") && isCriticalScore(situation)) {
    result.errorChanceDelta -= 0.008;
    result.aceChanceDelta += 0.008;
  }
  if (ids.has("elite_serve_craftsman")) {
    result.errorChanceDelta -= 0.012;
    result.receiveQualityDelta -= 3;
  }
  if (ids.has("elite_service_ace")) result.aceChanceDelta += 0.016;
  if (ids.has("elite_serve_hunter")) result.receiveQualityDelta -= 4;
  if (ids.has("gold_serve_king")) {
    result.errorChanceDelta -= 0.018;
    result.aceChanceDelta += 0.024;
    result.receiveQualityDelta -= 5;
  }

  return result;
}
