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
      if (element.id.startsWith("DndLiveRegion-")) {
        continue;
      }

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
  const element = page.locator(locatorSelector);
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  const elementBox = await element.boundingBox();
  const navigationBox = await navigation.boundingBox();

  expect(elementBox, `${stateName}: target box`).not.toBeNull();
  expect(navigationBox, `${stateName}: navigation box`).not.toBeNull();
  expect(
    (elementBox?.y ?? 0) + (elementBox?.height ?? 0),
    `${stateName}: target must stay above navigation`,
  ).toBeLessThanOrEqual(navigationBox?.y ?? Number.POSITIVE_INFINITY);
}

async function expectReadableText(page: Page, stateName: string) {
  const tooSmall = await page.evaluate(() => {
    const ignoredTags = new Set(["SCRIPT", "STYLE", "SVG", "PATH"]);
    const results: Array<{
      selector: string;
      text: string;
      size: number;
    }> = [];

    for (const element of Array.from(
      document.querySelectorAll<HTMLElement>("body *"),
    )) {
      if (
        ignoredTags.has(element.tagName) ||
        element.id.startsWith("DndLiveRegion-")
      ) {
        continue;
      }
      const text = (element.innerText || "").trim();
      if (!text || element.children.length > 0) {
        continue;
      }
      const style = window.getComputedStyle(element);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0
      ) {
        continue;
      }
      const size = Number.parseFloat(style.fontSize);
      if (Number.isFinite(size) && size < 12) {
        results.push({
          selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}`,
          text: text.slice(0, 80),
          size,
        });
      }
    }

    return results;
  });

  expect(tooSmall, `${stateName}: text smaller than 12px`).toEqual([]);
}

const widths = [320, 360, 390, 414, 480];

for (const width of widths) {
  test(`every app state fits a ${width}px viewport`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");

    const navigation = page.getByRole("navigation", { name: "主要メニュー" });
    await expect(navigation).toBeVisible();

    await expectLayoutFits(page, testInfo, `${width}-home`);
    await expectNavigationFixed(page, `${width}-home`);
    await expectReadableText(page, `${width}-home`);

    await navigation.getByRole("button", { name: "選手", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${width}-players`);
    await expectNavigationFixed(page, `${width}-players`);
    await expectReadableText(page, `${width}-players`);

    await page.getByRole("button", { name: "編成", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${width}-team`);
    await expectNavigationFixed(page, `${width}-team`);
    await expectReadableText(page, `${width}-team`);

    await navigation.getByRole("button", { name: "育成", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${width}-training`);
    await expectNavigationFixed(page, `${width}-training`);
    await expectReadableText(page, `${width}-training`);
    await expectAboveNavigation(
      page,
      ".sticky-action-bar",
      `${width}-training-action`,
    );

    await navigation.getByRole("button", { name: "試合", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${width}-match`);
    await expectNavigationFixed(page, `${width}-match`);
    await expectReadableText(page, `${width}-match`);

    await navigation.getByRole("button", { name: "その他", exact: true }).click();
    await expectLayoutFits(page, testInfo, `${width}-more`);
    await expectNavigationFixed(page, `${width}-more`);
    await expectReadableText(page, `${width}-more`);
  });
}
