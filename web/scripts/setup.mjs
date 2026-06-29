#!/usr/bin/env node
/**
 * .env.local yoksa .env.example'dan kopyalar.
 */
import { copyFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const example = resolve(root, ".env.example");
const local = resolve(root, ".env.local");

if (existsSync(local)) {
  console.log("✓ .env.local zaten mevcut — üzerine yazılmadı.");
} else {
  copyFileSync(example, local);
  console.log("✓ .env.local oluşturuldu (.env.example'dan kopyalandı).");
}

console.log("\nSonraki adımlar:");
console.log("  1. .env.local dosyasına Clerk, Supabase ve OpenAI key'lerini ekleyin");
console.log("  2. npm run setup:check  — eksik key'leri kontrol edin");
console.log("  3. npm run dev          — geliştirme sunucusunu başlatın");
console.log("\nDetaylı rehber: KURULUM.md\n");
