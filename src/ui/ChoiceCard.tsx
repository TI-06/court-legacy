import type { ReactNode } from "react";

interface ChoiceCardProps {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  meta?: ReactNode;
  testId?: string;
}

export function ChoiceCard({
  title,
  description,
  selected,
  onClick,
  meta,
  testId,
}: ChoiceCardProps) {
  return (
    <button
      aria-pressed={selected}
      className={
        selected ? "ui-choice-card ui-choice-card--selected" : "ui-choice-card"
      }
      data-testid={testId}
      onClick={onClick}
      type="button"
    >
      <span className="ui-choice-card__check" aria-hidden="true">
        {selected ? "✓" : ""}
      </span>
      <strong>{title}</strong>
      <span className="ui-choice-card__description">{description}</span>
      {meta ? <span className="ui-choice-card__meta">{meta}</span> : null}
    </button>
  );
}
