from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"target not found in {path}: {old[:80]!r}")
    target.write_text(text.replace(old, new, 1))


replace_once(
    "src/features/match/MatchScreen.tsx",
    '  opponent: School;\n',
    '  opponent: Pick<School, "id" | "name" | "shortName">;\n',
)
replace_once(
    "src/features/match/MatchScreen.tsx",
    '  commandPending?: boolean;\n}',
    '  commandPending?: boolean;\n  schoolDisplayNames?: Partial<Record<School["id"], string>>;\n}',
)
replace_once(
    "src/features/match/MatchScreen.tsx",
    '  commandPending = false,\n}: MatchScreenProps) {',
    '  commandPending = false,\n  schoolDisplayNames,\n}: MatchScreenProps) {',
)
replace_once(
    "src/features/match/MatchScreen.tsx",
    '''    const schoolDisplayNames = presentation
      ? {
          [presentation.homeTeam.schoolId]: presentation.homeTeam.displayName,
          [presentation.awayTeam.schoolId]: presentation.awayTeam.displayName,
        }
      : undefined;
    return result.match.eventLog.slice(0, visibleEventIndex + 1).map((event) =>
      presentMatchEvent(event, {
        state,
        match: result.match,
        schoolDisplayNames,
      }),
    );
  }, [presentation, result, state, visibleEventIndex]);''',
    '''    const eventSchoolDisplayNames = presentation
      ? {
          [presentation.homeTeam.schoolId]: presentation.homeTeam.displayName,
          [presentation.awayTeam.schoolId]: presentation.awayTeam.displayName,
        }
      : schoolDisplayNames;
    return result.match.eventLog.slice(0, visibleEventIndex + 1).map((event) =>
      presentMatchEvent(event, {
        state,
        match: result.match,
        schoolDisplayNames: eventSchoolDisplayNames,
      }),
    );
  }, [presentation, result, schoolDisplayNames, state, visibleEventIndex]);''',
)

replace_once(
    "src/app/GameApp.tsx",
    'import type {\n  PvpChallengeResponse,\n',
    'import { isPvpChallengeInProgressResponse } from "../domain/pvp/pvpContracts";\nimport type {\n  PvpChallengeInProgressResponse,\n  PvpChallengeResponse,\n',
)
replace_once(
    "src/app/GameApp.tsx",
    'import { MatchScreen } from "../features/match/MatchScreen";\n',
    'import { MatchScreen } from "../features/match/MatchScreen";\nimport { buildPvpMatchScreenPresentation } from "../features/match/pvpMatchPresentation";\n',
)
replace_once(
    "src/app/GameApp.tsx",
    '''  const [pvpResult, setPvpResult] = useState<PvpChallengeResponse | null>(null);
  const [pvpLoading, setPvpLoading] = useState(false);''',
    '''  const [pvpResult, setPvpResult] = useState<PvpChallengeResponse | null>(null);
  const [pvpSession, setPvpSession] =
    useState<PvpChallengeInProgressResponse | null>(null);
  const [pvpActiveOpponent, setPvpActiveOpponent] =
    useState<PvpOpponentSummary | null>(null);
  const [pvpCommandPending, setPvpCommandPending] = useState(false);
  const [pvpLoading, setPvpLoading] = useState(false);''',
)
replace_once(
    "src/app/GameApp.tsx",
    '''  const awayStrength = useMemo(
    () => calculateSelectionStrength(gameState, opponentSelection),
    [gameState, opponentSelection],
  );''',
    '''  const awayStrength = useMemo(
    () => calculateSelectionStrength(gameState, opponentSelection),
    [gameState, opponentSelection],
  );
  const pvpMatchPresentation = useMemo(
    () =>
      pvpSession
        ? buildPvpMatchScreenPresentation(gameState.userSchoolId, pvpSession)
        : null,
    [gameState.userSchoolId, pvpSession],
  );''',
)
replace_once(
    "src/app/GameApp.tsx",
    '''      const response = await api.challengePvpTeam(session.accessToken, {
        operationId: crypto.randomUUID(),
        revision: cloudSession.snapshot.revision,
        opponentSnapshotId,
        ...(matchSelection ? { matchSelection } : {}),
        ...(matchTactics ? { matchTactics } : {}),
      });
      setPvpResult(response);
      await loadPvpData();''',
    '''      const response = await api.challengePvpTeam(session.accessToken, {
        operationId: crypto.randomUUID(),
        revision: cloudSession.snapshot.revision,
        opponentSnapshotId,
        ...(matchSelection ? { matchSelection } : {}),
        ...(matchTactics ? { matchTactics } : {}),
      });
      if (isPvpChallengeInProgressResponse(response)) {
        setPvpSession(response);
        setPvpActiveOpponent(
          pvpOpponents.find((item) => item.snapshotId === opponentSnapshotId) ??
            null,
        );
        setPvpResult(null);
        return;
      }
      setPvpSession(null);
      setPvpActiveOpponent(null);
      setPvpResult(response);
      await loadPvpData();''',
)
replace_once(
    "src/app/GameApp.tsx",
    '  const loadShop = async (): Promise<boolean> => {',
    '''  const adoptPvpCommandResponse = async (
    response: Awaited<ReturnType<NonNullable<GameApiClient["commandPvpChallenge"]>>>,
  ) => {
    if (isPvpChallengeInProgressResponse(response)) {
      setPvpSession(response);
      setPvpResult(null);
      return;
    }
    setPvpSession(null);
    setPvpActiveOpponent(null);
    setPvpResult(response);
    await loadPvpData();
  };

  const issuePvpMatchCommand = async (command: MatchCommand) => {
    if (!pvpSession || !api.commandPvpChallenge || pvpCommandPending) {
      if (!api.commandPvpChallenge) {
        setPvpError("対人戦の監督指示を利用できません");
      }
      return;
    }

    const operationId = pvpSession.operationId;
    const commandId = crypto.randomUUID();
    const request = { operationId, commandId, command };
    setPvpCommandPending(true);
    setPvpError(null);
    try {
      const response = await api.commandPvpChallenge(session.accessToken, request);
      await adoptPvpCommandResponse(response);
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === null &&
        api.getPvpChallengeSession
      ) {
        try {
          const recovered = await api.getPvpChallengeSession(
            session.accessToken,
            operationId,
          );
          if (!isPvpChallengeInProgressResponse(recovered)) {
            await adoptPvpCommandResponse(recovered);
            return;
          }
          if (
            recovered.segment.events.length !== pvpSession.segment.events.length ||
            recovered.segment.currentScore.challenger !==
              pvpSession.segment.currentScore.challenger ||
            recovered.segment.currentScore.defender !==
              pvpSession.segment.currentScore.defender
          ) {
            setPvpSession(recovered);
            return;
          }
          const retried = await api.commandPvpChallenge(session.accessToken, request);
          await adoptPvpCommandResponse(retried);
          return;
        } catch (recoveryError) {
          setPvpError(
            pvpErrorMessage(recoveryError, "対戦状況を復旧できませんでした"),
          );
          return;
        }
      }
      setPvpError(pvpErrorMessage(error, "監督指示を反映できませんでした"));
    } finally {
      setPvpCommandPending(false);
    }
  };

  const loadShop = async (): Promise<boolean> => {''',
)
replace_once(
    "src/app/GameApp.tsx",
    ''') : activeTab === "match" && matchView === "pvp" ? (
      <PvpScreen''',
    ''') : activeTab === "match" &&
      matchView === "pvp" &&
      pvpSession &&
      pvpMatchPresentation ? (
      <MatchScreen
        awaySelection={pvpMatchPresentation.awaySelection}
        awayStrength={pvpActiveOpponent?.teamPower ?? 0}
        homeSelection={pvpMatchPresentation.homeSelection}
        homeStrength={homeStrength}
        commandPending={pvpCommandPending}
        onCommand={issuePvpMatchCommand}
        onReturnHome={() => undefined}
        onStart={() => undefined}
        opponent={pvpMatchPresentation.opponent}
        reducedMotion={gameState.settings.reducedMotion}
        result={pvpMatchPresentation.result}
        schoolDisplayNames={pvpMatchPresentation.schoolDisplayNames}
        state={gameState}
      />
    ) : activeTab === "match" && matchView === "pvp" ? (
      <PvpScreen''',
)
