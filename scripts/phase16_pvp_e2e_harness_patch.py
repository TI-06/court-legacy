from pathlib import Path

p = Path("src/app/createBrowserAppDependencies.ts")
s = p.read_text()

old = '''import type {
  PvpChallengeRequest,
  PvpHistoryEntry,
'''
new = '''import type {
  PvpChallengeCommandRequest,
  PvpChallengeInProgressResponse,
  PvpChallengeRequest,
  PvpChallengeResponse,
  PvpChallengeSessionResponse,
  PvpHistoryEntry,
'''
assert old in s
s = s.replace(old, new, 1)

marker = 'const HARNESS_PVP_SEASON_ID = "2026-08";\n'
assert marker in s
addition = '''const HARNESS_PVP_SEASON_ID = "2026-08";

interface HarnessPvpSession {
  operationId: string;
  opponent: PvpOpponentSummary;
  selection: PvpChallengeInProgressResponse["segment"]["challengerSelection"];
  tactics: PvpChallengeInProgressResponse["segment"]["challengerTactics"];
  step: number;
}
'''
s = s.replace(marker, addition, 1)

old = '''  private pvpRating = 1000;
  private pvpHistory: PvpHistoryEntry[] = [];
'''
new = '''  private pvpRating = 1000;
  private pvpHistory: PvpHistoryEntry[] = [];
  private readonly pvpSessions = new Map<string, HarnessPvpSession>();
  private readonly pvpCompletedSessions = new Map<string, PvpChallengeResponse>();
'''
assert old in s
s = s.replace(old, new, 1)

start = s.index('  async challengePvpTeam(_accessToken: string, request: PvpChallengeRequest) {')
end = s.index('\n  }\n}\n\nfunction browserEnvironment()', start) + len('\n  }')
replacement = '''  private harnessPvpInProgress(
    session: HarnessPvpSession,
    revision: number,
  ): PvpChallengeInProgressResponse {
    const isSetBreak = session.step === 1;
    const challengerScore = session.step === 0 ? 8 : session.step === 1 ? 25 : 12;
    const defenderScore = session.step === 0 ? 12 : session.step === 1 ? 20 : 16;
    return {
      status: "in-progress",
      operationId: session.operationId,
      revision,
      seasonId: HARNESS_PVP_SEASON_ID,
      opponent: {
        snapshotId: session.opponent.snapshotId,
        schoolName: session.opponent.schoolName,
        schoolShortName: session.opponent.schoolShortName,
      },
      segment: {
        status: "in-progress",
        operationId: session.operationId,
        matchId: `pvp:harness:${session.operationId}`,
        phase: "coach-decision",
        currentSetNumber: session.step === 0 ? 1 : 2,
        challengerSetsWon: session.step >= 1 ? 1 : 0,
        defenderSetsWon: 0,
        currentScore: {
          challenger: challengerScore,
          defender: defenderScore,
        },
        challengerSelection: session.selection,
        challengerTactics: session.tactics,
        timeoutAvailable: !isSetBreak,
        sets:
          session.step >= 1
            ? [
                {
                  setNumber: 1,
                  challengerScore: 25,
                  defenderScore: 20,
                  completed: true,
                  winner: "challenger",
                },
              ]
            : [],
        pendingDecisionReason: isSetBreak ? "set-break" : "opponent-run",
        events: [
          {
            sequence: session.step + 1,
            type: isSetBreak ? "set-end" : "point",
            setNumber: session.step === 0 ? 1 : 2,
            challengerScore,
            defenderScore,
            winner: isSetBreak ? "challenger" : "defender",
            detailCode: isSetBreak ? "set.end" : "point.attack",
          },
        ],
      },
    };
  }

  private finishHarnessPvpSession(
    session: HarnessPvpSession,
    revision: number,
  ): PvpChallengeResponse {
    const existing = this.pvpCompletedSessions.get(session.operationId);
    if (existing) return existing;

    const before = this.pvpRating;
    const after = before + 16;
    this.pvpRating = after;
    const matchId = `00000000-0000-4000-8000-${String(
      this.pvpHistory.length + 301,
    ).padStart(12, "0")}`;
    const createdAt = new Date().toISOString();
    const result = {
      outcome: "win" as const,
      challengerSetsWon: 2,
      defenderSetsWon: 1,
      sets: [
        { setNumber: 1, challengerScore: 25, defenderScore: 20 },
        { setNumber: 2, challengerScore: 22, defenderScore: 25 },
        { setNumber: 3, challengerScore: 25, defenderScore: 18 },
      ],
    };
    const history: PvpHistoryEntry = {
      matchId,
      createdAt,
      opponentSnapshotId: session.opponent.snapshotId,
      opponentSchoolName: session.opponent.schoolName,
      perspective: "challenger",
      outcome: result.outcome,
      ratingBefore: before,
      ratingAfter: after,
      result,
    };
    this.pvpHistory = [history, ...this.pvpHistory];
    const response: PvpChallengeResponse = {
      operationId: session.operationId,
      revision,
      seasonId: HARNESS_PVP_SEASON_ID,
      matchId,
      opponent: {
        snapshotId: session.opponent.snapshotId,
        schoolName: session.opponent.schoolName,
        schoolShortName: session.opponent.schoolShortName,
      },
      rating: { before, after, delta: after - before },
      result,
      createdAt,
    };
    this.pvpCompletedSessions.set(session.operationId, response);
    this.pvpSessions.delete(session.operationId);
    return response;
  }

  async challengePvpTeam(
    _accessToken: string,
    request: PvpChallengeRequest,
  ): Promise<PvpChallengeSessionResponse> {
    const snapshot = this.requireSnapshot();
    if (request.revision !== snapshot.revision) {
      throw new ApiError(
        409,
        "revision_conflict",
        "別の操作でテスト用データが更新されています",
      );
    }
    const opponent = this.pvpOpponents.find(
      (candidate) => candidate.snapshotId === request.opponentSnapshotId,
    );
    if (!opponent) {
      throw new ApiError(
        404,
        "pvp_opponent_unavailable",
        "この対戦相手は現在利用できません",
      );
    }
    await this.pvpDelay();

    const existingCompleted = this.pvpCompletedSessions.get(request.operationId);
    if (existingCompleted) return existingCompleted;
    const existing = this.pvpSessions.get(request.operationId);
    if (existing) return this.harnessPvpInProgress(existing, snapshot.revision);

    const school = snapshot.state.schools[snapshot.state.userSchoolId]!;
    const session: HarnessPvpSession = {
      operationId: request.operationId,
      opponent,
      selection: request.matchSelection ?? snapshot.teamSelection,
      tactics: request.matchTactics ?? school.tactics,
      step: 0,
    };
    this.pvpSessions.set(request.operationId, session);
    return this.harnessPvpInProgress(session, snapshot.revision);
  }

  async getPvpChallengeSession(
    _accessToken: string,
    operationId: string,
  ): Promise<PvpChallengeSessionResponse> {
    await this.pvpDelay();
    const completed = this.pvpCompletedSessions.get(operationId);
    if (completed) return completed;
    const session = this.pvpSessions.get(operationId);
    if (!session) {
      throw new ApiError(404, "pvp_session_not_found", "対戦状況を確認できません");
    }
    return this.harnessPvpInProgress(session, this.requireSnapshot().revision);
  }

  async commandPvpChallenge(
    _accessToken: string,
    request: PvpChallengeCommandRequest,
  ): Promise<PvpChallengeSessionResponse> {
    await this.pvpDelay();
    const completed = this.pvpCompletedSessions.get(request.operationId);
    if (completed) return completed;
    const session = this.pvpSessions.get(request.operationId);
    if (!session) {
      throw new ApiError(404, "pvp_session_not_found", "対戦状況を確認できません");
    }

    if (request.command.type === "set-match-tactics") {
      session.tactics = request.command.plan;
    } else if (request.command.type === "substitute") {
      const rotation = session.selection.rotation.map((assignment) =>
        assignment.playerId === request.command.outgoingPlayerId
          ? { ...assignment, playerId: request.command.incomingPlayerId }
          : assignment,
      );
      session.selection = {
        ...session.selection,
        rotation,
        benchPlayerIds: [
          ...session.selection.benchPlayerIds.filter(
            (id) => id !== request.command.incomingPlayerId,
          ),
          request.command.outgoingPlayerId,
        ],
        servingOrderPlayerIds: session.selection.servingOrderPlayerIds.map((id) =>
          id === request.command.outgoingPlayerId
            ? request.command.incomingPlayerId
            : id,
        ),
      };
    }

    session.step += 1;
    if (session.step >= 3) {
      return this.finishHarnessPvpSession(
        session,
        this.requireSnapshot().revision,
      );
    }
    return this.harnessPvpInProgress(session, this.requireSnapshot().revision);
  }'''
s = s[:start] + replacement + s[end:]
p.write_text(s)
