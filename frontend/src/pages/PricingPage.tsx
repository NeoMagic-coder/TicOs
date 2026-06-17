// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Icon, AgentAvatar } from '@/components/AOS/widgets';
import { AGENT_BY_ID } from '@/data/aos/mockData';
import { useStore } from '@/stores/useStore';

import { useAdaptedPricingSkus } from '@/lib/aos/adapter';
import { pushToast } from '@/components/AOS/Toast';
import { BASE_URL } from '@/lib/api';

const PricingPage = () => {
  const SKUS_DATA = useAdaptedPricingSkus();
  const hasSkus = SKUS_DATA.length > 0;
  const econ = useStore((s: any) => s.productEconomics);
  const product = useStore((s: any) => s.onboardedProduct);
  const quickAsk = useStore((s: any) => s.quickAsk);
  const regenerateProductEconomics = useStore((s: any) => s.regenerateProductEconomics);
  const productEconomicsLoading = useStore((s: any) => s.productEconomicsLoading);
  const productEconomicsError = useStore((s: any) => s.productEconomicsError);
  const [watched, setWatched] = useState<Record<string, boolean>>({});
  const [applied, setApplied] = useState<Record<string, boolean>>({});
  // Live CollectAPI finance widgets (FX + BIST).
  const [fx, setFx] = useState<{ rates: any[]; lastupdate?: string; degraded?: boolean } | null>(null);
  const [bist, setBist] = useState<{ stocks: any[]; degraded?: boolean } | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState<string | null>(null);

  const loadFinance = async () => {
    setFinanceLoading(true);
    setFinanceError(null);
    try {
      const fxUrl = `${BASE_URL}/api/v1/pricing/fx?base=USD&amount=1&targets=TRY&targets=EUR&targets=GBP&targets=JPY`;
      const bistUrl = `${BASE_URL}/api/v1/pricing/bist?codes=THYAO&codes=AKBNK&codes=ASELS&codes=SISE&codes=BIMAS&limit=5`;
      const [fxRes, bistRes] = await Promise.all([
        fetch(fxUrl, { signal: AbortSignal.timeout(15000) }),
        fetch(bistUrl, { signal: AbortSignal.timeout(15000) }),
      ]);
      if (fxRes.ok) {
        const data = await fxRes.json();
        const out = data?.output || {};
        setFx({ rates: out.rates || [], lastupdate: out.lastupdate, degraded: data?.status !== 'success' });
      }
      if (bistRes.ok) {
        const data = await bistRes.json();
        const out = data?.output || {};
        setBist({ stocks: out.stocks || [], degraded: data?.status !== 'success' });
      }
    } catch (e: any) {
      setFinanceError(e?.message || String(e));
    } finally {
      setFinanceLoading(false);
    }
  };

  useEffect(() => {
    loadFinance();
    // refresh every 5 minutes
    const t = setInterval(loadFinance, 300_000);
    return () => clearInterval(t);
  }, []);

  // True when at least one SKU has a real (backend-sourced) competitor scan
  // result. The previous version always rendered competitor bands using a
  // ±20% formula and called the chart "REKABET BANDI · CANLI" regardless.
  const hasRealCompetitors = SKUS_DATA.some((s: any) => s.competitors_source === 'backend');
  const hasRealSuggestions = SKUS_DATA.some((s: any) => s.suggested_source === 'backend');

  const setProductEconomics = useStore((s: any) => s.setProductEconomics);
  const scanCompetitors = async () => {
    try {
      const productKeyword = product?.product_name || '';
      const items = SKUS_DATA.map((s: any) => ({
        sku: s.sku,
        // Compose a CollectAPI-friendly query: product name + variant title.
        // Without a real keyword the marketplace search returns ~nothing.
        query: [productKeyword, s.name].filter(Boolean).join(' ').trim() || s.sku,
      }));
      const res = await fetch(`${BASE_URL}/api/v1/pricing/scan-competitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, source: 'trendyol', limit: 12 }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const output = data?.output || {};
      const measuredAt: string | null = output.measured_at || null;
      const results: any[] = Array.isArray(output.results) ? output.results : [];
      const degraded = !!output.degraded;
      // Merge results into productEconomics so the adapter reflects
      // competitors_source = 'backend' for SKUs the scan covered.
      const currentEcon = useStore.getState().productEconomics;
      if (currentEcon && results.length && setProductEconomics) {
        const bySku: Record<string, any> = {};
        for (const r of results) if (r?.sku) bySku[r.sku] = r;
        const rows = currentEcon.rows.map((row: any, i: number) => {
          // Match by adapter-generated SKU index (same algorithm as adapter).
          const skuKey = SKUS_DATA[i]?.sku;
          const found = skuKey ? bySku[skuKey] : null;
          if (!found) return row;
          // Only adopt backend numbers when the response carries real samples.
          const samples = typeof found.samples === 'number' ? found.samples : 0;
          if (samples > 0 && typeof found.avg === 'number') {
            return {
              ...row,
              competitors: { avg: found.avg, min: found.min, max: found.max },
              competitors_measured_at: measuredAt,
              competitors_samples: samples,
            };
          }
          // Real call but no samples — keep heuristic band; just stamp the
          // scan attempt so UI can show "son tarama X sn önce".
          return { ...row, competitors_measured_at: measuredAt, competitors_samples: 0 };
        });
        setProductEconomics({ ...currentEcon, rows });
      }
      const measuredAge = measuredAt ? new Date(measuredAt).toLocaleTimeString('tr-TR', { hour12: false }) : null;
      pushToast({
        kind: degraded ? 'warn' : 'success',
        title: degraded ? 'Tarama mock\'a düştü' : 'Rakip taraması bitti',
        body: measuredAge ? `Ölçüm: ${measuredAge} · ${results.length} SKU` : 'Yanıt boş',
      });
    } catch (e: any) {
      quickAsk('Aktif ürünün tüm SKU\'ları için rakip fiyat taraması yap, sapanları işaretle ve önerilen aksiyonları listele.');
      pushToast({ kind: 'info', title: 'TicOSClaw üzerinden taranıyor', body: e?.message || String(e) });
    }
  };
  const applyAll = async () => {
    const pending = SKUS_DATA.filter((s: any) => s.suggested !== s.price && !applied[s.sku]);
    if (!pending.length) {
      pushToast({ kind: 'info', title: 'Uygulanacak öneri yok', body: 'Tüm fiyatlar zaten optimal.' });
      return;
    }
    if (!confirm(`${pending.length} SKU için fiyat değişikliği önerisini onay sırasına koy?`)) return;
    try {
      const res = await fetch(`${BASE_URL}/api/v1/pricing/apply-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku_prices: pending.map((p: any) => ({ sku: p.sku, new_price: p.suggested })),
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        pushToast({ kind: 'success', title: 'Onay sırasına eklendi', body: `${data?.queued ?? pending.length} SKU` });
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e: any) {
      quickAsk(`Aşağıdaki SKU'lar için fiyat önerilerini uygulamak üzere her biri için yüksek-riskli onay aç: ${pending.map((p: any) => p.sku).join(', ')}.`);
      pushToast({ kind: 'info', title: 'TicOSClaw üzerinden uygulanıyor', body: e?.message || String(e) });
    }
    setApplied((prev) => pending.reduce((acc: any, p: any) => ({ ...acc, [p.sku]: true }), prev));
  };
  const applyOne = (sku: any) => {
    quickAsk(`${sku.sku} için fiyatı ₺${sku.price}'den ₺${sku.suggested}'ye değiştirmek üzere onay aç (gerekçeyle birlikte).`);
    setApplied((p) => ({ ...p, [sku.sku]: true }));
  };
  const watchOne = (sku: any) => {
    setWatched((p) => ({ ...p, [sku.sku]: !p[sku.sku] }));
    pushToast({ kind: 'info', title: watched[sku.sku] ? 'İzleme kaldırıldı' : 'İzlemeye eklendi', body: sku.name });
  };
  const avgMarginNum = SKUS_DATA.length ? SKUS_DATA.reduce((s: number, x: any) => s + x.margin, 0) / SKUS_DATA.length : 0;
  const openSuggestions = SKUS_DATA.filter((x: any) => x.suggested !== x.price).length;
  // Projected uplift is only meaningful when we have real sales-volume data.
  // Without sales_30d the multiplication trivially returns 0, which we now
  // surface as "—" rather than a confident "₺0".
  const hasSalesData = SKUS_DATA.some((s: any) => (s.sales_30d || 0) > 0);
  const projectedRevenue = hasSalesData
    ? SKUS_DATA.reduce((acc: number, x: any) => acc + Math.max(0, (x.suggested - x.price) * (x.sales_30d || 0) / 4), 0)
    : null;
  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> FİYAT & FİNANS</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            Fiyat & Finans
            <span className="page__title-tag">DYNAMIC PRICING</span>
            {hasSkus && (
              <span className={`chip chip--${hasRealSuggestions || hasRealCompetitors ? 'acid' : 'amber'}`} style={{ background: 'transparent' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: hasRealSuggestions || hasRealCompetitors ? 'var(--acid)' : 'var(--amber)' }} />
                {hasRealSuggestions || hasRealCompetitors ? 'CANLI VERİ' : 'TAHMİNİ'}
              </span>
            )}
          </h1>
          <p className="page__sub">
            SKU bazlı rekabetçi fiyat penceresi, marj durumu ve dinamik öneriler.
            {hasSkus && !hasRealCompetitors && (
              <span className="mono" style={{ marginLeft: 8, fontSize: 10, color: 'var(--amber)' }}>
                · rakip bandı tahmini (±5–25% heuristic) — gerçek değerler için "Rakip Taraması"
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost" onClick={scanCompetitors} disabled={productEconomicsLoading}>
            <Icon name="refresh" size={12} /> {productEconomicsLoading ? 'Taranıyor…' : 'Rakip Taraması'}
          </button>
          <button className="btn btn--primary" onClick={applyAll}>
            <Icon name="zap" size={12} /> Tüm Önerileri Uygula
          </button>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1, background: 'var(--border-faint)',
        border: '1px solid var(--border)', borderRadius: 6,
        marginBottom: 16, overflow: 'hidden',
      }}>
        {[
          { l: 'Açık Öneriler',   v: hasSkus ? String(openSuggestions) : '—', sub: hasRealSuggestions ? 'backend pricing_agent' : (openSuggestions ? 'heuristic · backend onayı yok' : 'tüm fiyatlar optimal') },
          { l: 'Ortalama Marj',   v: hasSkus ? (avgMarginNum * 100).toFixed(1) + '%' : '—', sub: 'hedef 40%', color: hasSkus ? (avgMarginNum >= 0.4 ? 'var(--acid)' : 'var(--amber)') : 'var(--fg-3)' },
          { l: 'LTV / Müşteri',   v: econ?.ltv_per_customer ? '₺' + econ.ltv_per_customer.toLocaleString('tr-TR') : '—', sub: (econ?.total_customers ?? 0) + ' müşteri' },
          { l: 'Tahmini Gelir +', v: projectedRevenue != null ? '+₺' + Math.round(projectedRevenue).toLocaleString('tr-TR') : '—', sub: projectedRevenue != null ? 'haftalık · öneriler uygulanırsa' : 'satış verisi yok', color: projectedRevenue != null ? 'var(--acid)' : 'var(--fg-3)' },
        ].map(s => (
          <div key={s.l} style={{ padding: '12px 16px', background: 'var(--bg-1)' }}>
            <div className="label-eyebrow" style={{ marginBottom: 4 }}>{s.l}</div>
            <div className="tnum" style={{ fontSize: 20, fontWeight: 500, color: s.color || 'var(--fg-1)' }}>{s.v}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel__head">
          <h3>Canlı Finans — CollectAPI</h3>
          <span className="panel__head-tag">
            {financeLoading ? 'YÜKLENİYOR' : fx?.degraded || bist?.degraded ? 'MOCK · DEGRADED' : 'CANLI'}
          </span>
          <button
            className="btn btn--sm btn--ghost"
            onClick={loadFinance}
            disabled={financeLoading}
            style={{ marginLeft: 'auto' }}
          >
            <Icon name="refresh" size={11} /> Yenile
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border-faint)' }}>
          {/* FX */}
          <div style={{ background: 'var(--bg-1)', padding: '12px 16px' }}>
            <div className="label-eyebrow" style={{ marginBottom: 6 }}>
              USD → TRY / EUR / GBP / JPY
              {fx?.lastupdate && (
                <span className="mono" style={{ marginLeft: 8, fontSize: 9, color: 'var(--fg-3)' }}>
                  {fx.lastupdate}
                </span>
              )}
            </div>
            {fx?.rates?.length ? (
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                {fx.rates.map((r: any) => (
                  <div key={r.code} style={{ minWidth: 90 }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                      1 USD → {r.code}
                    </div>
                    <div className="tnum" style={{ fontSize: 15, fontWeight: 500 }}>
                      {typeof r.calculated === 'number' ? r.calculated.toFixed(2) : r.calculatedstr || r.rate}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                {financeError ? `Hata: ${financeError}` : 'Veri yok'}
              </div>
            )}
          </div>
          {/* BIST */}
          <div style={{ background: 'var(--bg-1)', padding: '12px 16px' }}>
            <div className="label-eyebrow" style={{ marginBottom: 6 }}>BIST · seçili hisseler</div>
            {bist?.stocks?.length ? (
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {bist.stocks.slice(0, 5).map((s: any) => {
                  const rate = typeof s.rate === 'number' ? s.rate : 0;
                  const color = rate > 0 ? 'var(--acid)' : rate < 0 ? 'var(--rose)' : 'var(--fg-3)';
                  return (
                    <div key={s.code} style={{ minWidth: 90 }}>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{s.code}</div>
                      <div className="tnum" style={{ fontSize: 14, fontWeight: 500 }}>
                        ₺{s.lastpricestr || s.lastprice}
                      </div>
                      <div className="mono" style={{ fontSize: 10, color }}>
                        {rate > 0 ? '↑' : rate < 0 ? '↓' : '·'} {Math.abs(rate).toFixed(2)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                {financeError ? `Hata: ${financeError}` : 'Veri yok'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h3>SKU Fiyat Penceresi</h3>
          <span className="panel__head-tag">
            REKABET BANDI · {hasRealCompetitors ? 'CANLI' : 'TAHMİNİ'}
          </span>
        </div>
        {!hasSkus && (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 8 }}>
              ╭─ ürün ekonomisi yok ─╮
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 14 }}>
              {product
                ? `"${product.product_name}" için fiyat/maliyet/satış verisi henüz hesaplanmadı.`
                : 'Önce bir ürün onboard et.'}
            </div>
            {productEconomicsError && (
              <div className="mono" style={{ fontSize: 10, color: 'var(--rose)', marginBottom: 12 }}>
                {productEconomicsError}
              </div>
            )}
            {product && (
              <button className="btn btn--primary" onClick={() => regenerateProductEconomics()} disabled={productEconomicsLoading}>
                <Icon name="zap" size={12} /> {productEconomicsLoading ? 'Hesaplanıyor…' : 'Ürün Ekonomisini Üret'}
              </button>
            )}
          </div>
        )}
        {hasSkus && (
          <div className="row" style={{
            gridTemplateColumns: '1.5fr 1fr 1fr 240px 1fr 110px',
            background: 'var(--bg-2)',
            padding: '8px 16px',
          }}>
            <span className="label-eyebrow">SKU</span>
            <span className="label-eyebrow">Fiyat</span>
            <span className="label-eyebrow">Marj</span>
            <span className="label-eyebrow">Rakip Bandı {hasRealCompetitors ? '' : '(tahmini)'}</span>
            <span className="label-eyebrow">Öneri</span>
            <span className="label-eyebrow">Aksiyon</span>
          </div>
        )}
        {SKUS_DATA.map((s: any) => {
          const change = s.suggested - s.price;
          const changePct = ((change / s.price) * 100).toFixed(1);
          const bandMin = Math.min(s.competitors.min, s.price) - 20;
          const bandMax = Math.max(s.competitors.max, s.price) + 20;
          const bandRange = bandMax - bandMin;
          const pos = (v) => ((v - bandMin) / bandRange) * 100;
          return (
            <div key={s.sku} className="row" style={{
              gridTemplateColumns: '1.5fr 1fr 1fr 240px 1fr 110px',
              padding: '14px 16px',
            }}>
              <div>
                <div style={{ fontSize: 13 }}>{s.name}</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{s.sku}</div>
              </div>
              <div>
                <span className="tnum" style={{ fontSize: 14, fontWeight: 500 }}>₺{s.price}</span>
              </div>
              <div>
                <span className="tnum" style={{
                  fontSize: 13,
                  color: s.margin > 0.4 ? 'var(--acid)' : 'var(--amber)',
                }}>{(s.margin*100).toFixed(0)}%</span>
              </div>
              <div style={{ position: 'relative', height: 28 }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: 13, height: 2, background: 'var(--bg-3)' }} />
                {/* Competitor band */}
                <div style={{
                  position: 'absolute', top: 8, height: 12,
                  left: pos(s.competitors.min) + '%',
                  width: (pos(s.competitors.max) - pos(s.competitors.min)) + '%',
                  background: 'rgba(155,123,255,0.18)',
                  border: '1px solid rgba(155,123,255,0.4)',
                  borderRadius: 2,
                }} />
                {/* Competitor avg */}
                <div style={{
                  position: 'absolute', top: 6, height: 16, width: 2,
                  left: pos(s.competitors.avg) + '%',
                  background: 'var(--violet)',
                }} />
                {/* Our price */}
                <div style={{
                  position: 'absolute', top: 4, height: 20, width: 3,
                  left: pos(s.price) + '%',
                  background: 'var(--acid)',
                  borderRadius: 1,
                  boxShadow: '0 0 6px var(--acid)',
                }} />
                {/* Suggested marker */}
                {s.suggested !== s.price && (
                  <div style={{
                    position: 'absolute', top: 6, height: 16, width: 2,
                    left: pos(s.suggested) + '%',
                    background: 'var(--amber)',
                    borderLeft: '2px dashed var(--amber)',
                  }} />
                )}
              </div>
              <div>
                {change !== 0 ? (
                  <div>
                    <div className="mono" style={{ fontSize: 13, color: change > 0 ? 'var(--acid)' : 'var(--rose)' }}>
                      <span className="tnum">₺{s.suggested}</span>
                      <span style={{ marginLeft: 6, fontSize: 11 }}>{change > 0 ? '↑' : '↓'} {Math.abs(changePct)}%</span>
                      {s.suggested_source === 'heuristic' && (
                        <span className="mono" style={{ marginLeft: 6, fontSize: 9, padding: '1px 4px', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--amber)' }}>
                          heuristic
                        </span>
                      )}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                      vs rakip {((s.suggested - s.competitors.avg)/s.competitors.avg*100).toFixed(1)}%{s.competitors_source === 'estimated' ? ' (tahmini)' : ''}
                    </div>
                  </div>
                ) : (
                  <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>— optimal</span>
                )}
              </div>
              <div>
                {change !== 0 ? (
                  <button
                    className="btn btn--sm btn--primary"
                    onClick={() => applyOne(s)}
                    disabled={applied[s.sku]}
                  >
                    {applied[s.sku] ? 'Onay sırasında' : 'Uygula'}
                  </button>
                ) : (
                  <button
                    className={`btn btn--sm ${watched[s.sku] ? '' : 'btn--ghost'}`}
                    onClick={() => watchOne(s)}
                  >
                    {watched[s.sku] ? 'İzleniyor' : 'İzle'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================================
// GROWTH — büyüme deneyleri
export { PricingPage };
export default PricingPage;
