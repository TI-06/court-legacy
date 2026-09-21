import { expect, test } from "@playwright/test";

const mobileViewports = [
  { width: 320, height: 800 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 414, height: 824 },
  { width: 480, height: 844 },
] as const;

for (const viewport of mobileViewports) {
  test(`${viewport.width}px Home command center fits`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(page.getByTestId("home-command-summary")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "今週やること" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "今週を進める" }),
    ).toBeVisible();

    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(layout.body).toBeLessThanOrEqual(layout.viewport);
    expect(layout.document).toBeLessThanOrEqual(layout.viewport);

    const home = page.getByTestId("home-screen");
    const homeSize = await home.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(homeSize.scrollWidth).toBeLessThanOrEqual(homeSize.clientWidth + 1);
    expect(
      homeSize.scrollHeight,
      "Home should not require vertical scrolling",
    ).toBeLessThanOrEqual(homeSize.clientHeight + 1);

    const advance = page.getByTestId("home-command-advance");
    const advanceButton = advance.getByRole("button", {
      name: "今週を進める",
    });
    const navigation = page.getByRole("navigation", { name: "主要メニュー" });
    const [advanceBox, buttonBox, navigationBox] = await Promise.all([
      advance.boundingBox(),
      advanceButton.boundingBox(),
      navigation.boundingBox(),
    ]);
    if (!advanceBox || !buttonBox || !navigationBox) {
      throw new Error("Home advance CTA geometry is unavailable");
    }

    expect(buttonBox.x).toBeGreaterThanOrEqual(advanceBox.x - 1);
    expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(
      advanceBox.x + advanceBox.width + 1,
    );
    expect(buttonBox.width).toBeGreaterThanOrEqual(advanceBox.width - 2);
    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(
      navigationBox.y + 1,
    );

    const commandCenterBox = await page
      .getByTestId("home-command-center")
      .boundingBox();
    if (!commandCenterBox) {
      throw new Error("Home command center geometry is unavailable");
    }
    expect(commandCenterBox.y + commandCenterBox.height).toBeLessThanOrEqual(
      advanceBox.y + 1,
    );
  });
}

test("unanswered practice offer warns before week advance", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "今週を進める" }).click();

  const dialog = page.getByRole("dialog", {
    name: "未回答の申し込みがあります",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("このまま次週へ進みますか");
  await dialog.getByRole("button", { name: "戻る" }).click();
  await expect(dialog).toHaveCount(0);
});

test("management task deep-links to the requested School view", async ({
  page,
}) => {
  await page.goto("/");

  let facilityTask = page.getByRole("button", {
    name: /強化可能な設備.*設備を見る/,
  });
  if (!(await facilityTask.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "やることをすべて見る" }).click();
    const taskSheet = page.getByRole("dialog", { name: "今週やること" });
    await expect(taskSheet).toBeVisible();
    facilityTask = taskSheet.getByRole("button", {
      name: /強化可能な設備.*設備を見る/,
    });
  }
  await expect(facilityTask).toBeVisible();
  await facilityTask.click();

  await expect(
    page.getByRole("tab", { name: "運営", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "トレーニング設備の詳細" }),
  ).toBeVisible();
});

test("Home keeps secondary tasks in a game-style sheet", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const allTasks = page.getByRole("button", { name: "やることをすべて見る" });
  if (await allTasks.isVisible().catch(() => false)) {
    await allTasks.click();
    const dialog = page.getByRole("dialog", { name: "今週やること" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("home-command-task")).not.toHaveCount(0);
    await dialog.getByRole("button", { name: "閉じる" }).click();
  }

  const home = page.getByTestId("home-screen");
  const size = await home.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(size.scrollHeight).toBeLessThanOrEqual(size.clientHeight + 1);
});
