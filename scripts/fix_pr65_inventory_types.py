from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"expected block not found in {path}: {old!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


# Catalog-derived test/status fixtures should expose the new possession cap field.
for path in [
    "tests/unit/app/GameApp.schoolEconomy.test.tsx",
    "tests/unit/app/GameApp.shop.test.tsx",
    "tests/unit/app/GameApp.shopResult.test.tsx",
    "tests/unit/features/shop/ShopTargetUx.test.tsx",
    "tests/unit/features/shop/ShopUseResultUx.test.tsx",
]:
    replace_once(
        path,
        "      annualUseLimit: item.annualUseLimit,\n",
        "      annualUseLimit: item.annualUseLimit,\n      inventoryLimit: item.inventoryLimit,\n",
    )

replace_once(
    "src/app/StaticShopHarness.ts",
    "          annualUseLimit: definition.annualUseLimit,\n",
    "          annualUseLimit: definition.annualUseLimit,\n          inventoryLimit: definition.inventoryLimit,\n",
)

# Literal fixtures use uncapped items, so null is the authoritative value.
replace_once(
    "tests/unit/features/scouting/ScoutingShopActions.test.tsx",
    "      annualUseLimit: 2,\n",
    "      annualUseLimit: 2,\n      inventoryLimit: null,\n",
)

shop_status_path = Path("tests/unit/worker/routes/shopStatus.test.ts")
shop_status = shop_status_path.read_text(encoding="utf-8")
needle = "      annualUseLimit: 3,\n"
if needle not in shop_status:
    raise RuntimeError("fatigue-recovery fixture marker missing")
shop_status = shop_status.replace(
    needle,
    "      annualUseLimit: 3,\n      inventoryLimit: null,\n",
    1,
)
needle = "      annualUseLimit: 1,\n"
if needle not in shop_status:
    raise RuntimeError("training-camp fixture marker missing")
shop_status = shop_status.replace(
    needle,
    "      annualUseLimit: 1,\n      inventoryLimit: null,\n",
    1,
)
shop_status_path.write_text(shop_status, encoding="utf-8")
