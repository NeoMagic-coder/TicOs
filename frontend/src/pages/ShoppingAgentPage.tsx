// @ts-nocheck
// ============================================================
// TicOSClaw — otonom e-ticaret karşılaştırma sayfası.
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import {
  SHOPPING_AGENT_URL,
  fetchShoppingMetrics,
  runShoppingAgent,
  sendShoppingFeedback,
  shoppingAgentReachable,
} from '@/lib/shoppingAgent';
import { useStore } from '@/stores/useStore';

const fmtTRY = (n) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

const STATUS_LABELS = {
  completed: 'Tamamlandı', partial: 'Kısmi (bazı siteler hatalı)', failed: 'Başarısız',
  running: 'Çalışıyor', pending: 'Bekliyor',
};

const STATUS_COLORS = {
  completed: 'var(--acid)', partial: 'var(--amber)', failed: 'var(--red)',
  running: 'var(--blue)', pending: 'var(--fg-3)',
};

const BREAKDOWN_LABELS = { price: 'Fiyat', stock: 'Stok', delivery: 'Teslimat', warranty: 'Garanti' };

const INPUT_STYLE = {
  width: '100%', padding: '8px 10px', background: 'var(--bg-0)',
  border: '1px solid var(--border)', color: 'var(--fg-1)', borderRadius: 4, fontSize: 13,
};

const OfferCard = ({ scored, highlight }) => {
  const o = scored.offer;
  return (
    <div className="panel" style={highlight ? { borderColor: 'var(--acid)' } : undefined}>
      <div className="panel__body">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>
              {highlight && <span style={{ color: 'var(--acid)', marginRight: 6 }}>★ ÖNERİ</span>}
              {o.title}
            </div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>
              {o.site} · {o.extracted_via === 'web_search' ? 'web araması' : o.extracted_via === 'llm' ? 'LLM çıkarımı' : 'DOM çıkarımı'}
              {o.url && (
                <>
                  {' · '}
                  <a href={o.url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>ürüne git</a>
                </>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{fmtTRY(o.price)}</div>
            <div className="mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>skor {scored.score.toFixed(2)}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 13 }}>
          <span>{o.in_stock ? (o.stock_level != null ? `Stok: ${o.stock_level} adet` : 'Stokta') : '⚠ Stokta yok'}</span>
          <span>{o.delivery_days != null ? `Teslimat: ${o.delivery_days} gün` : 'Teslimat: bilinmiyor'}</span>
          <span>{o.warranty_months ? `Garanti: ${o.warranty_months} ay` : 'Garanti: bilinmiyor'}</span>
          {o.rating != null && <span>Puan: {o.rating}</span>}
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {Object.entries(scored.breakdown).map(([k, v]) => (
            <span key={k} className="stat-chip mono" style={{ fontSize: 11 }}>
              {BREAKDOWN_LABELS[k] || k}: {v.toFixed(2)}
            </span>
          ))}
        </div>

        {scored.reasons.length > 0 && (
          <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 13, color: 'var(--fg-2)' }}>
            {scored.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const ShoppingAgentPage = ({ navigate }: { navigate?: (page: string) => void }) => {
  const activeProduct = useStore((s: any) => s.onboardedProduct);
  const [form, setForm] = useState({
    product_query: '',
    budget_min: '',
    budget_max: '',
    require_in_stock: true,
    require_fast_delivery: false,
    require_warranty: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [online, setOnline] = useState(null);
  const [fb, setFb] = useState({ accurate: null, satisfaction: 0, sent: false, busy: false });

  const refresh = useCallback(async () => {
    setOnline(await shoppingAgentReachable());
    try {
      setMetrics(await fetchShoppingMetrics());
    } catch {
      /* ajan kapalıysa metrik çekilemez; durum pili zaten gösteriyor */
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!activeProduct || form.product_query.trim()) return;
    const q = [activeProduct.product_name, activeProduct.category].filter(Boolean).join(' ');
    setForm((f) => ({ ...f, product_query: q }));
  }, [activeProduct?.product_name, activeProduct?.category]);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const run = async () => {
    if (!form.product_query.trim()) {
      setError('Önce bir ürün sorgusu girin (örn. "iPhone 15").');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setFb({ accurate: null, satisfaction: 0, sent: false, busy: false });
    try {
      const res = await runShoppingAgent({
        product_query: form.product_query.trim(),
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        require_in_stock: form.require_in_stock,
        require_fast_delivery: form.require_fast_delivery,
        require_warranty: form.require_warranty,
      });
      setResult(res);
      void refresh();
    } catch (e) {
      setError(
        `${e.message || e} — TicOSClaw backend bağlantısını kontrol edin (${SHOPPING_AGENT_URL}).`,
      );
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async () => {
    if (fb.accurate == null || !fb.satisfaction || !result) return;
    setFb((s) => ({ ...s, busy: true }));
    try {
      await sendShoppingFeedback(result.run_id, {
        recommendation_accurate: fb.accurate,
        satisfaction: fb.satisfaction,
      });
      setFb((s) => ({ ...s, sent: true, busy: false }));
      void refresh();
    } catch {
      setFb((s) => ({ ...s, busy: false }));
    }
  };

  return (
    <div className="page">
      <div className="page__breadcrumb mono">
        HOME <span>›</span> TICOSCLAW KARŞILAŞTIRMA
      </div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            TicOSClaw Ürün Karşılaştırma
            <span className="page__title-tag" style={online === false ? { color: 'var(--red)' } : undefined}>
              {online == null ? '...' : online ? 'BAĞLI' : 'KAPALI'}
            </span>
          </h1>
          <p className="page__sub">
            Hedefini ver; ajan web araması + pazar yerlerini tarayıp fiyat/stok/teslimatı karşılaştırır.
            <span className="mono" style={{ marginLeft: 6, fontSize: 11, color: 'var(--fg-3)' }}>{SHOPPING_AGENT_URL}</span>
          </p>
        </div>
      </div>

      {activeProduct && (
        <div className="panel context-banner">
          <div className="panel__body">
            <span>
              <strong>Aktif ürün:</strong> {activeProduct.product_name}
              <span style={{ color: 'var(--fg-3)', marginLeft: 8 }}>
                karşılaştırma sorgusu bu ürünle önceden dolduruldu
              </span>
            </span>
            {navigate && (
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => navigate('tic_products')}>
                Envanter&apos;e git
              </button>
            )}
          </div>
        </div>
      )}

      {metrics && metrics.total_runs > 0 && (
        <div className="stat-row">
          <div className="stat-chip"><span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{metrics.total_runs}</span> Koşu</div>
          {metrics.accuracy_rate != null && (
            <div className="stat-chip"><span className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--acid)' }}>%{Math.round(metrics.accuracy_rate * 100)}</span> Öneri Doğruluğu</div>
          )}
          {metrics.avg_satisfaction != null && (
            <div className="stat-chip"><span className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--amber)' }}>{metrics.avg_satisfaction}/5</span> Memnuniyet</div>
          )}
          {metrics.avg_time_saved_seconds != null && (
            <div className="stat-chip"><span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{Math.round(metrics.avg_time_saved_seconds / 60)} dk</span> Ort. Zaman Tasarrufu</div>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel__body">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ flex: '2 1 220px' }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>ÜRÜN</div>
              <input
                placeholder='örn. "iPhone 15" veya "kulaklik"'
                value={form.product_query}
                onChange={set('product_query')}
                onKeyDown={(e) => e.key === 'Enter' && run()}
                style={INPUT_STYLE}
              />
            </label>
            <label style={{ flex: '1 1 110px' }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>BÜTÇE MİN (TL)</div>
              <input type="number" min="0" value={form.budget_min} onChange={set('budget_min')} style={INPUT_STYLE} />
            </label>
            <label style={{ flex: '1 1 110px' }}>
              <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 4 }}>BÜTÇE MAX (TL)</div>
              <input type="number" min="0" value={form.budget_max} onChange={set('budget_max')} style={INPUT_STYLE} />
            </label>
            <button className="btn btn--primary" onClick={run} disabled={loading}>
              {loading ? 'Ajan çalışıyor…' : 'Ajanı Çalıştır'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 12, flexWrap: 'wrap', fontSize: 13 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.require_in_stock} onChange={set('require_in_stock')} /> Stokta olsun
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.require_fast_delivery} onChange={set('require_fast_delivery')} /> Hızlı teslimat (≤3 gün)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.require_warranty} onChange={set('require_warranty')} /> Garanti şartı
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="panel" style={{ borderColor: 'var(--red)' }}>
          <div className="panel__body" style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>
        </div>
      )}

      {result && (
        <>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: 12, color: STATUS_COLORS[result.status] }}>
              ● {STATUS_LABELS[result.status] || result.status}
            </span>
            <span className="mono" style={{ fontSize: 12, color: 'var(--fg-3)' }}>
              süre {result.duration_seconds}s · tasarruf ~{Math.round(result.time_saved_seconds / 60)} dk · run {result.run_id}
            </span>
          </div>
          <p style={{ margin: '0 0 14px', fontSize: 14 }}>{result.summary}</p>

          {result.web_search && (
            <div className="panel" style={{ marginBottom: 14 }}>
              <div className="panel__body" style={{ fontSize: 13 }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  Web araması
                  {result.web_search.degraded ? (
                    <span style={{ marginLeft: 8, color: 'var(--amber)', fontWeight: 400, fontSize: 12 }}>
                      (kısmi — {result.web_search.degraded_reason || 'kaynak sınırlı'})
                    </span>
                  ) : result.web_search.offer_count === 0 && result.web_search.sources.length > 0 ? (
                    <span style={{ marginLeft: 8, color: 'var(--fg-3)', fontWeight: 400, fontSize: 12 }}>
                      (genel web — canlı pazar yeri için COLLECTAPI_API_KEY)
                    </span>
                  ) : null}
                </div>
                <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 8 }}>
                  {result.web_search.offer_count} pazar yeri teklifi · {result.web_search.sources.length} kaynak
                  {result.web_search.market_sources?.length > 0 && (
                    <> · {result.web_search.market_sources.join(', ')}</>
                  )}
                </div>
                {result.web_search.answer && (
                  <p style={{ margin: '0 0 10px', color: 'var(--fg-2)' }}>{result.web_search.answer}</p>
                )}
                {result.web_search.sources.length > 0 && (
                  <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--fg-2)' }}>
                    {result.web_search.sources.slice(0, 8).map((src, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {src.uri ? (
                          <a href={src.uri} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>
                            {src.title || src.uri}
                          </a>
                        ) : (
                          src.title
                        )}
                        {src.snippet && (
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
                            {src.snippet.slice(0, 160)}
                            {src.snippet.length > 160 ? '…' : ''}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {result.site_errors.length > 0 && (
            <div className="panel" style={{ marginBottom: 14, borderColor: 'var(--amber)' }}>
              <div className="panel__body" style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--amber)' }}>Hata alınan siteler (akış kalanlarla devam etti): </span>
                {result.site_errors.map((e) => e.site).join(', ')}
              </div>
            </div>
          )}

          {result.best ? (
            <>
              <OfferCard scored={result.best} highlight />

              {!fb.sent ? (
                <div className="panel" style={{ margin: '14px 0' }}>
                  <div className="panel__body" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
                    <span>Öneri isabetli miydi?</span>
                    <button className={`btn btn--sm ${fb.accurate === true ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setFb((s) => ({ ...s, accurate: true }))}>Evet</button>
                    <button className={`btn btn--sm ${fb.accurate === false ? 'btn--primary' : 'btn--ghost'}`} onClick={() => setFb((s) => ({ ...s, accurate: false }))}>Hayır</button>
                    <span style={{ marginLeft: 8 }}>Memnuniyet:</span>
                    <span>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          onClick={() => setFb((s) => ({ ...s, satisfaction: n }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: n <= fb.satisfaction ? 'var(--amber)' : 'var(--fg-3)' }}
                          aria-label={`${n} yıldız`}
                        >
                          ★
                        </button>
                      ))}
                    </span>
                    <button className="btn btn--sm btn--primary" disabled={fb.accurate == null || !fb.satisfaction || fb.busy} onClick={submitFeedback}>
                      {fb.busy ? 'Gönderiliyor…' : 'Gönder'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="panel" style={{ margin: '14px 0' }}>
                  <div className="panel__body mono" style={{ fontSize: 13, color: 'var(--acid)' }}>Geri bildirim kaydedildi — EUV metriklerine işlendi. Teşekkürler!</div>
                </div>
              )}

              {result.alternatives.length > 0 && (
                <>
                  <h2 style={{ fontSize: 14, margin: '18px 0 10px', color: 'var(--fg-2)' }}>Alternatifler</h2>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {result.alternatives.map((s, i) => (
                      <OfferCard key={i} scored={s} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="panel">
              <div className="panel__body mono" style={{ textAlign: 'center', padding: 32 }}>
                Kriterlere uyan teklif bulunamadı. Bütçeyi veya filtreleri gevşetmeyi deneyin.
              </div>
            </div>
          )}
        </>
      )}

      {!result && !loading && !error && (
        <div className="panel">
          <div className="panel__body mono" style={{ textAlign: 'center', padding: 32, color: 'var(--fg-3)' }}>
            Henüz koşu yok. Ürün + bütçe girip "Ajanı Çalıştır" deyin.
            <br />
            Deneme senaryoları: "iPhone 15, max 40000, hızlı teslimat" · "kulaklik, 1000-2000, garanti"
          </div>
        </div>
      )}
    </div>
  );
};

export default ShoppingAgentPage;
