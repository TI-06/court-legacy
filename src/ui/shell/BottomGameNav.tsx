import { GameIcon } from "../theme/GameIcon";
import { APP_NAVIGATION, type AppTab } from "./appNavigation";

interface BottomGameNavProps {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}

export function BottomGameNav({ activeTab, onChange }: BottomGameNavProps) {
  return (
    <nav aria-label="主要メニュー" className="bottom-game-nav">
      {APP_NAVIGATION.map((item) => {
        const active = activeTab === item.id;

        return (
          <button
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "bottom-game-nav__item bottom-game-nav__item--active"
                : "bottom-game-nav__item"
            }
            key={item.id}
            onClick={() => onChange(item.id)}
            type="button"
          >
            <GameIcon name={item.icon} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
