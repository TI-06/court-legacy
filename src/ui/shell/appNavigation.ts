export type AppTab = "home" | "team" | "training" | "match" | "more";

export const APP_NAVIGATION = [
  { id: "home", label: "ホーム", icon: "home" },
  { id: "team", label: "選手", icon: "team" },
  { id: "training", label: "育成", icon: "training" },
  { id: "match", label: "試合", icon: "match" },
  { id: "more", label: "その他", icon: "more" },
] as const;
