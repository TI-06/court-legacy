export interface NextTrainingGrowthBoost {
  percent: 20;
  remainingUses: 1;
  sourceItemId: "training-efficiency-boost";
}

export interface ShopGameEffects {
  nextTrainingGrowthBoost?: NextTrainingGrowthBoost;
}
