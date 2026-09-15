from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected one match in {path}, got {count}: {old!r}")
    target.write_text(text.replace(old, new, 1))


notifications = "src/domain/notifications/gameNotifications.ts"
replace_once(
    notifications,
    'import type { AbilityKey } from "../validation/gameDataSchema";\n',
    'import type {\n  SpecialRelationshipKind,\n  SpecialRelationshipTransition,\n} from "../relationships/relationshipTypes";\nimport type { AbilityKey } from "../validation/gameDataSchema";\n',
)
replace_once(
    notifications,
    '''export interface ConcernResolutionNotification {
  id: string;
  type: "concern-resolution";
  createdGameDate: GameDate;
  academicYearIndex: number;
  weekOfYear: number;
  readAtGameDate: GameDate | null;
  payload: {
    items: ConcernResolutionNotificationItem[];
  };
}

export type GameNotification =
  TrainingResultNotification | ConcernResolutionNotification;
''',
    '''export interface ConcernResolutionNotification {
  id: string;
  type: "concern-resolution";
  createdGameDate: GameDate;
  academicYearIndex: number;
  weekOfYear: number;
  readAtGameDate: GameDate | null;
  payload: {
    items: ConcernResolutionNotificationItem[];
  };
}

export interface SpecialRelationshipNotification {
  id: string;
  type: "special-relationship";
  createdGameDate: GameDate;
  academicYearIndex: number;
  weekOfYear: number;
  readAtGameDate: GameDate | null;
  payload: {
    action: SpecialRelationshipTransition["action"];
    kind: SpecialRelationshipKind;
    kindLabel: string;
    playerIds: [PlayerId, PlayerId];
    displayNames: [string, string];
  };
}

export type GameNotification =
  | TrainingResultNotification
  | ConcernResolutionNotification
  | SpecialRelationshipNotification;
''',
)
replace_once(
    notifications,
    '''const concernTitles: Record<PlayerConcernCode, string> = {
  "playing-time": "出場機会への不満",
  "role-mismatch": "役割への不満",
  "injury-overuse": "怪我中の起用負荷",
  "team-slump": "チーム不調への不満",
};
''',
    '''const concernTitles: Record<PlayerConcernCode, string> = {
  "playing-time": "出場機会への不満",
  "role-mismatch": "役割への不満",
  "injury-overuse": "怪我中の起用負荷",
  "team-slump": "チーム不調への不満",
};

const specialRelationshipKindLabels: Record<SpecialRelationshipKind, string> = {
  rival: "ライバル",
  mentor: "師弟",
  partner: "相棒",
};
''',
)
replace_once(
    notifications,
    '''export function appendNotification(
  state: GameNotificationState,
  item: GameNotification,
): GameNotificationState {
''',
    '''export function buildSpecialRelationshipNotification(input: {
  state: GameState;
  transition: SpecialRelationshipTransition;
}): SpecialRelationshipNotification {
  const [leftId, rightId] = input.transition.playerIds;
  const left = input.state.players[leftId];
  const right = input.state.players[rightId];
  if (!left || !right) {
    throw new Error("special relationship notification references unknown player");
  }
  const pairKey = input.transition.playerIds.join(":");

  return {
    id: `special-relationship:${input.state.userSchoolId}:${input.state.yearIndex}:${input.state.calendar.weekOfYear}:${input.state.date}:${input.transition.action}:${input.transition.kind}:${pairKey}`,
    type: "special-relationship",
    createdGameDate: input.state.date,
    academicYearIndex: input.state.yearIndex,
    weekOfYear: input.state.calendar.weekOfYear,
    readAtGameDate: null,
    payload: {
      action: input.transition.action,
      kind: input.transition.kind,
      kindLabel: specialRelationshipKindLabels[input.transition.kind],
      playerIds: [...input.transition.playerIds] as [PlayerId, PlayerId],
      displayNames: [
        `${left.lastName} ${left.firstName}`,
        `${right.lastName} ${right.firstName}`,
      ],
    },
  };
}

export function appendNotification(
  state: GameNotificationState,
  item: GameNotification,
): GameNotificationState {
''',
)
text = Path(notifications).read_text()
text += '''\nexport function selectHomeSpecialRelationshipNotifications(\n  state: GameNotificationState,\n): SpecialRelationshipNotification[] {\n  const items = state.items.filter(\n    (item): item is SpecialRelationshipNotification =>\n      item.type === "special-relationship",\n  );\n  const newest = items[items.length - 1];\n  return newest ? [newest] : [];\n}\n'''
Path(notifications).write_text(text)

worker = "worker/game/applyGameAction.ts"
replace_once(
    worker,
    '''import {
  appendNotification,
  buildTrainingResultNotification,
  markNotificationRead,
} from "../../src/domain/notifications/gameNotifications";
''',
    '''import {
  appendNotification,
  buildSpecialRelationshipNotification,
  buildTrainingResultNotification,
  markNotificationRead,
} from "../../src/domain/notifications/gameNotifications";
import type { SpecialRelationshipTransition } from "../../src/domain/relationships/relationshipTypes";
''',
)
replace_once(
    worker,
    '''function applyTraining(
  state: GameState,
''',
    '''function appendSpecialRelationshipNotifications(
  state: GameState,
  transitions: readonly SpecialRelationshipTransition[],
): GameState {
  let notifications = state.notifications;
  for (const transition of transitions) {
    notifications = appendNotification(
      notifications,
      buildSpecialRelationshipNotification({ state, transition }),
    );
  }
  return notifications === state.notifications
    ? state
    : { ...state, notifications };
}

function applyTraining(
  state: GameState,
''',
)
replace_once(
    worker,
    '''    const progression = advanceGameWeek(currentState, gameData, {
      userIntake: context.userIntake,
    });
    const nextState = progression.academicYearTransition
      ? progression.state
      : surfaceWeeklyEvent(progression.state, gameData);
''',
    '''    const progression = advanceGameWeek(currentState, gameData, {
      userIntake: context.userIntake,
    });
    const stateWithRelationshipNotifications =
      appendSpecialRelationshipNotifications(
        progression.state,
        progression.specialRelationshipTransitions,
      );
    const nextState = progression.academicYearTransition
      ? stateWithRelationshipNotifications
      : surfaceWeeklyEvent(stateWithRelationshipNotifications, gameData);
''',
)
replace_once(
    worker,
    '''    return {
      state: resolution.state,
      teamSelection,
      outcome: resolution.occurrence,
    };
''',
    '''    return {
      state: appendSpecialRelationshipNotifications(
        resolution.state,
        resolution.specialRelationshipTransitions,
      ),
      teamSelection,
      outcome: resolution.occurrence,
    };
''',
)

model = "src/features/home/homeCommandCenter.ts"
replace_once(
    model,
    '''  selectHomeConcernResolutionNotifications,
  selectHomeTrainingNotifications,
  type ConcernResolutionNotification,
  type TrainingResultNotification,
''',
    '''  selectHomeConcernResolutionNotifications,
  selectHomeSpecialRelationshipNotifications,
  selectHomeTrainingNotifications,
  type ConcernResolutionNotification,
  type SpecialRelationshipNotification,
  type TrainingResultNotification,
''',
)
replace_once(
    model,
    '''  | {
      id: string;
      kind: "concern-resolution";
      title: string;
      detail: string;
      notification: ConcernResolutionNotification;
    }
  | {
      id: string;
      kind: "growth";
''',
    '''  | {
      id: string;
      kind: "concern-resolution";
      title: string;
      detail: string;
      notification: ConcernResolutionNotification;
    }
  | {
      id: string;
      kind: "special-relationship";
      title: string;
      detail: string;
      notification: SpecialRelationshipNotification;
    }
  | {
      id: string;
      kind: "growth";
''',
)
replace_once(
    model,
    '''  const concernResolution = selectHomeConcernResolutionNotifications(
    state.notifications,
  )[0];
''',
    '''  const concernResolution = selectHomeConcernResolutionNotifications(
    state.notifications,
  )[0];
  const specialRelationship = selectHomeSpecialRelationshipNotifications(
    state.notifications,
  )[0];
''',
)
replace_once(
    model,
    '''  if (notification) {
''',
    '''  if (specialRelationship) {
    const actionLabel =
      specialRelationship.payload.action === "established" ? "成立" : "解消";
    candidates.push({
      order: specialRelationship.readAtGameDate === null ? 2 : 42,
      news: {
        id: `news:relationship:${specialRelationship.id}`,
        kind: "special-relationship",
        title: `${specialRelationship.payload.kindLabel}関係が${actionLabel}`,
        detail: `${specialRelationship.payload.displayNames[0]} × ${specialRelationship.payload.displayNames[1]}`,
        notification: specialRelationship,
      },
    });
  }

  if (notification) {
''',
)

center = "src/features/home/HomeCommandCenter.tsx"
replace_once(
    center,
    '''import type { TrainingResultNotification } from "../../domain/notifications/gameNotifications";
''',
    '''import type {
  SpecialRelationshipNotification,
  TrainingResultNotification,
} from "../../domain/notifications/gameNotifications";
''',
)
replace_once(
    center,
    '''  onOpenTrainingNotification: (
    notification: TrainingResultNotification,
  ) => void;
}
''',
    '''  onOpenTrainingNotification: (
    notification: TrainingResultNotification,
  ) => void;
  onOpenRelationshipNotification: (
    notification: SpecialRelationshipNotification,
  ) => void;
}
''',
)
replace_once(
    center,
    '''  onDeclinePracticeOffer,
  onOpenTrainingNotification,
}: HomeCommandCenterProps) {
''',
    '''  onDeclinePracticeOffer,
  onOpenTrainingNotification,
  onOpenRelationshipNotification,
}: HomeCommandCenterProps) {
''',
)
replace_once(
    center,
    '''              if (news.kind === "growth") {
''',
    '''              if (news.kind === "special-relationship") {
                const unread = news.notification.readAtGameDate === null;
                return (
                  <button
                    aria-label={`${news.title} ${news.detail}`}
                    className={`home-command-news-row${unread ? " is-unread" : ""}`}
                    data-testid="home-command-news"
                    key={news.id}
                    onClick={() =>
                      onOpenRelationshipNotification(news.notification)
                    }
                    type="button"
                  >
                    <span>
                      <strong>{news.title}</strong>
                      <small>{news.detail}</small>
                    </span>
                    <b aria-hidden="true">›</b>
                  </button>
                );
              }
              if (news.kind === "growth") {
''',
)

home = "src/features/home/HomeScreen.tsx"
replace_once(
    home,
    '''import type { TrainingResultNotification } from "../../domain/notifications/gameNotifications";
''',
    '''import type {
  SpecialRelationshipNotification,
  TrainingResultNotification,
} from "../../domain/notifications/gameNotifications";
''',
)
replace_once(
    home,
    '''  const requestAdvance = () => {
''',
    '''  const acknowledgeRelationshipNotification = (
    notification: SpecialRelationshipNotification,
  ) => {
    if (notification.readAtGameDate === null) {
      void onMarkNotificationRead(notification.id);
    }
  };

  const requestAdvance = () => {
''',
)
replace_once(
    home,
    '''        onDeclinePracticeOffer={onDeclinePracticeOffer}
        onOpenTrainingNotification={openNotification}
        operationPending={operationPending}
''',
    '''        onDeclinePracticeOffer={onDeclinePracticeOffer}
        onOpenTrainingNotification={openNotification}
        onOpenRelationshipNotification={acknowledgeRelationshipNotification}
        operationPending={operationPending}
''',
)
