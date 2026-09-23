import type { GameState } from "../../domain/model/GameState";
import type { MatchState } from "../../domain/model/Match";
import { buildMatchResultStory } from "./matchResultStory";
import "./matchGameStats.css";

export function MatchResultStoryPanel({
  state,
  match,
}: {
  state: GameState;
  match: MatchState;
}) {
  const story = buildMatchResultStory(state, match);
  if (!story) return null;

  return (
    <section className="match-story-card" aria-label="今回の試合の物語">
      <div className="match-story-card__heading">
        <div>
          <p className="section-kicker">MATCH STORY</p>
          <h2>{story.headline}</h2>
        </div>
        <strong>{story.recordLabel}</strong>
      </div>

      {story.chips.length > 0 ? (
        <div className="match-story-card__chips" aria-label="試合の意味">
          {story.chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      ) : null}

      {story.rivalryProgress ? (
        <div
          aria-label={`因縁度 ${story.rivalryProgress.beforeScore}から${story.rivalryProgress.afterScore}`}
          className="match-story-card__rivalry-progress"
        >
          <span>因縁度</span>
          <div aria-hidden="true">
            <i
              style={{
                width: `${story.rivalryProgress.afterScore}%`,
              }}
            />
          </div>
          <strong>
            {story.rivalryProgress.beforeScore}
            <b aria-hidden="true">→</b>
            {story.rivalryProgress.afterScore}
          </strong>
          <small>
            +{story.rivalryProgress.delta}
            {story.rivalryProgress.becameDestinyRival ? "・宿敵へ" : ""}
          </small>
        </div>
      ) : null}

      <div className="match-story-card__facts">
        {story.facts.map((fact) => (
          <span key={fact}>{fact}</span>
        ))}
      </div>
    </section>
  );
}
