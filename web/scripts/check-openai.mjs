#!/usr/bin/env node
/**
 * OpenAI API anahtarını ve gpt-4o erişimini test eder.
 * Kullanım: node scripts/check-openai.mjs
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
const apiKey = env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("❌ OPENAI_API_KEY eksik.");
  process.exit(1);
}

console.log("\nOpenAI kontrolü\n");
const openai = new OpenAI({ apiKey });

try {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "Return JSON: {\"ok\": true}" },
      { role: "user", content: "test" },
    ],
    max_tokens: 20,
  });
  console.log("✓ gpt-4o erişimi çalışıyor");
  console.log("  Yanıt:", completion.choices[0]?.message?.content);
  console.log("\n✅ OpenAI tamam.\n");
} catch (err) {
  console.log("✗ gpt-4o çağrısı başarısız");
  console.log("  Hata:", err?.status ?? "", err?.message ?? err);
  if (err?.code) console.log("  Kod:", err.code);
  console.log("");
  process.exit(1);
}
