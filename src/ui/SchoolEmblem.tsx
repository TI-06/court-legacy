import type { SVGProps } from "react";
import { resolveSchoolVisualTheme } from "../domain/appearance/characterWorld";
import type { School } from "../domain/model/School";

interface SchoolEmblemProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  school?: School | null;
  compact?: boolean;
}

function motifPath(
  motif: ReturnType<typeof resolveSchoolVisualTheme>["motif"],
) {
  switch (motif) {
    case "wave":
      return (
        <>
          <path d="M4 14c3-6 8-8 16-5-4 0-6 2-7 4 3-1 6 0 8 3-5-2-9-1-12 3 1-3 0-5-5-5Z" />
          <path d="M5 18c4-3 8-3 13 0-5-1-8 0-10 3Z" opacity="0.65" />
        </>
      );
    case "wing":
      return (
        <>
          <path d="m4 18 8-12 1 7 7-5-4 10-5 3-1-5Z" />
          <path d="m5 9 5 4-2 3Z" opacity="0.62" />
        </>
      );
    case "fortress":
      return (
        <>
          <path d="M5 7h3V4h3v3h3V4h3v3h2v12l-7 3-7-3Z" />
          <path d="M9 12h6v8H9Z" opacity="0.58" />
        </>
      );
    case "mist":
      return (
        <>
          <path d="M4 10c3-4 6-4 9 0 2-2 5-1 7 2-3-1-5 0-6 2-3-2-6-2-10 0 2-2 2-3 0-4Z" />
          <path d="M5 17c5-2 10-2 15 0-5 3-10 3-15 0Z" opacity="0.6" />
        </>
      );
    case "shield":
      return <path d="M5 5h14v8c0 5-3 8-7 10-4-2-7-5-7-10Zm4 4v8l3 2 3-2V9Z" />;
  }
}

export function SchoolEmblem({
  school,
  compact = false,
  className,
  ...props
}: SchoolEmblemProps) {
  const theme = resolveSchoolVisualTheme(school);

  return (
    <svg
      {...props}
      aria-hidden="true"
      className={[
        "ui-school-emblem",
        compact ? "ui-school-emblem--compact" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-school-motif={theme.motif}
      data-testid="school-emblem"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M2.5 4.5 12 1l9.5 3.5v8.25c0 5.5-3.7 8.6-9.5 10.75C6.2 21.35 2.5 18.25 2.5 12.75Z"
        fill={theme.primary}
        stroke={theme.accent}
        strokeWidth="1.2"
      />
      <g fill={theme.secondary}>{motifPath(theme.motif)}</g>
      <path
        d="M4 5 12 2l8 3"
        fill="none"
        opacity="0.8"
        stroke={theme.glow}
        strokeLinecap="round"
      />
    </svg>
  );
}
