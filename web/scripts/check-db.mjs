#!/usr/bin/env node
/**
 * Supabase bağlantısını ve tabloların varlığını kontrol eder.
 * Kullanım: node scripts/check-db.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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

if (!existsSync(envPath)) {
  console.error("❌ .env.local bulunamadı.");
  process.exit(1);
}

const env = parseEnv(readFileSync(envPath, "utf8"));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik.");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const TABLES = [
  "users",
  "brands",
  "team_members",
  "conversations",
  "content_ideas",
  "automations",
  "integrations",
  "generated_images",
  "goals",
  "usage_limits",
];

console.log("\nSupabase veritabanı kontrolü\n");
console.log(`URL: ${url}\n`);

let missing = 0;
for (const table of TABLES) {
  // Gerçek sorgu kullan — head:true select tablo yoksa bile hata vermeyebilir.
  const { error } = await supabase.from(table).select("*").limit(1);
  if (error) {
    missing++;
    console.log(`✗ ${table.padEnd(18)} — ${error.message}`);
  } else {
    console.log(`✓ ${table}`);
  }
}

console.log("");
if (missing > 0) {
  console.log(`❌ ${missing} tablo eksik veya erişilemiyor.`);
  console.log("   Çözüm: supabase/migrations/001_initial_schema.sql dosyasını");
  console.log("   Supabase Dashboard → SQL Editor'da çalıştırın.\n");
  process.exit(1);
}

console.log("✅ Tüm tablolar mevcut ve erişilebilir.\n");
