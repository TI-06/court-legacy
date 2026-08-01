import type { Player } from "../model/Player";

export interface PlayerAbilitySummary {
  attack: number;
  defense: number;
  jump: number;
  stamina: number;
  mental: number;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculatePlayerDisplayPower(player: Player): number {
  return Math.round(average(Object.values(player.abilities))) * 100;
}

export function summarizePlayerAbilities(player: Player): PlayerAbilitySummary {
  return {
    attack: Math.round((player.abilities.spike + player.abilities.serve) / 2),
    defense: Math.round(
      (player.abilities.receive + player.abilities.block) / 2,
    ),
    jump: player.abilities.jump,
    stamina: player.abilities.stamina,
    mental: Math.round(
      (player.abilities.decision + player.abilities.mental) / 2,
    ),
  };
}
