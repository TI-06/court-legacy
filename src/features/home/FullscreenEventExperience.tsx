import { useEffect, useRef, useState } from "react";
import type { GameDataRegistry } from "../../data/dataRegistry";
import { renderEventText } from "../../domain/events/renderEventText";
import type { GameState } from "../../domain/model/GameState";
import { SchoolEmblem } from "../../ui/SchoolEmblem";
import "../../ui/ui.css";
import "./event-dialog.css";
import "./fullscreen-event.css";

export interface FullscreenEventExperienceProps {
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

const eventCategoryLabels: Record<string, string> = {
  individual: "選手イベント",
  relationship: "関係イベント",
  practice: "練習イベント",
  injury: "コンディション",
  academic: "学校生活",
  match: "試合イベント",
  captaincy: "チーム運営",
  scouting: "スカウト",
  rivalry: "ライバルイベント",
  ob: "OBイベント",
  rare: "特別イベント",
  seasonal: "季節イベント",
};

const focusableSelector = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function formatVisibleResult(code: string): string {
  const [head, ...rest] = code.split(" ");
  const label = abilityResultLabels[head ?? ""];
  return label ? `${label} ${rest.join(" ")}` : code;
}

export function FullscreenEventExperience({
  state,
  data,
  onChoose,
}: FullscreenEventExperienceProps) {
  const [selectedResolution, setSelectedResolution] = useState<{
    eventId: string;
    choiceId: string;
  } | null>(null);
  const [resolvingChoiceId, setResolvingChoiceId] = useState<string | null>(
    null,
  );
  const dialogRef = useRef<HTMLElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const pending = state.pendingEvent;
  const event = pending ? data.events.get(pending.eventId) : undefined;
  const latestOccurrence = state.eventMemory.history.at(-1);

  const resolvedPresentation = (() => {
    if (pending || !selectedResolution || !latestOccurrence) {
      return null;
    }
    if (
      latestOccurrence.eventId !== selectedResolution.eventId ||
      latestOccurrence.choiceId !== selectedResolution.choiceId
    ) {
      return null;
    }
    const resolvedEvent = data.events.get(latestOccurrence.eventId);
    const resolvedChoice = resolvedEvent?.choices.find(
      (choice) => choice.id === latestOccurrence.choiceId,
    );
    if (!resolvedEvent || !resolvedChoice) {
      return null;
    }
    const actorNames = latestOccurrence.actorPlayerIds
      .map((playerId) => state.players[playerId])
      .filter(Boolean)
      .map((player) => `${player!.lastName} ${player!.firstName}`);
    return {
      event: resolvedEvent,
      choice: resolvedChoice,
      occurrence: latestOccurrence,
      actorNames,
    };
  })();

  const phase: "choice" | "result" | null =
    pending && event ? "choice" : resolvedPresentation ? "result" : null;
  const active = phase !== null;

  useEffect(() => {
    if (!active) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    if (!restoreFocusRef.current) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
    }
    document.body.style.overflow = "hidden";

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== "Tab" || !dialogRef.current) {
        return;
      }
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) {
        return;
      }
      const currentIndex = focusable.indexOf(
        document.activeElement as HTMLElement,
      );
      const baseIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = keyboardEvent.shiftKey
        ? (baseIndex - 1 + focusable.length) % focusable.length
        : (baseIndex + 1) % focusable.length;
      keyboardEvent.preventDefault();
      focusable[nextIndex]?.focus();
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
  }, [active]);

  useEffect(() => {
    if (!phase) {
      return;
    }
    firstActionRef.current?.focus();
  }, [phase]);

  if (!phase) {
    return null;
  }

  const reducedMotionClass = state.settings.reducedMotion
    ? " fullscreen-event--reduced-motion"
    : "";

  if (phase === "result" && resolvedPresentation) {
    return (
      <div className="fullscreen-event-layer">
        <section
          aria-labelledby="fullscreen-event-result-title"
          aria-modal="true"
          className={`fullscreen-event${reducedMotionClass}`}
          data-phase="result"
          data-testid="fullscreen-event"
          ref={dialogRef}
          role="dialog"
        >
          <header className="fullscreen-event__header fullscreen-event__header--result">
            <div>
              <span className="fullscreen-event__category">対応結果</span>
              <h2 id="fullscreen-event-result-title">対応結果</h2>
              <p>{resolvedPresentation.event.title}への対応結果です。</p>
            </div>
          </header>

          <main className="fullscreen-event__content fullscreen-event__content--result">
            <div className="event-result" aria-live="polite">
              <div className="event-result__choice">
                <span>選んだ対応</span>
                <strong>{resolvedPresentation.choice.label}</strong>
                {resolvedPresentation.actorNames.length > 0 ? (
                  <small>{resolvedPresentation.actorNames.join("・")}</small>
                ) : null}
              </div>
              <section aria-label="対応による変化">
                <h3>起きた変化</h3>
                {resolvedPresentation.occurrence.visibleResultCodes.length >
                0 ? (
                  <ul>
                    {resolvedPresentation.occurrence.visibleResultCodes.map(
                      (code, index) => (
                        <li key={`${code}:${index}`}>
                          {formatVisibleResult(code)}
                        </li>
                      ),
                    )}
                  </ul>
                ) : (
                  <p>今回は大きな数値変化はありませんでした。</p>
                )}
              </section>
            </div>
          </main>

          <footer className="fullscreen-event__actions">
            <button
              className="event-result__close fullscreen-event__confirm"
              onClick={() => setSelectedResolution(null)}
              ref={firstActionRef}
              type="button"
            >
              結果を確認した
            </button>
          </footer>
        </section>
      </div>
    );
  }

  if (!pending || !event) {
    return null;
  }

  const actors = pending.actorPlayerIds.map((playerId) => {
    const player = state.players[playerId];
    const school = player ? state.schools[player.career.schoolId] : undefined;
    const personality = player
      ? data.personalities.get(player.personalityId)
      : undefined;
    return { playerId, player, school, personality };
  });
  const choices = event.choices.filter((choice) =>
    pending.choiceIds.includes(choice.id),
  );

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
    <div className="fullscreen-event-layer">
      <section
        aria-labelledby="fullscreen-event-title"
        aria-modal="true"
        className={`fullscreen-event${reducedMotionClass}`}
        data-phase="choice"
        data-testid="fullscreen-event"
        ref={dialogRef}
        role="dialog"
      >
        <header className="fullscreen-event__header">
          <div>
            <span className="fullscreen-event__category">
              {eventCategoryLabels[event.category] ?? "監督判断"}
            </span>
            <h2 id="fullscreen-event-title">{event.title}</h2>
            <p>監督として対応を選んでください。</p>
          </div>
        </header>

        <main className="fullscreen-event__content">
          <div className="event-actors" aria-label="関係する選手">
            {actors.map(({ playerId, player, school, personality }) => {
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
                    <span className="event-actor-card__personality">
                      {personality?.name ?? "性格不明"}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="event-story">
            {renderEventText(event.bodyTemplate, state, pending.actorPlayerIds)}
          </p>
        </main>

        <footer className="fullscreen-event__actions">
          <div className="event-choice-list" aria-label="対応を選択">
            {choices.map((choice, index) => (
              <button
                className="event-choice"
                disabled={resolvingChoiceId !== null}
                key={choice.id}
                onClick={() => void choose(choice.id)}
                ref={index === 0 ? firstActionRef : undefined}
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
        </footer>
      </section>
    </div>
  );
}
