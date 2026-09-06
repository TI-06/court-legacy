import { z } from "zod";
import { SHOP_ITEM_IDS } from "../../src/domain/shop/shopCatalog";
import type {
  CommitShopUseInput,
  PurchaseShopItemInput,
  ShopMutationErrorCode,
  ShopMutationResult,
  ShopOperationRecord,
  ShopStatusItem,
  ShopStore,
} from "./ShopStore";
import { ShopStoreMutationError } from "./ShopStore";
import type { SupabaseAdminClient } from "./createSupabaseAdmin";

const shopItemIdSchema = z.enum(SHOP_ITEM_IDS);

const operationRowSchema = z
  .object({
    operation_id: z.string().min(1),
    operation_type: z.enum(["purchase", "use"]),
    request_fingerprint: z.string().min(1),
    response: z.unknown(),
  })
  .strict();

const statusRowSchema = z
  .object({
    academic_year_index: z.number().int().nonnegative(),
    item_id: shopItemIdSchema,
    display_name: z.string().min(1),
    description: z.string().min(1),
    price_yen: z.literal(0),
    annual_purchase_limit: z.number().int().positive(),
    annual_use_limit: z.number().int().positive(),
    purchased_count: z.number().int().nonnegative(),
    used_count: z.number().int().nonnegative(),
    quantity_owned: z.number().int().nonnegative(),
    enabled: z.boolean(),
    sort_order: z.number().int(),
  })
  .strict();

const purchaseResponseSchema = z
  .object({
    operationId: z.string().min(1),
    operationType: z.literal("purchase"),
    revision: z.number().int().positive(),
    academicYearIndex: z.number().int().nonnegative(),
    itemId: shopItemIdSchema,
    quantityOwned: z.number().int().nonnegative(),
    purchasedCount: z.number().int().nonnegative(),
    usedCount: z.number().int().nonnegative(),
    result: z
      .object({
        fundsGranted: z.number().int().positive(),
        balanceAfter: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
  })
  .strict();

const mutationRowSchema = z
  .object({
    operation_id: z.string().min(1),
    operation_type: z.enum(["purchase", "use"]),
    request_fingerprint: z.string().min(1),
    revision: z.number().int().positive(),
    academic_year_index: z.number().int().nonnegative(),
    item_id: shopItemIdSchema,
    quantity_owned: z.number().int().nonnegative(),
    purchased_count: z.number().int().nonnegative(),
    used_count: z.number().int().nonnegative(),
    response: z.unknown(),
    replayed: z.boolean(),
  })
  .strict();

const mutationErrorCodes = new Set<ShopMutationErrorCode>([
  "revision_conflict",
  "operation_id_reused",
  "item_not_found",
  "item_disabled",
  "purchase_limit_reached",
  "use_limit_reached",
  "inventory_empty",
  "inventory_expired",
  "invalid_target",
  "target_not_found",
  "effect_already_pending",
  "scouting_cycle_unavailable",
  "server_error",
]);

export class ShopStoreDataError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ShopStoreDataError";
  }
}

function errorText(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    for (const key of ["message", "details", "hint", "code"] as const) {
      const value = (error as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }
  return "server_error";
}

function toMutationError(error: unknown): ShopStoreMutationError {
  const text = errorText(error);
  let code: ShopMutationErrorCode = "server_error";
  for (const candidate of mutationErrorCodes) {
    if (text.includes(candidate)) {
      code = candidate;
      break;
    }
  }
  return new ShopStoreMutationError(code, text, { cause: error });
}

function parseOperationRow(value: unknown): ShopOperationRecord {
  const parsed = operationRowSchema.safeParse(value);
  if (!parsed.success) {
    throw new ShopStoreDataError("shop operation response is invalid", {
      cause: parsed.error,
    });
  }

  return {
    operationId: parsed.data.operation_id,
    operationType: parsed.data.operation_type,
    requestFingerprint: parsed.data.request_fingerprint,
    response: parsed.data.response,
  };
}

function parseStatusRows(value: unknown): ShopStatusItem[] {
  const parsed = z.array(statusRowSchema).safeParse(value);
  if (!parsed.success) {
    throw new ShopStoreDataError("shop status response is invalid", {
      cause: parsed.error,
    });
  }

  return parsed.data.map((row) => ({
    academicYearIndex: row.academic_year_index,
    itemId: row.item_id,
    displayName: row.display_name,
    description: row.description,
    priceYen: row.price_yen,
    annualPurchaseLimit: row.annual_purchase_limit,
    annualUseLimit: row.annual_use_limit,
    purchasedCount: row.purchased_count,
    usedCount: row.used_count,
    quantityOwned: row.quantity_owned,
    enabled: row.enabled,
    sortOrder: row.sort_order,
  }));
}

function parseMutationRow(value: unknown): ShopMutationResult {
  const parsed = z.array(mutationRowSchema).safeParse(value);
  if (!parsed.success) {
    throw new ShopStoreDataError("shop mutation response is invalid", {
      cause: parsed.error,
    });
  }
  if (parsed.data.length !== 1) {
    throw new ShopStoreDataError("shop mutation response must contain one row");
  }

  const row = parsed.data[0]!;
  let response = row.response;
  if (row.operation_type === "purchase") {
    const purchaseResponse = purchaseResponseSchema.safeParse(row.response);
    if (!purchaseResponse.success) {
      throw new ShopStoreDataError("shop purchase response is invalid", {
        cause: purchaseResponse.error,
      });
    }
    response = purchaseResponse.data;
  }

  return {
    operationId: row.operation_id,
    operationType: row.operation_type,
    requestFingerprint: row.request_fingerprint,
    revision: row.revision,
    academicYearIndex: row.academic_year_index,
    itemId: row.item_id,
    quantityOwned: row.quantity_owned,
    purchasedCount: row.purchased_count,
    usedCount: row.used_count,
    response,
    replayed: row.replayed,
  };
}

export class SupabaseShopStore implements ShopStore {
  constructor(private readonly client: SupabaseAdminClient) {}

  async findOperation(
    userId: string,
    operationId: string,
  ): Promise<ShopOperationRecord | null> {
    const { data, error } = await this.client
      .from("shop_operations")
      .select("operation_id, operation_type, request_fingerprint, response")
      .eq("user_id", userId)
      .eq("operation_id", operationId)
      .maybeSingle();

    if (error) {
      throw new ShopStoreDataError("shop operation read failed", {
        cause: error,
      });
    }
    if (!data) {
      return null;
    }
    return parseOperationRow(data);
  }

  async getStatus(
    userId: string,
    currentYearIndex: number,
  ): Promise<ShopStatusItem[]> {
    const { data, error } = await this.client.rpc("get_shop_status", {
      p_user_id: userId,
      p_current_year_index: currentYearIndex,
    });

    if (error) {
      throw new ShopStoreDataError("shop status read failed", { cause: error });
    }
    return parseStatusRows(data);
  }

  async purchase(input: PurchaseShopItemInput): Promise<ShopMutationResult> {
    const { data, error } = await this.client.rpc("purchase_shop_item", {
      p_user_id: input.userId,
      p_operation_id: input.operationId,
      p_request_fingerprint: input.requestFingerprint,
      p_expected_revision: input.expectedRevision,
      p_item_id: input.itemId,
    });

    if (error) {
      throw toMutationError(error);
    }
    return parseMutationRow(data);
  }

  async use(input: CommitShopUseInput): Promise<ShopMutationResult> {
    const { data, error } = await this.client.rpc("commit_shop_item_use", {
      p_user_id: input.userId,
      p_operation_id: input.operationId,
      p_request_fingerprint: input.requestFingerprint,
      p_expected_revision: input.expectedRevision,
      p_item_id: input.itemId,
      p_state: input.state,
      p_team_selection: input.teamSelection,
      p_target_type: input.targetType,
      p_target_id: input.targetId,
      p_safe_request: input.safeRequest,
      p_public_result: input.publicResult,
      p_scouting_cycle_key: input.scoutingCycleKey ?? null,
      p_scouting_candidates: input.scoutingCandidates ?? null,
      p_scouting_insight: input.scoutingInsight ?? null,
    });

    if (error) {
      throw toMutationError(error);
    }
    return parseMutationRow(data);
  }
}
