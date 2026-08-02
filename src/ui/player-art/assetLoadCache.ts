export type AssetLoadStatus = "loaded" | "failed";

const assetLoadCache = new Map<string, Promise<AssetLoadStatus>>();

export function loadAsset(url: string): Promise<AssetLoadStatus> {
  const cached = assetLoadCache.get(url);
  if (cached) {
    return cached;
  }

  const request = new Promise<AssetLoadStatus>((resolve) => {
    if (typeof Image === "undefined") {
      resolve("failed");
      return;
    }

    const image = new Image();
    image.onload = () => resolve("loaded");
    image.onerror = () => resolve("failed");
    image.src = url;
  });

  assetLoadCache.set(url, request);
  return request;
}

export function resetAssetLoadCacheForTests(): void {
  assetLoadCache.clear();
}
