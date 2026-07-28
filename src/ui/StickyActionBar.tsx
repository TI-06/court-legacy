import type { ReactNode } from "react";

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
      {summary ? <div className="ui-sticky-action-bar__summary">{summary}</div> : null}
      <button disabled={disabled} onClick={onClick} type="button">
        {label}
      </button>
    </div>
  );
}
