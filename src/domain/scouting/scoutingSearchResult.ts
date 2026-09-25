import type { ScoutReport } from "./scoutReport";

export type ScoutingSearchResultTone =
  | "poor"
  | "promising"
  | "standout"
  | "genius-rumor";

export interface ScoutingSearchResultPresentation {
  tone: ScoutingSearchResultTone;
  title: string;
  message: string;
}

export function scoutingSearchResultPresentation(
  reports: readonly ScoutReport[],
): ScoutingSearchResultPresentation {
  const maxStars = reports.reduce(
    (max, report) => Math.max(max, report.evaluationStars),
    0,
  );
  const highPotential = reports.some(
    (report) => report.estimatedPotential.max >= 90,
  );

  if (maxStars >= 5 && highPotential) {
    return {
      tone: "genius-rumor",
      title: "天才の噂",
      message: "世代屈指の才能かもしれない選手の情報を掴んだ。",
    };
  }
  if (maxStars >= 5 || reports.filter((report) => report.evaluationStars >= 4).length >= 2) {
    return {
      tone: "standout",
      title: "逸材発見",
      message: "スカウト陣から強い推薦が届いている。",
    };
  }
  if (maxStars >= 4 || reports.length >= 5) {
    return {
      tone: "promising",
      title: "好感触",
      message: "将来が楽しみな候補を複数確認できた。",
    };
  }
  return {
    tone: "poor",
    title: "今回は不作",
    message: "目立つ逸材は少ない。条件を変えて探すのも手だ。",
  };
}
