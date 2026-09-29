import { activeAppearancePromises, type AppearancePromiseMode } from "./playerOpportunityRequests";
import type { GameState } from "../model/GameState";
import type { MatchCommandRecord, MatchState } from "../model/Match";
import type { PlayerId } from "../model/identifiers";
import { eventId } from "../model/identifiers";
import type { TeamSelection } from "../model/TeamSelection";

export interface AppearancePromiseResult {
  playerId: PlayerId;
  mode: AppearancePromiseMode;
  fulfilled: boolean;
  trustChange: number;
  moraleChange: number;
}

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function userSelection(match: MatchState, state: GameState): TeamSelection {
  if (match.homeSchoolId === state.userSchoolId) return match.homeSelection;
  if (match.awaySchoolId === state.userSchoolId) return match.awaySelection;
  throw new Error("appearance promise evaluation requires the user school");
}

function userSubstitutionCommands(
  match: MatchState,
  state: GameState,
): Array<Extract<MatchCommandRecord["command"], { type: "substitute" }>> {
  return (match.runtime?.commandHistory ?? [])
    .filter(
      (record) =>
        record.schoolId === state.userSchoolId &&
        record.command.type === "substitute",
    )
    .map(
      (record) =>
        record.command as Extract<
          MatchCommandRecord["command"],
          { type: "substitute" }
        >,
    );
}

function restoreInitialSelection(
  finalSelection: TeamSelection,
  commands: readonly Extract<
    MatchCommandRecord["command"],
    { type: "substitute" }
  >[],
): TeamSelection {
  const initial = structuredClone(finalSelection);

  for (const command of [...commands].reverse()) {
    const rotation = initial.rotation.find(
      (assignment) => assignment.playerId === command.incomingPlayerId,
    );
    const outgoingBenchIndex = initial.benchPlayerIds.indexOf(
      command.outgoingPlayerId,
    );
    if (!rotation || outgoingBenchIndex < 0) continue;

    rotation.playerId = command.outgoingPlayerId;
    initial.servingOrderPlayerIds = initial.servingOrderPlayerIds.map(
      (playerId) =>
        playerId === command.incomingPlayerId
          ? command.outgoingPlayerId
          : playerId,
    );
    initial.benchPlayerIds[outgoingBenchIndex] = command.incomingPlayerId;
  }

  return initial;
}

function activePlayerIds(selection: TeamSelection): Set<PlayerId> {
  return new Set([
    ...selection.rotation.map((assignment) => assignment.playerId),
    ...(selection.liberoPlayerId ? [selection.liberoPlayerId] : []),
  ]);
}

function promiseFulfilled(input: {
  mode: AppearancePromiseMode;
  playerId: PlayerId;
  initialActivePlayerIds: ReadonlySet<PlayerId>;
  substitutionCommands: readonly Extract<
    MatchCommandRecord["command"],
    { type: "substitute" }
  >[];
}): boolean {
  const started = input.initialActivePlayerIds.has(input.playerId);
  const enteredAsSubstitute = input.substitutionCommands.some(
    (command) => command.incomingPlayerId === input.playerId,
  );

  if (input.mode === "starter") return started;
  if (input.mode === "substitute") return enteredAsSubstitute || started;
  return started || enteredAsSubstitute;
}

export function applyAppearancePromiseFeedback(
  state: GameState,
  match: MatchState,
): { state: GameState; results: AppearancePromiseResult[] } {
  const promises = activeAppearancePromises(state);
  const entries = Object.entries(promises).filter(
    (entry): entry is [string, AppearancePromiseMode] => Boolean(entry[1]),
  );
  if (entries.length === 0) return { state, results: [] };

  const substitutions = userSubstitutionCommands(match, state);
  const initialSelection = restoreInitialSelection(
    userSelection(match, state),
    substitutions,
  );
  const initialActive = activePlayerIds(initialSelection);
  const players = { ...state.players };
  const resultOccurrences = [...state.eventMemory.history];
  const results: AppearancePromiseResult[] = [];

  for (const [rawPlayerId, mode] of entries) {
    const playerId = rawPlayerId as PlayerId;
    const player = players[playerId];
    if (!player) continue;

    const fulfilled = promiseFulfilled({
      mode,
      playerId,
      initialActivePlayerIds: initialActive,
      substitutionCommands: substitutions,
    });
    const trustChange = fulfilled ? 5 : -8;
    const moraleChange = fulfilled ? 3 : -5;

    players[playerId] = {
      ...player,
      trust: clamp100(player.trust + trustChange),
      morale: clamp100(player.morale + moraleChange),
    };
    results.push({
      playerId,
      mode,
      fulfilled,
      trustChange,
      moraleChange,
    });
    resultOccurrences.push({
      eventId: eventId("event.reserve-appearance-promise-result"),
      date: state.date,
      actorPlayerIds: [playerId],
      choiceId: fulfilled ? "fulfilled" : "broken",
      visibleResultCodes: [
        `約束 ${fulfilled ? "達成" : "未達"}`,
        `信頼 ${trustChange >= 0 ? "+" : ""}${trustChange}`,
        `士気 ${moraleChange >= 0 ? "+" : ""}${moraleChange}`,
      ],
    });
  }

  return {
    state: {
      ...state,
      players,
      eventMemory: {
        ...state.eventMemory,
        history: resultOccurrences.slice(-200),
      },
    },
    results,
  };
}
