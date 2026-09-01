export type AppTab = "home" | "team" | "school" | "match" | "more";
export const APP_NAVIGATION = [
  { id: "home", label: "ホーム", icon: "home" },
  { id: "team", label: "選手", icon: "team" },
  { id: "school", label: "学校", icon: "training" },
  { id: "match", label: "試合", icon: "match" },
  { id: "more", label: "その他", icon: "more" },
] as const;
