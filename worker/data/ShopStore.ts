import type { GameState } from "../../src/domain/model/GameState";
import type { TeamSelection } from "../../src/domain/model/TeamSelection";
import type { ShopItemId } from "../../src/domain/shop/shopCatalog";

export interface ShopStatusItem {
  academicYearIndex: number;
  itemId: ShopItemId;
  displayName: string;
  description: string;
  priceYen: 0;
  annualPurchaseLimit: number;
  annualUseLimit: number;
  purchasedCount: number;
  usedCount: number;
  quantityOwned: number;
  enabled: boolean;
  sortOrder: number;
}

export type ShopOperationType = "purchase" | "use";

export interface ShopMutationResult {
  operationId: string;
  operationType: ShopOperationType;
  requestFingerprint: string;
  revision: number;
  academicYearIndex: number;
  itemId: ShopItemId;
  quantityOwned: number;
  purchasedCount: number;
  usedCount: number;
  response: unknown;
  replayed: boolean;
}

export interface PurchaseShopItemInput {
  userId: string;
  operationId: string;
  requestFingerprint: string;
  expectedRevision: number;
  itemId: ShopItemId;
}

export type ShopUseTargetType =
  | "none"
  | "team"
  | "player"
  | "scouting-candidate"
  | "special-coach"
  | "next-training";

export interface CommitShopUseInput {
  userId: string;
  operationId: string;
  requestFingerprint: string;
  expectedRevision: number;
  itemId: ShopItemId;
  state: GameState;
  teamSelection: TeamSelection;
  targetType: ShopUseTargetType;
  targetId: string | null;
  safeRequest: Record<string, unknown>;
  publicResult: Record<string, unknown>;
  scoutingCycleKey?: string | null;
  scoutingCandidates?: unknown[] | null;
  scoutingInsight?: Record<string, unknown> | null;
}

export interface ShopStore {
  getStatus(userId: string, currentYearIndex: number): Promise<ShopStatusItem[]>;
  purchase(input: PurchaseShopItemInput): Promise<ShopMutationResult>;
  use(input: CommitShopUseInput): Promise<ShopMutationResult>;
}

export type ShopMutationErrorCode =
  | "revision_conflict"
  | "operation_id_reused"
  | "item_not_found"
  | "item_disabled"
  | "purchase_limit_reached"
  | "use_limit_reached"
  | "inventory_empty"
  | "inventory_expired"
  | "invalid_target"
  | "target_not_found"
  | "effect_already_pending"
  | "scouting_cycle_unavailable"
  | "server_error";

export class ShopStoreMutationError extends Error {
  constructor(
    public readonly code: ShopMutationErrorCode,
    message = code,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ShopStoreMutationError";
  }
}
