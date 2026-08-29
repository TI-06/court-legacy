from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    assert count == 1, f"{label}: expected 1 match, got {count}"
    return text.replace(old, new, 1)


game_path = Path("src/app/GameApp.tsx")
game = game_path.read_text()

game = replace_once(
    game,
    '''  ShopStatusResponse,
  ShopUseRequest,
} from "../domain/shop/shopContracts";''',
    '''  ShopStatusResponse,
  ShopUseRequest,
  ShopUseTarget,
} from "../domain/shop/shopContracts";''',
    "shop target import",
)

game = replace_once(
    game,
    '''  const [shopRetryRequest, setShopRetryRequest] =
    useState<ShopRetryRequest | null>(null);
  const [latestYearTransition, setLatestYearTransition] =''',
    '''  const [shopRetryRequest, setShopRetryRequest] =
    useState<ShopRetryRequest | null>(null);
  const [shopPendingTarget, setShopPendingTarget] =
    useState<ShopUseTarget | null>(null);
  const [latestYearTransition, setLatestYearTransition] =''',
    "shop pending target state",
)

game = replace_once(
    game,
    '''  const openScouting = () => {
    setScoutingOpen(true);
    setScoutingError(null);
    setRetryRecruitCandidateId(null);''',
    '''  const openScouting = () => {
    setScoutingOpen(true);
    setScoutingError(null);
    setRetryRecruitCandidateId(null);
    void loadShop();''',
    "open scouting shop load",
)

game = replace_once(
    game,
    '''    setShopPendingAction("use");
    setShopPendingItemId(request.itemId);
    setShopResultMessage(null);''',
    '''    setShopPendingAction("use");
    setShopPendingItemId(request.itemId);
    setShopPendingTarget(request.target ?? null);
    setShopResultMessage(null);''',
    "pending shop target",
)

game = replace_once(
    game,
    '''      if (await refreshShopAfterMutation(response.revision)) {
        setShopResultMessage("使用しました ✓");
      }
    } catch (error) {''',
    '''      if (await refreshShopAfterMutation(response.revision)) {
        setShopResultMessage("使用しました ✓");
        if (
          scoutingOpen &&
          (request.itemId === "scout-research" ||
            request.itemId === "potential-appraisal" ||
            request.itemId === "extra-scout-candidate")
        ) {
          await loadScoutingBoard(response.revision);
        }
      }
    } catch (error) {''',
    "shop use scouting refresh",
)

game = replace_once(
    game,
    '''    } finally {
      setShopPendingAction(null);
      setShopPendingItemId(null);
    }
  };

  const consumeShopItemFromUi = async (itemId: ShopItemId) => {
    await executeShopUse({
      operationId: crypto.randomUUID(),
      revision: cloudSession.snapshot.revision,
      itemId,
    });
  };''',
    '''    } finally {
      setShopPendingAction(null);
      setShopPendingItemId(null);
      setShopPendingTarget(null);
    }
  };

  const consumeShopItemFromUi = async (
    itemId: ShopItemId,
    target?: ShopUseTarget,
  ) => {
    await executeShopUse({
      operationId: crypto.randomUUID(),
      revision: cloudSession.snapshot.revision,
      itemId,
      target,
    });
  };''',
    "shop use target submit",
)

game = replace_once(
    game,
    '''        onRetry={retryScouting}
        recruitingCandidateId={recruitingCandidateId}
        reports={scoutingReports}
        state={gameState}
      />''',
    '''        onRetry={retryScouting}
        onUseShopItem={(itemId, target) => {
          void consumeShopItemFromUi(itemId, target);
        }}
        recruitingCandidateId={recruitingCandidateId}
        reports={scoutingReports}
        shopPendingCandidateId={
          shopPendingTarget?.type === "scouting-candidate"
            ? shopPendingTarget.candidateId
            : null
        }
        shopPendingItemId={shopPendingItemId}
        shopStatus={shopStatus}
        state={gameState}
      />''',
    "scouting shop props",
)

game = replace_once(
    game,
    '''        onUse={(itemId) => {
          void consumeShopItemFromUi(itemId);
        }}
        pendingAction={shopPendingAction}''',
    '''        onUse={(itemId, target) => {
          void consumeShopItemFromUi(itemId, target);
        }}
        pendingAction={shopPendingAction}''',
    "shop target callback",
)

game = replace_once(
    game,
    '''        retryAction={shopRetryRequest?.action ?? null}
        status={shopStatus}
      />''',
    '''        retryAction={shopRetryRequest?.action ?? null}
        state={gameState}
        status={shopStatus}
      />''',
    "shop game state prop",
)

game_path.write_text(game)

training_path = Path("src/features/training/TrainingScreen.tsx")
training = training_path.read_text()
training = replace_once(
    training,
    '''      </section>

      <section className="training-panel training-plan-card">''',
    '''      </section>

      {state.shopEffects?.nextTrainingGrowthBoost ? (
        <p className="training-shop-boost" role="status">
          次回練習 成長効率 +{state.shopEffects.nextTrainingGrowthBoost.percent}%
        </p>
      ) : null}

      <section className="training-panel training-plan-card">''',
    "training boost badge",
)
training_path.write_text(training)
