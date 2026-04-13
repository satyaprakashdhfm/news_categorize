import { fetchHtml } from "./fetch-client.mjs";
import { extractReadableContent } from "./readability.mjs";
import { scrapeWithBrowser } from "./browser-session.mjs";

export async function scrapeWebsite(options) {
  validateUrl(options.url);

  const mode = normalizeMode(options.mode);
  const format = normalizeFormat(options.format);
  const maxChars = clampNumber(options.maxChars, 20_000, 500, 2_000_000);

  const source =
    mode === "browser"
      ? await scrapeWithBrowser(options)
      : await fetchHtml(options.url, {
          timeoutMs: options.timeoutMs,
          retries: options.httpRetries,
          retryDelayMs: options.httpRetryDelayMs,
          proxyUrl: options.proxyUrl,
          userAgent: options.userAgent,
        });

  const parsed = await extractReadableContent({
    html: source.html,
    url: source.finalUrl || options.url,
    mode: format,
  });

  const text = truncate(parsed?.text || "", maxChars);
  const html = options.includeHtml ? truncate(source.html || "", maxChars) : undefined;

  return {
    mode,
    format,
    requestedUrl: options.url,
    finalUrl: source.finalUrl || options.url,
    title: parsed?.title || source.title || undefined,
    text,
    html,
    truncated: {
      text: (parsed?.text || "").length > text.length,
      html: options.includeHtml ? (source.html || "").length > (html?.length || 0) : false,
    },
    scrapedAt: new Date().toISOString(),
  };
}

function normalizeMode(mode) {
  const value = String(mode || "browser").toLowerCase().trim();
  if (value !== "browser" && value !== "http") {
    throw new Error("Invalid mode. Use 'browser' or 'http'.");
  }
  return value;
}

function normalizeFormat(format) {
  const value = String(format || "markdown").toLowerCase().trim();
  if (value !== "markdown" && value !== "text") {
    throw new Error("Invalid format. Use 'markdown' or 'text'.");
  }
  return value;
}

function validateUrl(url) {
  const value = String(url || "").trim();
  if (!value) {
    throw new Error("--url is required");
  }
  try {
    const parsed = new URL(value);
    if (!parsed.protocol.startsWith("http")) {
      throw new Error("URL must start with http:// or https://");
    }
  } catch {
    throw new Error("Invalid URL");
  }
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function truncate(value, maxChars) {
  return String(value || "").slice(0, maxChars);
}
