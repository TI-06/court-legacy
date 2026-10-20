import "./volleyball-loader.css";

export type VolleyballLoaderSize = "tiny" | "small" | "medium" | "large";

/** Shared decorative animation for every loading surface. Text and status semantics stay with the caller. */
export function VolleyballLoader({
  size = "small",
}: {
  size?: VolleyballLoaderSize;
}) {
  return (
    <span
      aria-hidden="true"
      className={`volleyball-loader volleyball-loader--${size}`}
      data-testid="volleyball-loader"
    >
      <svg
        className="volleyball-loader__court"
        viewBox="0 0 120 60"
        fill="none"
        focusable="false"
      >
        <path
          className="volleyball-loader__floor"
          d="M7 48 H113 M7 48 L18 53 H102 L113 48"
        />
        <path
          className="volleyball-loader__net"
          d="M60 15 V48 M55 21 H65 M55 27 H65 M55 33 H65 M55 39 H65 M55 45 H65 M55 15 V48 M65 15 V48"
        />
        <path className="volleyball-loader__net-top" d="M54 15 H66" />
        <ellipse
          className="volleyball-loader__shadow"
          cx="60"
          cy="48"
          rx="9"
          ry="2"
        />
        <g className="volleyball-loader__ball-flight">
          <g className="volleyball-loader__ball-spin">
            <circle cx="60" cy="31" r="11" fill="#fbfdff" />
            <path
              d="M50 25 Q61 23 69 32 L67 38 Q60 29 49 34 Z"
              fill="#f6d44e"
            />
            <path
              d="M59 20 Q54 26 57 34 Q59 39 66 40 L70 34 Q61 33 60 25 Z"
              fill="#297cbd"
            />
            <path
              d="M50 25 Q61 23 69 32 M49 34 Q60 29 67 38 M59 20 Q54 26 57 34 Q59 39 66 40"
              stroke="#133b67"
              strokeWidth="0.9"
              strokeLinecap="round"
            />
            <circle cx="60" cy="31" r="11" stroke="#b9d6e4" strokeWidth="0.9" />
          </g>
        </g>
      </svg>
    </span>
  );
}
