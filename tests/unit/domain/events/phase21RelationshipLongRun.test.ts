import { gameData } from "../../../../src/app/createDemoGame";
import type { AdvanceWeekOutcome } from "../../../../src/domain/calendar/advanceWeekOutcome";
import { eventActorPairKey } from "../../../../src/domain/events/selectEvent";
import type { GameState } from "../../../../src/domain/model/GameState";
import type { PlayerId } from "../../../../src/domain/model/identifiers";
import {
  createSoakSnapshot,
  type SoakRunResult,
} from "../../../../src/dev/soak/runBalanceSoak";
import type { CloudGameSnapshot } from "../../../../worker/data/GameStore";
import type { GameAction } from "../../../../worker/game/actionSchema";
import { applyGameAction } from "../../../../worker/game/applyGameAction";

interface Phase21LongRunMetrics {
  seed: string;
  simulatedWeeks: number;
  normalEvents: number;
  followUpEvents: number;
  relationshipEvents: number;
  uniqueActorPairs: number;
  maxPairShare: number;
  activeBondCount: number;
  legacyBondCount: number;
  discoveredTraitCount: number;
  maxObservedSocialBonus: number;
  invalidBondReferences: number;
  normalCadenceSlots: number;
}

interface AppliedAction {
  snapshot: CloudGameSnapshot;
  outcome: unknown;
}

const TARGET_WEEKS = 156;
const MAX_ACTIONS = 12_000;
const SEEDS = ["phase21-social-a", "phase21-social-b"] as const;

function applyAction(
  snapshot: CloudGameSnapshot,
  action: GameAction,
): AppliedAction {
  const applied = applyGameAction(snapshot, action);
  return {
    snapshot: {
      ...snapshot,
      revision: snapshot.revision + 1,
      state: applied.state,
      teamSelection: applied.teamSelection,
    },
    outcome: applied.outcome,
  };
}

function isAdvanceWeekOutcome(value: unknown): value is AdvanceWeekOutcome {
  return Boolean(
    value &&
      typeof value === "object" &&
      "weekAdvanced" in value &&
      "academicYearTransition" in value,
  );
}

function stateContext(state: GameState, metric: string): string {
  return `seed=${state.seed} date=${state.date} year=${state.yearIndex} week=${state.calendar.weekOfYear} metric=${metric}`;
}

function invalidBondReferenceCount(state: GameState): number {
  return Object.values(state.playerRelationshipBonds).reduce(
    (count, bond) =>
      count + bond.playerIds.filter((playerId) => !state.players[playerId]).length,
    0,
  );
}

function validateStateInvariants(state: GameState): number {
  const invalidReferences = invalidBondReferenceCount(state);
  expect(invalidReferences, stateContext(state, "invalidBondReferences")).toBe(0);
  expect(
    state.eventMemory.recentActorPairKeys.length,
    stateContext(state, "recentActorPairKeys.length"),
  ).toBeLessThanOrEqual(6);

  for (const bond of Object.values(state.playerRelationshipBonds)) {
    expect(
      bond.tags.length,
      stateContext(state, `bondTags:${bond.playerIds.join("::")}`),
    ).toBeLessThanOrEqual(2);
  }

  for (const player of Object.values(state.players)) {
    const assigned = new Set(player.hiddenTraitIds ?? []);
    for (const traitId of player.revealedHiddenTraitIds ?? []) {
      expect(
        assigned.has(traitId),
        stateContext(state, `revealedTraitSubset:${player.id}:${traitId}`),
      ).toBe(true);
    }
  }

  return invalidReferences;
}

function firstChoiceAction(state: GameState): GameAction {
  const pending = state.pendingEvent;
  if (!pending) {
    throw new Error(`pending event missing: ${stateContext(state, "pendingEvent")}`);
  }
  const choiceId = pending.choiceIds[0];
  if (!choiceId) {
    throw new Error(
      `pending event has no choice: ${stateContext(state, pending.eventId)}`,
    );
  }
  return { type: "event-choice", choiceId };
}

function nextAction(state: GameState): GameAction {
  if (state.pendingEvent) {
    return firstChoiceAction(state);
  }

  const activeMatch = state.activeMatch;
  if (activeMatch && activeMatch.phase !== "match-complete") {
    if (
      activeMatch.phase !== "coach-decision" ||
      activeMatch.pendingCoachCommandForSchoolId !== state.userSchoolId
    ) {
      throw new Error(
        `cannot auto-progress match: ${stateContext(state, `match:${activeMatch.id}:${activeMatch.phase}`)}`,
      );
    }
    return { type: "match-command", command: { type: "continue" } };
  }

  return { type: "advance-week" };
}

function observeTrainingOutcome(
  outcome: AdvanceWeekOutcome,
  currentMaximum: number,
): number {
  let maximum = currentMaximum;
  for (const log of outcome.trainingResult?.playerLogs ?? []) {
    maximum = Math.max(maximum, log.socialGrowth.appliedPercentPoints);
  }
  return maximum;
}

function runPhase21LongRun(seed: string): Phase21LongRunMetrics {
  let snapshot = createSoakSnapshot(seed);
  let simulatedWeeks = 0;
  let actions = 0;
  let normalEvents = 0;
  let followUpEvents = 0;
  let relationshipEvents = 0;
  let normalCadenceSlots = 0;
  let maxObservedSocialBonus = 0;
  let invalidBondReferences = 0;
  const relationshipPairCounts = new Map<string, number>();
  const discoveredTraits = new Set<string>();

  while (simulatedWeeks < TARGET_WEEKS) {
    if (actions >= MAX_ACTIONS) {
      throw new Error(
        `Phase21 long-run action guard exhausted: ${stateContext(snapshot.state, `actions=${actions}`)}`,
      );
    }

    const before = snapshot.state;
    invalidBondReferences = Math.max(
      invalidBondReferences,
      validateStateInvariants(before),
    );

    for (const player of Object.values(before.players)) {
      for (const traitId of player.revealedHiddenTraitIds ?? []) {
        discoveredTraits.add(`${player.id}::${traitId}`);
      }
    }

    if (before.pendingEvent) {
      const pending = before.pendingEvent;
      const definition = gameData.events.get(pending.eventId);
      if (!definition) {
        throw new Error(
          `event definition missing: ${stateContext(before, pending.eventId)}`,
        );
      }

      if (pending.chainId) followUpEvents += 1;
      else normalEvents += 1;

      if (
        definition.category === "relationship" ||
        definition.category === "rivalry"
      ) {
        relationshipEvents += 1;
        const pairKey = eventActorPairKey(pending.actorPlayerIds);
        if (pairKey) {
          relationshipPairCounts.set(
            pairKey,
            (relationshipPairCounts.get(pairKey) ?? 0) + 1,
          );
        }
      }
    }

    const action = nextAction(before);
    const applied = applyAction(snapshot, action);
    snapshot = applied.snapshot;
    actions += 1;
    invalidBondReferences = Math.max(
      invalidBondReferences,
      validateStateInvariants(snapshot.state),
    );

    if (action.type === "advance-week") {
      if (!isAdvanceWeekOutcome(applied.outcome)) {
        throw new Error(
          `advance-week outcome missing: ${stateContext(snapshot.state, "advanceWeekOutcome")}`,
        );
      }
      maxObservedSocialBonus = observeTrainingOutcome(
        applied.outcome,
        maxObservedSocialBonus,
      );
      if (applied.outcome.weekAdvanced) {
        simulatedWeeks += 1;
        if (
          applied.outcome.academicYearTransition === null &&
          snapshot.state.calendar.weekOfYear % 3 === 0
        ) {
          normalCadenceSlots += 1;
        }
      }
    }
  }

  validateStateInvariants(snapshot.state);
  for (const player of Object.values(snapshot.state.players)) {
    for (const traitId of player.revealedHiddenTraitIds ?? []) {
      discoveredTraits.add(`${player.id}::${traitId}`);
    }
  }

  const pairCounts = [...relationshipPairCounts.values()];
  const maxPairCount = pairCounts.length > 0 ? Math.max(...pairCounts) : 0;
  const maxPairShare =
    relationshipEvents > 0 ? maxPairCount / relationshipEvents : 0;
  const activeBondCount = Object.values(
    snapshot.state.playerRelationshipBonds,
  ).filter((bond) => bond.tags.length > 0).length;

  const metrics: Phase21LongRunMetrics = {
    seed,
    simulatedWeeks,
    normalEvents,
    followUpEvents,
    relationshipEvents,
    uniqueActorPairs: relationshipPairCounts.size,
    maxPairShare,
    activeBondCount,
    legacyBondCount: snapshot.state.history.relationshipLegacyHistory.length,
    discoveredTraitCount: discoveredTraits.size,
    maxObservedSocialBonus,
    invalidBondReferences,
    normalCadenceSlots,
  };

  expect(metrics.simulatedWeeks, `${seed}: simulatedWeeks`).toBeGreaterThanOrEqual(
    TARGET_WEEKS,
  );
  expect(
    metrics.maxObservedSocialBonus,
    `${seed}: maxObservedSocialBonus`,
  ).toBeLessThanOrEqual(5);
  expect(metrics.invalidBondReferences, `${seed}: invalidBondReferences`).toBe(0);
  expect(metrics.normalEvents, `${seed}: normal event cadence`).toBeLessThanOrEqual(
    metrics.normalCadenceSlots,
  );
  if (metrics.relationshipEvents >= 8) {
    expect(metrics.uniqueActorPairs, `${seed}: uniqueActorPairs`).toBeGreaterThanOrEqual(
      4,
    );
  }
  if (metrics.relationshipEvents >= 10) {
    expect(metrics.maxPairShare, `${seed}: maxPairShare`).toBeLessThanOrEqual(0.4);
  }

  console.info(
    `[phase21-long-run] seed=${metrics.seed} weeks=${metrics.simulatedWeeks} normal=${metrics.normalEvents}/${metrics.normalCadenceSlots} followUp=${metrics.followUpEvents} relationship=${metrics.relationshipEvents} pairs=${metrics.uniqueActorPairs} maxPairShare=${metrics.maxPairShare.toFixed(3)} bonds=${metrics.activeBondCount} legacy=${metrics.legacyBondCount} traits=${metrics.discoveredTraitCount} socialMax=${metrics.maxObservedSocialBonus}`,
  );

  return metrics;
}

describe("Phase21 relationship social/event long-run balance", () => {
  vi.setConfig({ testTimeout: 180_000 });

  for (const seed of SEEDS) {
    it(`keeps three seasons deterministic and bounded for ${seed}`, () => {
      const first = runPhase21LongRun(seed);
      const second = runPhase21LongRun(seed);
      expect(second, `${seed}: deterministic rerun`).toEqual(first);
    });
  }
});
