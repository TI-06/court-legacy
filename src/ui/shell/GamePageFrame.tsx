import type { ReactNode } from "react";
import { BottomGameNav } from "./BottomGameNav";
import { GameHeader } from "./GameHeader";
import type { AppTab } from "./appNavigation";

interface GamePageFrameProps {
  activeTab: AppTab;
  children: ReactNode;
  saveNotice: string | null;
  onChangeTab: (tab: AppTab) => void;
  onOpenSave: () => void;
  onOpenCalendar: () => void;
}

export function GamePageFrame({
  activeTab,
  children,
  saveNotice,
  onChangeTab,
  onOpenSave,
  onOpenCalendar,
}: GamePageFrameProps) {
  return (
    <div className="game-page-frame">
      <GameHeader
        onOpenCalendar={onOpenCalendar}
        onOpenSave={onOpenSave}
        saveNotice={saveNotice}
      />
      <div className="game-page-frame__content">{children}</div>
      <BottomGameNav activeTab={activeTab} onChange={onChangeTab} />
    </div>
  );
}
