from pathlib import Path

path = Path("worker/game/applyGameAction.ts")
text = path.read_text()

old_import = '''import {
  advanceOfficialTournamentsThroughWeek,
  findDueUserOfficialMatch,
  hasRequiredOfficialMatch,
} from "../../src/domain/tournament/progressOfficialTournaments";'''
new_import = '''import {
  advanceOfficialTournamentsThroughWeek,
  findDueUserOfficialMatch,
  hasRequiredOfficialMatch,
  type DueUserOfficialMatch,
} from "../../src/domain/tournament/progressOfficialTournaments";'''
if old_import not in text:
    raise SystemExit("official tournament import anchor mismatch")
text = text.replace(old_import, new_import, 1)

start = text.index("function applyOfficialMatch(\n")
end = text.index("\nfunction teamPresentation(", start)
replacement = r'''function buildOfficialSimulationContext(
  state: GameState,
  due: DueUserOfficialMatch,
) {
  const opponentContext =
    due.opponent.source === "world-school"
      ? {
          state,
          schoolId: due.opponent.schoolId,
          selection: autoSelectTeam({
            state,
            schoolId: due.opponent.schoolId,
          }),
        }
      : (() => {
          const materialized = materializeGuestOpponent({
            state,
            entrant: due.opponent,
            data: gameData,
          });
          return {
            state: materialized.temporaryState,
            schoolId: materialized.school.id,
            selection: materialized.selection,
          };
        })();
  return {
    ...opponentContext,
    userIsHome: due.match.homeEntrantId === due.userEntrant.entrantId,
  };
}

function buildOfficialActionOutcome(
  due: DueUserOfficialMatch,
  simulation: MatchStepResult,
) {
  return {
    officialMatch: {
      tournamentId: due.stage.tournamentId,
      circuit: due.circuit,
      level: due.level,
      round: due.match.round,
      opponent: {
        entrantId: due.opponent.entrantId,
        source: due.opponent.source,
        displayName: due.opponent.displayName,
        shortName: due.opponent.shortName,
      },
    },
    simulation,
  };
}

function validateOfficialMatchStart(
  state: GameState,
  teamSelection: TeamSelection,
  due: DueUserOfficialMatch,
): void {
  if (!isWeeklyActionCompleted(state, "training")) {
    return conflict(
      "official_match_training_required",
      "公式戦の前に今週の練習を完了してください",
    );
  }
  const issues = validateTeamSelection({
    state,
    schoolId: state.userSchoolId,
    selection: teamSelection,
  });
  if (issues.length > 0) {
    return conflict("invalid_team_selection", issues[0]!.message);
  }
  if (
    state.activeMatch &&
    state.activeMatch.phase !== "match-complete" &&
    (state.activeMatch.id !== matchId(due.match.id) ||
      state.activeMatch.runtime?.controlledSchoolId !== state.userSchoolId)
  ) {
    return conflict(
      "match_already_in_progress",
      "進行中の試合を完了してください",
    );
  }
}

function applyOfficialMatch(
  state: GameState,
  teamSelection: TeamSelection,
): AppliedGameAction {
  const due = findDueUserOfficialMatch(state);
  if (!due) {
    return conflict(
      "official_match_not_due",
      "現在開始できる公式戦がありません",
    );
  }
  validateOfficialMatchStart(state, teamSelection, due);

  const existing = state.activeMatch;
  if (
    existing?.runtime &&
    existing.phase !== "match-complete" &&
    existing.id === matchId(due.match.id) &&
    existing.runtime.controlledSchoolId === state.userSchoolId
  ) {
    return {
      state,
      teamSelection,
      outcome: buildOfficialActionOutcome(due, {
        match: existing,
        analysis: null,
      }),
    };
  }

  try {
    const context = buildOfficialSimulationContext(state, due);
    const id = matchId(due.match.id);
    const random = new SeededRandom(state.seed).fork(
      `match:${due.stage.tournamentId}:${due.match.id}`,
    );
    const simulation = startMatch({
      state: context.state,
      id,
      homeSchoolId: context.userIsHome
        ? state.userSchoolId
        : context.schoolId,
      awaySchoolId: context.userIsHome
        ? context.schoolId
        : state.userSchoolId,
      homeSelection: context.userIsHome ? teamSelection : context.selection,
      awaySelection: context.userIsHome ? context.selection : teamSelection,
      bestOfSets: 3,
      random,
      controlledSchoolId: state.userSchoolId,
      dynamicsReadinessByPlayerId: buildPveDynamicsReadinessByPlayerId(state),
    });

    const startedState: GameState = {
      ...state,
      activeMatch: simulation.match,
    };
    return {
      state: startedState,
      teamSelection,
      outcome: buildOfficialActionOutcome(due, simulation),
    };
  } catch (error) {
    if (error instanceof GameRuleConflictError) {
      throw error;
    }
    return conflict(
      "official_match_unavailable",
      error instanceof Error ? error.message : "公式戦を開始できません",
    );
  }
}

function applyOfficialMatchCommand(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "match-command" }>,
): AppliedGameAction {
  const due = findDueUserOfficialMatch(state);
  const activeMatch = state.activeMatch;
  if (!due || !activeMatch?.runtime) {
    return conflict(
      "active_official_match_not_found",
      "進行中の公式戦がありません",
    );
  }
  if (
    activeMatch.id !== matchId(due.match.id) ||
    activeMatch.runtime.controlledSchoolId !== state.userSchoolId
  ) {
    return conflict(
      "active_official_match_mismatch",
      "進行中の試合と公式戦予定が一致しません",
    );
  }

  const context = buildOfficialSimulationContext(state, due);
  const expectedHomeSchoolId = context.userIsHome
    ? state.userSchoolId
    : context.schoolId;
  const expectedAwaySchoolId = context.userIsHome
    ? context.schoolId
    : state.userSchoolId;
  if (
    activeMatch.homeSchoolId !== expectedHomeSchoolId ||
    activeMatch.awaySchoolId !== expectedAwaySchoolId
  ) {
    return conflict(
      "active_official_match_participants_mismatch",
      "進行中の公式戦の対戦情報が一致しません",
    );
  }

  try {
    const commandedMatch = applyMatchCommand({
      state: context.state,
      match: activeMatch,
      schoolId: state.userSchoolId,
      command: action.command,
    });
    const simulation = resumeMatch({
      state: context.state,
      match: commandedMatch,
    });
    const resumedState: GameState = {
      ...state,
      activeMatch: simulation.match,
    };

    if (!simulation.analysis) {
      return {
        state: resumedState,
        teamSelection,
        outcome: buildOfficialPresentation(
          resumedState,
          buildOfficialActionOutcome(due, simulation),
        ),
      };
    }

    const recorded = recordOfficialTournamentOutcome({
      state: resumedState,
      circuit: due.circuit,
      level: due.level,
      bracketMatchId: due.match.id,
      match: simulation.match,
    });
    const progressed = advanceOfficialTournamentsThroughWeek(recorded);
    return {
      state: progressed,
      teamSelection,
      outcome: buildOfficialPresentation(
        progressed,
        buildOfficialActionOutcome(due, simulation),
      ),
    };
  } catch (error) {
    if (error instanceof MatchCommandValidationError) {
      return conflict(error.code.replaceAll("-", "_"), error.message);
    }
    if (error instanceof GameRuleConflictError) {
      throw error;
    }
    return conflict(
      "match_command_unavailable",
      error instanceof Error
        ? error.message
        : "公式戦の監督指示を処理できません",
    );
  }
}

function applyActiveMatchCommand(
  state: GameState,
  teamSelection: TeamSelection,
  action: Extract<GameAction, { type: "match-command" }>,
): AppliedGameAction {
  const activeMatch = state.activeMatch;
  if (!activeMatch?.runtime) {
    return conflict("active_match_not_found", "進行中の試合がありません");
  }

  const due = findDueUserOfficialMatch(state);
  if (due && activeMatch.id === matchId(due.match.id)) {
    return applyOfficialMatchCommand(state, teamSelection, action);
  }

  const scheduledOpponentId =
    state.weeklySchedule.practiceMatch.scheduledOpponentId;
  const activeOpponentId =
    activeMatch.homeSchoolId === state.userSchoolId
      ? activeMatch.awaySchoolId
      : activeMatch.awaySchoolId === state.userSchoolId
        ? activeMatch.homeSchoolId
        : null;
  if (scheduledOpponentId && activeOpponentId === scheduledOpponentId) {
    return applyPracticeMatchCommand(state, teamSelection, action);
  }

  return conflict(
    "active_match_context_mismatch",
    "進行中の試合を確認できません",
  );
}
'''
text = text[:start] + replacement + text[end:]

pstart = text.index("function officialPresentation(\n")
pend = text.index("\nfunction hasUserOfficialMatchOnCurrentDate(", pstart)
presentation = r'''function buildOfficialPresentation(
  state: GameState,
  outcome: ReturnType<typeof buildOfficialActionOutcome>,
): PendingMatchPresentation {
  const simulation = outcome.simulation;
  const fallback = {
    displayName: outcome.officialMatch.opponent.displayName,
    shortName: outcome.officialMatch.opponent.shortName,
  };
  return {
    kind: "official",
    simulation,
    homeTeam: teamPresentation(
      state,
      simulation.match.homeSchoolId,
      simulation.match.homeSchoolId === state.userSchoolId
        ? undefined
        : fallback,
    ),
    awayTeam: teamPresentation(
      state,
      simulation.match.awaySchoolId,
      simulation.match.awaySchoolId === state.userSchoolId
        ? undefined
        : fallback,
    ),
    official: {
      tournamentId: outcome.officialMatch.tournamentId,
      circuit: outcome.officialMatch.circuit,
      level: outcome.officialMatch.level,
      round: outcome.officialMatch.round,
    },
  };
}

function officialPresentation(
  state: GameState,
  applied: AppliedGameAction,
): PendingMatchPresentation {
  return buildOfficialPresentation(
    state,
    applied.outcome as ReturnType<typeof buildOfficialActionOutcome>,
  );
}
'''
text = text[:pstart] + presentation + text[pend:]

old_switch = '''    case "match-command":
      return applyPracticeMatchCommand(state, teamSelection, action);'''
new_switch = '''    case "match-command":
      return applyActiveMatchCommand(state, teamSelection, action);'''
if old_switch not in text:
    raise SystemExit("match-command switch anchor mismatch")
text = text.replace(old_switch, new_switch, 1)

path.write_text(text)
