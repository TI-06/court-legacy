import type { Player } from "../domain/model/Player";
import type { School, UniformColors } from "../domain/model/School";
import {
  calculatePlayerDisplayPower,
  summarizePlayerAbilities,
} from "../domain/selectors/playerPresentation";

interface PlayerTileProps {
  player: Player;
  school?: School | null;
  uniform?: UniformColors;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  badge?: string;
  actionLabel?: string;
  ariaLabel?: string;
  onClick?: () => void;
  testId?: string;
}

function playerStatus(player: Player): { label: string; tone: string } {
  if (player.injury) {
    return { label: `怪我 ${player.injury.remainingWeeks}週`, tone: "danger" };
  }
  if (player.fatigue >= 85) {
    return { label: `疲労 ${player.fatigue}`, tone: "danger" };
  }
  if (player.fatigue >= 65) {
    return { label: `疲労 ${player.fatigue}`, tone: "warning" };
  }
  return { label: `状態 ${player.condition}`, tone: "normal" };
}

function playerInitials(player: Player): string {
  return `${player.lastName.slice(0, 1)}${player.firstName.slice(0, 1)}`;
}

export function PlayerTile({
  player,
  school,
  selected = false,
  disabled = false,
  compact = false,
  badge,
  actionLabel,
  ariaLabel,
  onClick,
  testId,
}: PlayerTileProps) {
  const status = playerStatus(player);
  const summary = summarizePlayerAbilities(player);
  const displayPower = Math.round(calculatePlayerDisplayPower(player) / 100);
  const content = (
    <>
      <span className="ui-player-tile__identity-mark" aria-hidden="true">
        {playerInitials(player)}
      </span>
      <span className="ui-player-tile__main">
        <strong>
          {player.lastName} {player.firstName}
        </strong>
        <small>
          {player.grade}年・{player.preferredPosition}・{player.heightCm}cm
        </small>
        {school ? <small>{school.shortName}</small> : null}
        <span className={`ui-status-pill ui-status-pill--${status.tone}`}>
          {status.label}
        </span>
      </span>
      <span className="ui-player-tile__power">
        <small>総合</small>
        <strong>{displayPower}</strong>
      </span>
      {!compact ? (
        <span className="ui-player-tile__abilities" aria-label="主要能力">
          <small>攻 {summary.attack}</small>
          <small>守 {summary.defense}</small>
          <small>跳 {summary.jump}</small>
        </span>
      ) : null}
      {badge ? <span className="ui-player-tile__badge">{badge}</span> : null}
      {actionLabel ? (
        <span className="ui-player-tile__action">{actionLabel}</span>
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
      <button
        aria-label={ariaLabel}
        aria-pressed={selected}
        className={className}
        data-testid={testId}
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <article className={className} data-testid={testId}>
      {content}
    </article>
  );
}
