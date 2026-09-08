import type { SchoolView } from "./SchoolNavigationTabs";

let requestedSchoolView: Exclude<SchoolView, "scouting"> | null = null;

export function requestSchoolView(
  view: Exclude<SchoolView, "scouting">,
): void {
  requestedSchoolView = view;
}

export const requestSchoolViewAfterScouting = requestSchoolView;

export function consumeSchoolViewAfterScouting(): SchoolView {
  // Reading is intentionally side-effect free so React StrictMode can call
  // state initializers more than once without losing the requested tab.
  return requestedSchoolView ?? "facilities";
}
