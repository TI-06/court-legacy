export type GameIconName =
  | "home"
  | "team"
  | "training"
  | "match"
  | "school"
  | "calendar"
  | "save"
  | "back"
  | "close";

interface GameIconProps {
  name: GameIconName;
  className?: string;
}

const ICON_PATHS: Readonly<Record<GameIconName, string>> = {
  home: "M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V10.5Z",
  team: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  training: "M6.5 6.5h11v11h-11zM3 9v6M21 9v6M9 3h6M9 21h6",
  match:
    "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Zm10 2h3v2a4 4 0 0 1-4 4M7 6H4v2a4 4 0 0 0 4 4",
  school: "m3 10 9-6 9 6-9 6-9-6Zm3 4v5h12v-5M9 19v-4h6v4",
  calendar: "M6 2v4M18 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v15H3V6a2 2 0 0 1 2-2Z",
  save: "M5 3h12l2 2v16H5V3Zm3 0v6h8V3M8 21v-7h8v7",
  back: "m15 18-6-6 6-6",
  close: "m6 6 12 12M18 6 6 18",
};

export function GameIcon({ name, className }: GameIconProps) {
  const classNames = ["game-icon", className].filter(Boolean).join(" ");

  return (
    <svg
      aria-hidden="true"
      className={classNames}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d={ICON_PATHS[name]}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
