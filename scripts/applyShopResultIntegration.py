from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    assert count == 1, f"{label}: expected 1 match, got {count}"
    return text.replace(old, new, 1)


shop_path = Path("src/features/shop/ShopScreen.tsx")
shop = shop_path.read_text()
shop = replace_once(
    shop,
    'import type { AbilityKey } from "../../domain/model/Player";',
    'import type { PlayerAbilities } from "../../domain/model/Player";',
    "player ability import",
)
shop = replace_once(
    shop,
    'type ShopView = "products" | "inventory";',
    'type AbilityKey = keyof PlayerAbilities;\n\ntype ShopView = "products" | "inventory";',
    "ability key alias",
)
shop_path.write_text(shop)


game_path = Path("src/app/GameApp.tsx")
game = game_path.read_text()

game = replace_once(
    game,
    'import { ShopScreen } from "../features/shop/ShopScreen";',
    'import { ShopScreen } from "../features/shop/ShopScreen";\nimport type { ShopUsePresentation } from "../features/shop/shopUsePresentation";',
    "presentation import",
)

game = replace_once(
    game,
    '''  const [shopResultMessage, setShopResultMessage] = useState<string | null>(
    null,
  );
  const [shopRetryRequest, setShopRetryRequest] =''',
    '''  const [shopResultMessage, setShopResultMessage] = useState<string | null>(
    null,
  );
  const [latestShopUseResult, setLatestShopUseResult] =
    useState<ShopUsePresentation | null>(null);
  const [shopRetryRequest, setShopRetryRequest] =''',
    "presentation state",
)

old_load = '''  const loadScoutingBoard = async (
    revision = cloudSession.snapshot.revision,
  ) => {
    if (!api.getScoutingBoard) {
      setScoutingError("スカウト機能を利用できません");
      return;
    }

    setScoutingLoading(true);
    setScoutingError(null);
    setRetryRecruitCandidateId(null);

    try {
      const response = await api.getScoutingBoard(session.accessToken, {
        operationId: crypto.randomUUID(),
        revision,
      });
      setScoutingReports(response.reports);
      setScoutingCycle(response.cycleKey);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          const latest = await api.bootstrap(session.accessToken);
          if (latest.status === "ready") {
            await cloudSession.adoptServerSnapshot(
              latest.game,
              "最新のゲーム状態を読み込みました",
            );
            setScoutingReports([]);
            setScoutingCycle(null);
            const refreshed = await api.getScoutingBoard(session.accessToken, {
              operationId: crypto.randomUUID(),
              revision: latest.game.revision,
            });
            setScoutingReports(refreshed.reports);
            setScoutingCycle(refreshed.cycleKey);
            return;
          }
        } catch (refreshError) {
          setScoutingError(
            scoutingErrorMessage(
              refreshError,
              "最新のスカウト候補を読み込めませんでした",
            ),
          );
          return;
        }
      }

      setScoutingError(
        scoutingErrorMessage(error, "候補を読み込めませんでした"),
      );
    } finally {
      setScoutingLoading(false);
    }
  };'''
new_load = '''  const loadScoutingBoard = async (
    revision = cloudSession.snapshot.revision,
  ): Promise<ScoutReport[] | null> => {
    if (!api.getScoutingBoard) {
      setScoutingError("スカウト機能を利用できません");
      return null;
    }

    setScoutingLoading(true);
    setScoutingError(null);
    setRetryRecruitCandidateId(null);

    try {
      const response = await api.getScoutingBoard(session.accessToken, {
        operationId: crypto.randomUUID(),
        revision,
      });
      setScoutingReports(response.reports);
      setScoutingCycle(response.cycleKey);
      return response.reports;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        try {
          const latest = await api.bootstrap(session.accessToken);
          if (latest.status === "ready") {
            await cloudSession.adoptServerSnapshot(
              latest.game,
              "最新のゲーム状態を読み込みました",
            );
            setScoutingReports([]);
            setScoutingCycle(null);
            const refreshed = await api.getScoutingBoard(session.accessToken, {
              operationId: crypto.randomUUID(),
              revision: latest.game.revision,
            });
            setScoutingReports(refreshed.reports);
            setScoutingCycle(refreshed.cycleKey);
            return refreshed.reports;
          }
        } catch (refreshError) {
          setScoutingError(
            scoutingErrorMessage(
              refreshError,
              "最新のスカウト候補を読み込めませんでした",
            ),
          );
          return null;
        }
      }

      setScoutingError(
        scoutingErrorMessage(error, "候補を読み込めませんでした"),
      );
      return null;
    } finally {
      setScoutingLoading(false);
    }
  };'''
game = replace_once(game, old_load, new_load, "scouting loader")

game = replace_once(
    game,
    '''    setShopPendingItemId(request.itemId);
    setShopResultMessage(null);
    setShopRetryRequest(null);''',
    '''    setShopPendingItemId(request.itemId);
    setShopResultMessage(null);
    setLatestShopUseResult(null);
    setShopRetryRequest(null);''',
    "clear use result on purchase",
)

old_use = '''  const executeShopUse = async (request: ShopUseRequest) => {
    if (!api.useShopItem || shopPendingAction !== null) {
      if (!api.useShopItem) {
        setShopError("ショップ使用機能を利用できません");
      }
      return;
    }

    setShopPendingAction("use");
    setShopPendingItemId(request.itemId);
    setShopPendingTarget(request.target ?? null);
    setShopResultMessage(null);
    setShopRetryRequest(null);
    setShopError(null);
    try {
      const response = await api.useShopItem(session.accessToken, request);
      if (await refreshShopAfterMutation(response.revision)) {
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
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.code === "revision_conflict"
      ) {
        await recoverShopRevision();
        return;
      }
      if (error instanceof ApiError && error.status === null) {
        setShopRetryRequest({ action: "use", request });
      }
      setShopError(shopErrorMessage(error, "使用処理に失敗しました"));
    } finally {
      setShopPendingAction(null);
      setShopPendingItemId(null);
      setShopPendingTarget(null);
    }
  };'''
new_use = '''  const executeShopUse = async (request: ShopUseRequest) => {
    if (!api.useShopItem || shopPendingAction !== null) {
      if (!api.useShopItem) {
        setShopError("ショップ使用機能を利用できません");
      }
      return;
    }

    const beforeScoutReport =
      request.target?.type === "scouting-candidate"
        ? scoutingReports.find(
            (report) => report.candidateId === request.target?.candidateId,
          )
        : undefined;

    setShopPendingAction("use");
    setShopPendingItemId(request.itemId);
    setShopPendingTarget(request.target ?? null);
    setShopResultMessage(null);
    setLatestShopUseResult(null);
    setShopRetryRequest(null);
    setShopError(null);
    try {
      const response = await api.useShopItem(session.accessToken, request);
      if (await refreshShopAfterMutation(response.revision)) {
        let afterScoutReport: ScoutReport | undefined;
        if (
          scoutingOpen &&
          (request.itemId === "scout-research" ||
            request.itemId === "potential-appraisal" ||
            request.itemId === "extra-scout-candidate")
        ) {
          const refreshedReports = await loadScoutingBoard(response.revision);
          if (request.target?.type === "scouting-candidate") {
            afterScoutReport = refreshedReports?.find(
              (report) => report.candidateId === request.target?.candidateId,
            );
          }
        }

        setLatestShopUseResult({
          itemId: request.itemId,
          result: response.result,
          ...(request.target ? { target: request.target } : {}),
          ...(beforeScoutReport ? { beforeScoutReport } : {}),
          ...(afterScoutReport ? { afterScoutReport } : {}),
        });
        setShopResultMessage("使用しました ✓");
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 409 &&
        error.code === "revision_conflict"
      ) {
        await recoverShopRevision();
        return;
      }
      if (error instanceof ApiError && error.status === null) {
        setShopRetryRequest({ action: "use", request });
      }
      setShopError(shopErrorMessage(error, "使用処理に失敗しました"));
    } finally {
      setShopPendingAction(null);
      setShopPendingItemId(null);
      setShopPendingTarget(null);
    }
  };'''
game = replace_once(game, old_use, new_use, "shop use integration")

game = replace_once(
    game,
    '''  const openShop = () => {
    setMoreView("shop");
    setShopResultMessage(null);
    setShopRetryRequest(null);''',
    '''  const openShop = () => {
    setMoreView("shop");
    setShopResultMessage(null);
    setLatestShopUseResult(null);
    setShopRetryRequest(null);''',
    "clear result on shop open",
)

game = replace_once(
    game,
    '''      <ScoutingScreen
        error={scoutingError}
        loading={scoutingLoading}
        onBack={''',
    '''      <ScoutingScreen
        error={scoutingError}
        latestShopUseResult={latestShopUseResult}
        loading={scoutingLoading}
        onBack={''',
    "scouting result prop",
)

game = replace_once(
    game,
    '''      <ShopScreen
        error={shopError}
        loading={shopLoading}
        onBack={''',
    '''      <ShopScreen
        error={shopError}
        latestUseResult={latestShopUseResult}
        loading={shopLoading}
        onBack={''',
    "shop result prop",
)

game_path.write_text(game)
