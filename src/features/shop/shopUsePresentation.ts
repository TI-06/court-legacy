import type { ScoutReport } from "../../domain/scouting/scoutReport";
import type { ShopItemId } from "../../domain/shop/shopCatalog";
import type { ShopUseTarget } from "../../domain/shop/shopContracts";

export interface ShopUsePresentation {
  itemId: ShopItemId;
  result: Record<string, unknown>;
  target?: ShopUseTarget;
  beforeScoutReport?: ScoutReport;
  afterScoutReport?: ScoutReport;
}
