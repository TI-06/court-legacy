import { GameIcon } from "../theme/GameIcon";

interface GameHeaderProps {
  saveNotice: string | null;
  onOpenSave: () => void;
  onOpenCalendar: () => void;
}

export function GameHeader({
  saveNotice,
  onOpenSave,
  onOpenCalendar,
}: GameHeaderProps) {
  return (
    <header className="game-header">
      <div className="game-header__brand">
        <p>ONE PLAY, ONE HEART.</p>
        <h1>継承のコート</h1>
      </div>
      <div className="game-header__actions">
        <span aria-live="polite" className="game-header__notice">
          {saveNotice}
        </span>
        <button
          aria-label="セーブ・ロードを開く"
          className="game-header__action"
          onClick={onOpenSave}
          type="button"
        >
          <GameIcon name="save" />
        </button>
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
