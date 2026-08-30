import { z } from "zod";
import { ABILITY_KEYS, type Player } from "../../src/domain/model/Player";
import { reputationGrade } from "../../src/domain/school/reputation";
import type { GameStore } from "../data/GameStore";
import type { PvPStore } from "../data/PvPStore";
import { json, jsonError } from "../http/json";
import type { AuthenticatedRequestHandler } from "../router";

const requestSchema = z
  .object({
    operationId: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(1).max(120)),
    revision: z.number().int().positive(),
  })
  .strict();

export interface PvpPublishHandlerDependencies {
  gameStore: GameStore;
  pvpStore: PvPStore;
}

function invalidRequest(): Response {
  return jsonError(
    400,
    "invalid_pvp_publish_request",
    "公開条件を確認してください",
  );
}

function revisionConflict(): Response {
  return jsonError(
    409,
    "revision_conflict",
    "別の端末または操作でデータが更新されています",
  );
}

function normalizedPlayer(player: Player): Player {
  return {
    ...structuredClone(player),
    condition: 100,
    fatigue: 0,
    injury: null,
  };
}

function teamPower(players: readonly Player[]): number {
  if (players.length === 0) return 0;

  const total = players.reduce(
    (playerTotal, player) =>
      playerTotal +
      ABILITY_KEYS.reduce(
        (abilityTotal, key) => abilityTotal + player.abilities[key],
        0,
      ) /
        ABILITY_KEYS.length,
    0,
  );

  return Math.max(0, Math.min(100, Math.round(total / players.length)));
}

export function createPvpPublishHandler(
  deps: PvpPublishHandlerDependencies,
): AuthenticatedRequestHandler {
  return async (request, user) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidRequest();
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return invalidRequest();
    }

    const snapshot = await deps.gameStore.getSnapshot(user.id);
    if (!snapshot) {
      return jsonError(
        409,
        "game_not_initialized",
        "学校データを作成してください",
      );
    }
    if (snapshot.revision !== parsed.data.revision) {
      return revisionConflict();
    }

    const sourceSchool = snapshot.state.schools[snapshot.state.userSchoolId];
    if (!sourceSchool) {
      throw new Error("authoritative school is missing");
    }

    const school = structuredClone(sourceSchool);
    const roster = sourceSchool.playerIds.map((playerId) => {
      const player = snapshot.state.players[playerId];
      if (!player) {
        throw new Error(
          `authoritative roster references unknown player: ${playerId}`,
        );
      }
      return normalizedPlayer(player);
    });
    const players = Object.fromEntries(
      roster.map((player) => [player.id, player]),
    ) as Record<string, Player>;
    const power = teamPower(roster);
    const rank = reputationGrade(sourceSchool.reputationPoints);

    const published = await deps.pvpStore.publishSnapshot({
      userId: user.id,
      operationId: parsed.data.operationId,
      sourceRevision: snapshot.revision,
      sourceAcademicYear: snapshot.state.calendar.academicYear,
      sourceYearIndex: snapshot.state.yearIndex,
      school,
      players,
      teamSelection: structuredClone(snapshot.teamSelection),
      reputationRank: rank,
      teamPower: power,
    });

    return json({
      operationId: parsed.data.operationId,
      revision: snapshot.revision,
      team: {
        snapshotId: published.id,
        schoolName: published.school.name,
        schoolShortName: published.school.shortName,
        reputationRank: rank,
        teamPower: power,
        academicYear: published.sourceAcademicYear,
        publishedAt: published.publishedAt,
      },
    });
  };
}
