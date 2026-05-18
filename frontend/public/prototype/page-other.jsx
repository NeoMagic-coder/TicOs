/* global React, AOSWidgets, AGENT_OS_DATA */
// ============================================================
// AGENT.OS — Other pages: Brand, Pricing, Growth, Onboarding
// ============================================================
const { useState, useEffect, useMemo } = React;
const { Icon, AgentAvatar, Sparkline } = window.AOSWidgets;
const { AGENT_BY_ID } = window.AGENT_OS_DATA;

// ============================================================
// BRAND — visual generator / brand identity
// ============================================================
const BRAND_PALETTE = [
  '#E8D9C0', '#B47C5C', '#3D2817', '#F2EBDD', '#C5946B',
];
const VISUALS = [
  { kind: 'product',   prompt: 'lifestyle, soft morning light, marble',  ts: '14:18' },
  { kind: 'moodboard', prompt: 'minimal beige luxury skincare',          ts: '13:42' },
  { kind: 'product',   prompt: 'shadow play, bathroom sink',              ts: '12:55' },
  { kind: 'social',    prompt: 'instagram square, dewy texture',          ts: '12:08' },
  { kind: 'product',   prompt: 'flatlay with botanical ingredients',     ts: '11:30' },
  { kind: 'banner',    prompt: 'horizontal hero, copy-friendly',         ts: '10:14' },
];

const BrandPage = () => {
  const brandAgent = AGENT_BY_ID['brand_identity_agent'];
  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> MARKA</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            Marka Stüdyosu
            <span className="page__title-tag">brand_identity_agent · gemini</span>
          </h1>
          <p className="page__sub">
            Ürün için marka kimliği, renk paleti ve görsel varlıklar. Gemini görsel modeline doğrudan bağlı.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost"><Icon name="refresh" size={12} /> Yenile</button>
          <button className="btn btn--primary"><Icon name="sparkles" size={12} /> Görsel Üret</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        {/* Identity panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="panel">
            <div className="panel__head"><h3>Marka Kimliği</h3></div>
            <div style={{ padding: 14 }}>
              <div style={{ fontSize: 22, letterSpacing: '-0.02em', fontWeight: 500, marginBottom: 4 }}>Lumelin</div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 14 }}>positioning · "günlük lüks, klinik kanıt"</div>
              <div className="label-eyebrow" style={{ marginBottom: 4 }}>Hedef Persona</div>
              <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5, marginBottom: 14 }}>
                25–38 yaş, urban, görünür sonuç arayan, hem masstige hem premium ürünleri seven kadın.
              </div>
              <div className="label-eyebrow" style={{ marginBottom: 6 }}>Ses Tonu</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
                {['sıcak', 'kendinden emin', 'kanıt-odaklı', 'sade', 'mesafeli olmayan'].map(t =>
                  <span key={t} className="chip">{t}</span>
                )}
              </div>
              <div className="label-eyebrow" style={{ marginBottom: 6 }}>Palet</div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                {BRAND_PALETTE.map(c => (
                  <div key={c} style={{
                    flex: 1, aspectRatio: '1/1', background: c, borderRadius: 3,
                    border: '1px solid var(--border-faint)',
                    position: 'relative',
                  }}>
                    <span className="mono" style={{
                      position: 'absolute', bottom: 4, left: 4,
                      fontSize: 8, color: 'rgba(0,0,0,0.6)',
                    }}>{c.slice(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head"><h3>Üretim İstatistikleri</h3></div>
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="label-eyebrow">Bu Ay</div>
                <div className="tnum" style={{ fontSize: 22 }}>32</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>görsel üretildi</div>
              </div>
              <div>
                <div className="label-eyebrow">Token Maliyet</div>
                <div className="tnum" style={{ fontSize: 22 }}>$1.24</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>gemini image</div>
              </div>
              <div>
                <div className="label-eyebrow">Avg Süre</div>
                <div className="tnum" style={{ fontSize: 22 }}>20s</div>
              </div>
              <div>
                <div className="label-eyebrow">Onay Oranı</div>
                <div className="tnum" style={{ fontSize: 22, color: 'var(--acid)' }}>87%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Generation grid */}
        <div className="panel">
          <div className="panel__head">
            <h3>Üretilen Görseller</h3>
            <span className="panel__head-tag">SON 7 GÜN · 32</span>
          </div>
          <div style={{ padding: 14 }}>
            {/* Prompt input */}
            <div style={{
              background: 'var(--bg-inset)', border: '1px solid var(--border)',
              borderRadius: 4, padding: 12, marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="label-eyebrow" style={{ color: 'var(--violet)' }}>● BRAND_VISUAL_GENERATOR</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>model: gemini-2.5-image · 1024x1024</span>
              </div>
              <input
                placeholder="prompt: ürünü yatay flatlay, sabah ışığı, mermer zemin, üstte bitkisel dokunuşlar…"
                style={{
                  width: '100%', background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 13, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)',
                  padding: '4px 0',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-faint)' }}>
                <button className="btn btn--sm btn--ghost"><Icon name="brand" size={10} /> palet ekle</button>
                <button className="btn btn--sm btn--ghost"><Icon name="layers" size={10} /> stil</button>
                <button className="btn btn--sm btn--ghost"><Icon name="bag" size={10} /> ürün</button>
                <span style={{ marginLeft: 'auto' }} />
                <button className="btn btn--sm btn--primary"><Icon name="sparkles" size={10} /> 4 varyasyon üret</button>
              </div>
            </div>

            {/* Visual grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {VISUALS.map((v, i) => {
                const palette = BRAND_PALETTE;
                const bg = palette[i % palette.length];
                return (
                  <div key={i} style={{
                    aspectRatio: '4/5',
                    background: `linear-gradient(135deg, ${bg}, ${palette[(i+2)%palette.length]})`,
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}>
                    {/* Faux product placeholder */}
                    <div style={{
                      position: 'absolute', left: '50%', top: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: '38%', height: '52%',
                      background: 'rgba(255,255,255,0.55)',
                      backdropFilter: 'blur(4px)',
                      borderRadius: 4,
                      border: '1px solid rgba(255,255,255,0.6)',
                      boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
                    }} />
                    <div style={{
                      position: 'absolute', bottom: 8, left: 10, right: 10,
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 9, color: 'rgba(0,0,0,0.55)',
                    }} className="mono">
                      <span>{v.kind}</span>
                      <span>{v.ts}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PRICING — Fiyat & Finans
// ============================================================
const SKUS = [
  { sku: 'OP-CRM-50ML',  name: 'Aydınlatıcı Krem 50ml',   price: 219, suggested: 239, margin: 0.42, demand: 'high',   competitors: { avg: 234, min: 199, max: 269 } },
  { sku: 'OP-CRM-30ML',  name: 'Aydınlatıcı Krem 30ml',   price: 149, suggested: 159, margin: 0.45, demand: 'medium', competitors: { avg: 162, min: 139, max: 189 } },
  { sku: 'OP-SRM-30ML',  name: 'C-Serum 30ml',            price: 289, suggested: 299, margin: 0.38, demand: 'high',   competitors: { avg: 312, min: 269, max: 369 } },
  { sku: 'OP-MSK-100ML', name: 'Maske 100ml',             price:  89, suggested:  89, margin: 0.51, demand: 'low',    competitors: { avg:  94, min:  79, max: 119 } },
  { sku: 'OP-SET-001',   name: 'Glow Set (3 ürün)',       price: 449, suggested: 469, margin: 0.36, demand: 'medium', competitors: { avg: 484, min: 399, max: 569 } },
];

const PricingPage = () => {
  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> FİYAT & FİNANS</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            Fiyat & Finans
            <span className="page__title-tag">DYNAMIC PRICING · CANLI</span>
          </h1>
          <p className="page__sub">
            SKU bazlı rekabetçi fiyat penceresi, marj durumu ve dinamik öneriler.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost"><Icon name="refresh" size={12} /> Rakip Taraması</button>
          <button className="btn btn--primary"><Icon name="zap" size={12} /> Tüm Önerileri Uygula</button>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1, background: 'var(--border-faint)',
        border: '1px solid var(--border)', borderRadius: 6,
        marginBottom: 16, overflow: 'hidden',
      }}>
        {[
          { l: 'Açık Öneriler',   v: '4',     sub: 'pricing_agent' },
          { l: 'Ortalama Marj',   v: '42.4%', sub: 'hedef 40%', color: 'var(--acid)' },
          { l: '24h Fiyat Değişim', v: '12',  sub: '8 otomatik · 4 onay' },
          { l: 'Tahmini Gelir +', v: '+₺18.4k', sub: 'haftalık · öneriler uygulanırsa', color: 'var(--acid)' },
        ].map(s => (
          <div key={s.l} style={{ padding: '12px 16px', background: 'var(--bg-1)' }}>
            <div className="label-eyebrow" style={{ marginBottom: 4 }}>{s.l}</div>
            <div className="tnum" style={{ fontSize: 20, fontWeight: 500, color: s.color || 'var(--fg-1)' }}>{s.v}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="panel__head">
          <h3>SKU Fiyat Penceresi</h3>
          <span className="panel__head-tag">REKABET BANDI · CANLI</span>
        </div>
        <div className="row" style={{
          gridTemplateColumns: '1.5fr 1fr 1fr 240px 1fr 110px',
          background: 'var(--bg-2)',
          padding: '8px 16px',
        }}>
          <span className="label-eyebrow">SKU</span>
          <span className="label-eyebrow">Fiyat</span>
          <span className="label-eyebrow">Marj</span>
          <span className="label-eyebrow">Rakip Bandı</span>
          <span className="label-eyebrow">Öneri</span>
          <span className="label-eyebrow">Aksiyon</span>
        </div>
        {SKUS.map(s => {
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
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                      vs rakip {((s.suggested - s.competitors.avg)/s.competitors.avg*100).toFixed(1)}%
                    </div>
                  </div>
                ) : (
                  <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>— optimal</span>
                )}
              </div>
              <div>
                {change !== 0 ? (
                  <button className="btn btn--sm btn--primary">Uygula</button>
                ) : (
                  <button className="btn btn--sm btn--ghost">İzle</button>
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
// ============================================================
const GROWTH_EXPERIMENTS = [
  { id: 'exp_a91',  name: 'Çapraz upsell: Krem + Serum',    status: 'running', conv_lift: '+18%',  spend: 4200, win_rate: 0.72, agent: 'growth_agent' },
  { id: 'exp_b32',  name: 'Mobile checkout 1-click',         status: 'running', conv_lift: '+12%',  spend: 0,    win_rate: 0.58, agent: 'growth_agent' },
  { id: 'exp_c14',  name: 'Email winback (90 gün)',          status: 'shipped', conv_lift: '+24%',  spend: 1100, win_rate: 0.91, agent: 'email_crm_agent' },
  { id: 'exp_d77',  name: 'Trendyol başlık optimizasyonu',   status: 'analyzing', conv_lift: '—',   spend: 0,    win_rate: 0,    agent: 'content_seo_agent' },
  { id: 'exp_e55',  name: 'Loyalty: 2. siparişte %15 indirim', status: 'planned', conv_lift: 'tahmin +9%', spend: 0, win_rate: 0, agent: 'growth_agent' },
];

const GrowthPage = () => (
  <div className="page">
    <div className="page__breadcrumb mono">HOME <span>›</span> BÜYÜME</div>
    <div className="page__header">
      <div>
        <h1 className="page__title">Büyüme & Deneyler<span className="page__title-tag">growth_agent</span></h1>
        <p className="page__sub">CRO, upsell, bundle, yeni kanal deneyleri — hipotezden ölçeklemeye.</p>
      </div>
      <button className="btn btn--primary"><Icon name="plus" size={12} /> Yeni Deney</button>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border-faint)', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 16, overflow: 'hidden' }}>
      {[
        { l: 'Aktif',     v: '2',      sub: 'çalışıyor' },
        { l: 'Bekleyen',  v: '3',      sub: 'analiz / plan' },
        { l: 'Win Rate',  v: '74%',    sub: 'son 90 gün', color: 'var(--acid)' },
        { l: 'Avg Lift',  v: '+18.5%', sub: 'dönüşüm', color: 'var(--acid)' },
      ].map(s => (
        <div key={s.l} style={{ padding: '12px 16px', background: 'var(--bg-1)' }}>
          <div className="label-eyebrow" style={{ marginBottom: 4 }}>{s.l}</div>
          <div className="tnum" style={{ fontSize: 20, fontWeight: 500, color: s.color || 'var(--fg-1)' }}>{s.v}</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{s.sub}</div>
        </div>
      ))}
    </div>

    <div className="panel">
      <div className="panel__head"><h3>Deney Sırası</h3><span className="panel__head-tag">{GROWTH_EXPERIMENTS.length}</span></div>
      {GROWTH_EXPERIMENTS.map(e => {
        const agent = AGENT_BY_ID[e.agent];
        const statusChip =
          e.status === 'running'   ? 'amber' :
          e.status === 'shipped'   ? 'acid'  :
          e.status === 'analyzing' ? 'violet': '';
        return (
          <div key={e.id} className="row" style={{ gridTemplateColumns: '24px 1fr 100px 110px 110px 90px 100px', padding: '14px 16px' }}>
            {agent && <AgentAvatar agent={agent} size={20} />}
            <div>
              <div style={{ fontSize: 13 }}>{e.name}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{e.id} · {agent?.name}</div>
            </div>
            <span className={`chip chip--${statusChip}`}>{e.status}</span>
            <div>
              <div className="label-eyebrow">CONV LIFT</div>
              <div className="tnum mono" style={{ fontSize: 13, color: e.conv_lift.startsWith('+') ? 'var(--acid)' : 'var(--fg-2)' }}>{e.conv_lift}</div>
            </div>
            <div>
              <div className="label-eyebrow">HARCAMA</div>
              <div className="tnum mono" style={{ fontSize: 13 }}>₺{e.spend.toLocaleString('tr-TR')}</div>
            </div>
            <div>
              <div className="label-eyebrow">WIN</div>
              <div className="tnum mono" style={{ fontSize: 13 }}>{(e.win_rate*100).toFixed(0)}%</div>
            </div>
            <button className="btn btn--sm btn--ghost">Detay <Icon name="chevright" size={10} /></button>
          </div>
        );
      })}
    </div>
  </div>
);

// ============================================================
// ONBOARDING — 5 step product onboarding flow
// ============================================================
const ONBOARDING_STEPS = [
  { id: 1, label: 'Ürün Tanıtımı',     icon: 'bag',          status: 'done',    sub: 'ad, kategori, hikaye' },
  { id: 2, label: 'Pazar Seçimi',      icon: 'integration',  status: 'done',    sub: 'TR · 4 kanal seçildi' },
  { id: 3, label: 'Marka Kimliği',     icon: 'brand',        status: 'current', sub: 'isim, palet, ses' },
  { id: 4, label: 'Entegrasyonlar',    icon: 'tools',        status: 'queued',  sub: 'shopify, trendyol, ga4' },
  { id: 5, label: 'Otonomi Politikası', icon: 'settings',    status: 'queued',  sub: 'eşikler, izinler' },
];

const OnboardingPage = () => {
  const [step, setStep] = useState(3);
  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> ONBOARDING</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            Ürün Onboarding
            <span className="page__title-tag">ADIM {step}/5</span>
          </h1>
          <p className="page__sub">
            Ajan ailesinin senin ürününü tanıması için 5 adımlık başlangıç. Atladığın adıma istediğinde geri dönebilirsin.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 1,
        background: 'var(--border-faint)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        marginBottom: 24,
        overflow: 'hidden',
      }}>
        {ONBOARDING_STEPS.map(s => {
          const isCurrent = s.id === step;
          const isDone = s.id < step;
          return (
            <div
              key={s.id}
              onClick={() => setStep(s.id)}
              style={{
                padding: '14px 16px',
                background: 'var(--bg-1)',
                cursor: 'pointer',
                position: 'relative',
                borderTop: isCurrent ? '2px solid var(--acid)' : '2px solid transparent',
                paddingTop: isCurrent ? 12 : 14,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, whiteSpace: 'nowrap' }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 3,
                  background: isDone ? 'var(--acid-soft)' : isCurrent ? 'var(--acid-soft)' : 'var(--bg-3)',
                  color: isDone || isCurrent ? 'var(--acid)' : 'var(--fg-3)',
                  border: '1px solid ' + (isDone || isCurrent ? 'var(--border-accent)' : 'var(--border)'),
                  display: 'grid', placeItems: 'center', flex: 'none',
                  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600,
                }}>
                  {isDone ? <Icon name="check" size={12} /> : s.id}
                </span>
                <span style={{ fontSize: 12, color: isCurrent ? 'var(--fg-1)' : 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        <div className="panel">
          <div className="panel__head"><h3>Adım 3 · Marka Kimliği</h3><span className="panel__head-tag">brand_identity_agent</span></div>
          <div style={{ padding: 18 }}>
            <div style={{ marginBottom: 14 }}>
              <div className="label-eyebrow" style={{ marginBottom: 4 }}>Marka adı</div>
              <input
                defaultValue="Lumelin"
                style={{
                  width: '100%', background: 'var(--bg-inset)',
                  border: '1px solid var(--border)', borderRadius: 4,
                  padding: '10px 12px', color: 'var(--fg-1)', fontSize: 15,
                  outline: 'none',
                }}
              />
              <div className="mono" style={{ fontSize: 10, color: 'var(--acid)', marginTop: 4 }}>
                ✓ domain lumelin.com.tr boş · trademark açık
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div className="label-eyebrow" style={{ marginBottom: 4 }}>Bir cümlede konumlandırma</div>
              <textarea
                defaultValue="Günlük kullanım için klinik kanıtlı, hızlı sonuç veren, lüks dokunuşlu cilt bakımı."
                style={{
                  width: '100%', background: 'var(--bg-inset)',
                  border: '1px solid var(--border)', borderRadius: 4,
                  padding: '10px 12px', color: 'var(--fg-1)', fontSize: 13,
                  outline: 'none', minHeight: 60, resize: 'vertical',
                  fontFamily: 'inherit', lineHeight: 1.5,
                }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div className="label-eyebrow" style={{ marginBottom: 6 }}>Ses tonu (4 seç)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {['sıcak','kanıt-odaklı','sade','kendinden emin','mesafeli','eğlenceli','şık','klinik','eril','dişil'].map((t, i) => (
                  <button key={t} className="btn btn--sm" style={{
                    background: i < 4 ? 'var(--acid-soft)' : 'var(--bg-1)',
                    color: i < 4 ? 'var(--acid)' : 'var(--fg-2)',
                    borderColor: i < 4 ? 'var(--border-accent)' : 'var(--border)',
                  }}>{t}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="label-eyebrow" style={{ marginBottom: 6 }}>Önerilen palet</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {BRAND_PALETTE.map(c => (
                  <div key={c} style={{
                    flex: 1, height: 50, background: c, borderRadius: 4,
                    border: '1px solid var(--border-faint)',
                    position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute', bottom: 4, left: 4,
                      fontSize: 9, color: 'rgba(0,0,0,0.6)',
                      fontFamily: 'var(--font-mono)',
                    }}>{c.slice(1)}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn--sm btn--ghost" style={{ marginTop: 8 }}>
                <Icon name="refresh" size={10} /> Başka palet üret
              </button>
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
              <button className="btn btn--ghost" onClick={() => setStep(s => Math.max(1, s-1))}><Icon name="chevright" size={10} style={{ transform: 'rotate(180deg)' }} /> Geri</button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--ghost">Atla</button>
                <button className="btn btn--primary" onClick={() => setStep(s => Math.min(5, s+1))}>İleri <Icon name="chevright" size={10} /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Agent assist */}
        <div className="panel" style={{ alignSelf: 'flex-start' }}>
          <div className="panel__head"><h3>Ajan Yardımı</h3></div>
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
              <AgentAvatar agent={AGENT_BY_ID['brand_identity_agent']} size={28} />
              <div>
                <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>Brand Identity Agent</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>conf 0.85 · 7 tool</div>
              </div>
            </div>
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-faint)',
              borderLeft: '2px solid #F472B6',
              borderRadius: 3,
              fontSize: 12,
              color: 'var(--fg-2)',
              lineHeight: 1.55,
              marginBottom: 12,
            }}>
              Ürün tanımına bakıyorum — "aydınlatıcı krem" + premium pozisyon. Hedef persona 25–38, urban. "Lumelin" ismi "lume" (ışık) + "in" eki. Sade, çağrışımlı, hatırlanır.
            </div>
            <div className="label-eyebrow" style={{ marginBottom: 6 }}>Kullanılan Araçlar</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {['brand_name_generator','domain_availability_checker','color_palette_generator','target_persona_builder'].map(t => (
                <div key={t} className="mono" style={{ fontSize: 11, color: 'var(--cyan)', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="tools" size={10} color="var(--fg-3)" />
                  {t}() <Icon name="check" size={10} color="var(--acid)" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.AOSPages = window.AOSPages || {};
window.AOSPages.Brand = BrandPage;
window.AOSPages.Pricing = PricingPage;
window.AOSPages.Growth = GrowthPage;
window.AOSPages.Onboarding = OnboardingPage;
