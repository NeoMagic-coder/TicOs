/* global React, AOSWidgets, AGENT_OS_DATA */
// ============================================================
// AGENT.OS — Tools registry (OpenClaw)
// ============================================================
const { useState, useEffect, useMemo } = React;
const { Icon, AgentAvatar } = window.AOSWidgets;
const { TOOLS, TOOL_CATEGORIES, AGENTS } = window.AGENT_OS_DATA;

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
      <span className={`chip ${tool.mode === 'live' ? 'chip--acid' : ''}`} style={{ alignSelf: 'center', justifySelf: 'flex-start' }}>
        {tool.mode}
      </span>
      <span className="mono tnum" style={{ fontSize: 11, color: 'var(--fg-2)', textAlign: 'right' }}>{tool.calls}</span>
      <span className="mono tnum" style={{ fontSize: 11, color: 'var(--fg-2)', textAlign: 'right' }}>{tool.ms}ms</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            width: tool.success + '%', height: '100%',
            background: tool.success > 98 ? 'var(--acid)' : 'var(--amber)',
          }} />
        </div>
        <span className="mono tnum" style={{ fontSize: 10, color: 'var(--fg-3)', width: 38, textAlign: 'right' }}>{tool.success.toFixed(1)}%</span>
      </div>
    </div>
  );
};

const ToolDetail = ({ tool }) => {
  if (!tool) return null;
  const p = PROVIDER_META[tool.provider] || PROVIDER_META.internal;
  // Find agents allowed to use it (mock — by category match)
  const allowed = AGENTS.slice(0, 4);
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
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{tool.category} · {tool.mode}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[
            { l: 'Çağrı (24h)',  v: tool.calls.toString() },
            { l: 'Avg gecikme',  v: tool.ms + 'ms' },
            { l: 'Başarı',       v: tool.success.toFixed(1) + '%' },
            { l: 'Çağrı maliyet',v: '$' + tool.cost },
          ].map(s => (
            <div key={s.l}>
              <div className="label-eyebrow">{s.l}</div>
              <div className="mono tnum" style={{ fontSize: 14, color: 'var(--fg-1)' }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div className="label-eyebrow" style={{ marginBottom: 6 }}>Input Şeması</div>
        <div className="term" style={{ fontSize: 11, marginBottom: 12 }}>
{`{
  "type": "object",
  "properties": {
    "sku": { "type": "string" },
    "currency": { "type": "string", "default": "TRY" }
  },
  "required": ["sku"]
}`}
        </div>

        <div className="label-eyebrow" style={{ marginBottom: 6 }}>İzinli Ajanlar</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {allowed.map(a => (
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

        <button className="btn btn--primary" style={{ width: '100%' }}>
          <Icon name="play" size={12} /> Sandbox'ta Çalıştır
        </button>
      </div>
    </div>
  );
};

const ToolsPage = () => {
  const [cat, setCat] = useState('all');
  const [mode, setMode] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(TOOLS[0]);

  const filtered = useMemo(() => {
    return TOOLS.filter(t => {
      if (cat !== 'all' && t.category !== cat) return false;
      if (mode !== 'all' && t.mode !== mode) return false;
      if (q && !t.name.toLowerCase().includes(q.toLowerCase()) && !t.id.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [cat, mode, q]);

  const totalCalls = TOOLS.reduce((s, t) => s + t.calls, 0);
  const totalCost  = TOOLS.reduce((s, t) => s + t.cost * t.calls, 0);

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> ARAÇLAR</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            OpenClaw Registry
            <span className="page__title-tag">76 TOOL</span>
          </h1>
          <p className="page__sub">
            Tüm araçların manifest kaydı — kategori, izinli ajanlar, mock/live durumu, ortalama gecikme ve maliyet.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost"><Icon name="refresh" size={12} /> Yeniden Tara</button>
          <button className="btn"><Icon name="plus" size={12} /> Manifest Ekle</button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1, background: 'var(--border-faint)',
        border: '1px solid var(--border)', borderRadius: 6,
        marginBottom: 16, overflow: 'hidden',
      }}>
        {[
          { l: 'Toplam Tool',   v: '76',                                       sub: '14 manifest dosyası' },
          { l: 'Toplam Çağrı (24h)', v: totalCalls.toLocaleString('tr-TR'),         sub: 'orchestrator + scheduler' },
          { l: 'Toplam Maliyet (24h)',  v: '$' + totalCost.toFixed(2),               sub: 'bütçenin %2.8\'i' },
          { l: 'Live / Mock',   v: '12 / 64',                                  sub: '8 entegrasyon canlı' },
        ].map(s => (
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
          {['all','live','mock'].map(m => (
            <button key={m} className="btn btn--sm" onClick={() => setMode(m)}
              style={{
                background: mode === m ? 'var(--bg-3)' : 'var(--bg-1)',
                borderColor: mode === m ? 'var(--border-strong)' : 'var(--border)',
              }}>
              {m === 'all' ? 'Tüm Modlar' : m === 'live' ? '● live' : '○ mock'}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {TOOL_CATEGORIES.slice(0, 10).map(c => (
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
            {!filtered.length && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }} className="mono">
                eşleşen tool yok
              </div>
            )}
          </div>
        </div>
        <ToolDetail tool={selected} />
      </div>
    </div>
  );
};

window.AOSPages = window.AOSPages || {};
window.AOSPages.Tools = ToolsPage;
