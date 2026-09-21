import type { SchoolView } from "./SchoolNavigationTabs";

type LegacySchoolView = "facilities" | "staff" | "alumni";
type SchoolViewRequest = Exclude<SchoolView, "scouting"> | LegacySchoolView;

export type SchoolManagementView = "facilities" | "staff";

let requestedSchoolView: Exclude<SchoolView, "scouting"> | null = null;
let requestedSchoolManagementView: SchoolManagementView | null = null;

export function requestSchoolView(view: SchoolViewRequest): void {
  if (view === "facilities" || view === "staff") {
    requestedSchoolView = "management";
    requestedSchoolManagementView = view;
    return;
  }
  if (view === "alumni") {
    requestedSchoolView = "records";
    return;
  }
  requestedSchoolView = view;
}

export const requestSchoolViewAfterScouting = requestSchoolView;

export function consumeSchoolViewAfterScouting(): SchoolView {
  // Reading is intentionally side-effect free so React StrictMode can call
  // state initializers more than once without losing the requested tab.
  return requestedSchoolView ?? "management";
}

export function consumeSchoolManagementViewAfterScouting(): SchoolManagementView {
  return requestedSchoolManagementView ?? "facilities";
}
