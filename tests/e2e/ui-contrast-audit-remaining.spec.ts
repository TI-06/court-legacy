import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { advanceWeekFromHome } from "./homeTestHelpers";

const OUTPUT_DIR = path.join(process.cwd(), "contrast-audit");
const REPORT_PATH = path.join(OUTPUT_DIR, "remaining-report.json");
const records: Array<{ state: string; issueCount: number; issues: unknown[] }> = [];

async function audit(page: Page, state: string) {
  await page.waitForTimeout(100);
  const issues = await page.evaluate(() => {
    type Rgba = { r: number; g: number; b: number; a: number };
    const parse = (value: string): Rgba | null => {
      const m = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
      return m
        ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] }
        : null;
    };
    const blend = (fg: Rgba, bg: Rgba): Rgba => {
      const a = fg.a + bg.a * (1 - fg.a);
      return a <= 0
        ? { r: 0, g: 0, b: 0, a: 0 }
        : {
            r: (fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a,
            g: (fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a,
            b: (fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a,
            a,
          };
    };
    const channel = (v: number) => {
      const n = v / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    };
    const lum = (c: Rgba) => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
    const ratio = (a: Rgba, b: Rgba) => {
      const l1 = lum(a);
      const l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const background = (element: HTMLElement) => {
      const layers: Rgba[] = [];
      let current: HTMLElement | null = element;
      let gradient = false;
      while (current) {
        const style = getComputedStyle(current);
        gradient ||= style.backgroundImage !== "none";
        const c = parse(style.backgroundColor);
        if (c && c.a > 0) layers.push(c);
        current = current.parentElement;
      }
      let resolved: Rgba = { r: 5, g: 11, b: 20, a: 1 };
      for (const layer of layers.reverse()) resolved = blend(layer, resolved);
      return { resolved, gradient };
    };

    return Array.from(document.querySelectorAll<HTMLElement>("body *")).flatMap((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0 ||
        rect.width < 1 ||
        rect.height < 1 ||
        element.matches(":disabled,[aria-disabled='true']")
      ) return [];
      const text = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) return [];
      const fg = parse(style.color);
      if (!fg) return [];
      const bgInfo = background(element);
      const effectiveFg = blend(fg, bgInfo.resolved);
      const contrastRatio = ratio(effectiveFg, bgInfo.resolved);
      const fontSize = Number.parseFloat(style.fontSize) || 0;
      const parsedWeight = Number.parseInt(style.fontWeight, 10);
      const fontWeight = Number.isFinite(parsedWeight) ? parsedWeight : style.fontWeight === "bold" ? 700 : 400;
      const required = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5;
      if (contrastRatio + 0.05 >= required) return [];
      const classes = typeof element.className === "string" ? element.className.trim().replace(/\s+/g, ".") : "";
      return [{
        selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${classes ? `.${classes}` : ""}`,
        text: text.slice(0, 100),
        color: style.color,
        backgroundColor: `rgb(${Math.round(bgInfo.resolved.r)} ${Math.round(bgInfo.resolved.g)} ${Math.round(bgInfo.resolved.b)})`,
        ratio: Math.round(contrastRatio * 100) / 100,
        required,
        fontSize,
        fontWeight,
        gradientAncestor: bgInfo.gradient,
      }];
    });
  });

  await mkdir(OUTPUT_DIR, { recursive: true });
  const safe = state.replace(/[^a-zA-Z0-9_-]+/g, "-");
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${safe}.png`), fullPage: true });
  records.push({ state, issueCount: issues.length, issues });
  await writeFile(REPORT_PATH, JSON.stringify(records, null, 2), "utf8");
  console.log(`[contrast-audit] ${state}: ${issues.length} issue(s)`);
}

async function schedulePracticeMatch(page: Page) {
  const scheduled = page.getByText("対戦決定", { exact: true });
  if (await scheduled.isVisible().catch(() => false)) return;
  const accept = page.getByRole("button", { name: "受ける" });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
    await expect(scheduled).toBeVisible();
    return;
  }
  for (let i = 0; i < 6; i += 1) {
    const request = page.locator("button").filter({ hasText: "申し込む" }).first();
    if (!(await request.isVisible().catch(() => false))) break;
    await request.click();
    try {
      await expect(scheduled).toBeVisible({ timeout: 900 });
      return;
    } catch {}
  }
  await expect(scheduled).toBeVisible();
}

async function finishMatch(page: Page) {
  const result = page.getByRole("heading", { name: "試合結果" });
  for (let i = 0; i < 14; i += 1) {
    if (await result.isVisible().catch(() => false)) return;
    const nextDecision = page.getByRole("button", { name: "次の判断まで進む" });
    const toResult = page.getByRole("button", { name: "結果まで進む" });
    if (await nextDecision.isVisible().catch(() => false)) await nextDecision.click();
    else if (await toResult.isVisible().catch(() => false)) await toResult.click();
    if (await result.isVisible().catch(() => false)) return;
    const panel = page.getByRole("region", { name: "監督指示" });
    await expect(panel).toBeVisible();
    const nextSet = panel.getByRole("button", { name: "このまま次セットへ" });
    if (await nextSet.isVisible().catch(() => false)) await nextSet.click();
    else await panel.getByRole("button", { name: "このまま続ける" }).click();
    await expect(panel).toBeHidden();
  }
  throw new Error("match did not reach result");
}

async function saveTrainingAndAdvance(page: Page) {
  const nav = page.getByRole("navigation", { name: "主要メニュー" });
  await nav.getByRole("button", { name: "選手", exact: true }).click();
  await page.locator(".player-training-chip").first().click();
  await page.getByRole("dialog", { name: /の個人練習$/ }).getByRole("button", { name: /^攻撃/ }).click();
  await nav.getByRole("button", { name: "ホーム", exact: true }).click();
  await advanceWeekFromHome(page);
}

test.describe.configure({ mode: "serial", timeout: 120_000 });

test("audit remaining signed-in screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "主要メニュー" });

  await nav.getByRole("button", { name: "選手", exact: true }).click();
  await page.locator(".player-training-chip").first().click();
  await audit(page, "players-training-dialog");
  await page.getByRole("dialog", { name: /の個人練習$/ }).getByRole("button", { name: "閉じる" }).click();
  for (const label of ["編成", "チーム状態", "戦術"] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await audit(page, `players-${label}`);
  }

  await nav.getByRole("button", { name: "学校", exact: true }).click();
  await audit(page, "school-facilities");
  const detail = page.getByRole("button", { name: "トレーニング設備の詳細" });
  if (await detail.isVisible().catch(() => false)) {
    await detail.click();
    await audit(page, "school-facility-dialog");
    await page.getByRole("dialog", { name: "設備を強化" }).getByRole("button", { name: "閉じる" }).click();
  }
  for (const label of ["スタッフ", "記録", "卒業生"] as const) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await audit(page, `school-${label}`);
  }
  await page.getByRole("tab", { name: "スカウト", exact: true }).click();
  await expect(page.getByRole("heading", { name: "新入生スカウト" })).toBeVisible();
  await audit(page, "school-scouting");

  await nav.getByRole("button", { name: "試合", exact: true }).click();
  await audit(page, "match-hub");
  const tournament = page.getByRole("button", { name: "大会表を見る" });
  if (await tournament.isVisible().catch(() => false)) {
    await tournament.click();
    await audit(page, "match-tournament");
    const back = page.getByRole("button", { name: /戻る/ }).first();
    if (await back.isVisible().catch(() => false)) await back.click();
  }
  const pvp = page.getByRole("button", { name: "対人戦を開く" });
  if (await pvp.isVisible().catch(() => false)) {
    await pvp.click();
    await page.waitForTimeout(250);
    await audit(page, "match-pvp");
  }

  await nav.getByRole("button", { name: "その他", exact: true }).click();
  await audit(page, "more-menu");
  await page.getByRole("button", { name: "ショップ", exact: true }).click();
  await page.waitForTimeout(250);
  await audit(page, "more-shop");
  await page.getByRole("button", { name: "その他へ戻る" }).click();
  await page.getByRole("button", { name: "所持品", exact: true }).click();
  await page.waitForTimeout(250);
  await audit(page, "more-inventory");
});

test("audit practice match screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "主要メニュー" });
  await nav.getByRole("button", { name: "試合", exact: true }).click();
  await schedulePracticeMatch(page);
  await audit(page, "match-practice-scheduled");
  await nav.getByRole("button", { name: "ホーム", exact: true }).click();
  await page.getByRole("button", { name: "今週を進める" }).click();
  await expect(page.getByRole("heading", { name: "試合準備" })).toBeVisible();
  await audit(page, "match-preparation");
  await page.getByRole("button", { name: "この編成・戦術で試合開始" }).click();
  await expect(page.getByRole("heading", { name: "試合ダイジェスト" })).toBeVisible();
  await audit(page, "match-live");
  await finishMatch(page);
  await audit(page, "match-result");
  await page.getByRole("button", { name: "結果を確認して次へ" }).click();
  const trainingResult = page.getByRole("button", { name: /今週の練習結果/ }).first();
  if (await trainingResult.isVisible().catch(() => false)) {
    await trainingResult.click();
    await audit(page, "home-training-result-dialog");
  }
});

test("audit fullscreen event", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await saveTrainingAndAdvance(page);
  await saveTrainingAndAdvance(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await audit(page, "event-choice");
  await dialog.locator(".event-choice").first().click();
  await expect(page.getByRole("dialog", { name: "対応結果" })).toBeVisible();
  await audit(page, "event-result");
});

test("audit auth and onboarding", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    sessionStorage.setItem("court-legacy:e2e-auth-state", "signed-out");
    sessionStorage.setItem("court-legacy:e2e-game-state", "needs-onboarding");
    sessionStorage.removeItem("court-legacy:e2e-server-snapshot");
    sessionStorage.removeItem("court-legacy:e2e-flow-initialized");
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "監督としてログイン" })).toBeVisible();
  await audit(page, "auth-login");
  await page.getByRole("button", { name: "新規登録はこちら" }).click();
  await audit(page, "auth-registration");
  await page.getByLabel("メールアドレス").fill("audit@court-legacy.test");
  await page.getByLabel("ログインID").fill("audit.coach");
  await page.getByLabel("パスワード", { exact: true }).fill("password123");
  await page.getByLabel("パスワード確認").fill("password123");
  await page.getByLabel("監督名").fill("監査 監督");
  await page.getByLabel("高校名").fill("監査高校");
  await page.getByRole("button", { name: "この内容で登録" }).click();
  await expect(page.getByRole("heading", { name: "学校をつくる" })).toBeVisible();
  await audit(page, "onboarding-school-setup");
});
