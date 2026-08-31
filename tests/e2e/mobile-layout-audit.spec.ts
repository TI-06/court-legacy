import { expect, test, type Page, type TestInfo } from "@playwright/test";

interface OverflowIssue {
  selector: string;
  text: string;
  left: number;
  right: number;
  scrollWidth: number;
  clientWidth: number;
  overflowX: string;
}

async function inspectLayout(page: Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const issues: OverflowIssue[] = [];

    for (const element of Array.from(
      document.querySelectorAll<HTMLElement>("body *"),
    )) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const visuallyOutside =
        rect.right > viewportWidth + 0.5 || rect.left < -0.5;
      const internallyScrollable =
        element.scrollWidth > element.clientWidth + 1;
      const clipped =
        internallyScrollable && !["auto", "scroll"].includes(style.overflowX);

      if (!visuallyOutside && !clipped) {
        continue;
      }

      const classes =
        typeof element.className === "string" ? element.className : "";
      issues.push({
        selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${classes ? `.${classes.trim().replace(/\s+/g, ".")}` : ""}`,
        text: (element.innerText || "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 120),
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        overflowX: style.overflowX,
      });
    }

    return {
      viewportWidth,
      bodyWidth: document.body.scrollWidth,
      documentWidth: document.documentElement.scrollWidth,
      issues,
    };
  });
}

async function expectLayoutFits(
  page: Page,
  testInfo: TestInfo,
  stateName: string,
) {
  await page.waitForTimeout(80);
  const report = await inspectLayout(page);

  if (
    report.bodyWidth > report.viewportWidth ||
    report.documentWidth > report.viewportWidth ||
    report.issues.length > 0
  ) {
    await testInfo.attach(`${stateName}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await testInfo.attach(`${stateName}.json`, {
      body: Buffer.from(JSON.stringify(report, null, 2)),
      contentType: "application/json",
    });
  }

  expect(report.bodyWidth, `${stateName}: body overflow`).toBeLessThanOrEqual(
    report.viewportWidth,
  );
  expect(
    report.documentWidth,
    `${stateName}: document overflow`,
  ).toBeLessThanOrEqual(report.viewportWidth);
  expect(report.issues, `${stateName}: clipped or offscreen elements`).toEqual(
    [],
  );
}

async function expectNavigationFixed(page: Page, stateName: string) {
  const viewport = page.viewportSize();
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  const box = await navigation.boundingBox();

  expect(box, `${stateName}: navigation box`).not.toBeNull();
  expect(
    Math.abs((box?.y ?? 0) + (box?.height ?? 0) - (viewport?.height ?? 0)),
    `${stateName}: navigation must stay at viewport bottom`,
  ).toBeLessThanOrEqual(1);
}

async function expectAboveNavigation(
  page: Page,
  locatorSelector: string,
  stateName: string,
) {
  const target = page.locator(locatorSelector);
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  const targetBox = await target.boundingBox();
  const navigationBox = await navigation.boundingBox();

  expect(targetBox, `${stateName}: target box`).not.toBeNull();
  expect(navigationBox, `${stateName}: navigation box`).not.toBeNull();
  expect(
    (targetBox?.y ?? 0) + (targetBox?.height ?? 0),
    `${stateName}: core content should fit above bottom navigation`,
  ).toBeLessThanOrEqual(navigationBox?.y ?? 0);
}

async function expectNoHorizontalScroll(
  page: Page,
  locatorSelector: string,
  stateName: string,
) {
  const dimensions = await page
    .locator(locatorSelector)
    .evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
  expect(
    dimensions.scrollWidth,
    `${stateName}: horizontal scrolling should not be required`,
  ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function schedulePracticeMatch(page: Page) {
  const scheduled = page.getByText("対戦決定", { exact: true });
  if (await scheduled.isVisible().catch(() => false)) return;

  const acceptOffer = page.getByRole("button", { name: "受ける" });
  if (await acceptOffer.isVisible().catch(() => false)) {
    await acceptOffer.click();
    await expect(scheduled).toBeVisible();
    return;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const requestButton = page
      .locator("button")
      .filter({ hasText: "申し込む" })
      .first();
    if (!(await requestButton.isVisible().catch(() => false))) break;

    await requestButton.click();
    try {
      await expect(scheduled).toBeVisible({ timeout: 800 });
      return;
    } catch {
      // The request can be rejected. Try the next available candidate.
    }
  }

  await expect(scheduled).toBeVisible();
}

const mobileViewports = [
  { width: 320, height: 800 },
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 414, height: 824 },
  { width: 480, height: 844 },
] as const;

for (const viewport of mobileViewports) {
  test(`every app state fits a ${viewport.width}px viewport`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const navigation = page.getByRole("navigation", { name: "主要メニュー" });

    await expectLayoutFits(page, testInfo, `${viewport.width}-home`);
    await expectNavigationFixed(page, `${viewport.width}-home`);
    if (viewport.width === 414) {
      await expectAboveNavigation(
        page,
        ".home-week-progress__button",
        "414-home-next-week",
      );
    }

    const bracketButton = page.getByRole("button", { name: "大会表を見る" });
    if (await bracketButton.isVisible().catch(() => false)) {
      await bracketButton.click();
      await expectLayoutFits(page, testInfo, `${viewport.width}-tournament`);
      await expectNoHorizontalScroll(
        page,
        ".tournament-panel",
        `${viewport.width}-tournament`,
      );
      await navigation
        .getByRole("button", { name: "ホーム", exact: true })
        .click();
    }

    await navigation.getByRole("button", { name: "選手", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${viewport.width}-players`);
    await expectNavigationFixed(page, `${viewport.width}-players`);

    await page.getByTestId("roster-player-row").first().click();
    await expectLayoutFits(page, testInfo, `${viewport.width}-player-detail`);
    if (viewport.width === 414) {
      await expectAboveNavigation(
        page,
        ".player-detail__metrics",
        "414-player-core",
      );
    }
    await page.getByRole("button", { name: "選手一覧へ戻る" }).click();

    await page.getByRole("button", { name: "編成", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${viewport.width}-team`);
    await expectNavigationFixed(page, `${viewport.width}-team`);
    await page.getByRole("button", { name: "ローテーション1を変更" }).click();
    await expectLayoutFits(page, testInfo, `${viewport.width}-team-picker`);
    await page
      .getByRole("dialog", { name: "ローテーション1の選手を選択" })
      .getByRole("button", { name: "閉じる" })
      .click();

    await page.getByRole("button", { name: "チーム状態", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "チーム状態" }),
    ).toBeVisible();
    await expectLayoutFits(page, testInfo, `${viewport.width}-team-dynamics`);
    await expectNavigationFixed(page, `${viewport.width}-team-dynamics`);

    await navigation.getByRole("button", { name: "育成", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${viewport.width}-training`);
    await expectNavigationFixed(page, `${viewport.width}-training`);

    await page.getByRole("button", { name: "チーム練習を変更" }).click();
    await expectLayoutFits(page, testInfo, `${viewport.width}-training-menu`);
    await page
      .getByRole("dialog", { name: "チーム練習を選択" })
      .getByRole("button", { name: "閉じる" })
      .click();

    await page.getByRole("button", { name: "個人指示2の選手を変更" }).click();
    await expectLayoutFits(
      page,
      testInfo,
      `${viewport.width}-training-player-picker`,
    );
    await page
      .getByRole("dialog", { name: "個人指示2の選手を選択" })
      .getByRole("button", { name: "閉じる" })
      .click();

    await page.getByRole("button", { name: "個人指示1の内容を変更" }).click();
    await expectLayoutFits(
      page,
      testInfo,
      `${viewport.width}-training-instruction-picker`,
    );
    await page
      .getByRole("dialog", { name: "個人指示1の内容を選択" })
      .getByRole("button", { name: "閉じる" })
      .click();

    await page.getByRole("button", { name: "この内容で設定" }).click();
    await expectLayoutFits(
      page,
      testInfo,
      `${viewport.width}-training-confirm`,
    );
    await page
      .getByRole("dialog", { name: "練習設定を確認" })
      .getByRole("button", { name: "閉じる" })
      .click();

    await navigation.getByRole("button", { name: "試合", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${viewport.width}-match-planning`);
    await expectNavigationFixed(page, `${viewport.width}-match-planning`);
    await schedulePracticeMatch(page);
    await expectLayoutFits(page, testInfo, `${viewport.width}-match-prep`);
    await page.getByRole("button", { name: "試合開始" }).click();
    await expect(
      page.getByRole("heading", { name: "試合ダイジェスト" }),
    ).toBeVisible();
    await expectLayoutFits(page, testInfo, `${viewport.width}-match-live`);
    await page.getByRole("button", { name: "結果まで進む" }).click();
    await expectLayoutFits(page, testInfo, `${viewport.width}-match-result`);

    await navigation
      .getByRole("button", { name: "その他", exact: true })
      .click();
    await page.getByRole("button", { name: "学校管理" }).click();
    await expectLayoutFits(
      page,
      testInfo,
      `${viewport.width}-school-facilities`,
    );
    await expectNavigationFixed(page, `${viewport.width}-school-facilities`);

    await page.getByRole("button", { name: "トレーニング設備を強化" }).click();
    await expectLayoutFits(page, testInfo, `${viewport.width}-school-upgrade`);
    await page
      .getByRole("dialog", { name: "設備を強化" })
      .getByRole("button", { name: "閉じる" })
      .click();

    await page.getByRole("tab", { name: "記録", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${viewport.width}-school-records`);
    await page.getByRole("tab", { name: "卒業生", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${viewport.width}-school-alumni`);

    await page.getByRole("button", { name: "予定を確認" }).click();
    await expectLayoutFits(page, testInfo, `${viewport.width}-calendar`);
    await page
      .getByRole("dialog", { name: "週間カレンダー" })
      .getByRole("button", { name: "閉じる" })
      .click();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expectNavigationFixed(page, `${viewport.width}-school-after-scroll`);
  });
}
