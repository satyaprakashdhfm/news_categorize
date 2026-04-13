#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { scrapeWebsite } from "./scraper.mjs";

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.url) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const actions = await maybeLoadActions(args.actionsFile);

  const result = await scrapeWebsite({
    url: args.url,
    mode: args.mode,
    format: args.format,
    timeoutMs: toNumber(args.timeoutMs),
    httpRetries: toNumber(args.httpRetries),
    httpRetryDelayMs: toNumber(args.httpRetryDelayMs),
    maxChars: toNumber(args.maxChars),
    includeHtml: toBoolean(args.includeHtml),
    headless: toBoolean(args.headless, true),
    browserPath: args.browserPath,
    userAgent: args.userAgent,
    proxyUrl: args.proxyUrl,
    screenshotPath: args.screenshot,
    postActionWaitMs: toNumber(args.postActionWaitMs),
    actions,
  });

  const output = JSON.stringify(result, null, 2);

  if (args.out) {
    const outPath = path.resolve(process.cwd(), args.out);
    await fs.writeFile(outPath, `${output}\n`, "utf8");
    process.stdout.write(`Saved output to ${outPath}\n`);
    return;
  }

  process.stdout.write(`${output}\n`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = "true";
    }
  }
  return args;
}

async function maybeLoadActions(actionsFile) {
  if (!actionsFile) {
    return undefined;
  }
  const raw = await fs.readFile(path.resolve(process.cwd(), actionsFile), "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("actions file must be a JSON array");
  }
  return parsed;
}

function toNumber(value) {
  if (value === undefined) {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }
  const normalized = String(value).toLowerCase().trim();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function printHelp() {
  process.stdout.write(`
Satya Scraper (standalone)

Usage:
  node src/cli.mjs --url <https://...> [options]

Options:
  --url <value>              Required target URL
  --mode <browser|http>      Scrape via Playwright browser or plain HTTP (default: browser)
  --format <markdown|text>   Output format (default: markdown)
  --actions-file <path>      JSON array of page actions (click/type/wait)
  --postActionWaitMs <n>     Wait after actions before extract
  --timeoutMs <n>            Timeout per request/navigation (default: 30000)
  --httpRetries <n>          HTTP mode retry attempts on network/server errors (default: 2)
  --httpRetryDelayMs <n>     Base retry delay in ms for HTTP mode (default: 750)
  --maxChars <n>             Max output chars for text/html (default: 20000)
  --includeHtml <bool>       Include raw HTML in output (default: false)
  --headless <bool>          Run browser headless (default: true)
  --browserPath <path>       Optional browser executable path
  --proxyUrl <url>           Optional HTTP proxy URL
  --userAgent <value>        Optional user agent override
  --screenshot <path>        Save full-page screenshot
  --out <path>               Save JSON output to file
  --help                     Show this help

Example:
  node src/cli.mjs --url https://news.ycombinator.com --mode browser --format text --out output.json
`);
}

main().catch((error) => {
  process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
