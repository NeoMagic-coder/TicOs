// @ts-nocheck
// ============================================================
// AGENT.OS — Tools registry (OpenClaw)
// ============================================================
import React, { useState, useEffect, useMemo } from 'react';
import { Icon, AgentAvatar } from '@/components/AOS/widgets';
import { AGENTS } from '@/data/aos/mockData';
import { useAdaptedTools } from '@/lib/aos/adapter';
import { useStore } from '@/stores/useStore';
import { BASE_URL } from '@/lib/api';
import { pushToast } from '@/components/AOS/Toast';

const PROVIDER_META = {
  shopify:   { color: '#95BF47', glyph: 'sh' },
  trendyol:  { color: '#F27A1A', glyph: 'ty' },
  google:    { color: '#4285F4', glyph: 'go' },
  meta:      { color: '#0866FF', glyph: 'fb' },
  gemini:    { color: '#9B7BFF', glyph: 'gm' },
  internal:  { color: '#7C8497', glyph: '·' },
};

const ToolRow = ({ tool, selected, onSelect }) => {
  const p = PROVIDER_META[tool.provider] || PROVIDER_META.internal;
  const hasStats = tool.calls != null && tool.calls > 0;
  return (
    <div
      onClick={() => onSelect(tool)}
      className="row"
      style={{
        gridTemplateColumns: '26px 1.5fr 1fr 90px 80px 90px 1fr',
        cursor: 'pointer',
        background: selected ? 'var(--bg-2)' : 'transparent',
        borderLeft: selected ? '2px solid var(--acid)' : '2px solid transparent',
      }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: 3,
        background: p.color + '22', color: p.color,
        border: `1px solid ${p.color}44`,
        display: 'grid', placeItems: 'center',
        fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
      }}>{p.glyph}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>{tool.name}</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tool.id}</div>
      </div>
      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{tool.category}</span>
      <span style={{ alignSelf: 'center', justifySelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <span className={`chip ${tool.mode === 'live' ? 'chip--acid' : ''}`} title={tool.degraded ? `degraded: ${tool.degradedReason || 'breaker open'}` : tool.mode}>
          {tool.mode}
        </span>
        {tool.degraded && (
          <span title={tool.degradedReason || 'son canlı çağrı mock\'a düştü'} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }} />
        )}
      </span>
      <span className="mono tnum" style={{ fontSize: 11, color: tool.calls != null ? 'var(--fg-2)' : 'var(--fg-4)', textAlign: 'right' }}>
        {tool.calls != null ? tool.calls : '—'}
      </span>
      <span className="mono tnum" style={{ fontSize: 11, color: tool.ms != null ? 'var(--fg-2)' : 'var(--fg-4)', textAlign: 'right' }}>
        {tool.ms != null ? tool.ms + 'ms' : '—'}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {hasStats && tool.success != null ? (
          <>
            <div style={{ flex: 1, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                width: tool.success + '%', height: '100%',
                background: tool.success > 98 ? 'var(--acid)' : tool.success >= 90 ? 'var(--amber)' : 'var(--rose)',
              }} />
            </div>
            <span className="mono tnum" style={{ fontSize: 10, color: 'var(--fg-3)', width: 38, textAlign: 'right' }}>{tool.success.toFixed(1)}%</span>
          </>
        ) : (
          <span className="mono" style={{ fontSize: 10, color: 'var(--fg-4)', width: '100%', textAlign: 'right' }}>henüz çağrı yok</span>
        )}
      </div>
    </div>
  );
};

const ToolDetail = ({ tool }) => {
  if (!tool) return null;
  const p = PROVIDER_META[tool.provider] || PROVIDER_META.internal;
  // Real allowed-agents list from the manifest (the previous version showed
  // the first 4 agents regardless of permission).
  const allowedIds: string[] = Array.isArray(tool.allowed_agents) ? tool.allowed_agents : [];
  const allowed = allowedIds.length
    ? allowedIds.map((id: string) => AGENTS.find((a) => a.id === id) || { id, name: id, glyph: id.slice(0, 2).toUpperCase(), accent: '#7C8497' })
    : [];
  const schemaText = tool.input_schema ? JSON.stringify(tool.input_schema, null, 2) : '— manifest input schema sağlamıyor —';
  return (
    <div className="panel" style={{ position: 'sticky', top: 0 }}>
      <div className="panel__head">
        <h3>{tool.name}</h3>
        <span className="panel__head-tag">{tool.id}</span>
      </div>
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 3,
            background: p.color + '22', color: p.color,
            border: `1px solid ${p.color}44`,
            display: 'grid', placeItems: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
          }}>{p.glyph}</span>
          <div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--fg-2)' }}>{tool.provider}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{tool.category} · {tool.mode}{tool.requires_approval ? ' · onay gerekli' : ''}</div>
          </div>
        </div>

        {tool.description && (
          <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5, marginBottom: 12 }}>
            {tool.description}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {(() => {
            const lastAge = tool.lastCalledAt
              ? (() => {
                  const s = Math.round((Date.now() - new Date(tool.lastCalledAt).getTime()) / 1000);
                  if (s < 60) return `${s}s önce`;
                  if (s < 3600) return `${Math.round(s / 60)} dk önce`;
                  if (s < 86400) return `${Math.round(s / 3600)} sa önce`;
                  return `${Math.round(s / 86400)} gün önce`;
                })()
              : null;
            return [
              { l: 'Toplam Çağrı',  v: tool.calls != null ? String(tool.calls) : '—' },
              { l: 'Avg gecikme',   v: tool.ms != null ? `${tool.ms}ms` : (tool.timeout_ms != null ? `≤ ${tool.timeout_ms}ms (timeout)` : '—') },
              { l: 'Başarı',        v: tool.success != null ? `${tool.success.toFixed(1)}%` : '—' },
              { l: 'Çağrı maliyet', v: tool.cost != null ? `$${tool.cost}` : '—' },
              { l: 'Son çağrı',     v: lastAge || '—' },
              { l: 'Durum',         v: tool.degraded ? `⚠ ${tool.degradedReason || 'degraded'}` : (tool.mode === 'live' ? '✓ ok' : '—') },
            ];
          })().map((s: any) => (
            <div key={s.l}>
              <div className="label-eyebrow">{s.l}</div>
              <div className="mono tnum" style={{ fontSize: 14, color: s.v === '—' ? 'var(--fg-4)' : (String(s.v).startsWith('⚠') ? 'var(--amber)' : 'var(--fg-1)') }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div className="label-eyebrow" style={{ marginBottom: 6 }}>Input Şeması</div>
        <div className="term" style={{ fontSize: 11, marginBottom: 12, whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>
          {schemaText}
        </div>

        <div className="label-eyebrow" style={{ marginBottom: 6 }}>
          İzinli Ajanlar {allowedIds.length === 0 && <span className="mono" style={{ color: 'var(--fg-4)', fontSize: 10, marginLeft: 4 }}>(tüm ajanlara açık)</span>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {allowed.length === 0 ? (
            <span className="mono" style={{ fontSize: 10, color: 'var(--fg-4)' }}>— kısıtlama yok —</span>
          ) : allowed.map((a: any) => (
            <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 6px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 3 }}>
              <AgentAvatar agent={a} size={12} />
              <span className="mono" style={{ fontSize: 10, color: 'var(--fg-2)' }}>{a.id}</span>
            </span>
          ))}
        </div>

        <div className="label-eyebrow" style={{ marginBottom: 6 }}>Etiketler</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 14 }}>
          {tool.tags.map(t => <span key={t} className="chip">{t}</span>)}
        </div>

        <button
          className="btn btn--primary"
          style={{ width: '100%' }}
          onClick={async () => {
            try {
              // Tool execute requires agent_id; pick the first allowed agent
              // for this tool (or fall back to supervisor).
              const agentId: string =
                (Array.isArray((tool as any).allowed_agents) && (tool as any).allowed_agents[0])
                || 'supervisor';
              const res = await fetch(`${BASE_URL}/api/v1/tools/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tool_id: tool.id, agent_id: agentId, input: {}, dry_run: true }),
                signal: AbortSignal.timeout(6000),
              });
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const data = await res.json();
              pushToast({ kind: 'success', title: `${tool.name} sandbox`, body: `Durum: ${data?.status || 'ok'} · gecikme ${data?.duration_ms ?? '?'}ms` });
            } catch (e: any) {
              pushToast({ kind: 'warn', title: 'Sandbox başarısız', body: e?.message || String(e) });
            }
          }}
        >
          <Icon name="play" size={12} /> Sandbox'ta Çalıştır
        </button>
      </div>
    </div>
  );
};

const ToolsPage = () => {
  // No fallback to mockData — the page shows an empty state if the backend
  // manifest hasn't been loaded yet (loadTools fires on app mount).
  const TOOLS = useAdaptedTools();
  const hasTools = TOOLS.length > 0;
  const loadTools = useStore((s: any) => s.loadTools);

  const [cat, setCat] = useState('all');
  const [mode, setMode] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(TOOLS[0]);
  const [scanning, setScanning] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const rescan = async () => {
    setScanning(true);
    try {
      await loadTools();
      pushToast({ kind: 'success', title: 'Manifest taraması bitti', body: `${TOOLS.length} tool yenilendi.` });
    } catch (e: any) {
      pushToast({ kind: 'warn', title: 'Tarama başarısız', body: e?.message || String(e) });
    } finally {
      setScanning(false);
    }
  };

  const handleAddManifest = () => {
    fileInputRef.current?.click();
  };
  const onManifestFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      // Best-effort: POST to backend (endpoint may not exist).
      try {
        await fetch(`${BASE_URL}/api/v1/tools`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(items),
          signal: AbortSignal.timeout(3000),
        });
      } catch {
        // Backend unavailable — keep going so the user sees feedback.
      }
      pushToast({ kind: 'success', title: 'Manifest yüklendi', body: `${items.length} tool eklendi (local).` });
      await loadTools();
    } catch (e: any) {
      pushToast({ kind: 'error', title: 'Manifest okunamadı', body: e?.message || String(e) });
    }
  };

  const filtered = useMemo(() => {
    return TOOLS.filter(t => {
      if (cat !== 'all' && t.category !== cat) return false;
      if (mode !== 'all' && t.mode !== mode) return false;
      if (q && !t.name.toLowerCase().includes(q.toLowerCase()) && !t.id.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [cat, mode, q, TOOLS]);

  // Totals only consider tools that actually reported stats — otherwise we'd
  // pretend "0 calls" was a measurement when the backend simply hasn't filled
  // the stats payload yet.
  const toolsWithCalls = TOOLS.filter((t: any) => typeof t.calls === 'number');
  const totalCalls = toolsWithCalls.reduce((s: number, t: any) => s + (t.calls || 0), 0);
  const totalCost = toolsWithCalls.reduce(
    (s: number, t: any) => s + (typeof t.cost === 'number' ? t.cost * (t.calls || 0) : 0),
    0,
  );
  const hasUsageStats = totalCalls > 0;

  // Real per-category counts from the live tool list (the previous version
  // pulled hardcoded numbers from mockData.TOOL_CATEGORIES that didn't match
  // reality after manifests changed).
  const dynamicCategories = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const t of TOOLS) byCat[t.category] = (byCat[t.category] || 0) + 1;
    const ordered = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    return [{ id: 'all', label: 'Tümü', count: TOOLS.length }, ...ordered.map(([id, count]) => ({ id, label: id, count }))];
  }, [TOOLS]);

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> ARAÇLAR</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            OpenClaw Registry
            <span className="page__title-tag">{TOOLS.length} TOOL</span>
          </h1>
          <p className="page__sub">
            Tüm araçların manifest kaydı — kategori, izinli ajanlar, mock/live durumu, ortalama gecikme ve maliyet.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost" onClick={rescan} disabled={scanning}>
            <Icon name="refresh" size={12} /> {scanning ? 'Taranıyor…' : 'Yeniden Tara'}
          </button>
          <button
            className="btn"
            onClick={handleAddManifest}
            title="JSON manifest dosyası yükle (tool_id, name, category, input_schema…)"
            aria-label="Tool manifest JSON dosyası yükle"
          >
            <Icon name="plus" size={12} /> Manifest Ekle (.json)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => onManifestFile(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      {/* Stats strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1, background: 'var(--border-faint)',
        border: '1px solid var(--border)', borderRadius: 6,
        marginBottom: 16, overflow: 'hidden',
      }}>
        {(() => {
          const liveTools = TOOLS.filter((t: any) => t.mode === 'live').length;
          const mockTools = TOOLS.length - liveTools;
          const liveProviders = new Set(TOOLS.filter((t: any) => t.mode === 'live').map((t: any) => t.provider));
          return [
            { l: 'Toplam Tool',   v: String(TOOLS.length),                              sub: `${new Set(TOOLS.map((t: any) => t.category)).size} kategori` },
            { l: 'Toplam Çağrı',  v: hasUsageStats ? totalCalls.toLocaleString('tr-TR') : '—', sub: hasUsageStats ? 'gerçek kullanım' : 'henüz çağrı kaydı yok' },
            { l: 'Toplam Maliyet', v: hasUsageStats ? '$' + totalCost.toFixed(2) : '—', sub: hasUsageStats ? 'tüm çağrılar' : 'maliyet hesaplanmıyor' },
            { l: 'Live / Mock',   v: `${liveTools} / ${mockTools}`,                     sub: `${liveProviders.size} provider canlı` },
          ];
        })().map(s => (
          <div key={s.l} style={{ padding: '12px 16px', background: 'var(--bg-1)' }}>
            <div className="label-eyebrow" style={{ marginBottom: 4 }}>{s.l}</div>
            <div className="tnum" style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em' }}>{s.v}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 4, padding: '4px 8px',
        }}>
          <Icon name="search" size={12} color="var(--fg-3)" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Tool ara…"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--fg-1)', fontSize: 12, width: 180,
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'live', 'mock'] as const).map(m => {
            const count = m === 'all' ? TOOLS.length : TOOLS.filter((t: any) => t.mode === m).length;
            const label = m === 'all' ? 'Tüm Modlar' : m === 'live' ? '● live' : '○ mock';
            return (
              <button key={m} className="btn btn--sm" onClick={() => setMode(m)}
                title={`${m === 'all' ? 'Tümü' : m} · ${count} tool`}
                style={{
                  background: mode === m ? 'var(--bg-3)' : 'var(--bg-1)',
                  borderColor: mode === m ? 'var(--border-strong)' : 'var(--border)',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                {label}
                <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{count}</span>
              </button>
            );
          })}
        </div>
        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {dynamicCategories.slice(0, 12).map((c) => (
            <button key={c.id} className="btn btn--sm" onClick={() => setCat(c.id)}
              style={{
                background: cat === c.id ? 'var(--acid-soft)' : 'var(--bg-1)',
                color: cat === c.id ? 'var(--acid)' : 'var(--fg-2)',
                borderColor: cat === c.id ? 'var(--border-accent)' : 'var(--border)',
              }}>
              <span className="mono">{c.label}</span>
              <span style={{ color: 'var(--fg-4)', marginLeft: 4 }}>{c.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* List + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
        <div className="panel">
          <div className="row" style={{
            gridTemplateColumns: '26px 1.5fr 1fr 90px 80px 90px 1fr',
            background: 'var(--bg-2)',
            borderBottom: '1px solid var(--border)',
            padding: '8px 14px',
          }}>
            <span />
            <span className="label-eyebrow">Tool</span>
            <span className="label-eyebrow">Kategori</span>
            <span className="label-eyebrow">Mod</span>
            <span className="label-eyebrow" style={{ textAlign: 'right' }}>Çağrı</span>
            <span className="label-eyebrow" style={{ textAlign: 'right' }}>Gecikme</span>
            <span className="label-eyebrow">Başarı</span>
          </div>
          <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {filtered.map(t => (
              <ToolRow key={t.id} tool={t} selected={selected?.id === t.id} onSelect={setSelected} />
            ))}
            {!filtered.length && hasTools && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }} className="mono">
                filtreyle eşleşen tool yok
              </div>
            )}
            {!hasTools && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }} className="mono">
                — manifest yüklenmedi —
                <div style={{ marginTop: 10, fontSize: 11 }}>
                  Backend `/api/v1/tools` boş döndü ya da erişilemiyor.
                </div>
                <button className="btn btn--sm" style={{ marginTop: 12 }} onClick={rescan} disabled={scanning}>
                  <Icon name="refresh" size={10} /> {scanning ? 'Taranıyor…' : 'Yeniden Tara'}
                </button>
              </div>
            )}
          </div>
        </div>
        <ToolDetail tool={selected} />
      </div>
    </div>
  );
};




export default ToolsPage;
