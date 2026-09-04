import { useState } from "react";
import type { GameDataRegistry } from "../../data/dataRegistry";
import { renderEventText } from "../../domain/events/renderEventText";
import type { GameState } from "../../domain/model/GameState";
import { BottomSheet } from "../../ui/BottomSheet";
import { SchoolEmblem } from "../../ui/SchoolEmblem";
import "../../ui/ui.css";
import "./event-dialog.css";

interface EventDialogProps {
  state: GameState;
  data: GameDataRegistry;
  onChoose: (choiceId: string) => void | Promise<void>;
}

const abilityResultLabels: Record<string, string> = {
  spike: "スパイク",
  jump: "ジャンプ",
  receive: "レシーブ",
  serve: "サーブ",
  set: "トス",
  block: "ブロック",
  speed: "スピード",
  stamina: "スタミナ",
  decision: "判断力",
  mental: "メンタル",
};

function formatVisibleResult(code: string): string {
  const [head, ...rest] = code.split(" ");
  const label = abilityResultLabels[head ?? ""];
  return label ? `${label} ${rest.join(" ")}` : code;
}

export function EventDialog({ state, data, onChoose }: EventDialogProps) {
  const [selectedResolution, setSelectedResolution] = useState<{
    eventId: string;
    choiceId: string;
  } | null>(null);
  const [resolvingChoiceId, setResolvingChoiceId] = useState<string | null>(
    null,
  );
  const pending = state.pendingEvent;
  const latestOccurrence = state.eventMemory.history.at(-1);

  if (!pending && selectedResolution && latestOccurrence) {
    const resolvedEvent = data.events.get(latestOccurrence.eventId);
    const resolvedChoice = resolvedEvent?.choices.find(
      (choice) => choice.id === latestOccurrence.choiceId,
    );
    const matchesSelection =
      latestOccurrence.eventId === selectedResolution.eventId &&
      latestOccurrence.choiceId === selectedResolution.choiceId;

    if (matchesSelection && resolvedEvent && resolvedChoice) {
      const actorNames = latestOccurrence.actorPlayerIds
        .map((playerId) => state.players[playerId])
        .filter(Boolean)
        .map((player) => `${player!.lastName} ${player!.firstName}`);

      return (
        <BottomSheet
          description={`${resolvedEvent.title}への対応結果です。`}
          onClose={() => setSelectedResolution(null)}
          open
          title="対応結果"
        >
          <div className="event-result" aria-live="polite">
            <div className="event-result__choice">
              <span>選んだ対応</span>
              <strong>{resolvedChoice.label}</strong>
              {actorNames.length > 0 ? <small>{actorNames.join("・")}</small> : null}
            </div>
            <section aria-label="対応による変化">
              <h3>起きた変化</h3>
              {latestOccurrence.visibleResultCodes.length > 0 ? (
                <ul>
                  {latestOccurrence.visibleResultCodes.map((code, index) => (
                    <li key={`${code}:${index}`}>{formatVisibleResult(code)}</li>
                  ))}
                </ul>
              ) : (
                <p>今回は大きな数値変化はありませんでした。</p>
              )}
            </section>
            <button
              className="event-result__close"
              onClick={() => setSelectedResolution(null)}
              type="button"
            >
              結果を確認した
            </button>
          </div>
        </BottomSheet>
      );
    }
  }

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

  const choose = async (choiceId: string) => {
    if (resolvingChoiceId !== null) return;
    setSelectedResolution({ eventId: pending.eventId, choiceId });
    setResolvingChoiceId(choiceId);
    try {
      await onChoose(choiceId);
    } finally {
      setResolvingChoiceId(null);
    }
  };

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

            return (
              <article className="event-actor-card" key={playerId}>
                <span className="event-actor-character" aria-hidden="true">
                  {player.lastName.slice(0, 1)}
                  {player.firstName.slice(0, 1)}
                </span>
                <div className="event-actor-card__identity">
                  <span className="event-actor-card__school">
                    <SchoolEmblem compact school={school} />
                    {school?.name ?? "所属校不明"}
                  </span>
                  <strong>
                    {player.lastName} {player.firstName}
                  </strong>
                  <small>
                    {player.grade}年・{player.preferredPosition}
                  </small>
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
                disabled={resolvingChoiceId !== null}
                key={choice.id}
                onClick={() => void choose(choice.id)}
                type="button"
              >
                <strong>
                  {resolvingChoiceId === choice.id
                    ? "結果を反映しています…"
                    : choice.label}
                </strong>
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
