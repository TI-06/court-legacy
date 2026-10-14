import type { MatchState } from "../../domain/model/Match";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import { deriveCourtMoment, type CourtPlay } from "./liveCourtMoment";
import { pointCelebrationForEvent } from "./pointCelebration";
import "./liveCourtAnimation.css";

interface LiveCourtAnimationProps {
  match: MatchState;
  visibleEventIndex: number;
  homeSelection: TeamSelection;
  awaySelection: TeamSelection;
  reducedMotion: boolean;
  playing: boolean;
}

const HOME_SPOTS = [
  [139, 39],
  [139, 79],
  [139, 119],
  [81, 39],
  [81, 79],
  [81, 119],
] as const;
const AWAY_SPOTS = [
  [221, 39],
  [221, 79],
  [221, 119],
  [279, 39],
  [279, 79],
  [279, 119],
] as const;

const PLAY_LABEL: Record<CourtPlay, string> = {
  serve: "サーブ",
  attack: "スパイク",
  block: "ブロック",
  receive: "レシーブ",
  rally: "ラリー",
};

export function LiveCourtAnimation({
  match,
  visibleEventIndex,
  homeSelection,
  awaySelection,
  reducedMotion,
  playing,
}: LiveCourtAnimationProps) {
  const event = match.eventLog[visibleEventIndex];
  if (!event) return null;

  const moment = deriveCourtMoment(
    match,
    visibleEventIndex,
    homeSelection,
    awaySelection,
  );
  const celebration = pointCelebrationForEvent(event, match);
  const direction = moment.fromHome ? "home" : "away";
  const receive = moment.play === "receive";
  const animate = playing && !reducedMotion && moment.play !== "rally";
  const ballStartX = receive
    ? moment.fromHome
      ? 85
      : 275
    : moment.fromHome
      ? 145
      : 215;
  const ballEndX = receive
    ? moment.fromHome
      ? 145
      : 215
    : moment.fromHome
      ? 250
      : 110;
  const actorMotionClass = animate
    ? `court-live__actor court-live__actor--${moment.play} court-live__actor--${direction}`
    : "court-live__actor";
  const ballMotionClass = animate
    ? `court-live__ball court-live__ball--${direction} court-live__ball--${moment.play}`
    : "court-live__ball";

  return (
    <section
      className="court-live"
      aria-label="試合2Dコート"
      data-testid="live-court"
      data-play={moment.play}
    >
      <div className="court-live__caption">
        <span>コートビュー</span>
        <strong>{PLAY_LABEL[moment.play]}</strong>
      </div>
      <svg
        aria-hidden="true"
        className="court-live__field"
        viewBox="0 0 360 158"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x="8" y="8" width="344" height="142" rx="11" fill="#173c51" />
        <rect x="18" y="18" width="324" height="122" rx="4" fill="#c98b60" />
        <path
          d="M180 18V140M18 18V140M342 18V140M18 18H342M18 140H342M100 18V140M260 18V140"
          stroke="#fff7e9"
          strokeWidth="1.6"
          opacity=".86"
          fill="none"
        />
        <path d="M180 12V146" stroke="#e8f2f8" strokeWidth="6" opacity=".92" />
        {homeSelection.rotation.map(({ slot }, index) => {
          const [x, y] = HOME_SPOTS[index]!;
          const active =
            moment.actorSide === "home" && moment.actorSlot === slot;
          return (
            <g
              key={`home-${slot}`}
              className={active ? actorMotionClass : undefined}
              data-testid={active ? "live-court-active-player" : undefined}
            >
              <circle
                cx={x}
                cy={y}
                r="12"
                fill="#175971"
                stroke={active ? "#fff0a2" : "#c9ebf0"}
                strokeWidth={active ? 3 : 1.5}
              />
              <text
                x={x}
                y={y + 3.5}
                fill="#fff"
                fontSize="10"
                textAnchor="middle"
                fontWeight="700"
              >
                {slot}
              </text>
            </g>
          );
        })}
        {awaySelection.rotation.map(({ slot }, index) => {
          const [x, y] = AWAY_SPOTS[index]!;
          const active =
            moment.actorSide === "away" && moment.actorSlot === slot;
          return (
            <g
              key={`away-${slot}`}
              className={active ? actorMotionClass : undefined}
              data-testid={active ? "live-court-active-player" : undefined}
            >
              <circle
                cx={x}
                cy={y}
                r="12"
                fill="#9f5238"
                stroke={active ? "#fff0a2" : "#ffe0bc"}
                strokeWidth={active ? 3 : 1.5}
              />
              <text
                x={x}
                y={y + 3.5}
                fill="#fff"
                fontSize="10"
                textAnchor="middle"
                fontWeight="700"
              >
                {slot}
              </text>
            </g>
          );
        })}
        {celebration ? (
          <g
            key={`point-${event.sequence}`}
            className={
              playing && !reducedMotion
                ? "court-live__celebration court-live__celebration--animate"
                : "court-live__celebration"
            }
            data-testid="live-court-point-effect"
            data-celebration={celebration.kind}
          >
            <rect
              x={celebration.fromHome ? 46 : 214}
              y="19"
              width="100"
              height="29"
              rx="14"
              fill="#143348"
              fillOpacity=".94"
              stroke="#ffe6a9"
              strokeWidth="1.5"
            />
            <text
              x={celebration.fromHome ? 96 : 264}
              y="38"
              fill="#fff0af"
              fontSize="12"
              fontWeight="800"
              textAnchor="middle"
            >
              {celebration.label}
            </text>
          </g>
        ) : null}
        <circle
          key={event.sequence}
          data-testid="live-court-ball"
          className={ballMotionClass}
          data-animated={animate ? "true" : "false"}
          cx={animate ? ballStartX : ballEndX}
          cy="79"
          r="7"
          fill="#fff4ac"
          stroke="#fff"
          strokeWidth="2"
        />
      </svg>
    </section>
  );
}
