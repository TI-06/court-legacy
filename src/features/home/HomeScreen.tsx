import { useState } from "react";
import type { GameDataRegistry } from "../../data/dataRegistry";
import { gameDataBootstrap } from "../../data/gameData";
import type { SimulateMatchResult } from "../../domain/match/simulateMatch";
import type { GameState } from "../../domain/model/GameState";
import type { School } from "../../domain/model/School";
import type { TrainingResultNotification } from "../../domain/notifications/gameNotifications";
import { BottomSheet } from "../../ui/BottomSheet";
import { StickyActionBar } from "../../ui/StickyActionBar";
import "../../ui/ui.css";
import { HomeCommandCenter } from "./HomeCommandCenter";
import {
  selectHomeCommandCenter,
  type HomeCommandAction,
} from "./homeCommandCenter";
import { TrainingResultNotificationSheet } from "./TrainingResultNotificationSheet";
import "./home-command-center.css";
import "./training-result-notification.css";

interface HomeScreenProps {
  state: GameState;
  data?: Pick<GameDataRegistry, "trainingMenus">;
  homeStrength: number;
  onCommand?: (action: HomeCommandAction) => void;
  onAdvanceWeek: () => void;
  onAcceptPracticeOffer?: () => void;
  onDeclinePracticeOffer?: () => void;
  operationPending?: boolean;
  onMarkNotificationRead: (notificationId: string) => Promise<void> | void;

  // Transitional compatibility for the existing GameApp wiring. Task 3 replaces
  // these callbacks with the HomeCommandAction contract and removes this bridge.
  opponent?: School;
  latestMatch?: SimulateMatchResult | null;
  trainingCompleted?: boolean;
  practiceMatchCompleted?: boolean;
  onOpenSchool?: () => void;
  onOpenTeam?: () => void;
  onOpenMatch?: () => void;
  onOpenOfficialTournament?: () => void;
}

export function HomeScreen({
  state,
  data,
  homeStrength,
  onCommand,
  onAdvanceWeek,
  onAcceptPracticeOffer = () => undefined,
  onDeclinePracticeOffer = () => undefined,
  operationPending = false,
  onMarkNotificationRead,
  onOpenSchool = () => undefined,
  onOpenTeam = () => undefined,
  onOpenMatch = () => undefined,
  onOpenOfficialTournament = () => undefined,
}: HomeScreenProps) {
  const [selectedNotification, setSelectedNotification] =
    useState<TrainingResultNotification | null>(null);
  const [advanceWarningOpen, setAdvanceWarningOpen] = useState(false);
  const resolvedData =
    data ?? (gameDataBootstrap.ok ? gameDataBootstrap.data : null);
  if (!resolvedData) {
    throw new Error("game data is unavailable for Home");
  }

  const model = selectHomeCommandCenter({
    state,
    data: resolvedData,
    homeStrength,
  });

  const openNotification = (notification: TrainingResultNotification) => {
    setSelectedNotification(notification);
    if (notification.readAtGameDate === null) {
      void onMarkNotificationRead(notification.id);
    }
  };

  const requestAdvance = () => {
    if (operationPending) return;
    if (model.advance.requiresConfirmation) {
      setAdvanceWarningOpen(true);
      return;
    }
    onAdvanceWeek();
  };

  const dispatchCommand = (action: HomeCommandAction) => {
    if (onCommand) {
      onCommand(action);
      return;
    }

    switch (action.target) {
      case "team":
      case "player":
        onOpenTeam();
        return;
      case "school":
      case "scouting":
        onOpenSchool();
        return;
      case "practice":
        onOpenMatch();
        return;
      case "tournament":
        onOpenOfficialTournament();
        return;
      case "start-week-match":
        requestAdvance();
        return;
    }
  };

  return (
    <main
      aria-label="ホーム"
      className="app-content home-screen"
      data-testid="home-screen"
    >
      <HomeCommandCenter
        model={model}
        onAcceptPracticeOffer={onAcceptPracticeOffer}
        onCommand={dispatchCommand}
        onDeclinePracticeOffer={onDeclinePracticeOffer}
        onOpenTrainingNotification={openNotification}
        operationPending={operationPending}
      />

      <div className="home-command-advance" data-testid="home-command-advance">
        <StickyActionBar
          disabled={operationPending}
          label="今週を進める"
          onClick={requestAdvance}
        />
      </div>

      <TrainingResultNotificationSheet
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
      />

      <BottomSheet
        description="練習試合の申し込みが未回答です。このまま次週へ進みますか？"
        onClose={() => setAdvanceWarningOpen(false)}
        open={advanceWarningOpen}
        title="未回答の申し込みがあります"
      >
        <div className="home-advance-warning-actions">
          <button
            disabled={operationPending}
            onClick={() => setAdvanceWarningOpen(false)}
            type="button"
          >
            戻る
          </button>
          <button
            className="is-primary"
            disabled={operationPending}
            onClick={() => {
              setAdvanceWarningOpen(false);
              onAdvanceWeek();
            }}
            type="button"
          >
            そのまま進む
          </button>
        </div>
      </BottomSheet>
    </main>
  );
}
