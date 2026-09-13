import { expect, test } from "@playwright/test";

const AUTH_STATE_KEY = "court-legacy:e2e-auth-state";
const GAME_STATE_KEY = "court-legacy:e2e-game-state";
const SNAPSHOT_KEY = "court-legacy:e2e-server-snapshot";

async function expectPracticalTouchTarget(
  locator: import("@playwright/test").Locator,
) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

test("@critical primary mobile controls have names, visible keyboard focus, and practical touch targets", async ({
  page,
}) => {
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await expect(navigation).toBeVisible();

  for (const label of ["ホーム", "選手", "学校", "試合", "その他"]) {
    const button = navigation.getByRole("button", { name: label, exact: true });
    await expect(button).toBeVisible();
    await expectPracticalTouchTarget(button);
  }

  const advanceWeek = page.getByRole("button", { name: "今週を進める" });
  await expect(advanceWeek).toBeVisible();
  await expectPracticalTouchTarget(advanceWeek);

  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toHaveCount(1);
  const focusPresentation = await focused.evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      tagName: element.tagName,
      outlineStyle: styles.outlineStyle,
      outlineWidth: styles.outlineWidth,
    };
  });
  expect(focusPresentation.tagName).toBe("BUTTON");
  expect(focusPresentation.outlineStyle).not.toBe("none");
  expect(focusPresentation.outlineWidth).not.toBe("0px");
});

test("@critical gameplay dialog traps and restores focus and respects reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "選手", exact: true }).click();

  const trainingChip = page.locator(".player-training-chip").first();
  await trainingChip.click();

  const dialog = page.getByRole("dialog", { name: /の個人練習$/ });
  await expect(dialog).toBeVisible();
  const closeButton = dialog.getByRole("button", { name: "閉じる" });
  await expect(closeButton).toBeFocused();
  await expectPracticalTouchTarget(closeButton);

  const animationName = await dialog.evaluate(
    (element) => getComputedStyle(element).animationName,
  );
  expect(animationName).toBe("none");

  await page.keyboard.press("Tab");
  const focusedInsideDialog = dialog.locator(":focus");
  await expect(focusedInsideDialog).toHaveCount(1);

  await dialog.getByRole("button", { name: /^攻撃/ }).click();
  await expect(page.locator(".operation-status")).toHaveText("保存済み ✓");

  await trainingChip.click();
  await expect(dialog).toBeVisible();
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trainingChip).toBeFocused();
});

test("@critical registration fields keep explicit accessible labels", async ({
  page,
}) => {
  await page.addInitScript(
    ({ authStateKey, gameStateKey, snapshotKey }) => {
      sessionStorage.setItem(authStateKey, "signed-out");
      sessionStorage.setItem(gameStateKey, "needs-onboarding");
      sessionStorage.removeItem(snapshotKey);
    },
    {
      authStateKey: AUTH_STATE_KEY,
      gameStateKey: GAME_STATE_KEY,
      snapshotKey: SNAPSHOT_KEY,
    },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "新規登録はこちら" }).click();
  await expect(
    page.getByRole("heading", { name: "監督アカウントを作成" }),
  ).toBeVisible();

  for (const label of [
    "メールアドレス",
    "ログインID",
    "パスワード",
    "パスワード確認",
    "監督名",
    "高校名",
  ]) {
    const field =
      label === "パスワード"
        ? page.getByLabel(label, { exact: true })
        : page.getByLabel(label);
    await expect(field).toBeVisible();
  }

  await expect(
    page.getByRole("button", { name: "この内容で登録" }),
  ).toBeVisible();
});
