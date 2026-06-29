#!/usr/bin/env node
/**
 * Ortam değişkenlerinin dolu olup olmadığını kontrol eder.
 * Kullanım: node scripts/check-env.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

const REQUIRED = {
  clerk: [
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
  ],
  supabase: [
    "NEXT_PUBLIC_SUPABASE_URL",
    ["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    "SUPABASE_SERVICE_ROLE_KEY",
  ],
};

const RECOMMENDED = {
  openai: ["OPENAI_API_KEY"],
};

const OPTIONAL = {
  firecrawl: ["FIRECRAWL_API_KEY"],
  oauth: [
    "INSTAGRAM_CLIENT_ID",
    "FACEBOOK_CLIENT_ID",
    "LINKEDIN_CLIENT_ID",
  ],
};

function parseEnv(content) {
  const vars = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    vars[key] = value;
  }
  return vars;
}

function checkGroup(label, keys, vars, level) {
  const missing = keys.filter((k) => {
    if (Array.isArray(k)) {
      return !k.some((alt) => vars[alt]);
    }
    return !vars[k];
  }).flatMap((k) => (Array.isArray(k) ? k : [k]));
  const ok = missing.length === 0;
  const icon = level === "required" ? "🔴" : level === "recommended" ? "🟡" : "⚪";
  const status = ok ? "✓" : "✗";
  console.log(`${icon} ${label}: ${status}`);
  if (!ok) {
    for (const k of missing) console.log(`     eksik: ${k}`);
  }
  return ok;
}

if (!existsSync(envPath)) {
  console.error("❌ .env.local bulunamadı.");
  console.error("   Çalıştır: npm run setup");
  process.exit(1);
}

const vars = parseEnv(readFileSync(envPath, "utf8"));

console.log("\nTicosclaw ortam kontrolü\n");

let allRequired = true;
for (const [label, keys] of Object.entries(REQUIRED)) {
  if (!checkGroup(label, keys, vars, "required")) allRequired = false;
}
for (const [label, keys] of Object.entries(RECOMMENDED)) {
  checkGroup(label, keys, vars, "recommended");
}
for (const [label, keys] of Object.entries(OPTIONAL)) {
  checkGroup(label, keys, vars, "optional");
}

console.log("");
if (!allRequired) {
  console.log("Minimum kurulum için Clerk + Supabase key'lerini doldurun.");
  console.log("Rehber: web/KURULUM.md\n");
  process.exit(1);
}

console.log("✅ Zorunlu değişkenler tamam. npm run dev ile başlatabilirsiniz.\n");
