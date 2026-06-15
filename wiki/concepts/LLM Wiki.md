---
tags:
  - llm
  - knowledge_base
  - concepts
type: concept
status: active
created: 2026-06-13
updated: 2026-06-13
---

LLM Wiki, bir dil modelinin ham kaynakları her sorguda yeniden keşfetmesi yerine, zaman içinde kalıcı ve bağlantılı bir Markdown bilgi tabanı derleyip bakımını yaptığı bilgi yönetimi yaklaşımıdır.

## Temel Model

Yaklaşım üç katmandan oluşur:

1. `raw/` değişmez kaynakların bulunduğu doğruluk katmanıdır.
2. `wiki/` LLM'nin kaynaklardan derlediği ve güncel tuttuğu bağlantılı bilgi katmanıdır.
3. `AGENTS.md` veya benzeri bir şema dosyası, agent'ın ingest, query ve lint davranışlarını tanımlar.

Bu modelde Obsidian görsel arayüz ve gezinme ortamı, LLM bakım yapan agent, wiki ise sürekli gelişen bilgi ürünü olarak çalışır. [[wiki/entities/Andrej Karpathy|Andrej Karpathy]] bu ilişkiyi yazılım geliştirme benzetmesiyle açıklar.

## RAG'den Farkı

Klasik Retrieval-Augmented Generation (RAG) akışında ilgili ham parçalar sorgu anında bulunur ve cevap yeniden oluşturulur. LLM Wiki yaklaşımında kaynaklar bir kez işlenerek var olan bilgiye entegre edilir; çapraz bağlantılar, sentezler ve çelişkiler sonraki sorgular için kalıcı hale gelir.

Bu, RAG'in her ölçekte gereksiz olduğu anlamına gelmez. Wiki büyüdüğünde yerel arama veya hibrit retrieval araçları yararlı olabilir.

## Operasyonlar

- **Ingest:** Yeni kaynağı özetler, kavram ve entity sayfalarına entegre eder.
- **Query:** Wiki üzerinden kaynaklı bir sentez üretir ve kalıcı değeri varsa geri yazar.
- **Lint:** Kırık bağlantıları, çelişkileri, eski iddiaları, yetim sayfaları ve bilgi boşluklarını arar.

## Tasarım İlkeleri

- Ham kaynaklar değişmez kalır.
- Türetilmiş bilgi kaynaklara kadar izlenebilir olur.
- Yeni bilgi mevcut sayfalara entegre edilir.
- Çelişkiler silinmez, görünür biçimde kaydedilir.
- İnsan kaynak seçimi ve yönlendirmeyi; LLM özetleme, bağlantılama ve bakımı üstlenir.

## Sources

- [[wiki/sources/Karpathy - LLM Wiki Gist]]

