import "./school-screen.css";

export type SchoolView = "management" | "scouting" | "records";

interface SchoolNavigationTabsProps {
  activeView: SchoolView;
  onSelect: (view: SchoolView) => void;
}

const schoolViews: readonly [SchoolView, string][] = [
  ["management", "運営"],
  ["scouting", "スカウト"],
  ["records", "記録"],
];

export function SchoolNavigationTabs({
  activeView,
  onSelect,
}: SchoolNavigationTabsProps) {
  return (
    <div
      aria-label="学校運営メニュー"
      className="school-segments"
      role="tablist"
    >
      {schoolViews.map(([id, label]) => (
        <button
          aria-selected={activeView === id}
          className={activeView === id ? "school-segment--active" : undefined}
          data-school-view={id}
          key={id}
          onClick={() => onSelect(id)}
          role="tab"
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
