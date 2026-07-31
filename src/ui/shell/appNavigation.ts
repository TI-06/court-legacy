export type AppTab = "home" | "team" | "training" | "match" | "school";

export const APP_NAVIGATION = [
  { id: "home", label: "ホーム", icon: "home" },
  { id: "team", label: "選手", icon: "team" },
  { id: "training", label: "育成", icon: "training" },
  { id: "match", label: "試合", icon: "match" },
  { id: "school", label: "学校", icon: "school" },
] as const;
