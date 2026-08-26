import type { Player } from "../domain/model/Player";
import type { School } from "../domain/model/School";
import {
  calculatePlayerDisplayPower,
  summarizePlayerAbilities,
} from "../domain/selectors/playerPresentation";

interface PlayerTileProps {
  player: Player;
  school?: School | null;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

function playerInitials(player: Player): string {
  return `${player.lastName.slice(0, 1)}${player.firstName.slice(0, 1)}`;
}

export function PlayerTile({
  player,
  school,
  selected = false,
  compact = false,
  onClick,
}: PlayerTileProps) {
  const summary = summarizePlayerAbilities(player);
  const displayPower = calculatePlayerDisplayPower(player);
  const content = (
    <>
      <span className="ui-player-tile__identity-mark" aria-hidden="true">
        {playerInitials(player)}
      </span>
      <span className="ui-player-tile__identity">
        <strong>
          {player.lastName} {player.firstName}
        </strong>
        <small>
          {player.grade}年・{player.preferredPosition}・{player.heightCm}cm
        </small>
        {school ? <small>{school.shortName}</small> : null}
      </span>
      <span className="ui-player-tile__power">
        <small>総合</small>
        <strong>{Math.round(displayPower / 100)}</strong>
      </span>
      {!compact ? (
        <span className="ui-player-tile__abilities" aria-label="主要能力">
          <small>攻 {summary.attack}</small>
          <small>守 {summary.defense}</small>
          <small>跳 {summary.jump}</small>
        </span>
      ) : null}
    </>
  );

  const className = [
    "ui-player-tile",
    compact ? "ui-player-tile--compact" : "",
    selected ? "ui-player-tile--selected" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (onClick) {
    return (
      <button className={className} onClick={onClick} type="button">
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
