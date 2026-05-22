import { join } from "node:path";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";
import type { BrowserContext, Page } from "playwright";
import { env } from "../shared/config.js";

chromium.use(stealth());

let context: BrowserContext | null = null;

export async function getContext(): Promise<BrowserContext> {
  if (context) return context;
  const userDataDir = join(process.cwd(), env.pwProfileDir);
  context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chrome",
    headless: env.pwHeadless,
    viewport: { width: 1280, height: 900 },
    locale: "zh-TW",
    timezoneId: "Asia/Taipei",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  return context;
}

export async function newPage(): Promise<Page> {
  const ctx = await getContext();
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  return page;
}

export async function closeBrowser(): Promise<void> {
  await context?.close();
  context = null;
}

async function isLoggedIn(page: Page): Promise<boolean> {
  if (/\/login|\/signup|accounts\/login/i.test(page.url())) return false;
  const notifLink = await page.$('a[href="/notifications"]').catch(() => null);
  return notifLink !== null;
}

export async function detectRiskSignals(page: Page): Promise<string[]> {
  const signals: string[] = [];
  if (/challenge|checkpoint/i.test(page.url())) signals.push(`risky_url:${page.url()}`);
  const body = (await page.textContent("body").catch(() => "")) ?? "";
  if (/unusual activity detected|verify you.?re human|完成驗證|異常活動偵測/i.test(body))
    signals.push("captcha_or_unusual_activity");
  if (/try again later|稍後再試|rate limit/i.test(body))
    signals.push("rate_limited");
  return signals;
}

export async function waitForCaptchaResolved(
  page: Page,
  timeoutMs = 3 * 60 * 1000,
): Promise<boolean> {
  console.log("\n" + "=".repeat(60));
  console.log("⚠️  Threads 要求人工驗證（captcha / 異常活動）");
  console.log("請在瀏覽器視窗中完成驗證，完成後程式將自動繼續。");
  console.log("=".repeat(60) + "\n");

  const deadline = Date.now() + timeoutMs;
  let dots = 0;
  while (Date.now() < deadline) {
    await page.waitForTimeout(3000);
    const signals = await detectRiskSignals(page);
    if (!signals.includes("captcha_or_unusual_activity")) {
      console.log("\n✅ 驗證通過，繼續執行…\n");
      return true;
    }
    process.stdout.write(".");
    if (++dots % 20 === 0) process.stdout.write("\n");
  }
  console.log("\n\n❌ 等待逾時，請重新執行。");
  return false;
}

export async function ensureLoggedIn(page: Page): Promise<boolean> {
  await page.goto("https://www.threads.com/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  if (await isLoggedIn(page)) {
    await warmUp(page);
    return true;
  }

  console.log("\n" + "=".repeat(60));
  console.log("⚠️  尚未登入 Threads");
  console.log("請在瀏覽器視窗中手動登入，登入後程式自動繼續。");
  console.log("（程式不會再動頁面，請放心操作）");
  console.log("=".repeat(60) + "\n");

  let dots = 0;
  while (true) {
    await page.waitForTimeout(3000);
    if (await isLoggedIn(page)) {
      console.log("\n✅ 登入成功，進行暖機…\n");
      await warmUp(page);
      return true;
    }
    process.stdout.write(".");
    if (++dots % 20 === 0) process.stdout.write("\n");
  }
}

async function warmUp(page: Page): Promise<void> {
  console.log("🔥 暖機中（home feed 自然瀏覽，約 15 秒）…");
  try {
    const scrolls = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < scrolls; i++) {
      await page.mouse.wheel(0, 400 + Math.floor(Math.random() * 500));
      await page.waitForTimeout(2000 + Math.floor(Math.random() * 2000));
    }
    console.log("✅ 暖機完成，開始海巡\n");
  } catch {
    console.log("ℹ️  暖機略過\n");
  }
}
