import { expect, it, vi } from "vitest";
import { playerId } from "../../../src/domain/model/identifiers";
import { HttpGameApiClient } from "../../../src/services/api/GameApiClient";

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

it("uses the Worker scouting recruitment route", async () => {
  const candidateId = playerId("candidate-route-regression");
  const fetchImpl = vi.fn().mockResolvedValue(
    jsonResponse({
      operationId: "recruit-route-1",
      game: { revision: 6 },
      outcome: {
        candidateId,
        committedCandidateIds: [candidateId],
        cycleKey: "school.user:year-1",
      },
    }),
  );
  const api = new HttpGameApiClient(fetchImpl);
  const request = {
    operationId: "recruit-route-1",
    revision: 5,
    candidateId,
  };

  await api.commitRecruit("access-token", request);

  expect(fetchImpl).toHaveBeenCalledWith(
    "/api/scouting/recruit",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify(request),
    }),
  );
});
