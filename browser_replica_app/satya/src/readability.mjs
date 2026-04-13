const HIDDEN_STYLE_PATTERNS = [
  ["display", /^\s*none\s*$/i],
  ["visibility", /^\s*hidden\s*$/i],
  ["opacity", /^\s*0\s*$/],
  ["font-size", /^\s*0(px|em|rem|pt|%)?\s*$/i],
  ["text-indent", /^\s*-\d{4,}px\s*$/],
  ["color", /^\s*transparent\s*$/i],
  ["color", /^\s*rgba\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0(?:\.0+)?\s*\)\s*$/i],
  ["color", /^\s*hsla\s*\(\s*[\d.]+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*0(?:\.0+)?\s*\)\s*$/i],
];

const HIDDEN_CLASS_NAMES = new Set([
  "sr-only",
  "visually-hidden",
  "d-none",
  "hidden",
  "invisible",
  "screen-reader-only",
  "offscreen",
]);

const INVISIBLE_UNICODE_RE =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u206A-\u206F\uFEFF\u{E0000}-\u{E007F}]/gu;

let depsPromise;

async function loadDeps() {
  if (!depsPromise) {
    depsPromise = Promise.all([import("@mozilla/readability"), import("linkedom")]).then(
      ([readability, linkedom]) => ({
        Readability: readability.Readability,
        parseHTML: linkedom.parseHTML,
      }),
    );
  }
  try {
    return await depsPromise;
  } catch (error) {
    depsPromise = undefined;
    throw error;
  }
}

export async function extractReadableContent({ html, url, mode = "markdown" }) {
  const cleanHtml = await sanitizeHtml(html);

  try {
    const { Readability, parseHTML } = await loadDeps();
    const { document } = parseHTML(cleanHtml);
    try {
      document.baseURI = url;
    } catch {
      // Best effort only.
    }
    const reader = new Readability(document, { charThreshold: 0 });
    const parsed = reader.parse();
    if (!parsed || !parsed.content) {
      return fallbackReadable(cleanHtml, mode);
    }

    if (mode === "text") {
      const text = stripInvisibleUnicode(normalizeWhitespace(parsed.textContent || ""));
      if (text) {
        return { text, title: parsed.title || undefined };
      }
      return fallbackReadable(cleanHtml, mode);
    }

    const rendered = htmlToMarkdown(parsed.content);
    return {
      text: stripInvisibleUnicode(rendered.text),
      title: parsed.title || rendered.title,
    };
  } catch {
    return fallbackReadable(cleanHtml, mode);
  }
}

function fallbackReadable(cleanHtml, mode) {
  const rendered = htmlToMarkdown(cleanHtml);
  if (mode === "text") {
    return {
      text: stripInvisibleUnicode(markdownToText(rendered.text) || normalizeWhitespace(stripTags(cleanHtml))),
      title: rendered.title,
    };
  }
  return {
    text: stripInvisibleUnicode(rendered.text),
    title: rendered.title,
  };
}

export function htmlToMarkdown(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? normalizeWhitespace(stripTags(titleMatch[1])) : undefined;
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  text = text.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, body) => {
    const label = normalizeWhitespace(stripTags(body));
    return label ? `[${label}](${href})` : href;
  });

  text = text.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, body) => {
    const prefix = "#".repeat(Math.max(1, Math.min(6, Number.parseInt(level, 10))));
    const label = normalizeWhitespace(stripTags(body));
    return `\n${prefix} ${label}\n`;
  });

  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, body) => {
    const label = normalizeWhitespace(stripTags(body));
    return label ? `\n- ${label}` : "";
  });

  text = text
    .replace(/<(br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|header|footer|table|tr|ul|ol)>/gi, "\n");

  text = stripTags(text);
  text = normalizeWhitespace(text);
  return { text, title };
}

export function markdownToText(markdown) {
  let text = String(markdown || "");
  text = text.replace(/!\[[^\]]*]\([^)]+\)/g, "");
  text = text.replace(/\[([^\]]+)]\([^)]+\)/g, "$1");
  text = text.replace(/```[\s\S]*?```/g, (block) =>
    block.replace(/```[^\n]*\n?/g, "").replace(/```/g, ""),
  );
  text = text.replace(/`([^`]+)`/g, "$1");
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/^\s*[-*+]\s+/gm, "");
  text = text.replace(/^\s*\d+\.\s+/gm, "");
  return normalizeWhitespace(text);
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/gi, (_, dec) => String.fromCharCode(Number.parseInt(dec, 10)));
}

function stripTags(value) {
  return decodeEntities(String(value || "").replace(/<[^>]+>/g, ""));
}

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function hasHiddenClass(className) {
  const classes = String(className || "").toLowerCase().split(/\s+/);
  return classes.some((cls) => HIDDEN_CLASS_NAMES.has(cls));
}

function isStyleHidden(style) {
  for (const [prop, pattern] of HIDDEN_STYLE_PATTERNS) {
    const escapedProp = prop.replace(/-/g, "\\-");
    const match = style.match(new RegExp(`(?:^|;)\\s*${escapedProp}\\s*:\\s*([^;]+)`, "i"));
    if (match && pattern.test(match[1])) {
      return true;
    }
  }
  return false;
}

function shouldRemoveElement(element) {
  const tagName = element.tagName.toLowerCase();
  if (["meta", "template", "svg", "canvas", "iframe", "object", "embed"].includes(tagName)) {
    return true;
  }
  if (tagName === "input" && element.getAttribute("type")?.toLowerCase() === "hidden") {
    return true;
  }
  if (element.getAttribute("aria-hidden") === "true") {
    return true;
  }
  if (element.hasAttribute("hidden")) {
    return true;
  }
  if (hasHiddenClass(element.getAttribute("class"))) {
    return true;
  }
  const style = element.getAttribute("style") || "";
  return Boolean(style && isStyleHidden(style));
}

async function sanitizeHtml(html) {
  let sanitized = String(html || "").replace(/<!--[\s\S]*?-->/g, "");
  try {
    const { parseHTML } = await import("linkedom");
    const { document } = parseHTML(sanitized);
    const all = Array.from(document.querySelectorAll("*"));
    for (let i = all.length - 1; i >= 0; i -= 1) {
      const el = all[i];
      if (shouldRemoveElement(el)) {
        el.parentNode?.removeChild(el);
      }
    }
    sanitized = document.toString();
  } catch {
    return sanitized;
  }
  return sanitized;
}

function stripInvisibleUnicode(text) {
  return String(text || "").replace(INVISIBLE_UNICODE_RE, "");
}
