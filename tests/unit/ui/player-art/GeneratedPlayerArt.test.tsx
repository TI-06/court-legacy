import { act, render, screen, waitFor } from "@testing-library/react";
import { createDemoGame } from "../../../../src/app/createDemoGame";
import { resolveFeaturedCharacter } from "../../../../src/domain/appearance/characterWorld";
import {
  loadAsset,
  resetAssetLoadCacheForTests,
} from "../../../../src/ui/player-art/assetLoadCache";
import { GeneratedPlayerArt } from "../../../../src/ui/player-art/GeneratedPlayerArt";

interface FakeImageInstance {
  onload: (() => void) | null;
  onerror: (() => void) | null;
  src: string;
}

let createdImages: FakeImageInstance[] = [];

class FakeImage implements FakeImageInstance {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";

  constructor() {
    createdImages.push(this);
  }
}

function generatedPlayerFixture() {
  const state = createDemoGame();
  const school = state.schools[state.userSchoolId]!;
  const player = school.playerIds
    .map((playerId) => state.players[playerId])
    .find((candidate) => {
      return candidate && resolveFeaturedCharacter(candidate, school) === null;
    });

  if (!player) {
    throw new Error("a generated player fixture is required");
  }

  return { player, school };
}

describe("GeneratedPlayerArt", () => {
  beforeEach(() => {
    createdImages = [];
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("CSS", { supports: vi.fn(() => true) });
    resetAssetLoadCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders only after every asset loads", async () => {
    const { player, school } = generatedPlayerFixture();

    render(
      <GeneratedPlayerArt
        player={player}
        school={school}
        testId="generated-art"
        variant="card"
      />,
    );

    expect(screen.queryByTestId("generated-art")).not.toBeInTheDocument();
    expect(createdImages).toHaveLength(1);

    await act(async () => {
      createdImages[0]!.onload?.();
      await Promise.resolve();
    });

    expect(await screen.findByTestId("generated-art")).toBeVisible();
    const layers = screen.getAllByTestId("player-art-layer");
    expect(layers.length).toBeGreaterThanOrEqual(4);
    expect(layers.length).toBeLessThanOrEqual(6);
    const svg = document.querySelector("svg[data-testid='player-character']");
    expect(svg).toBeNull();
  });

  it("hides the character when a required asset fails", async () => {
    const { player, school } = generatedPlayerFixture();

    render(
      <GeneratedPlayerArt
        player={player}
        school={school}
        testId="generated-art"
        variant="full"
      />,
    );

    expect(createdImages).toHaveLength(1);
    const failedUrl = createdImages[0]!.src;

    await act(async () => {
      createdImages[0]!.onerror?.();
      await Promise.resolve();
    });

    await expect(loadAsset(failedUrl)).resolves.toBe("failed");
    await waitFor(() => {
      expect(screen.queryByTestId("generated-art")).not.toBeInTheDocument();
    });
    expect(screen.queryAllByTestId("player-art-layer")).toHaveLength(0);
    const svg = document.querySelector("svg[data-testid='player-character']");
    expect(svg).toBeNull();
  });

  it("does not request assets without raster mask support", () => {
    vi.stubGlobal("CSS", { supports: vi.fn(() => false) });
    const { player, school } = generatedPlayerFixture();

    render(
      <GeneratedPlayerArt
        player={player}
        school={school}
        testId="generated-art"
        variant="portrait"
      />,
    );

    expect(screen.queryByTestId("generated-art")).not.toBeInTheDocument();
    expect(createdImages).toHaveLength(0);
  });
});
