import { expect, test, type Page, type TestInfo } from "@playwright/test";

interface OverflowIssue {
  selector: string;
  tag: string;
  className: string;
  text: string;
  left: number;
  right: number;
  width: number;
  scrollWidth: number;
  clientWidth: number;
  overflowX: string;
}

async function captureState(
  page: Page,
  testInfo: TestInfo,
  viewport: number,
  stateName: string,
) {
  await page.waitForTimeout(150);
  const screenshot = await page.screenshot({ fullPage: true });
  await testInfo.attach(`${viewport}-${stateName}.png`, {
    body: screenshot,
    contentType: "image/png",
  });

  const report = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const bodyWidth = document.body.scrollWidth;
    const documentWidth = document.documentElement.scrollWidth;
    const issues: OverflowIssue[] = [];

    for (const element of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const visuallyOutside = rect.right > viewportWidth + 0.5 || rect.left < -0.5;
      const internallyScrollable = element.scrollWidth > element.clientWidth + 1;
      const clipped = internallyScrollable && !["auto", "scroll"].includes(style.overflowX);

      if (!visuallyOutside && !clipped) {
        continue;
      }

      const classes = typeof element.className === "string" ? element.className : "";
      issues.push({
        selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${classes ? `.${classes.trim().replace(/\\s+/g, ".")}` : ""}`,
        tag: element.tagName.toLowerCase(),
        className: classes,
        text: (element.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 120),
        left: Math.round(rect.left * 10) / 10,
        right: Math.round(rect.right * 10) / 10,
        width: Math.round(rect.width * 10) / 10,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        overflowX: style.overflowX,
      });
    }

    return {
      viewportWidth,
      bodyWidth,
      documentWidth,
      bodyOverflow: bodyWidth - viewportWidth,
      documentOverflow: documentWidth - viewportWidth,
      issues,
    };
  });

  await testInfo.attach(`${viewport}-${stateName}.json`, {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: "application/json",
  });

  return report;
}

for (const viewport of [360, 390]) {
  test(`audit every mobile state at ${viewport}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport, height: viewport === 360 ? 800 : 844 });
    await page.goto("/");

    const navigation = page.getByRole("navigation", { name: "主要メニュー" });
    const reports: Array<{ state: string; issueCount: number; bodyOverflow: number }> = [];

    const capture = async (name: string) => {
      const report = await captureState(page, testInfo, viewport, name);
      reports.push({
        state: name,
        issueCount: report.issues.length,
        bodyOverflow: report.bodyOverflow,
      });
    };

    await capture("home");

    await navigation.getByRole("button", { name: "チーム", exact: true }).click();
    await capture("team");
    await page.getByRole("button", { name: "ローテーション1を変更" }).click();
    await capture("team-picker");
    await page.getByRole("button", { name: "閉じる" }).click();

    await navigation.getByRole("button", { name: "育成", exact: true }).click();
    await capture("training");
    await page.getByRole("button", { name: "個人指示2の選手を変更" }).click();
    await capture("training-picker");
    await page.getByRole("button", { name: "閉じる" }).click();

    await navigation.getByRole("button", { name: "試合", exact: true }).click();
    await capture("match-prep");
    await page.getByRole("button", { name: "試合開始" }).click();
    await capture("match-live");
    await page.getByRole("button", { name: "結果まで進む" }).click();
    await capture("match-result");

    await navigation.getByRole("button", { name: "学校", exact: true }).click();
    await capture("school");

    await testInfo.attach(`${viewport}-summary.json`, {
      body: Buffer.from(JSON.stringify(reports, null, 2)),
      contentType: "application/json",
    });

    expect(
      reports,
      "Temporary audit intentionally fails so screenshots and reports are uploaded.",
    ).toHaveLength(0);
  });
}
