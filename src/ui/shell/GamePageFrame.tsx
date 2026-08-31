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
  progressLabel: string;
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
  operation,
  onChangeTab,
  onOpenCalendar,
}: GamePageFrameProps) {
  return (
    <div className="game-page-frame">
      <GameHeader
        dateLabel={dateLabel}
        onOpenCalendar={onOpenCalendar}
        operation={operation}
        progressLabel={progressLabel}
        schoolName={schoolName}
      />
      <div className="game-page-frame__content">{children}</div>
      <BottomGameNav activeTab={activeTab} onChange={onChangeTab} />
    </div>
  );
}
