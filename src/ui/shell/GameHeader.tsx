import type { OperationState } from "../../app/useGameSession";
import { OperationStatusBar } from "../status/OperationStatusBar";
import { GameIcon } from "../theme/GameIcon";

interface GameHeaderProps {
  schoolName: string;
  dateLabel: string;
  progressLabel: string;
  operation: OperationState;
  onOpenCalendar: () => void;
}

export function GameHeader({
  schoolName,
  dateLabel,
  progressLabel,
  operation,
  onOpenCalendar,
}: GameHeaderProps) {
  return (
    <header className="game-header">
      <div className="game-header__identity">
        <p>{schoolName}</p>
        <div className="game-header__meta">
          <span>{dateLabel}</span>
          <span>{progressLabel}</span>
        </div>
      </div>
      <div className="game-header__actions">
        <OperationStatusBar state={operation} />
        <button
          aria-label="予定を確認"
          className="game-header__action"
          onClick={onOpenCalendar}
          type="button"
        >
          <GameIcon name="calendar" />
        </button>
      </div>
    </header>
  );
}
