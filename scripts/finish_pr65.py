from pathlib import Path


def replace_exact(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"expected block not found: {path}\n{old[:160]}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


# ShopScreen: split purchase and inventory into separate entry modes and fix carry-over copy.
replace_exact(
    "src/features/shop/ShopScreen.tsx",
    '''interface ShopScreenProps {\n  status: ShopStatusResponse | null;\n  loading: boolean;\n  error: string | null;\n  state?: GameState;''',
    '''interface ShopScreenProps {\n  status: ShopStatusResponse | null;\n  loading: boolean;\n  error: string | null;\n  view?: ShopView;\n  state?: GameState;''',
)
replace_exact(
    "src/features/shop/ShopScreen.tsx",
    '''  if (presentation.itemId === "extra-scout-candidate") {\n    const candidateCount = asNumber(result.candidateCount);\n    if (candidateCount === null) return null;\n    return (\n      <section className="shop-use-result" aria-live="polite">\n        <h3>新入生候補追加の結果</h3>\n        <p>今年度のスカウト候補が {candidateCount}人 になりました。</p>\n      </section>\n    );\n  }''',
    '''  if (\n    presentation.itemId === "extra-scout-candidate" ||\n    presentation.itemId === "generational-scout-candidate"\n  ) {\n    const candidateCount = asNumber(result.candidateCount);\n    if (candidateCount === null) return null;\n    return (\n      <section className="shop-use-result" aria-live="polite">\n        <h3>\n          {presentation.itemId === "generational-scout-candidate"\n            ? "天才候補生追加の結果"\n            : "新入生候補追加の結果"}\n        </h3>\n        <p>今年度のスカウト候補が {candidateCount}人 になりました。</p>\n      </section>\n    );\n  }''',
)
replace_exact(
    "src/features/shop/ShopScreen.tsx",
    '''      <div className="shop-card__status">\n        <span>今年度のみ有効</span>\n        <span>\n          使用 {item.usedCount} / {item.annualUseLimit}\n        </span>\n      </div>''',
    '''      <div className="shop-card__status">\n        <span>翌年度以降も持ち越し可</span>\n        <span>\n          使用 {item.usedCount} / {item.annualUseLimit}\n        </span>\n      </div>''',
)
replace_exact(
    "src/features/shop/ShopScreen.tsx",
    '''export function ShopScreen({\n  status,\n  loading,\n  error,\n  state,''',
    '''export function ShopScreen({\n  status,\n  loading,\n  error,\n  view = "products",\n  state,''',
)
replace_exact(
    "src/features/shop/ShopScreen.tsx",
    '''}: ShopScreenProps) {\n  const [view, setView] = useState<ShopView>("products");\n  const [targetingItemId, setTargetingItemId] = useState<ShopItemId | null>(''',
    '''}: ShopScreenProps) {\n  const [targetingItemId, setTargetingItemId] = useState<ShopItemId | null>(''',
)
replace_exact(
    "src/features/shop/ShopScreen.tsx",
    '''      <div className="shop-screen__topbar">\n        <button onClick={onBack} type="button">\n          その他へ戻る\n        </button>\n        <span>テスト中 / すべて¥0</span>\n      </div>\n\n      <section className="shop-screen__heading">\n        <p className="section-kicker">ショップ案内</p>\n        <h2>ショップ</h2>\n        <p>テスト期間中は、すべてのアイテムを¥0で利用できます。</p>\n      </section>\n\n      <div aria-label="ショップ表示" className="shop-screen__tabs" role="group">\n        <button\n          aria-pressed={view === "products"}\n          onClick={() => {\n            setView("products");\n            closeTargeting();\n          }}\n          type="button"\n        >\n          商品\n        </button>\n        <button\n          aria-pressed={view === "inventory"}\n          onClick={() => setView("inventory")}\n          type="button"\n        >\n          所持品\n        </button>\n      </div>''',
    '''      <div className="shop-screen__topbar">\n        <button onClick={onBack} type="button">\n          その他へ戻る\n        </button>\n        <span>\n          {view === "products"\n            ? "テスト中 / すべて¥0"\n            : "未使用アイテムは持ち越し可"}\n        </span>\n      </div>\n\n      <section className="shop-screen__heading">\n        <p className="section-kicker">\n          {view === "products" ? "ショップ案内" : "アイテム管理"}\n        </p>\n        <h2>{view === "products" ? "ショップ" : "所持品"}</h2>\n        <p>\n          {view === "products"\n            ? "テスト期間中は、すべてのアイテムを¥0で購入できます。"\n            : "購入済みアイテムの確認と使用ができます。未使用分は翌年度以降も持ち越せます。"}\n        </p>\n      </section>''',
)
replace_exact(
    "src/features/shop/ShopScreen.tsx",
    '''          <p className="shop-screen__year">\n            年度 {status.academicYearIndex} ・ 所持品は年度更新で失効\n          </p>''',
    '''          <p className="shop-screen__year">\n            {view === "products"\n              ? `年度 ${status.academicYearIndex} ・ 購入/使用上限は年度ごとに更新`\n              : `年度 ${status.academicYearIndex} ・ 未使用アイテムは翌年度以降も持ち越し可`}\n          </p>''',
)
replace_exact(
    "src/features/shop/ShopScreen.tsx",
    '''            <p className="shop-screen__notice">\n              今年度の所持アイテムはありません。\n            </p>''',
    '''            <p className="shop-screen__notice">所持アイテムはありません。</p>''',
)

# GameApp: route peer More entries into purchase-only vs inventory-only views.
replace_exact(
    "src/app/GameApp.tsx",
    'type MoreView = "menu" | "shop";',
    'type MoreView = "menu" | "shop" | "inventory";',
)
replace_exact(
    "src/app/GameApp.tsx",
    '''            request.itemId === "potential-appraisal" ||\n            request.itemId === "extra-scout-candidate")''',
    '''            request.itemId === "potential-appraisal" ||\n            request.itemId === "extra-scout-candidate" ||\n            request.itemId === "generational-scout-candidate")''',
)
replace_exact(
    "src/app/GameApp.tsx",
    '''  const openShop = () => {\n    setMoreView("shop");\n    setShopResultMessage(null);\n    setLatestShopUseResult(null);\n    setShopRetryRequest(null);\n    void loadShop();\n  };''',
    '''  const openShop = () => {\n    setMoreView("shop");\n    setShopResultMessage(null);\n    setLatestShopUseResult(null);\n    setShopRetryRequest(null);\n    void loadShop();\n  };\n\n  const openInventory = () => {\n    setMoreView("inventory");\n    setShopResultMessage(null);\n    setLatestShopUseResult(null);\n    setShopRetryRequest(null);\n    void loadShop();\n  };''',
)
replace_exact(
    "src/app/GameApp.tsx",
    ''') : moreView === "shop" ? (\n      <ShopScreen\n        error={shopError}''',
    ''') : moreView === "shop" || moreView === "inventory" ? (\n      <ShopScreen\n        error={shopError}''',
)
replace_exact(
    "src/app/GameApp.tsx",
    '''        status={shopStatus}\n      />''',
    '''        status={shopStatus}\n        view={moreView === "shop" ? "products" : "inventory"}\n      />''',
)
replace_exact(
    "src/app/GameApp.tsx",
    '''        accountLabel={session.email ?? "ログイン済みアカウント"}\n        onOpenShop={openShop}\n        onSignOut={() => void auth.signOut()}''',
    '''        accountLabel={session.email ?? "ログイン済みアカウント"}\n        onOpenInventory={openInventory}\n        onOpenShop={openShop}\n        onSignOut={() => void auth.signOut()}''',
)

# Shop UI tests: purchase and inventory are separate screens; carried inventory copy is correct.
Path("tests/unit/features/shop/ShopScreen.test.tsx").write_text(
    '''import { fireEvent, render, screen } from "@testing-library/react";\nimport { vi } from "vitest";\nimport { createDemoGame } from "../../../../src/app/createDemoGame";\nimport { PHASE5_SHOP_ITEMS } from "../../../../src/domain/shop/shopCatalog";\nimport type { ShopStatusResponse } from "../../../../src/domain/shop/shopContracts";\nimport { ShopScreen } from "../../../../src/features/shop/ShopScreen";\n\nfunction createStatus(): ShopStatusResponse {\n  return {\n    revision: 8,\n    academicYearIndex: 4,\n    items: PHASE5_SHOP_ITEMS.map((item) => {\n      const isExtra = item.itemId === "extra-scout-candidate";\n      const isFatigue = item.itemId === "fatigue-recovery";\n      const isFund300 = item.itemId === "funds-grant-300";\n      return {\n        itemId: item.itemId,\n        displayName: item.displayName,\n        description: item.description,\n        priceYen: 0,\n        annualPurchaseLimit: item.annualPurchaseLimit,\n        annualUseLimit: item.annualUseLimit,\n        inventoryLimit: item.inventoryLimit,\n        purchasedCount: isFund300\n          ? 1\n          : isExtra\n            ? item.annualPurchaseLimit\n            : isFatigue\n              ? 2\n              : 0,\n        usedCount: isFatigue ? 1 : 0,\n        quantityOwned: isFatigue ? 2 : 0,\n        canPurchase: !isExtra,\n        purchaseBlockedReason: isExtra ? "purchase_limit_reached" : null,\n        canUse: isFatigue,\n        useBlockedReason: isFatigue ? null : "inventory_empty",\n      };\n    }),\n  };\n}\n\nfunction renderShop(\n  overrides: Partial<React.ComponentProps<typeof ShopScreen>> = {},\n) {\n  const props: React.ComponentProps<typeof ShopScreen> = {\n    status: createStatus(),\n    loading: false,\n    error: null,\n    view: "products",\n    pendingAction: null,\n    pendingItemId: null,\n    resultMessage: null,\n    onBack: vi.fn(),\n    onRetry: vi.fn(),\n    onPurchase: vi.fn(),\n    onUse: vi.fn(),\n    ...overrides,\n  };\n  render(<ShopScreen {...props} />);\n  return props;\n}\n\ndescribe("ShopScreen", () => {\n  it("keeps a visible loading state with Japanese labels instead of rendering a blank screen", () => {\n    renderShop({ status: null, loading: true });\n\n    expect(screen.getByRole("heading", { name: "ショップ" })).toBeVisible();\n    expect(screen.getByText("ショップ案内")).toBeVisible();\n    expect(screen.getByText("テスト中 / すべて¥0")).toBeVisible();\n    expect(screen.queryByText("SHOP")).toBeNull();\n    expect(screen.queryByText("TEST / ALL ¥0")).toBeNull();\n    expect(screen.getByRole("status")).toHaveTextContent(\n      "ショップ情報を読み込んでいます…",\n    );\n  });\n\n  it("renders the shop as purchase-only with annual limits", () => {\n    renderShop();\n\n    expect(screen.queryByRole("button", { name: "商品" })).toBeNull();\n    expect(screen.queryByRole("button", { name: "所持品" })).toBeNull();\n    for (const item of PHASE5_SHOP_ITEMS) {\n      expect(screen.getByText(item.displayName)).toBeVisible();\n    }\n    expect(screen.getAllByText("¥0")).toHaveLength(PHASE5_SHOP_ITEMS.length);\n    expect(screen.getByText("今年度の上限に達しました")).toBeVisible();\n    expect(screen.getByText("購入 5 / 5")).toBeVisible();\n    expect(screen.getByText("所持 2")).toBeVisible();\n    expect(screen.getByText(/購入\\/使用上限は年度ごとに更新/)).toBeVisible();\n  });\n\n  it("renders fund grants as immediate claims", () => {\n    const props = renderShop();\n\n    expect(screen.getByText("年度残り 2 / 3")).toBeVisible();\n    const button = screen.getByRole("button", {\n      name: "資金 +300を受け取る",\n    });\n    expect(button).toHaveTextContent("¥0で受け取る");\n    fireEvent.click(button);\n    expect(props.onPurchase).toHaveBeenCalledWith("funds-grant-300");\n  });\n\n  it("does not reuse a previous fund grant message for a later shop action", () => {\n    const state = createDemoGame();\n    const school = state.schools[state.userSchoolId]!;\n    state.schools[state.userSchoolId] = { ...school, funds: 1000 };\n    const baseProps: React.ComponentProps<typeof ShopScreen> = {\n      status: createStatus(),\n      loading: false,\n      error: null,\n      view: "products",\n      state,\n      resultMessage: null,\n      onBack: vi.fn(),\n      onRetry: vi.fn(),\n      onPurchase: vi.fn(),\n      onUse: vi.fn(),\n    };\n    const { rerender } = render(<ShopScreen {...baseProps} />);\n\n    fireEvent.click(\n      screen.getByRole("button", { name: "資金 +300を受け取る" }),\n    );\n    rerender(<ShopScreen {...baseProps} resultMessage="購入しました ✓" />);\n    expect(screen.getByText("資金 +300 / 残高 1,000")).toBeVisible();\n\n    rerender(<ShopScreen {...baseProps} resultMessage="使用しました ✓" />);\n    expect(screen.getByText("使用しました ✓")).toBeVisible();\n    expect(\n      screen.queryByText("資金 +300 / 残高 1,000"),\n    ).not.toBeInTheDocument();\n  });\n\n  it("renders the peer inventory screen with carried owned items only", () => {\n    const props = renderShop({ view: "inventory" });\n\n    expect(screen.getByRole("heading", { name: "所持品" })).toBeVisible();\n    expect(screen.getByText("未使用アイテムは持ち越し可")).toBeVisible();\n    expect(screen.getByText("疲労回復")).toBeVisible();\n    expect(screen.getByText("×2")).toBeVisible();\n    expect(screen.getByText("翌年度以降も持ち越し可")).toBeVisible();\n    expect(screen.queryByText("強化合宿")).not.toBeInTheDocument();\n    expect(screen.queryByText("資金 +300")).not.toBeInTheDocument();\n    expect(screen.queryByText("今年度のみ有効")).not.toBeInTheDocument();\n\n    fireEvent.click(screen.getByRole("button", { name: "疲労回復を使用" }));\n    expect(props.onUse).toHaveBeenCalledWith("fatigue-recovery");\n  });\n\n  it("shows pending, success, and error states with retry controls", () => {\n    const onRetry = vi.fn();\n    renderShop({\n      error: "ショップ情報を読み込めませんでした",\n      pendingAction: "purchase",\n      pendingItemId: "fatigue-recovery",\n      resultMessage: "購入しました ✓",\n      onRetry,\n    });\n\n    expect(screen.getByRole("alert")).toHaveTextContent(\n      "ショップ情報を読み込めませんでした",\n    );\n    expect(screen.getByText("購入しました ✓")).toBeVisible();\n    expect(\n      screen.getByRole("button", { name: "疲労回復を購入処理中…" }),\n    ).toBeDisabled();\n\n    fireEvent.click(screen.getByRole("button", { name: "再読み込み" }));\n    expect(onRetry).toHaveBeenCalledTimes(1);\n  });\n});\n''',
    encoding="utf-8",
)

# Add visual styling for the actual five-axis radar and numeric overall matchup.
css_path = Path("src/features/match/matchGameStats.css")
css = css_path.read_text(encoding="utf-8")
if ".match-radar__chart" not in css:
    css += '''\n\n.match-power-versus {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);\n  align-items: center;\n  margin-top: 12px;\n  padding: 10px;\n  gap: 10px;\n  text-align: center;\n  background: rgb(255 255 255 / 5%);\n  border: 1px solid rgb(255 255 255 / 7%);\n  border-radius: 14px;\n}\n\n.match-power-versus > div {\n  display: grid;\n  min-width: 0;\n  gap: 2px;\n}\n\n.match-power-versus small {\n  color: #8fb8c2;\n  font-size: 0.56rem;\n  font-weight: 850;\n}\n\n.match-power-versus strong {\n  color: #fff;\n  font-size: 1.2rem;\n  line-height: 1;\n}\n\n.match-power-versus > div:first-child strong {\n  color: #6de2e2;\n}\n\n.match-power-versus > div:last-child strong {\n  color: #ffd17a;\n}\n\n.match-power-versus > span {\n  color: #8faeb5;\n  font-size: 0.6rem;\n  font-weight: 950;\n}\n\n.match-radar {\n  display: grid;\n  justify-items: center;\n  margin-top: 10px;\n  padding: 8px 6px 10px;\n  background: rgb(2 20 29 / 24%);\n  border: 1px solid rgb(255 255 255 / 6%);\n  border-radius: 14px;\n}\n\n.match-radar__chart {\n  display: block;\n  width: min(100%, 270px);\n  height: auto;\n  overflow: visible;\n}\n\n.match-radar__grid {\n  fill: none;\n  stroke: rgb(186 218 224 / 17%);\n  stroke-width: 1;\n}\n\n.match-radar__axis {\n  stroke: rgb(186 218 224 / 14%);\n  stroke-width: 1;\n}\n\n.match-radar__home {\n  fill: rgb(65 211 213 / 19%);\n  stroke: #5de0e1;\n  stroke-linejoin: round;\n  stroke-width: 2.4;\n}\n\n.match-radar__away {\n  fill: rgb(236 183 74 / 16%);\n  stroke: #efbd58;\n  stroke-linejoin: round;\n  stroke-width: 2.4;\n}\n\n.match-radar__label {\n  fill: #d8e9ec;\n  font-size: 8px;\n  font-weight: 900;\n}\n\n.match-radar__legend {\n  display: flex;\n  justify-content: center;\n  gap: 14px;\n  margin-top: -2px;\n  font-size: 0.58rem;\n  font-weight: 900;\n}\n\n.match-radar__legend span::before {\n  display: inline-block;\n  width: 8px;\n  height: 8px;\n  margin-right: 4px;\n  border-radius: 999px;\n  content: "";\n}\n\n.match-radar__legend-home {\n  color: #86e6e6;\n}\n\n.match-radar__legend-home::before {\n  background: #5de0e1;\n}\n\n.match-radar__legend-away {\n  color: #f2cf8a;\n}\n\n.match-radar__legend-away::before {\n  background: #efbd58;\n}\n\n@media (max-width: 380px) {\n  .match-radar__chart {\n    width: min(100%, 240px);\n  }\n\n  .match-power-versus {\n    padding: 8px;\n    gap: 7px;\n  }\n}\n'''
    css_path.write_text(css, encoding="utf-8")
