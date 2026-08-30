import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_ORIGIN = "https://www.joson-care.com";
const SITEMAP_URL = `${SITE_ORIGIN}/sitemap.xml`;
const FEATURED_IDS = new Set(["30", "12", "40", "2"]);
const OUTPUT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../data/products.js");

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function fetchText(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "Joson-Care product catalog sync/1.0" },
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 500);
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError?.message || lastError}`);
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanText(value = "") {
  return decodeHtml(
    String(value)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<(?:br|\/p|\/li|\/div|\/tr|\/h[1-6])\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[\t\r ]+/g, " ")
    .replace(/ *\n+ */g, "\n")
    .trim();
}

function meta(html, property) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHtml(match[1]).trim();
  }
  return "";
}

function firstMatch(html, pattern) {
  const match = html.match(pattern);
  return match ? cleanText(match[1]) : "";
}

function unique(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function extractJsonLd(html) {
  const results = [];
  const pattern = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      results.push(JSON.parse(match[1].trim()));
    } catch {
      // Ignore malformed third-party structured data; HTML fields remain available.
    }
  }
  return results;
}

function extractHighlights(html) {
  const start = html.search(/<div[^>]+class=["'][^"']*name-box/i);
  const scoped = start >= 0 ? html.slice(start) : html;
  const summaryArticle = scoped.match(/<article[^>]+class=["'][^"']*editor[^"']*["'][^>]*>([\s\S]*?)<\/article>/i)?.[1] || "";
  const listItems = [...summaryArticle.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((match) => cleanText(match[1]));
  const headings = [...scoped.matchAll(/<h[3-5]\b[^>]*>([\s\S]*?)<\/h[3-5]>/gi)].map((match) => cleanText(match[1]));
  return unique([...listItems, ...headings])
    .filter((value) => value.length >= 2 && value.length <= 120)
    .slice(0, 24);
}

function extractSpecs(html) {
  const rows = [];
  for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    for (const row of table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cleanText(cell[1]));
      if (cells.length >= 2) {
        const label = cells[0].slice(0, 80);
        const value = cells.slice(1).join(" / ").slice(0, 240);
        if (label && value) rows.push({ label, value });
      }
    }
  }
  const seen = new Set();
  return rows.filter(({ label, value }) => {
    const key = `${label}\u0000${value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 40);
}

function parseProduct(url, html) {
  const parsedUrl = new URL(url);
  const jsonLd = extractJsonLd(html);
  const webPage = jsonLd.find((item) => item?.["@type"] === "WebPage") || {};
  const breadcrumbs = jsonLd.find((item) => item?.["@type"] === "BreadcrumbList")?.itemListElement || [];
  const model = firstMatch(html, /<span[^>]+id=["']productNO["'][^>]*>([\s\S]*?)<\/span>/i);
  let name = firstMatch(html, /<h1[^>]+class=["'][^"']*name[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
    || meta(html, "og:title")
    || String(webPage.name || "").split(" | ")[0];
  let subtitle = firstMatch(html, /<div[^>]+class=["'][^"']*subname[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  const rawSummary = meta(html, "og:description") || String(webPage.description || "");
  const summary = rawSummary.split(/Joson-Care\s*強盛興歷經/)[0].trim().slice(0, 900);
  const category = cleanText(breadcrumbs.at(-1)?.name || "產品介紹");
  const imageUrl = meta(html, "og:image") || String(webPage.image || "");
  const id = parsedUrl.searchParams.get("id") || "";
  const unavailable = !model;
  if (unavailable) {
    name = `官網產品 ${id}（資料未完整）`;
    subtitle = "官網頁面目前未提供繁中型號與名稱";
  }
  const slug = (model || `product-${id}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    id,
    slug,
    model,
    name,
    subtitle,
    category,
    summary,
    highlights: extractHighlights(html),
    specs: extractSpecs(html),
    imageUrl,
    sourceUrl: String(webPage.url || url).replace(/&amp;/g, "&"),
    featured: FEATURED_IDS.has(id),
    unavailable,
  };
}

async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

const sitemap = await fetchText(SITEMAP_URL);
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => decodeHtml(match[1]))
  .filter((url) => /product_d\.php\?lang=tw(?:&|$)/.test(url));

if (sitemapUrls.length !== 85) {
  throw new Error(`Expected 85 Traditional Chinese product pages, found ${sitemapUrls.length}. Review the sitemap before updating the snapshot.`);
}

const urls = unique(sitemapUrls);
const products = await mapConcurrent(urls, 5, async (url, index) => {
  const html = await fetchText(url);
  const product = parseProduct(url, html);
  console.log(`[${index + 1}/${urls.length}] ${product.model || product.id} ${product.name}`);
  return product;
});

const slugCounts = new Map();
for (const product of products) slugCounts.set(product.slug, (slugCounts.get(product.slug) || 0) + 1);
for (const product of products) {
  if ((slugCounts.get(product.slug) || 0) > 1 && !product.featured) product.slug = `${product.slug}-${product.id}`;
}

products.sort((left, right) => {
  if (left.featured !== right.featured) return left.featured ? -1 : 1;
  return (left.model || left.name).localeCompare(right.model || right.name, "zh-Hant");
});

const generatedAt = new Date().toISOString();
const generated = `// Generated by scripts/sync-products.mjs on ${generatedAt}.\n`
  + `// Source: ${SITEMAP_URL}\n`
  + `export const CATALOG_GENERATED_AT = ${JSON.stringify(generatedAt)};\n`
  + `export const PRODUCTS = Object.freeze(${JSON.stringify(products, null, 2)});\n`;

await mkdir(dirname(OUTPUT_PATH), { recursive: true });
await writeFile(OUTPUT_PATH, generated, "utf8");
console.log(`Wrote ${products.length} products to ${OUTPUT_PATH}`);
