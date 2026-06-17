# AutoResearch Recipe: Dynamic Pricing Optimization

## Goal & Metrics
- Target Metric: `expected_revenue_lift_pct`
- Mode: `maximize`
- Base Prompt: "Dynamic Pricing Agent: Dün için rakip fiyat, talep ve stok sinyallerinden hareketle fiyat ayarı önerisi ver ve tahmini ciro artışını (% expected_revenue_lift_pct) hesapla."

## Instructions
1. Baseline: Başlangıç olarak varsayılan parametreler (epsilon=0.10, max_price_change_pct=5.0) ile çalıştır ve taban başarı değerini hesapla.
2. Exploratory: Epsilon değerini artırarak (örn. epsilon=0.25) yeni fiyat arama alanını genişlet ve bunun ciro üzerindeki etkisini izle.
3. Exploitative: Epsilon değerini düşürerek (örn. epsilon=0.02) ve fiyat değişim sınırını daraltarak stabil fiyatlandırma denemesi yap.
4. Final Selection: En yüksek ciro artışını (expected_revenue_lift_pct) sağlayan parametre grubunu seç ve nihai raporu yazdır.
