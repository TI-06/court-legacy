import { useEffect, useMemo, useState } from "react";
import { loadAsset } from "./assetLoadCache";

export type AssetBatchStatus = "loading" | "loaded" | "failed";

export function useAssetBatchStatus(
  urls: readonly string[],
): AssetBatchStatus {
  const key = [...new Set(urls)].sort().join("\u0000");
  const stableUrls = useMemo(() => {
    return key ? key.split("\u0000") : [];
  }, [key]);
  const [status, setStatus] = useState<AssetBatchStatus>(() => {
    return stableUrls.length === 0 ? "loaded" : "loading";
  });

  useEffect(() => {
    let active = true;

    if (stableUrls.length === 0) {
      setStatus("loaded");
      return () => {
        active = false;
      };
    }

    setStatus("loading");
    void Promise.all(stableUrls.map((url) => loadAsset(url))).then(
      (results) => {
        if (!active) {
          return;
        }
        setStatus(
          results.every((result) => result === "loaded")
            ? "loaded"
            : "failed",
        );
      },
    );

    return () => {
      active = false;
    };
  }, [stableUrls]);

  return status;
}
