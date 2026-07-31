import type { CSSProperties } from "react";
import {
  createPlayerArtRecipe,
  playerArtIdentitySignature,
  type PlayerArtVariant,
} from "../../domain/appearance/playerArtRecipe";
import type { CharacterExpression } from "../../domain/appearance/playerAppearance";
import type { Player } from "../../domain/model/Player";
import type { School } from "../../domain/model/School";
import {
  resolveGeneratedArtLayers,
  type GeneratedArtLayer,
} from "./generatedArtManifest";
import { supportsRasterMasks } from "./rasterMaskSupport";
import { useAssetBatchStatus } from "./useAssetBatchStatus";
import "./player-art.css";

interface GeneratedPlayerArtProps {
  player: Player;
  school?: School | null;
  variant: PlayerArtVariant;
  expressionOverride?: CharacterExpression;
  className?: string;
  testId?: string;
}

function percentage(offset: number, maximum: number): number {
  return maximum <= 0 ? 0 : (offset / maximum) * 100;
}

function layerStyle(layer: GeneratedArtLayer): CSSProperties {
  const { sourceRect } = layer;
  const widthScale = (sourceRect.atlasWidth / sourceRect.width) * 100;
  const heightScale = (sourceRect.atlasHeight / sourceRect.height) * 100;
  const horizontal = percentage(
    sourceRect.x,
    sourceRect.atlasWidth - sourceRect.width,
  );
  const vertical = percentage(
    sourceRect.y,
    sourceRect.atlasHeight - sourceRect.height,
  );
  const size = `${widthScale}% ${heightScale}%`;
  const position = `${horizontal}% ${vertical}%`;
  const image = `url("${layer.url}")`;

  if (layer.mode === "image") {
    return {
      backgroundImage: image,
      backgroundPosition: position,
      backgroundSize: size,
    };
  }

  return {
    backgroundColor: layer.color ?? "transparent",
    maskImage: image,
    maskPosition: position,
    maskRepeat: "no-repeat",
    maskSize: size,
    WebkitMaskImage: image,
    WebkitMaskPosition: position,
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: size,
  };
}

export function GeneratedPlayerArt({
  player,
  school,
  variant,
  expressionOverride,
  className,
  testId,
}: GeneratedPlayerArtProps) {
  const recipe = createPlayerArtRecipe(player, school);
  const effectiveRecipe = expressionOverride
    ? { ...recipe, expression: expressionOverride }
    : recipe;
  const layers = resolveGeneratedArtLayers(effectiveRecipe);
  const masksSupported = supportsRasterMasks();
  const urls = masksSupported ? layers.map((layer) => layer.url) : [];
  const status = useAssetBatchStatus(urls);

  if (!masksSupported || status !== "loaded") {
    return null;
  }

  const classNames = ["player-art", `player-art--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      aria-hidden="true"
      className={classNames}
      data-art-signature={playerArtIdentitySignature(effectiveRecipe)}
      data-expression={effectiveRecipe.expression}
      data-testid={testId}
    >
      {layers.map((layer) => (
        <span
          className={`player-art__layer player-art__layer--${layer.slot}`}
          data-testid="player-art-layer"
          key={`${layer.slot}:${layer.sourceRect.x}:${layer.sourceRect.y}`}
          style={layerStyle(layer)}
        />
      ))}
      <span className="player-art__number">{effectiveRecipe.jerseyNumber}</span>
    </span>
  );
}
