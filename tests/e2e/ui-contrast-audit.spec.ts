import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { advanceWeekFromHome } from "./homeTestHelpers";

const OUTPUT_DIR = path.join(process.cwd(), "contrast-audit");
const AUTH_STATE_KEY = "court-legacy:e2e-auth-state";
const GAME_STATE_KEY = "court-legacy:e2e-game-state";
const SNAPSHOT_KEY = "court-legacy:e2e-server-snapshot";
const FLOW_INITIALIZED_KEY = "court-legacy:e2e-flow-initialized";

type ContrastIssue = {
  selector: string;
  text: string;
  color: string;
  backgroundColor: string;
  backgroundImage: string;
  ratio: number;
  requiredRatio: number;
  fontSize: number;
  fontWeight: number;
};

type AuditRecord = {
  state: string;
  viewport: { width: number; height: number } | null;
  issueCount: number;
  issues: ContrastIssue[];
};

const records: AuditRecord[] = [];

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "");
}

async function persistReport(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    path.join(OUTPUT_DIR, "report.json"),
    JSON.stringify(records, null, 2),
    "utf8",
  );
}

async function auditState(page: Page, state: string): Promise<void> {
  await page.waitForTimeout(120);
  await mkdir(OUTPUT_DIR, { recursive: true });

  const issues = await page.evaluate(() => {
    type Rgba = { r: number; g: number; b: number; a: number };

    const parseColor = (value: string): Rgba | null => {
      const match = value.match(
        /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i,
      );
      if (!match) return null;
      return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3]),
        a: match[4] === undefined ? 1 : Number(match[4]),
      };
    };

    const blend = (foreground: Rgba, background: Rgba): Rgba => {
      const alpha = foreground.a + background.a * (1 - foreground.a);
      if (alpha <= 0) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r:
          (foreground.r * foreground.a +
            background.r * background.a * (1 - foreground.a)) /
          alpha,
        g:
          (foreground.g * foreground.a +
            background.g * background.a * (1 - foreground.a)) /
          alpha,
        b:
          (foreground.b * foreground.a +
            background.b * background.a * (1 - foreground.a)) /
          alpha,
        a: alpha,
      };
    };

    const channel = (value: number) => {
      const normalized = value / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    };

    const luminance = (value: Rgba) =>
      channel(value.r) * 0.2126 +
      channel(value.g) * 0.7152 +
      channel(value.b) * 0.0722;

    const contrast = (left: Rgba, right: Rgba) => {
      const light = Math.max(luminance(left), luminance(right));
      const dark = Math.min(luminance(left), luminance(right));
      return (light + 0.05) / (dark + 0.05);
    };

    const effectiveBackground = (element: HTMLElement): Rgba => {
      const layers: Rgba[] = [];
      let current: HTMLElement | null = element;
      while (current) {
        const parsed = parseColor(getComputedStyle(current).backgroundColor);
        if (parsed && parsed.a > 0) layers.push(parsed);
        current = current.parentElement;
      }
      let resolved: Rgba = { r: 5, g: 11, b: 20, a: 1 };
      for (const layer of layers.reverse()) resolved = blend(layer, resolved);
      return resolved;
    };

    const colorString = (value: Rgba) =>
      `rgb(${Math.round(value.r)} ${Math.round(value.g)} ${Math.round(value.b)})`;

    const result: ContrastIssue[] = [];
    for (const element of Array.from(
      document.querySelectorAll<HTMLElement>("body *"),
    )) {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number(style.opacity) === 0 ||
        rect.width < 1 ||
        rect.height < 1 ||
        element.matches(":disabled,[aria-disabled='true']")
      ) {
        continue;
      }

      const directText = Array.from(element.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (!directText) continue;

      const parsedText = parseColor(style.color);
      if (!parsedText) continue;
      const background = effectiveBackground(element);
      const text = blend(parsedText, background);
      const ratio = contrast(text, background);
      const fontSize = Number.parseFloat(style.fontSize) || 0;
      const parsedWeight = Number.parseInt(style.fontWeight, 10);
      const fontWeight = Number.isFinite(parsedWeight)
        ? parsedWeight
        : style.fontWeight === "bold"
          ? 700
          : 400;
      const largeText =
        fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
      const requiredRatio = largeText ? 3 : 4.5;
      if (ratio + 0.05 >= requiredRatio) continue;

      const className =
        typeof element.className === "string"
          ? element.className.trim().replace(/\s+/g, ".")
          : "";
      result.push({
        selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${className ? `.${className}` : ""}`,
        text: directText.slice(0, 100),
        color: style.color,
        backgroundColor: colorString(background),
        backgroundImage: style.backgroundImage,
        ratio: Math.round(ratio * 100) / 100,
        requiredRatio,
        fontSize,
        fontWeight,
      });
    }

    return result;
  });

  const name = safeName(state);
  await page.screenshot({
    path: path.join(OUTPUT_DIR, `${name}.png`),
    fullPage: true,
  });
  records.push({
    state,
    viewport: page.viewportSize(),
    issueCount: issues.length,
    issues,
  });
  await persistReport();
  console.log(`[contrast-audit] ${state}: ${issues.length} issue(s)`);
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

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const requestButton = page
      .locator("button")
      .filter({ hasText: "申し込む" })
      .first();
    if (!(await requestButton.isVisible().catch(() => false))) break;
    await requestButton.click();
    try {
      await expect(scheduled).toBeVisible({ timeout: 900 });
      return;
    } catch {
      // The request can be rejected. Try the next candidate.
    }
  }
  await expect(scheduled).toBeVisible();
}

async function finishInteractiveMatch(page: Page) {
  const resultHeading = page.getByRole("heading", { name: "試合結果" });
  for (let guard = 0; guard < 14; guard += 1) {
    if (await resultHeading.isVisible().catch(() => false)) return;
    const toDecision = page.getByRole("button", { name: "次の判断まで進む" });
    const toResult = page.getByRole("button", { name: "結果まで進む" });
    if (await toDecision.isVisible().catch(() => false)) await toDecision.click();
    else if (await toResult.isVisible().catch(() => false)) await toResult.click();
    if (await resultHeading.isVisible().catch(() => false)) return;
    const decision = page.getByRole("region", { name: "監督指示" });
    await expect(decision).toBeVisible();
    const nextSet = decision.getByRole("button", { name: "このまま次セットへ" });
    if (await nextSet.isVisible().catch(() => false)) await nextSet.click();
    else await decision.getByRole("button", { name: "このまま続ける" }).click();
    await expect(decision).toBeHidden();
  }
  throw new Error("interactive practice match did not reach the result");
}

async function saveTrainingAndAdvance(page: Page) {
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await page.locator(".player-training-chip").first().click();
  await page
    .getByRole("dialog", { name: /の個人練習$/ })
    .getByRole("button", { name: /^攻撃/ })
    .click();
  await navigation.getByRole("button", { name: "ホーム", exact: true }).click();
  await advanceWeekFromHome(page);
}

test.describe.configure({ mode: "serial" });

test("audit signed-in game screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });

  await auditState(page, "game-home");
  await page.getByRole("button", { name: "予定を確認" }).click();
  await expect(page.getByRole("dialog", { name: "週間カレンダー" })).toBeVisible();
  await auditState(page, "game-calendar");
  await page
    .getByRole("dialog", { name: "週間カレンダー" })
    .getByRole("button", { name: "閉じる" })
    .click();

  await navigation.getByRole("button", { name: "選手", exact: true }).click();
  await auditState(page, "players-roster");
  await page.getByTestId("roster-player-row").first().click();
  await auditState(page, "players-detail");
  await page.locator(".player-training-chip").first().click();
  await auditState(page, "players-training-dialog");
  await page
    .getByRole("dialog", { name: /の個人練習$/ })
    .getByRole("button", { name: "閉じる" })
    .click();
  await page.getByRole("button", { name: "選手一覧へ戻る" }).click();

  for (const label of ["編成", "チーム状態", "戦術"] as const) {
    await page.getByRole("button", { name: label, exact: true }).click();
    await auditState(page, `players-${label}`);
  }

  await navigation.getByRole("button", { name: "学校", exact: true }).click();
  await auditState(page, "school-facilities");
  const facilityDetail = page.getByRole("button", { name: "トレーニング設備の詳細" });
  if (await facilityDetail.isVisible().catch(() => false)) {
    await facilityDetail.click();
    await auditState(page, "school-facility-dialog");
    await page
      .getByRole("dialog", { name: "設備を強化" })
      .getByRole("button", { name: "閉じる" })
      .click();
  }
  for (const label of ["スタッフ", "記録", "卒業生"] as const) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await auditState(page, `school-${label}`);
  }
  await page.getByRole("tab", { name: "スカウト", exact: true }).click();
  await expect(page.getByRole("heading", { name: "新入生スカウト" })).toBeVisible();
  await auditState(page, "school-scouting");

  await navigation.getByRole("button", { name: "試合", exact: true }).click();
  await auditState(page, "match-hub");
  const tournamentButton = page.getByRole("button", { name: "大会表を見る" });
  if (await tournamentButton.isVisible().catch(() => false)) {
    await tournamentButton.click();
    await auditState(page, "match-tournament");
    await page.getByRole("button", { name: /戻る/ }).first().click();
  }
  const pvpButton = page.getByRole("button", { name: "対人戦を開く" });
  if (await pvpButton.isVisible().catch(() => false)) {
    await pvpButton.click();
    await page.waitForTimeout(250);
    await auditState(page, "match-pvp");
    const returnPractice = page.getByRole("button", { name: /練習試合/ }).first();
    if (await returnPractice.isVisible().catch(() => false)) await returnPractice.click();
  }

  await navigation.getByRole("button", { name: "その他", exact: true }).click();
  await auditState(page, "more-menu");
  await page.getByRole("button", { name: "ショップ", exact: true }).click();
  await page.waitForTimeout(250);
  await auditState(page, "more-shop");
  await page.getByRole("button", { name: "その他へ戻る" }).click();
  await page.getByRole("button", { name: "所持品", exact: true }).click();
  await page.waitForTimeout(250);
  await auditState(page, "more-inventory");
});

test("audit practice match preparation, live match, result, and training result", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "主要メニュー" });
  await navigation.getByRole("button", { name: "試合", exact: true }).click();
  await schedulePracticeMatch(page);
  await auditState(page, "match-practice-scheduled");

  await navigation.getByRole("button", { name: "ホーム", exact: true }).click();
  await page.getByRole("button", { name: "今週を進める" }).click();
  await expect(page.getByRole("heading", { name: "試合準備" })).toBeVisible();
  await auditState(page, "match-preparation");
  await page.getByRole("button", { name: "この編成・戦術で試合開始" }).click();
  await expect(page.getByRole("heading", { name: "試合ダイジェスト" })).toBeVisible();
  await auditState(page, "match-live");
  await finishInteractiveMatch(page);
  await auditState(page, "match-result");
  await page.getByRole("button", { name: "結果を確認して次へ" }).click();
  await expect(page.getByTestId("home-screen")).toBeVisible();
  const trainingResult = page.getByRole("button", { name: /今週の練習結果/ }).first();
  if (await trainingResult.isVisible().catch(() => false)) {
    await trainingResult.click();
    await auditState(page, "home-training-result-dialog");
  }
});

test("audit fullscreen event choice and result", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await saveTrainingAndAdvance(page);
  await saveTrainingAndAdvance(page);
  const eventDialog = page.getByRole("dialog");
  await expect(eventDialog).toBeVisible();
  await auditState(page, "event-choice");
  await eventDialog.locator(".event-choice").first().click();
  await expect(page.getByRole("dialog", { name: "対応結果" })).toBeVisible();
  await auditState(page, "event-result");
});

test("audit login, registration, and onboarding screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(
    ({ authStateKey, gameStateKey, snapshotKey, flowInitializedKey }) => {
      sessionStorage.removeItem(flowInitializedKey);
      sessionStorage.setItem(authStateKey, "signed-out");
      sessionStorage.setItem(gameStateKey, "needs-onboarding");
      sessionStorage.removeItem(snapshotKey);
    },
    {
      authStateKey: AUTH_STATE_KEY,
      gameStateKey: GAME_STATE_KEY,
      snapshotKey: SNAPSHOT_KEY,
      flowInitializedKey: FLOW_INITIALIZED_KEY,
    },
  );
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "監督としてログイン" })).toBeVisible();
  await auditState(page, "auth-login");
  await page.getByRole("button", { name: "新規登録はこちら" }).click();
  await auditState(page, "auth-registration");

  await page.getByLabel("メールアドレス").fill("audit@court-legacy.test");
  await page.getByLabel("ログインID").fill("audit.coach");
  await page.getByLabel("パスワード", { exact: true }).fill("password123");
  await page.getByLabel("パスワード確認").fill("password123");
  await page.getByLabel("監督名").fill("監査 監督");
  await page.getByLabel("高校名").fill("監査高校");
  await page.getByRole("button", { name: "この内容で登録" }).click();
  await expect(page.getByRole("heading", { name: "学校をつくる" })).toBeVisible();
  await auditState(page, "onboarding-school-setup");
});
