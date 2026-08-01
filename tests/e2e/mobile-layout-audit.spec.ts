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

for (const viewport of [320, 360, 390, 480]) {
  test(`every app state fits a ${viewport}px viewport`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({
      width: viewport,
      height: viewport <= 360 ? 800 : 844,
    });
    await page.goto("/");

    const navigation = page.getByRole("navigation", { name: "主要メニュー" });

    await expectLayoutFits(page, testInfo, `${viewport}-home`);
    await expectNavigationFixed(page, `${viewport}-home`);

    await navigation.getByRole("button", { name: "選手", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${viewport}-players`);
    await expectNavigationFixed(page, `${viewport}-players`);
    await page.getByRole("button", { name: "編成", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${viewport}-team`);
    await expectNavigationFixed(page, `${viewport}-team`);
    await page.getByRole("button", { name: "ローテーション1を変更" }).click();
    await expectLayoutFits(page, testInfo, `${viewport}-team-picker`);
    await page
      .getByRole("dialog", { name: "ローテーション1の選手を選択" })
      .getByRole("button", { name: "閉じる" })
      .click();

    await navigation.getByRole("button", { name: "育成", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${viewport}-training`);
    await expectNavigationFixed(page, `${viewport}-training`);

    await page.getByRole("button", { name: "チーム練習を変更" }).click();
    await expectLayoutFits(page, testInfo, `${viewport}-training-menu`);
    await page
      .getByRole("dialog", { name: "チーム練習を選択" })
      .getByRole("button", { name: "閉じる" })
      .click();

    await page.getByRole("button", { name: "個人指示2の選手を変更" }).click();
    await expectLayoutFits(
      page,
      testInfo,
      `${viewport}-training-player-picker`,
    );
    await page
      .getByRole("dialog", { name: "個人指示2の選手を選択" })
      .getByRole("button", { name: "閉じる" })
      .click();

    await page.getByRole("button", { name: "個人指示1の内容を変更" }).click();
    await expectLayoutFits(
      page,
      testInfo,
      `${viewport}-training-instruction-picker`,
    );
    await page
      .getByRole("dialog", { name: "個人指示1の内容を選択" })
      .getByRole("button", { name: "閉じる" })
      .click();

    await page.getByRole("button", { name: "練習を実行" }).click();
    await expectLayoutFits(page, testInfo, `${viewport}-training-confirm`);
    await page
      .getByRole("dialog", { name: "練習内容を確認" })
      .getByRole("button", { name: "閉じる" })
      .click();

    await navigation.getByRole("button", { name: "試合", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${viewport}-match-prep`);
    await expectNavigationFixed(page, `${viewport}-match-prep`);
    await page.getByRole("button", { name: "試合開始" }).click();
    await expectLayoutFits(page, testInfo, `${viewport}-match-live`);
    await page.getByRole("button", { name: "結果まで進む" }).click();
    await expectLayoutFits(page, testInfo, `${viewport}-match-result`);

    await navigation.getByRole("button", { name: "学校", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${viewport}-school-facilities`);
    await expectNavigationFixed(page, `${viewport}-school-facilities`);

    await page.getByRole("button", { name: "トレーニング設備を強化" }).click();
    await expectLayoutFits(page, testInfo, `${viewport}-school-upgrade`);
    await page
      .getByRole("dialog", { name: "設備を強化" })
      .getByRole("button", { name: "閉じる" })
      .click();

    await page.getByRole("tab", { name: "記録", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${viewport}-school-records`);
    await page.getByRole("tab", { name: "OB", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${viewport}-school-alumni`);

    await page.getByRole("button", { name: "予定を確認" }).click();
    await expectLayoutFits(page, testInfo, `${viewport}-calendar`);
    await page
      .getByRole("dialog", { name: "週間カレンダー" })
      .getByRole("button", { name: "閉じる" })
      .click();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expectNavigationFixed(page, `${viewport}-school-after-scroll`);
  });
}
