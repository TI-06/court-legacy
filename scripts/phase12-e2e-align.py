from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_required(path: str, old: str, new: str, count: int | None = None) -> None:
    text = read(path)
    actual = text.count(old)
    if actual == 0:
        raise RuntimeError(f"missing replacement in {path}: {old[:80]!r}")
    if count is not None and actual != count:
        raise RuntimeError(f"unexpected replacement count in {path}: {actual} != {count}")
    write(path, text.replace(old, new))


def replace_regex(path: str, pattern: str, replacement: str, count: int = 1) -> None:
    text = read(path)
    updated, actual = re.subn(pattern, replacement, text, count=count, flags=re.S)
    if actual != count:
        raise RuntimeError(f"unexpected regex replacement count in {path}: {actual} != {count}")
    write(path, updated)


# Actual Phase 12 mobile roster regression: the row kept the old five-column grid
# while the new roster has only a main button plus an absolutely positioned training chip.
css_path = "src/features/team/player-hub.css"
css = read(css_path)
css = css.replace(
    "grid-template-columns: 28px minmax(0, 1fr) 58px 42px 52px;",
    "grid-template-columns: 28px minmax(0, 1fr) 58px 42px;",
)
marker = ".player-roster__row {\n  position: relative;\n}"
if marker not in css:
    raise RuntimeError("player roster Phase 12 override marker missing")
css = css.replace(marker, ".player-roster__row {\n  position: relative;\n  display: block;\n}")
write(css_path, css)

# Scouting now belongs to the School tab, not the removed Development tab.
replace_required(
    "src/features/scouting/ScoutingScreen.tsx",
    'aria-label="育成へ戻る"',
    'aria-label="学校へ戻る"',
    1,
)
replace_required(
    "src/features/scouting/ScoutingScreen.tsx",
    "← 育成へ戻る",
    "← 学校へ戻る",
    1,
)

common_old = '''  await navigation.getByRole("button", { name: "育成", exact: true }).click();
  await page.getByRole("button", { name: "この内容で設定" }).click();
  await page
    .getByRole("dialog", { name: "練習設定を確認" })
    .getByRole("button", { name: "この内容で設定" })
    .click();
  await expect(page.getByRole("status")).toHaveText("保存済み ✓");'''
common_new = '''  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await page.locator(".player-training-chip").first().click();
  await page
    .getByRole("dialog", { name: /の個人練習$/ })
    .getByRole("button", { name: /^攻撃/ })
    .click();
  await expect(page.getByRole("status")).toHaveText("保存済み ✓");'''
for path in [
    "tests/e2e/v2-auth-game-flow.spec.ts",
    "tests/e2e/team-dynamics-flow.spec.ts",
    "tests/e2e/phase10-notifications.spec.ts",
    "tests/e2e/event-dialog.spec.ts",
]:
    replace_required(path, common_old, common_new, 1)

# App shell: align navigation, individual training flow, lineup sheet title, and School entry.
app_shell = "tests/e2e/app-shell.spec.ts"
replace_required(
    app_shell,
    '["ホーム", "選手", "育成", "試合", "その他"]',
    '["ホーム", "選手", "学校", "試合", "その他"]',
    1,
)
replace_regex(
    app_shell,
    r'test\("mobile training saves a plan and resolves it with next-week progression", async \(\{\n  page,\n\}\) => \{.*?\n\}\);\n\ntest\("mobile team selection uses a court picker without overflow"',
    '''test("mobile training saves a plan and resolves it with next-week progression", async ({
  page,
}) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "選手", exact: true }).click();

  await expect(page.getByRole("heading", { name: "選手一覧" })).toBeVisible();
  const trainingChips = page.locator(".player-training-chip");
  await expect(trainingChips).toHaveCount(12);
  await trainingChips.first().click();

  const trainingDialog = page.getByRole("dialog", { name: /の個人練習$/ });
  await expect(trainingDialog.locator(".player-training-options button")).toHaveCount(6);
  await trainingDialog.getByRole("button", { name: /^攻撃/ }).click();
  await expect(page.getByRole("status")).toHaveText("保存済み ✓");
  await expect(trainingChips.first()).toContainText("攻撃");

  await navigation.getByRole("button", { name: "ホーム", exact: true }).click();
  await page.getByRole("button", { name: "次の週へ進む" }).click();
  await expect(page.getByRole("banner").getByText("2026年4月8日")).toBeVisible();

  const resultNotification = page.getByRole("button", { name: /今週の練習結果/ });
  await expect(resultNotification).toBeVisible();
  await resultNotification.click();
  const resultDialog = page.getByRole("dialog", { name: "今週の練習結果" });
  await expect(resultDialog).toBeVisible();
  await expect(resultDialog.getByRole("heading", { name: "選手別" })).toBeVisible();
  await expect(resultDialog.locator(".training-result-notification__player")).toHaveCount(12);
  await resultDialog.getByRole("button", { name: "閉じる" }).click();

  const bodyWidth = await page.locator("body").evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});

test("mobile team selection uses a court picker without overflow"''',
)
replace_required(
    app_shell,
    'name: "ローテーション1の選手を選択",',
    'name: "ローテーション1を入れ替え",',
    1,
)
replace_regex(
    app_shell,
    r'test\("school management upgrades a facility and calendar resolves saved training while advancing", async \(\{\n  page,\n\}\) => \{.*?\n\}\);\n\ntest\("worker health endpoint reports ready status"',
    '''test("school management upgrades a facility and calendar resolves saved training while advancing", async ({
  page,
}) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });

  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  await expect(page.getByRole("heading", { name: "青葉高校" })).toBeVisible();
  await expect(page.getByText("資金 300")).toBeVisible();

  const trainingFacility = page.getByRole("button", { name: "トレーニング設備の詳細" });
  await trainingFacility.click();
  const facilityDialog = page.getByRole("dialog", { name: "設備を強化" });
  await facilityDialog.getByRole("button", { name: "70を使って強化" }).click();
  await expect(page.getByText("資金 230")).toBeVisible();
  await expect(trainingFacility).toContainText("Lv.1");

  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await page.locator(".player-training-chip").first().click();
  await page
    .getByRole("dialog", { name: /の個人練習$/ })
    .getByRole("button", { name: /^攻撃/ })
    .click();
  await expect(page.getByRole("status")).toHaveText("保存済み ✓");

  await page.getByRole("button", { name: "予定を確認" }).click();
  const calendar = page.getByRole("dialog", { name: "週間カレンダー" });
  await expect(calendar).toBeVisible();
  await expect(calendar.getByText("練習 週送りで実施")).toBeVisible();
  await calendar.getByRole("button", { name: "次の週へ進む" }).click();

  await expect(calendar).toBeHidden();
  await expect(page.getByTestId("home-screen")).toBeVisible();
  await expect(page.getByRole("banner").getByText("2026年4月8日")).toBeVisible();
  await expect(page.getByRole("button", { name: /今週の練習結果/ })).toBeVisible();
});

test("worker health endpoint reports ready status"''',
)

# Operation feedback now enters School directly and opens the facility detail tile.
replace_required(
    "tests/e2e/v2-operation-feedback.spec.ts",
    '''  await navigation.getByRole("button", { name: "その他", exact: true }).click();
  await page.getByRole("button", { name: "学校管理" }).click();
  await page.getByRole("button", { name: "トレーニング設備を強化" }).click();''',
    '''  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  await page.getByRole("button", { name: "トレーニング設備の詳細" }).click();''',
    1,
)

# Scouting is a School segment now.
scouting_flow = '''import { expect, test } from "@playwright/test";

test("mobile scouting acquires a candidate and preserves the result when reopened", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  await page.getByRole("tab", { name: "スカウト", exact: true }).click();

  await expect(page.getByRole("heading", { name: "新入生スカウト" })).toBeVisible();
  const recruitButton = page.getByRole("button", { name: /^獲得候補にする / }).first();
  await expect(recruitButton).toBeVisible();

  const recruitLabel = await recruitButton.getAttribute("aria-label");
  expect(recruitLabel).not.toBeNull();
  const candidateName = recruitLabel!.replace("獲得候補にする ", "");

  await recruitButton.click();
  await expect(page.getByRole("button", { name: `獲得済み ${candidateName}` })).toBeDisabled();

  const bodyWidth = await page.locator("body").evaluate((body) => body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(360);

  await page.getByRole("button", { name: "学校へ戻る" }).click();
  await expect(page.getByRole("heading", { name: "青葉高校" })).toBeVisible();
  await page.getByRole("tab", { name: "スカウト", exact: true }).click();

  await expect(page.getByRole("button", { name: `獲得済み ${candidateName}` })).toBeDisabled();
  const reopenedBodyWidth = await page.locator("body").evaluate((body) => body.scrollWidth);
  expect(reopenedBodyWidth).toBeLessThanOrEqual(360);
});
'''
write("tests/e2e/scouting-flow.spec.ts", scouting_flow)

# Shop scouting entry follows School > Scouting.
replace_required(
    "tests/e2e/shop-flow.spec.ts",
    '''  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "育成", exact: true }).click();
  await page.getByRole("button", { name: "新入生スカウト" }).click();''',
    '''  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  await page.getByRole("tab", { name: "スカウト", exact: true }).click();''',
    1,
)
boost_old = '''  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "育成", exact: true }).click();
  await expect(page.getByText("次回練習 成長効率 +20%")).toBeVisible();

  await page.getByRole("button", { name: "この内容で設定" }).click();
  await page
    .getByRole("dialog", { name: "練習設定を確認" })
    .getByRole("button", { name: "この内容で設定" })
    .click();
  await expect(page.locator(".operation-status")).toHaveText("保存済み ✓");'''
boost_new = '''  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await page.locator(".player-training-chip").first().click();
  await page
    .getByRole("dialog", { name: /の個人練習$/ })
    .getByRole("button", { name: /^攻撃/ })
    .click();
  await expect(page.locator(".operation-status")).toHaveText("保存済み ✓");'''
replace_required("tests/e2e/shop-flow.spec.ts", boost_old, boost_new, 1)
replace_required(
    "tests/e2e/shop-flow.spec.ts",
    '''  await navigation.getByRole("button", { name: "育成", exact: true }).click();
  await expect(page.getByText("次回練習 成長効率 +20%")).toHaveCount(0);''',
    '''  await expect
    .poll(() =>
      page.evaluate((snapshotKey) => {
        const raw = sessionStorage.getItem(snapshotKey);
        if (!raw) return "missing";
        const snapshot = JSON.parse(raw) as {
          state?: { shopEffects?: { nextTrainingGrowthBoost?: unknown } };
        };
        return snapshot.state?.shopEffects?.nextTrainingGrowthBoost ?? null;
      }, SERVER_SNAPSHOT_KEY),
    )
    .toBeNull();''',
    1,
)

# The layout audit should exercise the new player training sheet and direct School tab.
layout_path = "tests/e2e/mobile-layout-audit.spec.ts"
replace_required(
    layout_path,
    'name: "ローテーション1の選手を選択"',
    'name: "ローテーション1を入れ替え"',
    1,
)
replace_regex(
    layout_path,
    r'    await navigation\.getByRole\("button", \{ name: "育成", exact: true \}\)\.click\(\);.*?    await page\n      \.getByRole\("dialog", \{ name: "練習設定を確認" \}\)\n      \.getByRole\("button", \{ name: "閉じる" \}\)\n      \.click\(\);',
    '''    await page.getByRole("button", { name: "選手一覧", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${viewport.width}-players-training`);
    await page.locator(".player-training-chip").first().click();
    await expectLayoutFits(page, testInfo, `${viewport.width}-training-options`);
    await page
      .getByRole("dialog", { name: /の個人練習$/ })
      .getByRole("button", { name: "閉じる" })
      .click();''',
    1,
)
replace_required(
    layout_path,
    '''    await navigation
      .getByRole("button", { name: "その他", exact: true })
      .click();
    await page.getByRole("button", { name: "学校管理" }).click();''',
    '''    await navigation
      .getByRole("button", { name: "学校", exact: true })
      .click();''',
    1,
)
replace_required(
    layout_path,
    'await page.getByRole("button", { name: "トレーニング設備を強化" }).click();',
    'await page.getByRole("button", { name: "トレーニング設備の詳細" }).click();',
    1,
)

print("Phase 12 E2E alignment applied")
