import { chromium } from "playwright";

export async function scrapeWithBrowser(options) {
  const timeoutMs = clampNumber(options.timeoutMs, 30_000, 1_000, 180_000);
  const waitUntil = options.waitUntil || "domcontentloaded";

  const browser = await chromium.launch({
    headless: options.headless !== false,
    executablePath: options.browserPath || undefined,
  });

  try {
    const context = await browser.newContext({
      userAgent: options.userAgent || undefined,
      viewport: {
        width: clampNumber(options.viewportWidth, 1366, 320, 3840),
        height: clampNumber(options.viewportHeight, 768, 240, 2160),
      },
      extraHTTPHeaders: options.extraHeaders || undefined,
    });

    const page = await context.newPage();
    await page.goto(options.url, { waitUntil, timeout: timeoutMs });

    if (Array.isArray(options.actions) && options.actions.length > 0) {
      await runActions(page, options.actions, timeoutMs);
    }

    if (typeof options.postActionWaitMs === "number" && options.postActionWaitMs > 0) {
      await page.waitForTimeout(Math.max(0, Math.min(60_000, Math.floor(options.postActionWaitMs))));
    }

    const html = await captureStableHtml(page, timeoutMs);
    const finalUrl = page.url();
    const title = await capturePageTitle(page);

    if (options.screenshotPath) {
      await page.screenshot({ path: options.screenshotPath, fullPage: true });
    }

    await context.close();

    return {
      url: options.url,
      finalUrl,
      title,
      html,
    };
  } finally {
    await browser.close();
  }
}

async function captureStableHtml(page, timeoutMs) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await waitForPageStability(page, timeoutMs);
    try {
      return await page.content();
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(250 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unable to capture stable page content");
}

async function capturePageTitle(page) {
  try {
    return await page.title();
  } catch {
    return "";
  }
}

async function waitForPageStability(page, timeoutMs) {
  const perStateTimeout = Math.max(1000, Math.min(6000, Math.floor(timeoutMs / 6)));
  const states = ["domcontentloaded", "load", "networkidle"];
  for (const state of states) {
    try {
      await page.waitForLoadState(state, { timeout: perStateTimeout });
    } catch {
      // Some pages never reach every state; continue with best effort.
    }
  }
  await page.waitForTimeout(300);
}

async function runActions(page, actions, timeoutMs) {
  for (const action of actions) {
    const type = String(action?.type || "").trim().toLowerCase();
    if (!type) {
      continue;
    }

    if (type === "wait") {
      const ms = clampNumber(action.ms, 1000, 0, 120_000);
      await page.waitForTimeout(ms);
      continue;
    }

    if (type === "goto") {
      if (!action.url) {
        throw new Error("Action 'goto' requires 'url'.");
      }
      await page.goto(String(action.url), { waitUntil: "domcontentloaded", timeout: timeoutMs });
      continue;
    }

    if (!action.selector) {
      throw new Error(`Action '${type}' requires 'selector'.`);
    }

    const selector = String(action.selector);

    if (type === "click") {
      await page.locator(selector).first().click({ timeout: timeoutMs });
      continue;
    }

    if (type === "type") {
      const text = String(action.text || "");
      await page.locator(selector).first().fill(text, { timeout: timeoutMs });
      continue;
    }

    if (type === "press") {
      const key = String(action.key || "Enter");
      await page.locator(selector).first().press(key, { timeout: timeoutMs });
      continue;
    }

    if (type === "select") {
      const value = String(action.value || "");
      await page.locator(selector).first().selectOption(value, { timeout: timeoutMs });
      continue;
    }

    if (type === "hover") {
      await page.locator(selector).first().hover({ timeout: timeoutMs });
      continue;
    }

    throw new Error(`Unsupported action type '${type}'.`);
  }
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(n)));
}
