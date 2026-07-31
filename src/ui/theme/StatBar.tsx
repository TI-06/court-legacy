interface StatBarProps {
  label: string;
  value: number;
  valueLabel?: string;
  tone?: "default" | "accent" | "danger" | "warning" | "success";
  className?: string;
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function StatBar({
  label,
  value,
  valueLabel,
  tone = "default",
  className,
}: StatBarProps) {
  const percentage = clampPercentage(value);
  const classNames = ["game-stat-bar", `game-stat-bar--${tone}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames}>
      <div className="game-stat-bar__header">
        <span>{label}</span>
        <strong>{valueLabel ?? percentage}</strong>
      </div>
      <span
        aria-label={`${label} ${percentage}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percentage}
        className="game-stat-bar__track"
        role="progressbar"
      >
        <span
          className="game-stat-bar__fill"
          data-testid="stat-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </span>
    </div>
  );
}
