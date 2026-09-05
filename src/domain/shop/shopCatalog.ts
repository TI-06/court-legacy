export const SHOP_ITEM_IDS = [
  "extra-scout-candidate",
  "scout-research",
  "potential-appraisal",
  "training-camp",
  "fatigue-recovery",
  "special-coach",
  "training-efficiency-boost",
  "funds-grant-300",
  "funds-grant-1000",
  "funds-grant-3000",
] as const;

export type ShopItemId = (typeof SHOP_ITEM_IDS)[number];

export type ShopTargetKind =
  | "none"
  | "team"
  | "player"
  | "scouting-candidate"
  | "special-coach"
  | "next-training";

export interface ShopItemDefinition {
  itemId: ShopItemId;
  displayName: string;
  description: string;
  priceYen: 0;
  annualPurchaseLimit: number;
  annualUseLimit: number;
  targetKind: ShopTargetKind;
  sortOrder: number;
}

export const PHASE5_SHOP_ITEMS = [
  {
    itemId: "extra-scout-candidate",
    displayName: "新入生候補追加",
    description: "今年度の新入生スカウト候補を1名追加します。",
    priceYen: 0,
    annualPurchaseLimit: 1,
    annualUseLimit: 1,
    targetKind: "none",
    sortOrder: 10,
  },
  {
    itemId: "scout-research",
    displayName: "スカウト再調査",
    description: "指定した候補のスカウト情報を高精度で再調査します。",
    priceYen: 0,
    annualPurchaseLimit: 2,
    annualUseLimit: 2,
    targetKind: "scouting-candidate",
    sortOrder: 20,
  },
  {
    itemId: "potential-appraisal",
    displayName: "潜在能力鑑定",
    description: "指定した候補の将来性をより狭い推定範囲で鑑定します。",
    priceYen: 0,
    annualPurchaseLimit: 3,
    annualUseLimit: 3,
    targetKind: "scouting-candidate",
    sortOrder: 30,
  },
  {
    itemId: "training-camp",
    displayName: "強化合宿",
    description: "チーム全体へ追加の特別育成を実施します。",
    priceYen: 0,
    annualPurchaseLimit: 1,
    annualUseLimit: 1,
    targetKind: "team",
    sortOrder: 40,
  },
  {
    itemId: "fatigue-recovery",
    displayName: "疲労回復",
    description: "指定した選手1名の疲労を大きく回復します。",
    priceYen: 0,
    annualPurchaseLimit: 3,
    annualUseLimit: 3,
    targetKind: "player",
    sortOrder: 50,
  },
  {
    itemId: "special-coach",
    displayName: "特別コーチ",
    description: "指定した選手1名へ重点個別育成を実施します。",
    priceYen: 0,
    annualPurchaseLimit: 1,
    annualUseLimit: 1,
    targetKind: "special-coach",
    sortOrder: 60,
  },
  {
    itemId: "training-efficiency-boost",
    displayName: "練習効率アップ",
    description: "次回の通常練習1回だけ成長効率を20%高めます。",
    priceYen: 0,
    annualPurchaseLimit: 1,
    annualUseLimit: 1,
    targetKind: "next-training",
    sortOrder: 70,
  },
  {
    itemId: "funds-grant-300",
    displayName: "活動資金 +300",
    description: "学校の活動資金を300追加します。受け取り後すぐに反映されます。",
    priceYen: 0,
    annualPurchaseLimit: 3,
    annualUseLimit: 3,
    targetKind: "none",
    sortOrder: 80,
  },
  {
    itemId: "funds-grant-1000",
    displayName: "活動資金 +1,000",
    description: "学校の活動資金を1,000追加します。受け取り後すぐに反映されます。",
    priceYen: 0,
    annualPurchaseLimit: 1,
    annualUseLimit: 1,
    targetKind: "none",
    sortOrder: 90,
  },
  {
    itemId: "funds-grant-3000",
    displayName: "活動資金 +3,000",
    description: "学校の活動資金を3,000追加します。受け取り後すぐに反映されます。",
    priceYen: 0,
    annualPurchaseLimit: 1,
    annualUseLimit: 1,
    targetKind: "none",
    sortOrder: 100,
  },
] as const satisfies readonly ShopItemDefinition[];

export function getShopItemDefinition(itemId: ShopItemId): ShopItemDefinition {
  const definition = PHASE5_SHOP_ITEMS.find((item) => item.itemId === itemId);
  if (!definition) {
    throw new Error(`unknown shop item: ${itemId}`);
  }
  return definition;
}

export function shopFundGrantAmount(itemId: ShopItemId): number | null {
  switch (itemId) {
    case "funds-grant-300":
      return 300;
    case "funds-grant-1000":
      return 1000;
    case "funds-grant-3000":
      return 3000;
    default:
      return null;
  }
}

export function isShopFundGrant(itemId: ShopItemId): boolean {
  return shopFundGrantAmount(itemId) !== null;
}
