import { resolveJerseyNumber } from "../domain/appearance/characterWorld";
import type { Player } from "../domain/model/Player";
import type { School, UniformColors } from "../domain/model/School";
import { PlayerArt } from "./player-art/PlayerArt";

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
  const jerseyNumber = resolveJerseyNumber(player);
  const content = (
    <>
      <span className="ui-player-avatar" aria-hidden="true">
        <PlayerArt player={player} school={school} variant="card" />
      </span>
      <span className="ui-player-tile__main">
        <strong>
          {player.lastName} {player.firstName}
        </strong>
        <small>
          {player.grade}年・{player.preferredPosition}・{player.heightCm}cm
        </small>
        <small className="ui-player-tile__number">背番号 {jerseyNumber}</small>
        <span className={`ui-status-pill ui-status-pill--${status.tone}`}>
          {status.label}
        </span>
      </span>
      {badge ? <span className="ui-player-tile__badge">{badge}</span> : null}
      {actionLabel ? (
        <span className="ui-player-tile__action">{actionLabel}</span>
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        aria-label={ariaLabel}
        aria-pressed={selected}
        className={[
          "ui-player-tile",
          compact ? "ui-player-tile--compact" : "",
          selected ? "ui-player-tile--selected" : "",
        ]
          .filter(Boolean)
          .join(" ")}
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
    <article
      className={[
        "ui-player-tile",
        compact ? "ui-player-tile--compact" : "",
        selected ? "ui-player-tile--selected" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      data-testid={testId}
    >
      {content}
    </article>
  );
}
