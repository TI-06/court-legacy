import type { MatchEvent, MatchState } from "../../domain/model/Match";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import "./liveCourtAnimation.css";

interface LiveCourtAnimationProps {
  match: MatchState;
  visibleEventIndex: number;
  homeSelection: TeamSelection;
  awaySelection: TeamSelection;
  homeLabel: string;
  awayLabel: string;
  reducedMotion: boolean;
  playing: boolean;
}

type CourtPlay = "serve" | "attack" | "block" | "receive" | "rally";

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

function playForEvent(event: MatchEvent): CourtPlay {
  if (event.type === "serve") return "serve";
  if (event.type === "attack") return "attack";
  if (event.type === "block") return "block";
  if (event.type === "receive" || event.type === "dig") return "receive";
  return "rally";
}

/**
 * Reveal only the currently visible match segment. No simulation is rerun and
 * no animation state is persisted. The same event always maps to the same
 * court snapshot when the user pauses, skips, or reopens a match.
 */
export function deriveCourtMoment(
  match: MatchState,
  visibleEventIndex: number,
  homeSelection: TeamSelection,
  awaySelection: TeamSelection,
): {
  play: CourtPlay;
  fromHome: boolean;
  actorSlot: number | null;
  actorSide: "home" | "away" | null;
} {
  const current = match.eventLog[visibleEventIndex];
  if (!current) {
    return { play: "rally", fromHome: true, actorSlot: null, actorSide: null };
  }
  let action = current;
  if (current.type === "point") {
    for (let index = visibleEventIndex - 1; index >= 0; index -= 1) {
      const previous = match.eventLog[index];
      if (!previous || previous.setNumber !== current.setNumber) break;
      if (previous.type === "point" || previous.type === "set-end") break;
      if (
        previous.type === "serve" ||
        previous.type === "attack" ||
        previous.type === "block" ||
        previous.type === "receive" ||
        previous.type === "dig"
      ) {
        action = previous;
        break;
      }
    }
  }

  const homeActor = homeSelection.rotation.find(
    (entry) => entry.playerId === action.actorPlayerId,
  );
  const awayActor = awaySelection.rotation.find(
    (entry) => entry.playerId === action.actorPlayerId,
  );
  const actorSide = homeActor ? "home" : awayActor ? "away" : null;
  const fromHome =
    actorSide === "home"
      ? true
      : actorSide === "away"
        ? false
        : (current.winnerSchoolId ?? match.servingSchoolId) === match.homeSchoolId;

  return {
    play: playForEvent(action),
    fromHome,
    actorSide,
    actorSlot: homeActor?.slot ?? awayActor?.slot ?? null,
  };
}

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
  homeLabel,
  awayLabel,
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
  const animate = playing && !reducedMotion;
  const ballStartX = moment.fromHome ? 145 : 215;
  const ballEndX = moment.fromHome ? 250 : 110;
  const direction = moment.fromHome ? "home" : "away";

  return (
    <section className="court-live" aria-label="試合2Dコート" data-testid="live-court">
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
          const active = moment.actorSide === "home" && moment.actorSlot === slot;
          return (
            <g key={`home-${slot}`} className={active ? "court-live__actor" : undefined}>
              <circle cx={x} cy={y} r="12" fill="#175971" stroke={active ? "#fff0a2" : "#c9ebf0"} strokeWidth={active ? 3 : 1.5} />
              <text x={x} y={y + 3.5} fill="#fff" fontSize="10" textAnchor="middle" fontWeight="700">
                {slot}
              </text>
            </g>
          );
        })}
        {awaySelection.rotation.map(({ slot }, index) => {
          const [x, y] = AWAY_SPOTS[index]!;
          const active = moment.actorSide === "away" && moment.actorSlot === slot;
          return (
            <g key={`away-${slot}`} className={active ? "court-live__actor" : undefined}>
              <circle cx={x} cy={y} r="12" fill="#9f5238" stroke={active ? "#fff0a2" : "#ffe0bc"} strokeWidth={active ? 3 : 1.5} />
              <text x={x} y={y + 3.5} fill="#fff" fontSize="10" textAnchor="middle" fontWeight="700">
                {slot}
              </text>
            </g>
          );
        })}
        <circle
          key={event.sequence}
          data-testid="live-court-ball"
          className={animate ? `court-live__ball court-live__ball--${direction}` : "court-live__ball"}
          data-animated={animate ? "true" : "false"}
          cx={animate ? ballStartX : ballEndX}
          cy="79"
          r="7"
          fill="#fff4ac"
          stroke="#fff"
          strokeWidth="2"
        />
      </svg>
      <div className="court-live__teams">
        <span title={homeLabel}>{homeLabel}</span>
        <span title={awayLabel}>{awayLabel}</span>
      </div>
    </section>
  );
}
