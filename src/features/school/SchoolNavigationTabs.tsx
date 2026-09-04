import "./school-screen.css";

export type SchoolView = "facilities" | "scouting" | "records" | "alumni";

let requestedViewAfterScouting: Exclude<SchoolView, "scouting"> | null = null;

export function requestSchoolViewAfterScouting(
  view: Exclude<SchoolView, "scouting">,
): void {
  requestedViewAfterScouting = view;
}

export function consumeSchoolViewAfterScouting(): SchoolView {
  // Reading is intentionally side-effect free so React StrictMode can call
  // state initializers more than once without losing the requested tab.
  return requestedViewAfterScouting ?? "facilities";
}

interface SchoolNavigationTabsProps {
  activeView: SchoolView;
  onSelect: (view: SchoolView) => void;
}

const schoolViews: readonly [SchoolView, string][] = [
  ["facilities", "設備"],
  ["scouting", "スカウト"],
  ["records", "記録"],
  ["alumni", "卒業生"],
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
