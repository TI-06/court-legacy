interface ChoiceChipProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  testId?: string;
}

export function ChoiceChip({
  label,
  selected,
  onClick,
  testId,
}: ChoiceChipProps) {
  return (
    <button
      aria-pressed={selected}
      className={selected ? "ui-choice-chip ui-choice-chip--selected" : "ui-choice-chip"}
      data-testid={testId}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
