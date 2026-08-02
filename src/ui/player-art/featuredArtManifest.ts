import kurobaBust from "../../assets/characters/featured/kuroba-hayato/bust-neutral.webp";
import kurobaChibi from "../../assets/characters/featured/kuroba-hayato/chibi-neutral.webp";
import kurobaFocused from "../../assets/characters/featured/kuroba-hayato/expression-focused.webp";
import kurobaFrustrated from "../../assets/characters/featured/kuroba-hayato/expression-frustrated.webp";
import kurobaHappy from "../../assets/characters/featured/kuroba-hayato/expression-happy.webp";
import kurobaNeutral from "../../assets/characters/featured/kuroba-hayato/expression-neutral.webp";
import kurobaFull from "../../assets/characters/featured/kuroba-hayato/full-neutral.webp";
import setoBust from "../../assets/characters/featured/seto-soma/bust-neutral.webp";
import setoChibi from "../../assets/characters/featured/seto-soma/chibi-neutral.webp";
import setoFocused from "../../assets/characters/featured/seto-soma/expression-focused.webp";
import setoFrustrated from "../../assets/characters/featured/seto-soma/expression-frustrated.webp";
import setoHappy from "../../assets/characters/featured/seto-soma/expression-happy.webp";
import setoNeutral from "../../assets/characters/featured/seto-soma/expression-neutral.webp";
import setoFull from "../../assets/characters/featured/seto-soma/full-neutral.webp";
import higamiBust from "../../assets/characters/featured/higami-ren/bust-neutral.webp";
import higamiChibi from "../../assets/characters/featured/higami-ren/chibi-neutral.webp";
import higamiFocused from "../../assets/characters/featured/higami-ren/expression-focused.webp";
import higamiFrustrated from "../../assets/characters/featured/higami-ren/expression-frustrated.webp";
import higamiHappy from "../../assets/characters/featured/higami-ren/expression-happy.webp";
import higamiNeutral from "../../assets/characters/featured/higami-ren/expression-neutral.webp";
import higamiFull from "../../assets/characters/featured/higami-ren/full-neutral.webp";
import shiromaBust from "../../assets/characters/featured/shiroma-minato/bust-neutral.webp";
import shiromaChibi from "../../assets/characters/featured/shiroma-minato/chibi-neutral.webp";
import shiromaFocused from "../../assets/characters/featured/shiroma-minato/expression-focused.webp";
import shiromaFrustrated from "../../assets/characters/featured/shiroma-minato/expression-frustrated.webp";
import shiromaHappy from "../../assets/characters/featured/shiroma-minato/expression-happy.webp";
import shiromaNeutral from "../../assets/characters/featured/shiroma-minato/expression-neutral.webp";
import shiromaFull from "../../assets/characters/featured/shiroma-minato/full-neutral.webp";
import { resolveFeaturedCharacter } from "../../domain/appearance/characterWorld";
import type { Player } from "../../domain/model/Player";
import type { School } from "../../domain/model/School";

export const FEATURED_ART_VARIANTS = [
  "bust",
  "full",
  "chibi",
  "expression-neutral",
  "expression-focused",
  "expression-happy",
  "expression-frustrated",
] as const;

export type FeaturedArtVariant = (typeof FEATURED_ART_VARIANTS)[number];

type FeaturedArtSet = Readonly<Record<FeaturedArtVariant, string>>;

const FEATURED_ART: Readonly<Record<string, FeaturedArtSet>> = {
  "kuroba-hayato": {
    bust: kurobaBust,
    full: kurobaFull,
    chibi: kurobaChibi,
    "expression-neutral": kurobaNeutral,
    "expression-focused": kurobaFocused,
    "expression-happy": kurobaHappy,
    "expression-frustrated": kurobaFrustrated,
  },
  "seto-soma": {
    bust: setoBust,
    full: setoFull,
    chibi: setoChibi,
    "expression-neutral": setoNeutral,
    "expression-focused": setoFocused,
    "expression-happy": setoHappy,
    "expression-frustrated": setoFrustrated,
  },
  "higami-ren": {
    bust: higamiBust,
    full: higamiFull,
    chibi: higamiChibi,
    "expression-neutral": higamiNeutral,
    "expression-focused": higamiFocused,
    "expression-happy": higamiHappy,
    "expression-frustrated": higamiFrustrated,
  },
  "shiroma-minato": {
    bust: shiromaBust,
    full: shiromaFull,
    chibi: shiromaChibi,
    "expression-neutral": shiromaNeutral,
    "expression-focused": shiromaFocused,
    "expression-happy": shiromaHappy,
    "expression-frustrated": shiromaFrustrated,
  },
};

export function resolveFeaturedArtUrl(
  player: Player,
  school: School | null | undefined,
  variant: FeaturedArtVariant,
): string | null {
  const featured = resolveFeaturedCharacter(player, school);
  if (!featured) {
    return null;
  }

  return FEATURED_ART[featured.characterId]?.[variant] ?? null;
}
