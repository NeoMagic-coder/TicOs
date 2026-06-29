#!/usr/bin/env node
/**
 * Marka analizi akışını (scrape + OpenAI) izole test eder.
 * Kullanım: node scripts/check-analyze.mjs <url>
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

function parseEnv(content) {
  const vars = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return vars;
}

const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {};
const url = process.argv[2] || "https://www.trendyol.com";

async function scrapeUrl(target) {
  const firecrawlKey = env.FIRECRAWL_API_KEY;
  if (firecrawlKey) {
    console.log("→ Firecrawl ile taranıyor...");
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${firecrawlKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: target, formats: ["markdown"] }),
      });
      if (res.ok) {
        const data = await res.json();
        const md = data.data?.markdown ?? data.markdown ?? "";
        console.log(`  Firecrawl OK (${md.length} karakter)`);
        return md;
      }
      console.log(`  Firecrawl başarısız: HTTP ${res.status} — direkt fetch'e düşülüyor`);
    } catch (e) {
      console.log(`  Firecrawl hata: ${e.message} — direkt fetch'e düşülüyor`);
    }
  } else {
    console.log("→ Firecrawl yok, direkt fetch...");
  }

  const pageRes = await fetch(target, { headers: { "User-Agent": "TicosclawBot/1.0" } });
  const html = await pageRes.text();
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 8000);
  console.log(`  Direkt fetch OK (${text.length} karakter)`);
  return text;
}

console.log(`\nMarka analizi testi: ${url}\n`);

try {
  const content = await scrapeUrl(url);
  if (!content || content.length < 50) {
    console.log(`\n⚠ Uyarı: çok az içerik alındı (${content.length} karakter). Site botu engelliyor olabilir.`);
  }

  console.log("→ OpenAI gpt-4o ile analiz ediliyor...");
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Analyze the website content and return a brand voice profile as JSON with keys:
tone (string[]), personality (string[]), wordPreferences ({preferred: string[], avoid: string[]}),
audience (string), colors (string[] hex), fonts (string[]), summary (string, 2-3 sentences in Turkish).`,
      },
      { role: "user", content: `Website URL: ${url}\n\nContent:\n${content}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const profile = JSON.parse(raw);
  console.log("\n✅ Analiz başarılı. Özet:");
  console.log("  " + (profile.summary ?? "(özet yok)"));
  console.log("");
} catch (err) {
  console.log("\n✗ Analiz başarısız");
  console.log("  Hata:", err?.status ?? "", err?.message ?? err);
  console.log("");
  process.exit(1);
}
