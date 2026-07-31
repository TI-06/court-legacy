import {
  loadAsset,
  resetAssetLoadCacheForTests,
} from "../../../../src/ui/player-art/assetLoadCache";

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

function imageFor(url: string): FakeImageInstance {
  const image = createdImages.find((candidate) => candidate.src === url);
  if (!image) {
    throw new Error(`image request not found: ${url}`);
  }
  return image;
}

describe("player art asset load cache", () => {
  beforeEach(() => {
    createdImages = [];
    vi.stubGlobal("Image", FakeImage);
    resetAssetLoadCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shares one Image request for the same URL", async () => {
    const first = loadAsset("/part.webp");
    const second = loadAsset("/part.webp");

    expect(first).toBe(second);
    expect(createdImages).toHaveLength(1);

    imageFor("/part.webp").onload?.();

    await expect(first).resolves.toBe("loaded");
  });

  it("remembers failures without retrying in a loop", async () => {
    const first = loadAsset("/missing.webp");

    imageFor("/missing.webp").onerror?.();

    await expect(first).resolves.toBe("failed");
    expect(loadAsset("/missing.webp")).toBe(first);
    await expect(loadAsset("/missing.webp")).resolves.toBe("failed");
    expect(createdImages).toHaveLength(1);
  });
});
