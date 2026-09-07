from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"expected block not found in {path}: {old!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_all(path: str, old: str, new: str, expected: int) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != expected:
        raise RuntimeError(
            f"expected {expected} occurrences in {path}, found {count}: {old!r}"
        )
    target.write_text(text.replace(old, new), encoding="utf-8")


# Shop and inventory are now peer destinations under More, not tabs inside ShopScreen.
replace_once(
    "tests/unit/app/GameApp.shop.test.tsx",
    '''    fireEvent.click(screen.getByRole("button", { name: "所持品" }));\n    fireEvent.click(\n      await screen.findByRole("button", { name: "強化合宿を使用" }),\n    );''',
    '''    fireEvent.click(screen.getByRole("button", { name: "その他へ戻る" }));\n    fireEvent.click(screen.getByRole("button", { name: "所持品" }));\n    expect(\n      await screen.findByRole("heading", { name: "所持品" }),\n    ).toBeVisible();\n    fireEvent.click(\n      await screen.findByRole("button", { name: "強化合宿を使用" }),\n    );''',
)
# Opening the peer inventory destination performs its own authoritative status refresh.
replace_once(
    "tests/unit/app/GameApp.shop.test.tsx",
    '''      .mockResolvedValueOnce(initialStatus)\n      .mockResolvedValueOnce(purchasedStatus)\n      .mockResolvedValueOnce(usedStatus);''',
    '''      .mockResolvedValueOnce(initialStatus)\n      .mockResolvedValueOnce(purchasedStatus)\n      .mockResolvedValueOnce(purchasedStatus)\n      .mockResolvedValueOnce(usedStatus);''',
)
replace_once(
    "tests/unit/app/GameApp.shop.test.tsx",
    '''    await waitFor(() => expect(getShop).toHaveBeenCalledTimes(3));\n    expect(await screen.findByText("使用しました ✓")).toBeVisible();''',
    '''    await waitFor(() => expect(getShop).toHaveBeenCalledTimes(4));\n    expect(await screen.findByText("使用しました ✓")).toBeVisible();''',
)
replace_once(
    "tests/unit/app/GameApp.shop.test.tsx",
    '      await screen.findByText("今年度の所持アイテムはありません。"),',
    '      await screen.findByText("所持アイテムはありません。"),',
)
replace_once(
    "tests/unit/app/GameApp.shopResult.test.tsx",
    '''    fireEvent.click(screen.getByRole("button", { name: "ショップ" }));\n    await waitFor(() => expect(getShop).toHaveBeenCalledTimes(1));\n    fireEvent.click(screen.getByRole("button", { name: "所持品" }));''',
    '''    fireEvent.click(screen.getByRole("button", { name: "所持品" }));\n    await waitFor(() => expect(getShop).toHaveBeenCalledTimes(1));\n    expect(\n      await screen.findByRole("heading", { name: "所持品" }),\n    ).toBeVisible();''',
)

# Direct ShopScreen target tests enter the inventory destination explicitly.
replace_all(
    "tests/unit/features/shop/ShopTargetUx.test.tsx",
    '''        state={state}\n        status={shopStatusWithOwned([''',
    '''        state={state}\n        view="inventory"\n        status={shopStatusWithOwned([''',
    2,
)
replace_all(
    "tests/unit/features/shop/ShopTargetUx.test.tsx",
    '    fireEvent.click(screen.getByRole("button", { name: "所持品" }));\n',
    "",
    2,
)

# Match-flow integration asserts the accessible five-axis radar; the dedicated radar test
# verifies each individual axis label and A-G grade.
replace_once(
    "tests/unit/features/match/MatchFlow.test.tsx",
    '''    for (const label of [\n      "アタック",\n      "ブロック",\n      "サーブ",\n      "レシーブ",\n      "連携",\n      "スタミナ",\n    ]) {\n      expect(screen.getByText(label)).toBeInTheDocument();\n    }''',
    '''    expect(\n      screen.getByRole("img", { name: "自校と相手の5項目戦力比較" }),\n    ).toBeInTheDocument();''',
)

# New public/store status contract includes the possession cap metadata.
replace_once(
    "tests/unit/worker/data/SupabaseShopStore.test.ts",
    '''        annualUseLimit: 3,\n        purchasedCount: 1,''',
    '''        annualUseLimit: 3,\n        inventoryLimit: null,\n        purchasedCount: 1,''',
)
replace_once(
    "tests/unit/worker/routes/shopStatus.test.ts",
    '''          annualUseLimit: 3,\n          purchasedCount: 1,''',
    '''          annualUseLimit: 3,\n          inventoryLimit: null,\n          purchasedCount: 1,''',
)
replace_once(
    "tests/unit/worker/routes/shopStatus.test.ts",
    '''          annualUseLimit: 1,\n          purchasedCount: 1,''',
    '''          annualUseLimit: 1,\n          inventoryLimit: null,\n          purchasedCount: 1,''',
)

# The guaranteed generational scout item is allowed by the security catalog test.
replace_once(
    "tests/unit/worker/shopSecurity.test.ts",
    '''      "extra-scout-candidate",\n      "scout-research",''',
    '''      "extra-scout-candidate",\n      "generational-scout-candidate",\n      "scout-research",''',
)
