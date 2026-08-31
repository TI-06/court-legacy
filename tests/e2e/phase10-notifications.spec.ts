import { expect, test } from "@playwright/test";

const SERVER_SNAPSHOT_KEY = "court-legacy:e2e-server-snapshot";

async function persistedTrainingNotificationReadDate(
  page: import("@playwright/test").Page,
): Promise<string | null | undefined> {
  return page.evaluate((snapshotKey) => {
    const raw = sessionStorage.getItem(snapshotKey);
    if (!raw) return undefined;

    const snapshot = JSON.parse(raw) as {
      state?: {
        notifications?: {
          items?: Array<{
            type?: string;
            readAtGameDate?: string | null;
          }>;
        };
      };
    };

    return snapshot.state?.notifications?.items?.find(
      (item) => item.type === "training-result",
    )?.readAtGameDate;
  }, SERVER_SNAPSHOT_KEY);
}

test("training result notification survives reload and keeps durable read state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "育成", exact: true }).click();
  await page.getByRole("button", { name: "この内容で設定" }).click();
  await page
    .getByRole("dialog", { name: "練習設定を確認" })
    .getByRole("button", { name: "この内容で設定" })
    .click();
  await expect(page.getByRole("status")).toHaveText("保存済み ✓");

  await navigation.getByRole("button", { name: "ホーム", exact: true }).click();
  await page.getByRole("button", { name: "次の週へ進む" }).click();
  await expect(page.getByRole("status")).toHaveText("保存済み ✓");

  let notificationRow = page.getByRole("button", {
    name: /今週の練習結果/,
  });
  await expect(notificationRow).toBeVisible();
  await expect(notificationRow).toContainText("NEW");
  await expect
    .poll(() => persistedTrainingNotificationReadDate(page))
    .toBeNull();

  await page.reload();
  await expect(page.getByRole("main", { name: "ホーム" })).toBeVisible();

  notificationRow = page.getByRole("button", { name: /今週の練習結果/ });
  await expect(notificationRow).toBeVisible();
  await expect(notificationRow).toContainText("NEW");

  await notificationRow.click();
  const resultSheet = page.getByRole("dialog", { name: "今週の練習結果" });
  await expect(resultSheet).toBeVisible();
  await expect(
    resultSheet.getByRole("heading", { name: "選手別" }),
  ).toBeVisible();
  await expect
    .poll(() => persistedTrainingNotificationReadDate(page))
    .not.toBeNull();

  await resultSheet.getByRole("button", { name: "閉じる" }).click();
  await expect(resultSheet).toBeHidden();
  await expect(notificationRow).toContainText("確認済み");
  await expect(notificationRow).not.toContainText("NEW");

  await page.reload();
  await expect(page.getByRole("main", { name: "ホーム" })).toBeVisible();

  notificationRow = page.getByRole("button", { name: /今週の練習結果/ });
  await expect(notificationRow).toBeVisible();
  await expect(notificationRow).toContainText("確認済み");
  await expect(notificationRow).not.toContainText("NEW");

  await notificationRow.click();
  await expect(
    page.getByRole("dialog", { name: "今週の練習結果" }),
  ).toBeVisible();
});
