import { useEffect, useMemo, useState } from "react";
import { loadAsset } from "./assetLoadCache";

export type AssetBatchStatus = "loading" | "loaded" | "failed";

export function useAssetBatchStatus(urls: readonly string[]): AssetBatchStatus {
  const key = [...new Set(urls)].sort().join("\u0000");
  const stableUrls = useMemo(
    () => (key ? key.split("\u0000") : []),
    [key],
  );
  const [status, setStatus] = useState<AssetBatchStatus>(() =>
    stableUrls.length === 0 ? "loaded" : "loading",
  );

  useEffect(() => {
    if (stableUrls.length === 0) {
      setStatus("loaded");
      return undefined;
    }

    let active = true;
    setStatus("loading");
    const requests = stableUrls.map((url) => loadAsset(url));
    void Promise.all(requests).then((results) => {
      if (active) {
        setStatus(
          results.every((result) => result === "loaded")
            ? "loaded"
            : "failed",
        );
      }
    });

    return () => {
      active = false;
    };
  }, [stableUrls]);

  return status;
}
