import type { SVGProps } from "react";
import type { School } from "../domain/model/School";

interface SchoolEmblemProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  school?: School | null;
  compact?: boolean;
}

const DEFAULT_UNIFORM = {
  primary: "#23384A",
  secondary: "#F4F6F7",
  accent: "#CF8C32",
};

export function SchoolEmblem({
  school,
  compact = false,
  className,
  ...props
}: SchoolEmblemProps) {
  const uniform = school?.uniform ?? DEFAULT_UNIFORM;

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
      data-school-motif="shield"
      data-testid="school-emblem"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M2.5 4.5 12 1l9.5 3.5v8.25c0 5.5-3.7 8.6-9.5 10.75C6.2 21.35 2.5 18.25 2.5 12.75Z"
        fill={uniform.primary}
        stroke={uniform.accent}
        strokeWidth="1.2"
      />
      <path
        d="M5 5h14v8c0 5-3 8-7 10-4-2-7-5-7-10Zm4 4v8l3 2 3-2V9Z"
        fill={uniform.secondary}
      />
      <path
        d="M4 5 12 2l8 3"
        fill="none"
        opacity="0.8"
        stroke={uniform.accent}
        strokeLinecap="round"
      />
    </svg>
  );
}
