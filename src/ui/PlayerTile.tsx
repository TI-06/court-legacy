import type { Player } from "../domain/model/Player";

interface PlayerTileProps {
  player: Player;
  selected?: boolean;
  disabled?: boolean;
  compact?: boolean;
  badge?: string;
  actionLabel?: string;
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
  selected = false,
  disabled = false,
  compact = false,
  badge,
  actionLabel,
  onClick,
  testId,
}: PlayerTileProps) {
  const status = playerStatus(player);
  const content = (
    <>
      <span className="ui-player-avatar" aria-hidden="true">
        {player.preferredPosition}
      </span>
      <span className="ui-player-tile__main">
        <strong>
          {player.lastName} {player.firstName}
        </strong>
        <small>
          {player.grade}年・{player.preferredPosition}・{player.heightCm}cm
        </small>
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
