import type { GameState } from "../../domain/model/GameState";
import type { TeamSelection } from "../../domain/model/TeamSelection";
import { buildPreMatchRivalryPresentationFromSelection } from "./rivalryPresentation";
import "./pre-match-rivalry.css";

export function PreMatchRivalryContext({
  state,
  opponentSelection,
}: {
  state: GameState;
  opponentSelection: TeamSelection;
}) {
  const presentation = buildPreMatchRivalryPresentationFromSelection(
    state,
    opponentSelection,
  );
  if (!presentation) return null;

  return (
    <section className="pre-match-rivalry" aria-label="対戦相手との因縁">
      <div className="pre-match-rivalry__heading">
        <span>HISTORY</span>
        <strong>{presentation.headline}</strong>
      </div>
      <div className="pre-match-rivalry__record">
        <b>{presentation.recordLabel}</b>
        {presentation.previousResultLabel ? (
          <span>{presentation.previousResultLabel}</span>
        ) : null}
      </div>
      {presentation.chips.length > 0 ? (
        <div className="pre-match-rivalry__chips" aria-label="因縁情報">
          {presentation.chips.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
