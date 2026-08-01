import { expect, test } from "@playwright/test";

test("mobile shell keeps all primary navigation actions visible", async ({
  page,
}) => {
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await expect(navigation).toBeVisible();

  for (const label of ["ホーム", "選手", "育成", "試合", "学校"]) {
    await expect(
      navigation.getByRole("button", { name: label, exact: true }),
    ).toBeVisible();
  }

  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});

test("mobile training uses compact sheets and advances to the next week", async ({
  page,
}) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "育成", exact: true }).click();

  await expect(page.getByRole("heading", { name: "週間練習" })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(page.getByTestId("team-training-choice")).toHaveCount(0);

  await page.getByRole("button", { name: "チーム練習を変更" }).click();
  const teamMenu = page.getByRole("dialog", { name: "チーム練習を選択" });
  await expect(teamMenu.getByTestId("team-training-choice")).toHaveCount(12);
  await teamMenu.getByTestId("team-training-choice").nth(1).click();
  await expect(teamMenu).toBeHidden();

  await page.getByRole("button", { name: "個人指示2の選手を変更" }).click();
  const playerPicker = page.getByRole("dialog", {
    name: "個人指示2の選手を選択",
  });
  await expect(playerPicker.getByTestId("player-picker-option")).toHaveCount(
    12,
  );
  await playerPicker.getByRole("button", { name: "閉じる" }).click();

  await page.getByRole("button", { name: "個人指示1の内容を変更" }).click();
  const instructionPicker = page.getByRole("dialog", {
    name: "個人指示1の内容を選択",
  });
  await expect(
    instructionPicker.getByTestId("individual-instruction-choice"),
  ).toHaveCount(6);
  await instructionPicker.getByRole("button", { name: "閉じる" }).click();

  await page.getByRole("button", { name: "練習を実行" }).click();
  const confirmation = page.getByRole("dialog", { name: "練習内容を確認" });
  await confirmation.getByRole("button", { name: "この内容で実行" }).click();
  await expect(
    page.getByRole("heading", { name: "今週の練習結果" }),
  ).toBeVisible();
  await expect(page.getByTestId("training-result-player")).toHaveCount(0);
  await page.getByText("選手別の結果を確認").click();
  await expect(page.getByTestId("training-result-player")).toHaveCount(12);
  await expect(
    page.getByRole("button", { name: "今週の練習は完了" }),
  ).toBeDisabled();

  await navigation.getByRole("button", { name: "ホーム", exact: true }).click();
  await page.getByRole("button", { name: "次の週へ進む" }).click();
  await expect(page.getByText("2026年4月8日")).toBeVisible();

  await navigation.getByRole("button", { name: "育成", exact: true }).click();
  await expect(page.getByRole("button", { name: "練習を実行" })).toBeEnabled();

  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});

test("mobile team selection uses a court picker without overflow", async ({
  page,
}) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await page.getByRole("button", { name: "編成", exact: true }).click();

  await expect(page.getByRole("heading", { name: "チーム編成" })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "ローテーション1を変更" }),
  ).toBeVisible();
  await expect(page.getByTestId("bench-player")).toHaveCount(5);

  await page.getByRole("button", { name: "ローテーション1を変更" }).click();
  const picker = page.getByRole("dialog", {
    name: "ローテーション1の選手を選択",
  });
  await expect(picker).toBeVisible();
  await expect(picker.getByTestId("player-picker-option")).toHaveCount(12);
  await picker.getByRole("button", { name: "閉じる" }).click();

  await page.getByRole("button", { name: "自動編成" }).click();
  await page.getByRole("button", { name: "安全調整" }).click();
  await expect(page.getByText("編成は有効です")).toBeVisible();

  const bodyWidth = await page
    .locator("body")
    .evaluate((body) => body.scrollWidth);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
});

test("school management upgrades a facility and calendar advances the shared week", async ({
  page,
}) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });

  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  await expect(page.getByRole("heading", { name: "青嵐高校" })).toBeVisible();
  await expect(page.getByText("資金 300")).toBeVisible();

  const trainingUpgrade = page.getByRole("button", {
    name: "トレーニング設備を強化",
  });
  const trainingFacilityCard = trainingUpgrade.locator(
    "xpath=ancestor::article",
  );
  await trainingUpgrade.click();
  const facilityDialog = page.getByRole("dialog", { name: "設備を強化" });
  await facilityDialog.getByRole("button", { name: "70を使って強化" }).click();
  await expect(page.getByText("資金 230")).toBeVisible();
  await expect(trainingFacilityCard.getByText("Lv.1")).toBeVisible();

  await navigation.getByRole("button", { name: "育成", exact: true }).click();
  await page.getByRole("button", { name: "練習を実行" }).click();
  await page
    .getByRole("dialog", { name: "練習内容を確認" })
    .getByRole("button", { name: "この内容で実行" })
    .click();

  await page.getByRole("button", { name: "予定を確認" }).click();
  const calendar = page.getByRole("dialog", { name: "週間カレンダー" });
  await expect(calendar).toBeVisible();
  await expect(calendar.getByText("練習 完了")).toBeVisible();
  await calendar.getByRole("button", { name: "次の週へ進む" }).click();

  await expect(calendar).toBeHidden();
  await expect(page.getByRole("heading", { name: "監督ホーム" })).toBeVisible();
  await expect(page.getByText("2026年4月8日")).toBeVisible();
});

test("worker health endpoint reports ready status", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toEqual({ status: "ok" });
});
