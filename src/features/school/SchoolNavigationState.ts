import type { SchoolView } from "./SchoolNavigationTabs";

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
