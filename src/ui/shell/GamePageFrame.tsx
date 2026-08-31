import type { ReactNode } from "react";
import type { OperationState } from "../../app/useGameSession";
import { BottomGameNav } from "./BottomGameNav";
import { GameHeader } from "./GameHeader";
import type { AppTab } from "./appNavigation";

interface GamePageFrameProps {
  activeTab: AppTab;
  children: ReactNode;
  schoolName: string;
  dateLabel: string;
  progressLabel?: string;
  reputationLabel?: string;
  operation: OperationState;
  onChangeTab: (tab: AppTab) => void;
  onOpenCalendar: () => void;
}

export function GamePageFrame({
  activeTab,
  children,
  schoolName,
  dateLabel,
  progressLabel,
  reputationLabel,
  operation,
  onChangeTab,
  onOpenCalendar,
}: GamePageFrameProps) {
  const resolvedProgressLabel =
    progressLabel ?? `就任中${reputationLabel ? `・${reputationLabel}` : ""}`;

  return (
    <div className="game-page-frame">
      <GameHeader
        dateLabel={dateLabel}
        onOpenCalendar={onOpenCalendar}
        operation={operation}
        progressLabel={resolvedProgressLabel}
        schoolName={schoolName}
      />
      <div className="game-page-frame__content">{children}</div>
      <BottomGameNav activeTab={activeTab} onChange={onChangeTab} />
    </div>
  );
}
