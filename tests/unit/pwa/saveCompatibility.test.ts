import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createDemoGame } from "../../../src/app/createDemoGame";
import {
  decodeGameState,
  encodeGameState,
} from "../../../src/persistence/gameStateCodec";

describe("Phase18 PWA save compatibility", () => {
  it("keeps the existing schema v8 save payload unchanged while PWA startup initializes", async () => {
    const state = createDemoGame();
    const encodedBefore = encodeGameState(state);
    const { registerServiceWorker } = await import(
      "../../../src/pwa/registerServiceWorker"
    );

    const registration = await registerServiceWorker(
      () => undefined,
      {} as Navigator,
    );
    const encodedAfter = encodeGameState(state);

    expect(registration).toBeNull();
    expect(encodedAfter).toBe(encodedBefore);
    expect(decodeGameState(encodedAfter)).toEqual(decodeGameState(encodedBefore));
    expect(decodeGameState(encodedAfter).schemaVersion).toBe(8);
  });

  it("keeps the service worker outside every client-side game save namespace", () => {
    const serviceWorkerSource = readFileSync(
      resolve(process.cwd(), "public/sw.js"),
      "utf8",
    );

    expect(serviceWorkerSource).not.toMatch(
      /\b(localStorage|indexedDB|gameState|saveGame|snapshot)\b/i,
    );
  });
});
