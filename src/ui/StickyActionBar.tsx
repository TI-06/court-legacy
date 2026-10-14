import type { ReactNode } from "react";
import { GameButton } from "./theme/GameButton";

interface StickyActionBarProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  summary?: ReactNode;
}

export function StickyActionBar({
  label,
  onClick,
  disabled = false,
  summary,
}: StickyActionBarProps) {
  return (
    <div className="ui-sticky-action-bar">
      {summary ? (
        <div className="ui-sticky-action-bar__summary">{summary}</div>
      ) : null}
      <GameButton disabled={disabled} onClick={onClick} variant="primary">
        {label}
      </GameButton>
    </div>
  );
}
