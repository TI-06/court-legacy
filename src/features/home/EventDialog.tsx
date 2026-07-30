import type { GameDataRegistry } from "../../data/dataRegistry";
import { resolveCharacterVisual } from "../../domain/appearance/characterWorld";
import { renderEventText } from "../../domain/events/renderEventText";
import type { GameState } from "../../domain/model/GameState";
import { BottomSheet } from "../../ui/BottomSheet";
import { PlayerCharacter } from "../../ui/PlayerCharacter";
import { SchoolEmblem } from "../../ui/SchoolEmblem";
import "../../ui/ui.css";
import "./event-dialog.css";

interface EventDialogProps {
  state: GameState;
  data: GameDataRegistry;
  onChoose: (choiceId: string) => void;
}

export function EventDialog({ state, data, onChoose }: EventDialogProps) {
  const pending = state.pendingEvent;
  if (!pending) {
    return null;
  }
  const event = data.events.get(pending.eventId);
  if (!event) {
    return null;
  }
  const actors = pending.actorPlayerIds.map((playerId) => {
    const player = state.players[playerId];
    const school = player ? state.schools[player.career.schoolId] : undefined;
    return { playerId, player, school };
  });
  const recentHistory = [...state.eventMemory.history].slice(-5).reverse();

  return (
    <BottomSheet
      description="監督として対応を選んでください。結果には利点と負担があります。"
      dismissible={false}
      onClose={() => undefined}
      open
      title={event.title}
    >
      <div className="event-dialog-body">
        <div className="event-actors" aria-label="関係する選手">
          {actors.map(({ playerId, player, school }) => {
            if (!player) {
              return <span key={playerId}>不明な選手</span>;
            }

            const visual = resolveCharacterVisual(player, school);
            return (
              <article className="event-actor-card" key={playerId}>
                <span className="event-actor-character" aria-hidden="true">
                  <PlayerCharacter player={player} school={school} />
                </span>
                <div className="event-actor-card__identity">
                  <span className="event-actor-card__school">
                    <SchoolEmblem compact school={school} />
                    {school?.name ?? "所属校不明"}
                  </span>
                  <strong>
                    {player.lastName} {player.firstName}
                  </strong>
                  <small>{visual.roleLabel}</small>
                </div>
              </article>
            );
          })}
        </div>
        <p className="event-story">
          {renderEventText(event.bodyTemplate, state, pending.actorPlayerIds)}
        </p>

        <div className="event-choice-list" aria-label="対応を選択">
          {event.choices
            .filter((choice) => pending.choiceIds.includes(choice.id))
            .map((choice) => (
              <button
                className="event-choice"
                key={choice.id}
                onClick={() => onChoose(choice.id)}
                type="button"
              >
                <strong>{choice.label}</strong>
                <span>{choice.detail}</span>
              </button>
            ))}
        </div>

        {recentHistory.length > 0 ? (
          <section className="event-history" aria-label="最近の出来事">
            <h3>最近の出来事</h3>
            <ol>
              {recentHistory.map((occurrence, index) => {
                const definition = data.events.get(occurrence.eventId);
                const actor = state.players[occurrence.actorPlayerIds[0]];
                const choice = definition?.choices.find(
                  (candidate) => candidate.id === occurrence.choiceId,
                );
                return (
                  <li key={`${occurrence.eventId}-${occurrence.date}-${index}`}>
                    <div>
                      <strong>{definition?.title ?? "出来事"}</strong>
                      <span>
                        {occurrence.date}・
                        {actor
                          ? `${actor.lastName} ${actor.firstName}`
                          : "選手"}
                      </span>
                    </div>
                    <p>{choice?.label ?? occurrence.choiceId}</p>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}
      </div>
    </BottomSheet>
  );
}
