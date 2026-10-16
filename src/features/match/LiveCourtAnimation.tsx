import type { MatchState } from "../../domain/model/Match";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import {
  courtTrajectory,
  deriveCourtMoment,
  deriveCourtRally,
  type CourtPlay,
} from "./liveCourtMoment";
import { pointCelebrationForEvent } from "./pointCelebration";
import { getSpecialAbilityDefinition } from "../../domain/player/specialAbilities";
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
  set: "トス",
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
  const rally = deriveCourtRally(
    match,
    visibleEventIndex,
    homeSelection,
    awaySelection,
  );
  const trajectories = rally.flatMap((step) => {
    const trajectory = courtTrajectory(step.play, step.fromHome);
    return trajectory ? [{ ...step, trajectory }] : [];
  });
  const lastTrajectory = courtTrajectory(moment.play, moment.fromHome);
  const celebration = pointCelebrationForEvent(event, match);
  const scoringSkill =
    celebration && event.scoringSpecialAbilityId
      ? getSpecialAbilityDefinition(event.scoringSpecialAbilityId)
      : null;
  const direction = moment.fromHome ? "home" : "away";
  const animate = playing && !reducedMotion && lastTrajectory !== null;
  const actorMotionClass = animate
    ? `court-live__actor court-live__actor--${moment.play} court-live__actor--${direction}`
    : "court-live__actor";

  return (
    <section
      className="court-live"
      aria-label="試合2Dコート"
      data-testid="live-court"
      data-play={moment.play}
    >
      <div className="court-live__caption">
        <span>コートビュー</span>
        <div className="court-live__playback">
          {rally.length > 1 ? (
            <small
              aria-label="このラリーのプレー"
              data-testid="live-court-rally-steps"
            >
              {rally.map((step) => PLAY_LABEL[step.play]).join(" → ")}
            </small>
          ) : null}
          <strong>{PLAY_LABEL[moment.play]}</strong>
        </div>
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
        {trajectories.map((step, index) => (
          <path
            key={step.sequence}
            className={
              animate
                ? "court-live__route court-live__route--animate"
                : "court-live__route"
            }
            d={step.trajectory.path}
            data-testid="live-court-rally-trail"
            data-motion={step.play}
            data-side={step.fromHome ? "home" : "away"}
            fill="none"
            stroke={step.fromHome ? "#a1e7f2" : "#ffe0b6"}
            strokeWidth={index === trajectories.length - 1 ? 2.5 : 1.5}
            opacity={index === trajectories.length - 1 ? 0.85 : 0.35}
            style={animate ? { animationDelay: `${index * 32}ms` } : undefined}
          />
        ))}
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
        {scoringSkill ? (
          <g
            key={`skill-${event.sequence}`}
            className={
              playing && !reducedMotion
                ? "court-live__skill-burst court-live__skill-burst--animate"
                : "court-live__skill-burst"
            }
            data-testid="live-court-special-ability"
            data-skill-id={scoringSkill.id}
          >
            <rect
              x={celebration?.fromHome ? 22 : 188}
              y="52"
              width="150"
              height="23"
              rx="11"
              fill="#40345d"
              fillOpacity=".95"
              stroke="#ecd18f"
              strokeWidth="1.3"
            />
            <text
              x={celebration?.fromHome ? 97 : 263}
              y="67.5"
              textAnchor="middle"
              fill="#fff2b9"
              fontSize="10.5"
              fontWeight="700"
            >
              {scoringSkill.name} 発揮
            </text>
          </g>
        ) : null}
        <circle
          key={event.sequence}
          data-testid="live-court-ball"
          className="court-live__ball"
          data-animated={animate ? "true" : "false"}
          data-motion={moment.play}
          cx={animate ? 0 : (lastTrajectory?.endX ?? 180)}
          cy={animate ? 0 : (lastTrajectory?.endY ?? 79)}
          r="7"
          fill="#fff4ac"
          stroke="#fff"
          strokeWidth="2"
        >
          {animate && lastTrajectory ? (
            <animateMotion
              dur="175ms"
              fill="freeze"
              path={lastTrajectory.path}
              repeatCount="1"
            />
          ) : null}
        </circle>
      </svg>
    </section>
  );
}
