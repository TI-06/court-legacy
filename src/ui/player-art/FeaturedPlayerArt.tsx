import { useState } from "react";
import type { Player } from "../../domain/model/Player";
import type { School } from "../../domain/model/School";
import {
  resolveFeaturedArtUrl,
  type FeaturedArtVariant,
} from "./featuredArtManifest";
import "./featured-player-art.css";

interface FeaturedPlayerArtProps {
  player: Player;
  school?: School | null;
  variant: FeaturedArtVariant;
  className?: string;
  testId?: string;
  loading?: "eager" | "lazy";
}

export function FeaturedPlayerArt({
  player,
  school,
  variant,
  className,
  testId,
  loading = "lazy",
}: FeaturedPlayerArtProps) {
  const src = resolveFeaturedArtUrl(player, school, variant);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || failedSrc === src) {
    return null;
  }

  const classNames = [
    "featured-player-art",
    `featured-player-art--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <img
      alt=""
      aria-hidden="true"
      className={classNames}
      data-testid={testId}
      decoding="async"
      loading={loading}
      onError={() => setFailedSrc(src)}
      src={src}
    />
  );
}
