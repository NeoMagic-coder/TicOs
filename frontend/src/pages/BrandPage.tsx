// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Icon, AgentAvatar } from '@/components/AOS/widgets';
import { AGENT_BY_ID } from '@/data/aos/mockData';
import { useStore } from '@/stores/useStore';

import { useBrandIdentity } from '@/lib/aos/adapter';
import { pushToast } from '@/components/AOS/Toast';
import { BASE_URL, resolveBackendUrl } from '@/lib/api';
import { extractImages } from '@/components/ChatMessageBody';

// ============================================================
// Gray placeholder palette used until brand_identity_agent runs.
// These are intentionally neutral so a user never mistakes them for the
// brand's real palette.
const BRAND_PALETTE = [
  '#2A2A2A', '#3D3D3D', '#5A5A5A', '#7A7A7A', '#A0A0A0',
];

const BrandPage = () => {
  const brandAgent = AGENT_BY_ID['brand_identity_agent'];
  const brand = useBrandIdentity();
  const product = useStore((s: any) => s.onboardedProduct);
  const regenerateBrandIdentity = useStore((s: any) => s.regenerateBrandIdentity);
  const brandIdentityLoading = useStore((s: any) => s.brandIdentityLoading);
  const brandIdentityError = useStore((s: any) => s.brandIdentityError);
  const quickAsk = useStore((s: any) => s.quickAsk);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [imageStatus, setImageStatus] = useState<any>(null);
  const [generatedImages, setGeneratedImages] = useState<Array<{ url: string; prompt: string; ts: string; kind?: string; degraded?: boolean }>>([]);

  // Load existing images from backend on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/images`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return;
        const items = await res.json();
        if (cancelled || !Array.isArray(items)) return;
        const mapped = items.slice(0, 12).map((it: any) => ({
          url: resolveBackendUrl(it.url),
          prompt: it.filename,
          ts: new Date((it.created_at || 0) * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          kind: 'product',
        }));
        setGeneratedImages(mapped);
      } catch {
        /* backend offline — placeholders fall back below */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/llm/image-status`, { signal: AbortSignal.timeout(5000) });
        if (!res.ok || cancelled) return;
        setImageStatus(await res.json());
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const appendToPrompt = (snippet: string) => setPrompt((p) => (p ? `${p}, ${snippet}` : snippet));
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      pushToast({ kind: 'success', title: 'Kopyalandı', body: `${label} panoya kopyalandı.` });
    } catch {
      pushToast({ kind: 'warn', title: 'Kopyalanamadı', body: 'Tarayıcı izin vermedi.' });
    }
  };
  const startLogoGeneration = () => {
    if (!product) {
      pushToast({ kind: 'warn', title: 'Ürün yok', body: 'Önce bir ürün onboard et.' });
      return;
    }
    const paletteHint = paletteFull.slice(0, 3).map((p: any) => p.hex).join(' / ');
    const logoPrompt = `${brandName} markası için minimalist logo: vektörel, tek katman, beyaz arka plan üzerinde merkezde, "${brandName}" yazısı dahil, ${paletteHint} renk paleti, modern san-serif tipografi, sembol + wordmark kombinasyonu. Yüksek kontrast, baskıya uygun.`;
    setPrompt(logoPrompt);
    onGenerate(2);
  };
  const onGenerate = async (variations = 1) => {
    if (!product) {
      pushToast({ kind: 'warn', title: 'Ürün yok', body: 'Önce bir ürün onboard et.' });
      return;
    }
    // Build a rich default prompt that anchors the image generator on the
    // actual brand identity (name, tagline, palette, archetype, mood, category)
    // Bedrock image generation — product name must be in prompt for on-brand visuals.
    const brandName: string = brand?.brand_name || product.product_name || '';
    const tagline: string = brand?.tagline || '';
    const archetype: string = brand?.archetype || '';
    const story: string = brand?.story || '';
    const mood: string = brand?.imagery_style?.mood || brand?.imagery_style?.style || '';
    const paletteHex = (paletteFull || []).slice(0, 4).map((p: any) => p.hex).filter(Boolean).join(', ');
    const category: string = product.category || '';
    const description: string = product.product_description || '';
    const brandBits = [
      brandName && `"${brandName}" markası`,
      tagline && `slogan: "${tagline}"`,
      archetype && `marka arketipi: ${archetype}`,
      mood && `görsel ton: ${mood}`,
      paletteHex && `renk paleti: ${paletteHex}`,
      category && `kategori: ${category}`,
      description && `ürün: ${description}`,
      story && `marka hikayesi özet: ${story.slice(0, 160)}`,
    ].filter(Boolean).join(' | ');
    const userPart = prompt.trim();
    const basePart = userPart || `${product.product_name} için stüdyo kalitesinde, premium lifestyle ürün görseli`;
    const finalPrompt = brandBits
      ? `${basePart}. ${brandBits}. Yüksek çözünürlüklü, profesyonel ışıklandırma, marka kimliğine birebir sadık kal.`
      : basePart;
    setGenerating(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/brand/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          variations,
          product_name: product.product_name,
        }),
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const variationsList: any[] = data?.variations || [];
      const newImages = variationsList
        .filter((v) => v.status === 'success' && v.output?.url)
        .map((v) => ({
          url: resolveBackendUrl(v.output.url),
          prompt: v.output.prompt || finalPrompt,
          ts: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          kind: 'product',
          degraded: Boolean(v.output?.degraded),
        }));
      const hardFailures = variationsList.filter((v) => v.status === 'failure');
      const errors = variationsList.filter((v) => v.status !== 'success' || !v.output?.url);
      const placeholders = newImages.filter((img) => img.degraded);
      if (newImages.length) {
        setGeneratedImages((prev) => [...newImages, ...prev]);
        if (placeholders.length === newImages.length) {
          pushToast({
            kind: 'warn',
            title: 'Yer tutucu görsel',
            body: 'Bedrock Image erişimi yok — AWS Console\'da Stability Image Core modelini etkinleştirin.',
          });
        } else if (placeholders.length) {
          pushToast({
            kind: 'warn',
            title: 'Kısmi başarı',
            body: `${newImages.length - placeholders.length}/${variations} gerçek görsel, ${placeholders.length} yer tutucu.`,
          });
        } else {
          pushToast({ kind: 'success', title: 'Görsel üretildi', body: `${newImages.length}/${variations} başarılı` });
        }
      }
      if (hardFailures.length) {
        pushToast({
          kind: 'warn',
          title: 'Bazı varyasyonlar başarısız',
          body: `${hardFailures.length} varyasyon zaman aşımı veya sunucu hatası — tekrar deneyin.`,
        });
      } else if (errors.length && !newImages.length) {
        const firstErr = errors[0]?.output?.error || errors[0]?.status || 'bilinmeyen hata';
        const msg = String(firstErr);
        const friendly = msg.includes('Operation not allowed')
          ? 'Bedrock görsel modeli izni yok — AWS Console → Bedrock → Model access → Stability Image Core'
          : msg.slice(0, 160);
        pushToast({ kind: 'warn', title: 'Bazı varyasyonlar başarısız', body: friendly });
      }
      if (!newImages.length && !errors.length) {
        pushToast({ kind: 'warn', title: 'Yanıt boş', body: 'Backend görsel döndürmedi.' });
      }
    } catch (err: any) {
      quickAsk(`brand_visual_generator çalıştır: prompt='${finalPrompt}', varyasyon=${variations}, ürün=${product.product_name}.`);
      pushToast({ kind: 'warn', title: 'Doğrudan API başarısız', body: `${err?.message || err} — TicOSClaw üzerinden tekrar deneniyor.` });
    } finally {
      setGenerating(false);
    }
  };
  // Placeholder labels — the slot exists so the layout doesn't shift, but the
  // role is shown as "henüz üretilmedi" until brand_identity_agent fills in
  // real values. This prevents the gray default from being read as the brand's
  // intended palette.
  const PLACEHOLDER_ROLES = ['Yer Tutucu 1', 'Yer Tutucu 2', 'Yer Tutucu 3', 'Yer Tutucu 4', 'Yer Tutucu 5'];
  const paletteFull = brand?.palette?.length
    ? brand.palette
    : BRAND_PALETTE.map((hex, i) => ({ hex, role: PLACEHOLDER_ROLES[i] ?? `Slot ${i + 1}`, label: 'henüz üretilmedi' }));
  const palette = paletteFull.map((p: any) => p.hex);
  const brandName = brand?.brand_name || product?.product_name || 'Lumelin';
  const tagline = brand?.tagline || '';
  const story = brand?.story || '';
  const positioning = brand?.positioning || '"günlük lüks, klinik kanıt"';
  const personas = brand?.personas?.length ? brand.personas : [];
  const voiceTraits = brand?.voice?.traits?.length ? brand.voice.traits : ['sıcak', 'kendinden emin', 'kanıt-odaklı', 'sade', 'mesafeli olmayan'];
  const voiceDo: string[] = brand?.voice?.do || [];
  const voiceDont: string[] = brand?.voice?.dont || [];
  const alternatives: any[] = brand?.alternatives || [];
  const socialHandles: any[] = brand?.social_handles || [];
  const mission = brand?.mission || '';
  const vision = brand?.vision || '';
  const archetype = brand?.archetype || '';
  const elevatorPitch = brand?.elevator_pitch || '';
  const usp = brand?.usp || '';
  const values: any[] = brand?.values || [];
  const differentiators: string[] = brand?.differentiators || [];
  const taglines: string[] = brand?.taglines || [];
  const toneExamples: any[] = brand?.tone_examples || [];
  const hashtags: string[] = brand?.hashtags || [];
  const keywords: string[] = brand?.keywords || [];
  const typography: any = brand?.typography || null;
  const logoConcepts: any[] = brand?.logo_concepts || [];
  const imageryStyle: any = brand?.imagery_style || null;
  const competitors: any[] = brand?.competitors || [];
  const generatedAt: string | null = brand?.generated_at || null;

  // ── Identity tabs (left column) ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'kimlik' | 'mesaj' | 'tasarim' | 'pazar'>('kimlik');

  // ── Real generation stats — replaces the previously hardcoded numbers ────
  const auditLogs = useStore((s: any) => s.auditLogs);
  const stats = useMemo(() => {
    const monthCutoff = Date.now() - 30 * 86400000;
    let imagesThisMonth = 0;
    let totalCostUsd = 0;
    let lastDurationMs = 0;
    let durations: number[] = [];
    for (const log of auditLogs || []) {
      const t = new Date(log.timestamp || 0).getTime();
      if (t < monthCutoff) continue;
      const meta: any = log.metadata || {};
      const action: string = log.action || '';
      const isImage = /brand_visual|visual_generator|image|görsel/i.test(action) || /image/i.test(meta?.tool || '');
      if (isImage) imagesThisMonth += 1;
      if (typeof meta.cost_usd === 'number') totalCostUsd += meta.cost_usd;
      if (typeof meta.duration_ms === 'number') {
        durations.push(meta.duration_ms);
        lastDurationMs = meta.duration_ms;
      }
    }
    const avgMs = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    return {
      imagesThisMonth,
      totalCostUsd,
      avgSeconds: Math.round((avgMs || lastDurationMs) / 1000),
    };
  }, [auditLogs]);

  // Pull every image URL emitted by agents into chatMessages so the Brand page
  // can surface them as a gallery. Newest first.
  const chatMessages = useStore((s: any) => s.chatMessages);
  const agentImages: string[] = useMemo(() => {
    const urls = new Set<string>();
    const list: string[] = [];
    for (let i = (chatMessages || []).length - 1; i >= 0; i--) {
      const m = chatMessages[i];
      if (!m || (m.role !== 'agent' && m.role !== 'assistant')) continue;
      for (const u of extractImages(String(m.content || ''))) {
        if (urls.has(u)) continue;
        urls.add(u);
        list.push(u);
      }
    }
    return list;
  }, [chatMessages]);
  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> MARKA</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            Marka Stüdyosu
            <span className="page__title-tag">brand_identity_agent · bedrock</span>
          </h1>
          <p className="page__sub">
            Ürün için marka kimliği, renk paleti ve görsel varlıklar. AWS Bedrock üzerinden üretilir.
            {generatedAt && (
              <span className="mono" style={{ marginLeft: 8, fontSize: 10, color: 'var(--fg-3)' }}>
                · son üretim {new Date(generatedAt).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn--ghost"
            onClick={() => regenerateBrandIdentity()}
            disabled={brandIdentityLoading}
          >
            <Icon name="refresh" size={12} /> {brandIdentityLoading ? 'Yenileniyor…' : (brand ? 'Yeniden Üret' : 'Üret')}
          </button>
          <button
            className="btn btn--ghost"
            onClick={startLogoGeneration}
            disabled={generating}
            title="Marka renkleri ve adıyla logo üret"
          >
            <Icon name="brand" size={12} /> {generating ? 'Üretiliyor…' : 'Logo Üret'}
          </button>
          <button
            className="btn btn--primary"
            onClick={() => onGenerate(1)}
            disabled={generating}
          >
            <Icon name="sparkles" size={12} /> {generating ? 'Üretiliyor…' : 'Görsel Üret'}
          </button>
        </div>
      </div>

      {imageStatus?.bedrock_token_present && !imageStatus?.fal_configured && (
        <div style={{
          background: 'rgba(255,177,61,0.08)', border: '1px solid rgba(255,177,61,0.35)',
          padding: '10px 14px', borderRadius: 4, marginBottom: 14, fontSize: 12,
          color: 'var(--fg-1)', lineHeight: 1.5,
        }}>
          <strong style={{ color: 'var(--amber)' }}>Görsel modu:</strong>{' '}
          {imageStatus.mode === 'bedrock'
            ? `Bedrock (${imageStatus.bedrock_image_model}) — model erişimi yoksa yer tutucu SVG üretilir.`
            : 'Yapılandırılmamış'}
          {' '}
          <span style={{ color: 'var(--fg-3)' }}>{imageStatus.hint_tr}</span>
        </div>
      )}

      {brandIdentityError && (
        <div style={{
          background: 'rgba(194,91,91,0.10)', border: '1px solid rgba(194,91,91,0.45)',
          padding: '10px 14px', borderRadius: 4, marginBottom: 14, fontSize: 12,
          color: 'var(--fg-1)', lineHeight: 1.5,
        }}>
          <b style={{ color: '#c25b5b' }}>Marka kimliği hatası:</b> {brandIdentityError}
        </div>
      )}

      {/* Placeholder banner — shown when no real brand identity exists yet so
          the gray default palette is never mistaken for the brand's real one. */}
      {!brand && (
        <div style={{
          border: '1px dashed var(--border)',
          background: 'rgba(155,123,255,0.06)',
          borderRadius: 6,
          marginBottom: 14,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: 'rgba(155,123,255,0.15)', border: '1px solid rgba(155,123,255,0.35)',
            display: 'grid', placeItems: 'center',
          }}>
            <Icon name="sparkles" size={18} color="var(--violet)" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)', marginBottom: 2 }}>
              Marka kimliği henüz üretilmedi
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.4 }}>
              Aşağıdaki palet ve hikaye placeholder'dır. Gerçek değerler için <b style={{ color: 'var(--fg-1)' }}>brand_identity_agent</b> çalıştır.
            </div>
          </div>
          <button
            className="btn btn--primary"
            onClick={() => regenerateBrandIdentity()}
            disabled={brandIdentityLoading}
          >
            <Icon name="sparkles" size={12} /> {brandIdentityLoading ? 'Üretiliyor…' : 'Şimdi Üret'}
          </button>
        </div>
      )}

      {/* Brand Kit Hero — quick-look identity card showing the brand at a glance */}
      {brand && (
        <div style={{
          border: '1px solid var(--border)',
          borderRadius: 6,
          marginBottom: 14,
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${paletteFull[0]?.hex || '#1a1a1a'} 0%, ${paletteFull[Math.min(2, paletteFull.length - 1)]?.hex || '#0a0a0a'} 100%)`,
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.55) 100%)',
          }} />
          <div style={{ position: 'relative', padding: '20px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Left: brand name + tagline + meta */}
            <div>
              <div className="mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 8 }}>
                BRAND KIT {archetype ? `· ${archetype}` : ''}
              </div>
              <div style={{
                fontSize: 36,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: '#fff',
                fontFamily: typography?.heading ? `'${typography.heading}', system-ui, sans-serif` : 'inherit',
                lineHeight: 1.1,
                marginBottom: 6,
                textShadow: '0 2px 12px rgba(0,0,0,0.4)',
              }}>{brandName}</div>
              {tagline && (
                <div style={{
                  fontSize: 14, fontStyle: 'italic', color: 'rgba(255,255,255,0.85)',
                  fontFamily: typography?.body ? `'${typography.body}', system-ui, sans-serif` : 'inherit',
                  marginBottom: 14,
                  textShadow: '0 1px 6px rgba(0,0,0,0.4)',
                }}>"{tagline}"</div>
              )}
              {usp && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, maxWidth: 420 }}>
                  {usp}
                </div>
              )}
            </div>
            {/* Right: palette + typography preview + copy actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', gap: 4, width: '100%' }}>
                {paletteFull.map((p: any, idx: number) => (
                  <div key={p.hex + idx} title={`${p.role || ''} · ${p.label || ''} · ${p.hex}`} style={{
                    flex: 1, height: 56,
                    background: p.hex,
                    borderRadius: 3,
                    border: '1px solid rgba(255,255,255,0.18)',
                    position: 'relative',
                    cursor: 'pointer',
                  }}
                    onClick={() => copyToClipboard(p.hex, `${p.role || 'Renk'} (${p.hex})`)}
                  >
                    <span className="mono" style={{
                      position: 'absolute', bottom: 4, left: 5,
                      fontSize: 8, color: 'rgba(255,255,255,0.9)',
                      textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    }}>{p.hex}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => copyToClipboard(
                    paletteFull.map((p: any) => `--brand-${(p.role || 'tone').toLowerCase()}: ${p.hex};`).join('\n'),
                    'Palet (CSS)'
                  )}
                  style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.18)', color: '#fff' }}
                >
                  <Icon name="copy" size={10} /> CSS
                </button>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => copyToClipboard(JSON.stringify(brand, null, 2), 'Marka kimliği JSON')}
                  style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.18)', color: '#fff' }}
                >
                  <Icon name="copy" size={10} /> JSON
                </button>
                {typography?.heading && (
                  <button
                    className="btn btn--sm btn--ghost"
                    onClick={() => copyToClipboard(`${typography.heading} / ${typography.body || typography.heading}`, 'Tipografi')}
                    style={{ background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.18)', color: '#fff' }}
                  >
                    Aa {typography.heading}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {agentImages.length > 0 && (
        <div className="rounded-2xl" style={{
          border: '1px solid var(--border)', background: 'var(--bg-1, #0c0c0c)',
          padding: 14, marginBottom: 14,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 13, letterSpacing: '0.04em' }}>Ajan Görselleri</h3>
            <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>chat history · {agentImages.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
            {agentImages.slice(0, 24).map((src, i) => (
              <a key={src + i} href={src} target="_blank" rel="noreferrer" style={{ display: 'block', aspectRatio: '1/1', overflow: 'hidden', borderRadius: 6, border: '1px solid var(--border-faint)' }}>
                <img src={src} alt="agent görsel" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </a>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 16 }}>
        {/* Identity column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {brand && (
            <div className="tabs" style={{ borderBottom: '1px solid var(--border-faint)', marginBottom: -8 }}>
              {([
                { id: 'kimlik',   label: 'Kimlik' },
                { id: 'mesaj',    label: 'Mesaj' },
                { id: 'tasarim',  label: 'Tasarım' },
                { id: 'pazar',    label: 'Pazar' },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`tab ${activeTab === t.id ? 'tab--active' : ''}`}
                  onClick={() => setActiveTab(t.id)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', padding: '8px 12px' }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div style={{ display: brand && activeTab !== 'kimlik' ? 'none' : 'contents' }}>
          <div className="panel">
            <div className="panel__head"><h3>Marka Kimliği</h3></div>
            <div style={{ padding: 14 }}>
              <h3 style={{ fontSize: 22, letterSpacing: '-0.02em', fontWeight: 500, marginBottom: 4, margin: 0 }}>{brandName}</h3>
              {tagline && !brand && (
                <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--fg-2)', marginBottom: 8 }}>"{tagline}"</div>
              )}
              <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 14 }}>positioning · {positioning}</div>
              {story && (
                <>
                  <div className="label-eyebrow" style={{ marginBottom: 4 }}>Hikaye</div>
                  <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5, marginBottom: 14 }}>{story}</div>
                </>
              )}
              <div className="label-eyebrow" style={{ marginBottom: 6 }}>Ses Tonu</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                {voiceTraits.map((t: string) =>
                  <span key={t} className="chip">{t}</span>
                )}
              </div>
              {(voiceDo.length > 0 || voiceDont.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  {voiceDo.length > 0 && (
                    <div>
                      <div className="label-eyebrow" style={{ color: 'var(--acid)', marginBottom: 4 }}>✓ Yap</div>
                      <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.5 }}>
                        {voiceDo.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  )}
                  {voiceDont.length > 0 && (
                    <div>
                      <div className="label-eyebrow" style={{ color: 'var(--red, #c25b5b)', marginBottom: 4 }}>✗ Yapma</div>
                      <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.5 }}>
                        {voiceDont.map((d, i) => <li key={i}>{d}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <div className="label-eyebrow" style={{ marginBottom: 6 }}>Palet</div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                {paletteFull.map((p: any, idx: number) => (
                  <div key={p.hex + idx} title={`${p.role || ''} · ${p.label || ''}`} style={{
                    flex: 1, aspectRatio: '1/1', background: p.hex, borderRadius: 3,
                    border: '1px solid var(--border-faint)',
                    position: 'relative',
                  }}>
                    <span className="mono" style={{
                      position: 'absolute', bottom: 4, left: 4,
                      fontSize: 8, color: 'rgba(0,0,0,0.6)',
                    }}>{(p.hex || '').slice(1)}</span>
                  </div>
                ))}
              </div>
              {paletteFull.some((p: any) => p.label) && (
                <div className="mono" style={{ fontSize: 9, color: 'var(--fg-3)', display: 'flex', gap: 4, marginTop: 4 }}>
                  {paletteFull.map((p: any, idx: number) => (
                    <div key={idx} style={{ flex: 1, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.role || p.label}</div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {(mission || vision || archetype || elevatorPitch || usp) && (
            <div className="panel">
              <div className="panel__head"><h3>Strateji</h3></div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {archetype && (
                  <div>
                    <div className="label-eyebrow" style={{ marginBottom: 4 }}>Arketip</div>
                    <span className="chip" style={{ background: 'var(--violet-tint, rgba(140,100,220,0.12))' }}>{archetype}</span>
                  </div>
                )}
                {usp && (
                  <div>
                    <div className="label-eyebrow" style={{ marginBottom: 4 }}>USP</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>{usp}</div>
                  </div>
                )}
                {elevatorPitch && (
                  <div>
                    <div className="label-eyebrow" style={{ marginBottom: 4 }}>Asansör Konuşması</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>{elevatorPitch}</div>
                  </div>
                )}
                {mission && (
                  <div>
                    <div className="label-eyebrow" style={{ marginBottom: 4 }}>Misyon</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>{mission}</div>
                  </div>
                )}
                {vision && (
                  <div>
                    <div className="label-eyebrow" style={{ marginBottom: 4 }}>Vizyon</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>{vision}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {values.length > 0 && (
            <div className="panel">
              <div className="panel__head">
                <h3>Değerler</h3>
                <span className="panel__head-tag">{values.length}</span>
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {values.map((v: any, i: number) => (
                  <div key={i}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{v.name}</div>
                    {v.description && <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.4 }}>{v.description}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {differentiators.length > 0 && (
            <div className="panel">
              <div className="panel__head"><h3>Farklılaştırıcılar</h3></div>
              <div style={{ padding: 14 }}>
                <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.6 }}>
                  {differentiators.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            </div>
          )}
          </div>{/* /kimlik */}

          <div style={{ display: brand && activeTab !== 'mesaj' ? 'none' : 'contents' }}>
          {taglines.length > 0 && (
            <div className="panel">
              <div className="panel__head">
                <h3>Slogan Alternatifleri</h3>
                <span className="panel__head-tag">{taglines.length}</span>
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {taglines.map((t, i) => (
                  <div key={i} style={{ fontSize: 12, color: 'var(--fg-2)', fontStyle: 'italic', lineHeight: 1.5 }}>"{t}"</div>
                ))}
              </div>
            </div>
          )}

          {toneExamples.length > 0 && (
            <div className="panel">
              <div className="panel__head"><h3>Ton Örnekleri</h3></div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {toneExamples.map((t: any, i: number) => (
                  <div key={i}>
                    <div className="mono" style={{ fontSize: 9, color: 'var(--fg-3)', textTransform: 'uppercase', marginBottom: 2 }}>{t.context}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>{t.example}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(hashtags.length > 0 || keywords.length > 0) && (
            <div className="panel">
              <div className="panel__head"><h3>Etiketler & Anahtarlar</h3></div>
              <div style={{ padding: 14 }}>
                {hashtags.length > 0 && (
                  <>
                    <div className="label-eyebrow" style={{ marginBottom: 6 }}>Hashtag'ler</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                      {hashtags.map((h, i) => <span key={i} className="chip" style={{ color: 'var(--violet)' }}>{h}</span>)}
                    </div>
                  </>
                )}
                {keywords.length > 0 && (
                  <>
                    <div className="label-eyebrow" style={{ marginBottom: 6 }}>Anahtar Kelimeler</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {keywords.map((k, i) => <span key={i} className="chip">{k}</span>)}
                    </div>
                  </>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-faint)' }}>
                  {hashtags.length > 0 && (
                    <button
                      className="btn btn--sm btn--ghost"
                      onClick={() => copyToClipboard(hashtags.join(' '), 'Hashtag listesi')}
                    >
                      <Icon name="copy" size={10} /> hashtag'leri kopyala
                    </button>
                  )}
                  {keywords.length > 0 && (
                    <button
                      className="btn btn--sm btn--ghost"
                      onClick={() => copyToClipboard(keywords.join(', '), 'Anahtar kelimeler')}
                    >
                      <Icon name="copy" size={10} /> anahtar kelimeler
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          </div>{/* /mesaj */}

          <div style={{ display: brand && activeTab !== 'tasarim' ? 'none' : 'contents' }}>
          {typography && (typography.heading || typography.body) && (
            <div className="panel">
              <div className="panel__head"><h3>Tipografi</h3></div>
              <div style={{ padding: 14 }}>
                {typography.heading && (
                  <div style={{ marginBottom: 8 }}>
                    <div className="label-eyebrow" style={{ marginBottom: 2 }}>Başlık</div>
                    <div style={{ fontSize: 20, fontWeight: 600 }}>{typography.heading}</div>
                  </div>
                )}
                {typography.body && (
                  <div style={{ marginBottom: 8 }}>
                    <div className="label-eyebrow" style={{ marginBottom: 2 }}>Gövde</div>
                    <div style={{ fontSize: 13 }}>{typography.body}</div>
                  </div>
                )}
                {typography.rationale && (
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.4, marginTop: 4 }}>{typography.rationale}</div>
                )}
              </div>
            </div>
          )}

          {logoConcepts.length > 0 && (
            <div className="panel">
              <div className="panel__head">
                <h3>Logo Konseptleri</h3>
                <span className="panel__head-tag">{logoConcepts.length}</span>
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {logoConcepts.map((l: any, i: number) => (
                  <div key={i}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{l.name}</div>
                    {l.description && <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.4 }}>{l.description}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {imageryStyle && (
            <div className="panel">
              <div className="panel__head"><h3>Görsel Yönlendirme</h3></div>
              <div style={{ padding: 14 }}>
                {imageryStyle.mood && <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5, marginBottom: 10 }}>{imageryStyle.mood}</div>}
                {Array.isArray(imageryStyle.do) && imageryStyle.do.length > 0 && (
                  <>
                    <div className="label-eyebrow" style={{ color: 'var(--acid)', marginBottom: 4 }}>✓ Yap</div>
                    <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.5, marginBottom: 10 }}>
                      {imageryStyle.do.map((d: string, i: number) => <li key={i}>{d}</li>)}
                    </ul>
                  </>
                )}
                {Array.isArray(imageryStyle.dont) && imageryStyle.dont.length > 0 && (
                  <>
                    <div className="label-eyebrow" style={{ color: 'var(--red, #c25b5b)', marginBottom: 4 }}>✗ Yapma</div>
                    <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.5, marginBottom: 10 }}>
                      {imageryStyle.dont.map((d: string, i: number) => <li key={i}>{d}</li>)}
                    </ul>
                  </>
                )}
                {Array.isArray(imageryStyle.references) && imageryStyle.references.length > 0 && (
                  <>
                    <div className="label-eyebrow" style={{ marginBottom: 4 }}>Referans Sahneler</div>
                    <ul style={{ margin: 0, padding: '0 0 0 14px', fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.5 }}>
                      {imageryStyle.references.map((r: string, i: number) => <li key={i}>{r}</li>)}
                    </ul>
                  </>
                )}
              </div>
            </div>
          )}
          </div>{/* /tasarim */}

          <div style={{ display: brand && activeTab !== 'pazar' ? 'none' : 'contents' }}>
          {competitors.length > 0 && (
            <div className="panel">
              <div className="panel__head">
                <h3>Rakipler & Boşluk</h3>
                <span className="panel__head-tag">{competitors.length}</span>
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {competitors.map((c: any, i: number) => (
                  <div key={i} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{c.name}</div>
                    {c.positioning && <div style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1.4 }}><b>Konum:</b> {c.positioning}</div>}
                    {c.gap && <div style={{ fontSize: 11, color: 'var(--acid)', lineHeight: 1.4 }}><b>Boşluk:</b> {c.gap}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {personas.length > 0 && (
            <div className="panel">
              <div className="panel__head">
                <h3>Personalar</h3>
                <span className="panel__head-tag">{personas.length}</span>
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {personas.map((p: any, i: number) => (
                  <div key={i} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                      <span style={{ marginRight: 6 }}>{p.emoji || '👤'}</span>{p.name} <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>· {p.age}</span>
                    </div>
                    {p.goal && <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.4 }}><b>Hedef:</b> {p.goal}</div>}
                    {p.objection && <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.4 }}><b>İtiraz:</b> {p.objection}</div>}
                    {p.channel && <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>kanal · {p.channel}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {alternatives.length > 0 && (
            <div className="panel">
              <div className="panel__head">
                <h3>İsim Alternatifleri</h3>
                <span className="panel__head-tag">{alternatives.length}</span>
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {alternatives.map((a: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{a.name}</div>
                      {a.reasoning && <div style={{ fontSize: 10, color: 'var(--fg-3)', lineHeight: 1.4 }}>{a.reasoning}</div>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="tnum" style={{ fontSize: 13 }}>{a.score ?? '—'}</div>
                      <div className="mono" style={{ fontSize: 9, color: 'var(--fg-3)' }}>{a.domain || ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {socialHandles.length > 0 && (
            <div className="panel">
              <div className="panel__head"><h3>Sosyal Hesaplar</h3></div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {socialHandles.map((s: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span className="mono" style={{ color: 'var(--fg-3)' }}>{s.platform}</span>
                    <span>{s.handle} {s.available ? '✓' : '✗'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>{/* /pazar */}

          <div className="panel">
            <div className="panel__head"><h3>Üretim İstatistikleri</h3></div>
            <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div className="label-eyebrow">Bu Ay</div>
                <div className="tnum" style={{ fontSize: 22 }}>{stats.imagesThisMonth + generatedImages.length}</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>görsel üretildi</div>
              </div>
              <div>
                <div className="label-eyebrow">Token Maliyet</div>
                <div className="tnum" style={{ fontSize: 22 }}>${stats.totalCostUsd.toFixed(2)}</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>bedrock image</div>
              </div>
              <div>
                <div className="label-eyebrow">Avg Süre</div>
                <div className="tnum" style={{ fontSize: 22 }}>{stats.avgSeconds ? `${stats.avgSeconds}s` : '—'}</div>
              </div>
              <div>
                <div className="label-eyebrow">Galeri</div>
                <div className="tnum" style={{ fontSize: 22, color: 'var(--acid)' }}>{agentImages.length}</div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>chat üretimleri</div>
              </div>
            </div>
          </div>
        </div>

        {/* Generation grid */}
        <div className="panel">
          <div className="panel__head">
            <h3>Üretilen Görseller</h3>
            <span className="panel__head-tag">
              {generatedImages.length > 0
                ? `SON 7 GÜN · ${generatedImages.length}`
                : 'HENÜZ ÜRETİM YOK'}
            </span>
          </div>
          <div style={{ padding: 14 }}>
            {/* Prompt input */}
            <div style={{
              background: 'var(--bg-inset)', border: '1px solid var(--border)',
              borderRadius: 4, padding: 12, marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span className="label-eyebrow" style={{ color: 'var(--violet)' }}>● BRAND_VISUAL_GENERATOR</span>
                <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>model: amazon.titan-image · 1024x1024</span>
              </div>
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="prompt: ürünü yatay flatlay, sabah ışığı, mermer zemin, üstte bitkisel dokunuşlar…"
                style={{
                  width: '100%', background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 13, color: 'var(--fg-1)', fontFamily: 'var(--font-mono)',
                  padding: '4px 0',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-faint)' }}>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => appendToPrompt(`palet: ${palette.slice(0, 3).join(' / ')}`)}
                >
                  <Icon name="brand" size={10} /> palet ekle
                </button>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => appendToPrompt('editorial, minimal, soft natural light')}
                >
                  <Icon name="layers" size={10} /> stil
                </button>
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => appendToPrompt(`ürün: ${product?.product_name ?? 'ana ürün'}`)}
                >
                  <Icon name="bag" size={10} /> ürün
                </button>
                <span style={{ marginLeft: 'auto' }} />
                <button
                  className="btn btn--sm btn--primary"
                  onClick={() => onGenerate(4)}
                  disabled={generating}
                >
                  <Icon name="sparkles" size={10} /> 4 varyasyon üret
                </button>
              </div>
            </div>

            {/* Visual grid */}
            {generatedImages.length === 0 && (
              <div style={{
                padding: '24px 14px', textAlign: 'center', border: '1px dashed var(--border)',
                borderRadius: 6, color: 'var(--fg-3)', fontSize: 12, marginBottom: 10,
              }}>
                Henüz görsel üretilmedi. "Görsel Üret" veya "4 varyasyon üret" ile başla.
              </div>
            )}
            <div style={{ display: generatedImages.length ? 'grid' : 'none', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {(generatedImages.length ? generatedImages : []).map((v: any, i: number) => {
                const bg = BRAND_PALETTE[i % BRAND_PALETTE.length];
                const isReal = !!v.url;
                return (
                  <a
                    key={v.url || i}
                    href={v.url || undefined}
                    target={isReal ? '_blank' : undefined}
                    rel="noreferrer"
                    title={v.prompt || ''}
                    style={{
                      aspectRatio: '4/5',
                      background: isReal ? '#0c0c0c' : `linear-gradient(135deg, ${bg}, ${BRAND_PALETTE[(i+2)%BRAND_PALETTE.length]})`,
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      position: 'relative',
                      overflow: 'hidden',
                      cursor: isReal ? 'zoom-in' : 'pointer',
                      display: 'block',
                      textDecoration: 'none',
                    }}
                  >
                    {isReal ? (
                      <img
                        src={v.url}
                        alt={v.prompt || 'generated'}
                        loading="lazy"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
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
                    )}
                    <div style={{
                      position: 'absolute', bottom: 8, left: 10, right: 10,
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 9,
                      color: isReal ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)',
                      textShadow: isReal ? '0 1px 2px rgba(0,0,0,0.6)' : 'none',
                    }} className="mono">
                      <span>{v.kind || 'product'}</span>
                      <span>{v.ts}</span>
                    </div>
                  </a>
                );
              })}
            </div>
            {generating && (
              <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 10 }}>
                Üretiliyor… Bedrock'tan yanıt bekleniyor (20–60s).
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// PRICING — Fiyat & Finans
export { BrandPage };
export default BrandPage;
