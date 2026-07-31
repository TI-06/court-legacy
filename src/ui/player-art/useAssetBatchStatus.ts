import { useEffect, useMemo, useState } from "react";
import { loadAsset } from "./assetLoadCache";

export type AssetBatchStatus = "loading" | "loaded" | "failed";

interface AssetBatchResult {
  key: string;
  status: AssetBatchStatus;
}

export function useAssetBatchStatus(urls: readonly string[]): AssetBatchStatus {
  const key = [...new Set(urls)].sort().join("\u0000");
  const stableUrls = useMemo(() => (key ? key.split("\u0000") : []), [key]);
  const [result, setResult] = useState<AssetBatchResult>({
    key: "",
    status: "loaded",
  });

  useEffect(() => {
    if (!key) {
      return undefined;
    }

    let active = true;
    const requests = stableUrls.map((url) => loadAsset(url));
    void Promise.all(requests).then((statuses) => {
      if (active) {
        setResult({
          key,
          status: statuses.every((status) => status === "loaded")
            ? "loaded"
            : "failed",
        });
      }
    });

    return () => {
      active = false;
    };
  }, [key, stableUrls]);

  if (!key) {
    return "loaded";
  }

  return result.key === key ? result.status : "loading";
}
