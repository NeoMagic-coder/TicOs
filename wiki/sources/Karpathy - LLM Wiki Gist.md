---
tags:
  - llm_wiki
  - knowledge_base
  - source
type: source
status: active
author: Andrej Karpathy
source_url: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
published: 2026-04-04
ingested: 2026-06-13
created: 2026-06-13
updated: 2026-06-13
---

Andrej Karpathy'nin gist'i, LLM'lerin ham belgeleri yalnızca sorgu anında bulup özetlemesi yerine, kalıcı ve bağlantılı bir wiki'yi aşamalı olarak derleyip sürdürmesini önerir.

## Ana Tez

Wiki, her kaynak ve sorguyla zenginleşen kalıcı bir artefakttır. Daha önce kurulmuş bağlantılar, tespit edilmiş çelişkiler ve oluşmuş sentezler sonraki çalışmalarda tekrar kullanılabilir.

## Mimari

- **Raw sources:** LLM'nin okuduğu ancak değiştirmediği doğruluk kaynağı.
- **Wiki:** LLM'nin sahip olduğu ve bakımını yaptığı Markdown sayfaları.
- **Schema:** Wiki yapısını, kurallarını ve operasyonlarını tanımlayan agent talimatları.

## Operasyonlar

- **Ingest:** Kaynağı okur, özetler, ilgili sayfaları ve bağlantıları günceller, log'a yazar.
- **Query:** Wiki içinden kaynaklı sentez üretir; değerli sonuçları wiki'ye geri kaydedebilir.
- **Lint:** Çelişki, eski iddia, yetim sayfa, eksik bağlantı ve bilgi boşluklarını arar.

## Dikkat Çeken Uygulama Notları

- `index.md`, wiki içeriğinin kategori bazlı kataloğudur ve sorgularda ilk okunacak dosyadır.
- `log.md`, ingest, query ve lint işlemlerinin append-only kronolojik kaydıdır.
- Obsidian Web Clipper, Graph View, Dataview ve Marp isteğe bağlı yardımcı araçlardır.
- Wiki büyüdüğünde yerel Markdown arama araçları eklenebilir.

## Sınırlar ve Açık Kararlar

Gist kasıtlı olarak soyuttur. Kesin klasör yapısı, sayfa şeması, araçlar ve insan denetimi düzeyi kullanım alanına göre belirlenmelidir. Bu vault, genel amaçlı bir başlangıç şeması seçer.

## Raw Source

- [[raw/Karpathy LLM Wiki Gist|Karpathy LLM Wiki Gist kaynak işaretçisi]]

## Related Notes

- [[wiki/concepts/LLM Wiki]]
- [[wiki/entities/Andrej Karpathy]]

