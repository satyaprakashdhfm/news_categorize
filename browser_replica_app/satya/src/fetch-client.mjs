import { Agent, ProxyAgent, fetch } from "undici";

/**
 * Lightweight HTTP fetcher with optional proxy support.
 */
export async function fetchHtml(url, opts = {}) {
  const timeoutMs = clampNumber(opts.timeoutMs, 30_000, 1_000, 120_000);
  const retryCount = clampNumber(opts.retries, 2, 0, 10);
  const retryDelayMs = clampNumber(opts.retryDelayMs, 750, 50, 10_000);
  const dispatcher = createDispatcher(opts.proxyUrl);
  let lastError;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("request timed out")), timeoutMs);

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "user-agent":
            opts.userAgent ||
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari/537.36",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        dispatcher,
        signal: controller.signal,
      });

      if (!res.ok) {
        const error = new Error(`HTTP ${res.status}`);
        if (!isRetryableStatus(res.status) || attempt >= retryCount) {
          throw error;
        }
        lastError = error;
        await sleep(computeBackoffMs(retryDelayMs, attempt));
        continue;
      }

      const html = await res.text();
      return {
        url,
        finalUrl: res.url || url,
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        html,
      };
    } catch (error) {
      const wrapped = toFetchError(error, timeoutMs);
      if (!isRetryableError(error) || attempt >= retryCount) {
        throw new Error(
          `Failed to fetch ${url} after ${attempt + 1} attempt(s): ${wrapped.message}`,
          {
            cause: wrapped,
          },
        );
      }
      lastError = wrapped;
      await sleep(computeBackoffMs(retryDelayMs, attempt));
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(
    `Failed to fetch ${url}: ${lastError instanceof Error ? lastError.message : "unknown error"}`,
  );
}

function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isRetryableError(error) {
  const code = String(error?.cause?.code || error?.code || "").toUpperCase();
  if (["ETIMEDOUT", "ENETUNREACH", "ECONNRESET", "ECONNREFUSED", "EHOSTUNREACH", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"].includes(code)) {
    return true;
  }
  const message = String(error?.message || "").toLowerCase();
  return message.includes("timed out") || message.includes("timeout") || message.includes("fetch failed") || message.includes("socket");
}

function toFetchError(error, timeoutMs) {
  const code = String(error?.cause?.code || error?.code || "").toUpperCase();
  if (code === "ETIMEDOUT" || code === "UND_ERR_CONNECT_TIMEOUT") {
    return new Error(`request timed out after ${timeoutMs}ms`);
  }
  if (code) {
    return new Error(`${String(error?.message || "fetch failed")} (${code})`);
  }
  return error instanceof Error ? error : new Error(String(error));
}

function computeBackoffMs(baseDelayMs, attempt) {
  const exponential = baseDelayMs * 2 ** attempt;
  const jitter = Math.floor(Math.random() * Math.max(25, baseDelayMs / 4));
  return Math.min(20_000, exponential + jitter);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function createDispatcher(proxyUrl) {
  if (typeof proxyUrl === "string" && proxyUrl.trim()) {
    return new ProxyAgent(proxyUrl.trim());
  }
  return new Agent({ connect: { timeout: 20_000 } });
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(n)));
}
