import type { SchoolView } from "./SchoolNavigationTabs";

type LegacySchoolView = "facilities" | "staff" | "investment" | "alumni";
type SchoolViewRequest = Exclude<SchoolView, "scouting"> | LegacySchoolView;

export type SchoolManagementView = "facilities" | "staff" | "investment";

let requestedSchoolView: Exclude<SchoolView, "scouting"> | null = null;
let requestedSchoolManagementView: SchoolManagementView | null = null;

export function requestSchoolView(view: SchoolViewRequest): void {
  if (view === "facilities" || view === "staff" || view === "investment") {
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
