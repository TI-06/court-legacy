import type {
  EventChoiceDefinition,
  EventEffect,
} from "../../domain/validation/gameDataSchema";

export interface EventChoiceImpact {
  label: string;
  tone: "up" | "down" | "neutral";
}

const abilityLabels: Record<string, string> = {
  spike: "スパイク",
  jump: "ジャンプ",
  receive: "レシーブ",
  serve: "サーブ",
  set: "トス",
  block: "ブロック",
  speed: "スピード",
  stamina: "スタミナ",
  decision: "判断力",
  mental: "メンタル",
};
const sign = (n: number) => (n > 0 ? `+${n}` : String(n));

export function describeEventChoiceEffect(
  effect: EventEffect,
): EventChoiceImpact {
  switch (effect.type) {
    case "ability-change":
      return {
        label: `${abilityLabels[effect.ability]} ${sign(effect.amount)}`,
        tone: effect.amount < 0 ? "down" : "up",
      };
    case "morale-change":
    case "trust-change":
    case "relationship-change":
    case "reputation-change":
    case "funds-change": {
      const label = {
        "morale-change": "士気",
        "trust-change": "信頼",
        "relationship-change": "連携",
        "reputation-change": "評判",
        "funds-change": "資金",
      }[effect.type];
      return {
        label: `${label} ${sign(effect.amount)}`,
        tone: effect.amount < 0 ? "down" : "up",
      };
    }
    case "fatigue-change":
      return {
        label: `疲労 ${sign(effect.amount)}`,
        tone: effect.amount > 0 ? "down" : "up",
      };
    case "facility-change":
      return {
        label: `設備 ${sign(effect.amount)}`,
        tone: effect.amount < 0 ? "down" : "up",
      };
    case "injury-set":
      return { label: `負傷（${effect.weeks}週）`, tone: "down" };
    case "injury-clear":
      return { label: "負傷回復", tone: "up" };
    case "add-trait":
      return { label: "個性獲得", tone: "neutral" };
    case "remove-trait":
      return { label: "個性解除", tone: "neutral" };
    case "special-ability-acquire":
      return { label: "特殊能力の習得判定", tone: "neutral" };
    case "special-ability-add":
      return { label: "特殊能力を習得", tone: "up" };
    case "special-ability-remove":
      return { label: "特殊能力を失う", tone: "down" };
    case "special-relationship-add":
      return { label: "特別な関係を築く", tone: "up" };
    case "special-relationship-remove":
      return { label: "特別な関係を解消", tone: "neutral" };
    case "schedule-event":
      return {
        label: `${effect.afterWeeks}週後に展開（${effect.probability}%）`,
        tone: "neutral",
      };
  }
}

/** All labels describe authored effects, not predicted post-cap values. */
export function previewEventChoice(
  choice: EventChoiceDefinition,
): EventChoiceImpact[] {
  const impacts = choice.effects.map(describeEventChoiceEffect);
  if (choice.followUp) {
    impacts.push({
      label: `${choice.followUp.afterWeeks}週後に続編（${choice.followUp.probability}%）`,
      tone: "neutral",
    });
  }
  return impacts;
}
