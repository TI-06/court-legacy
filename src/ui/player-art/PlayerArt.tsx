import { resolveFeaturedCharacter } from "../../domain/appearance/characterWorld";
import type { CharacterExpression } from "../../domain/appearance/playerAppearance";
import type { PlayerArtRecipe } from "../../domain/appearance/playerArtRecipe";
import type { Player } from "../../domain/model/Player";
import type { School } from "../../domain/model/School";
import { FeaturedPlayerArt } from "./FeaturedPlayerArt";
import { GeneratedPlayerArt } from "./GeneratedPlayerArt";

export type PlayerArtVariant = "card" | "portrait" | "full";

interface PlayerArtProps {
  player: Player;
  school?: School | null;
  variant: PlayerArtVariant;
  expressionOverride?: CharacterExpression;
  recipeOverride?: PlayerArtRecipe;
  className?: string;
  loading?: "eager" | "lazy";
}

const FEATURED_VARIANTS = {
  card: "chibi",
  portrait: "bust",
  full: "full",
} as const;

export function PlayerArt({
  player,
  school,
  variant,
  expressionOverride,
  recipeOverride,
  className,
  loading,
}: PlayerArtProps) {
  if (resolveFeaturedCharacter(player, school)) {
    return (
      <FeaturedPlayerArt
        className={className}
        loading={loading}
        player={player}
        school={school}
        testId="featured-player-art"
        variant={FEATURED_VARIANTS[variant]}
      />
    );
  }

  return (
    <GeneratedPlayerArt
      className={className}
      expressionOverride={expressionOverride}
      player={player}
      recipeOverride={recipeOverride}
      school={school}
      testId="generated-player-art"
      variant={variant}
    />
  );
}
