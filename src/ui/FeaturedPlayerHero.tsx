import {
  resolveCharacterVisual,
  resolveFeaturedCharacter,
} from "../domain/appearance/characterWorld";
import type { Player, PlayerAbilities } from "../domain/model/Player";
import type { School } from "../domain/model/School";
import { PlayerCharacter } from "./PlayerCharacter";
import { SchoolEmblem } from "./SchoolEmblem";
import "./featured-player-hero.css";

interface FeaturedPlayerHeroProps {
  player: Player;
  school: School;
  onOpenTeam: () => void;
}

interface AbilityDisplay {
  key: keyof PlayerAbilities;
  label: string;
}

function highlightedAbilities(player: Player): AbilityDisplay[] {
  switch (player.preferredPosition) {
    case "S":
      return [
        { key: "set", label: "トス" },
        { key: "decision", label: "判断" },
        { key: "mental", label: "メンタル" },
      ];
    case "L":
      return [
        { key: "receive", label: "レシーブ" },
        { key: "speed", label: "スピード" },
        { key: "decision", label: "判断" },
      ];
    case "MB":
      return [
        { key: "block", label: "ブロック" },
        { key: "jump", label: "ジャンプ" },
        { key: "spike", label: "スパイク" },
      ];
    case "OH":
    case "OP":
      return [
        { key: "spike", label: "スパイク" },
        { key: "jump", label: "ジャンプ" },
        { key: "serve", label: "サーブ" },
      ];
  }
}

export function FeaturedPlayerHero({
  player,
  school,
  onOpenTeam,
}: FeaturedPlayerHeroProps) {
  const visual = resolveCharacterVisual(player, school);
  const featured = resolveFeaturedCharacter(player, school);
  const abilities = highlightedAbilities(player);

  return (
    <section
      aria-label="チームフェイス"
      className="featured-player-hero"
      style={
        {
          "--featured-primary": visual.theme.primary,
          "--featured-secondary": visual.theme.secondary,
          "--featured-accent": visual.theme.accent,
          "--featured-glow": visual.theme.glow,
        } as React.CSSProperties
      }
    >
      <div className="featured-player-hero__art">
        <PlayerCharacter player={player} school={school} variant="portrait" />
      </div>
      <div className="featured-player-hero__content">
        <div className="featured-player-hero__school">
          <SchoolEmblem school={school} />
          <div>
            <span>TEAM FACE</span>
            <strong>{school.name}</strong>
          </div>
        </div>
        <div className="featured-player-hero__identity">
          <span>{featured?.roleLabel ?? visual.roleLabel}</span>
          <h2>
            {player.lastName} {player.firstName}
          </h2>
          <p>{player.reading}</p>
        </div>
        <div className="featured-player-hero__meta">
          <span>{player.grade}年</span>
          <span>{player.preferredPosition}</span>
          <span>{player.heightCm}cm</span>
          <span>背番号 {visual.jerseyNumber}</span>
        </div>
        <div className="featured-player-hero__abilities" aria-label="主要能力">
          {abilities.map((ability) => (
            <div key={ability.key}>
              <span>{ability.label}</span>
              <strong>{player.abilities[ability.key]}</strong>
              <span className="featured-player-hero__bar" aria-hidden="true">
                <span
                  style={{ width: `${player.abilities[ability.key]}%` }}
                />
              </span>
            </div>
          ))}
        </div>
        <div className="featured-player-hero__condition">
          <span>状態 {player.condition}</span>
          <span>疲労 {player.fatigue}</span>
          <span>士気 {player.morale}</span>
        </div>
        <button onClick={onOpenTeam} type="button">
          チームを見る
        </button>
      </div>
    </section>
  );
}
