/* global React, AOSWidgets, AGENT_OS_DATA */
// ============================================================
// AGENT.OS — Supervisor (Chat) page
// Streaming execution view: prompt → plan → tool calls → answer
// ============================================================
const { useState, useEffect, useRef, useMemo } = React;
const { Icon, StatusDot, AgentAvatar } = window.AOSWidgets;
const { AGENT_BY_ID, AGENTS } = window.AGENT_OS_DATA;

// ----- Pre-scripted streaming exchange -----
const SAMPLE = {
  user: 'Mayıs ayında Trendyol kanalını büyütmek istiyorum. Önce mevcut durumu özetle, sonra büyüme planını çıkar.',
  steps: [
    { kind: 'plan',       agent: 'supervisor', label: 'TaskGraph oluşturuldu', meta: { primary: 'market_research_agent', supporting: 'analytics_agent, pricing_agent, marketing_agent', nodes: 7 }, t: 600 },
    { kind: 'agent_run',  agent: 'market_research_agent',   label: 'Pazar & rakip taraması başlatıldı', t: 1200 },
    { kind: 'tool',       agent: 'market_research_agent',   tool: 'trendyol_category_analysis', dur: 1820, t: 1800 },
    { kind: 'tool',       agent: 'market_research_agent',   tool: 'competitor_profile_builder', dur: 2240, t: 2400 },
    { kind: 'agent_done', agent: 'market_research_agent',   summary: 'Cilt bakımı kategorisi son 30 günde %18 büyüdü · Top 3 rakip avg ₺234 · senin pozisyon ₺219 (-%6.4).', dur: 4060, t: 3500 },
    { kind: 'agent_run',  agent: 'analytics_agent',         label: 'GA4 + Trendyol seans analizi', t: 4200 },
    { kind: 'tool',       agent: 'analytics_agent',         tool: 'ga4_sessions_report',         dur: 982,  t: 4500 },
    { kind: 'tool',       agent: 'analytics_agent',         tool: 'analytics_channel_perf',      dur: 412,  t: 5000 },
    { kind: 'agent_done', agent: 'analytics_agent',         summary: 'Trendyol 1,840 seans/gün · dönüşüm %1.9 · ROAS 2.8x · trafik %78 mobile.', dur: 1394, t: 5800 },
    { kind: 'agent_run',  agent: 'pricing_agent',           label: 'Marj-bilinçli fiyat pozisyonu', t: 6300 },
    { kind: 'tool',       agent: 'pricing_agent',           tool: 'competitor_price_lookup',     dur: 254,  t: 6600 },
    { kind: 'tool',       agent: 'pricing_agent',           tool: 'margin_calculator',           dur: 12,   t: 6900 },
    { kind: 'agent_done', agent: 'pricing_agent',           summary: 'Öneri: ₺239 — rakip ortalamasının %2 altında, marj +3.4 puan, dönüşüm tahmin -%1.1.', dur: 266, t: 7400 },
    { kind: 'critic',     agent: 'critic',                  scores: { concreteness: 0.91, numeric: 0.86, halluc: 0.08 }, t: 7900 },
    { kind: 'merge',      agent: 'supervisor', t: 8300 },
    { kind: 'final',      t: 8800 },
  ],
  final: `**Mevcut durum (Trendyol)**
- Kategori 30 günde +%18 büyüdü; top 3 rakip ortalama ₺234.
- Senin liste fiyat ₺219 (rakipten -%6.4), dönüşüm %1.9, ROAS 2.8x.
- Trafik %78 mobile · sepete ekleme %4.2 ama checkout %1.9 (mobil checkout darboğaz).

**3 maddelik büyüme planı**
1. **Fiyatı ₺239'a çek** (-%2 rakip altı): marj +3.4 puan, dönüşüm -%1.1, net gelir +%4.8.
2. **Mobile checkout deneyimini onar**: 1-tıkla giriş + adres autofill. Beklenen dönüşüm +%0.6.
3. **Trendyol+Meta kombo kampanyası**: 250 ₺/gün → 400 ₺/gün artış, ROAS hedef 3.2x.

Toplam hedef: Mayıs Trendyol satışı +%28 (₺28.1k → ₺36.0k).`,
};

// Tek mesaj tipi: chat history
// { role: 'user' | 'system' | 'final', content }

const TimelineStep = ({ step }) => {
  const agent = AGENT_BY_ID[step.agent] || { name: 'critic', glyph: 'CR', accent: '#9B7BFF', role: 'Critic' };
  if (step.kind === 'plan') {
    return (
      <div style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
        <AgentAvatar agent={agent} size={22} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 500 }}>
            <span style={{ color: 'var(--fg-1)' }}>{agent.name}</span>
            <span style={{ color: 'var(--fg-3)', marginLeft: 6 }} className="mono">— {step.label}</span>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
            primary={step.meta.primary} · supporting=[{step.meta.supporting}] · nodes={step.meta.nodes}
          </div>
        </div>
      </div>
    );
  }
  if (step.kind === 'agent_run') {
    return (
      <div style={{ display: 'flex', gap: 10, padding: '8px 0', alignItems: 'flex-start' }}>
        <AgentAvatar agent={agent} size={22} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: agent.accent, fontWeight: 500 }}>{agent.name}</span>
            <span className="chip chip--amber" style={{ marginLeft: 8 }}>çalışıyor</span>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>{step.label}<span className="caret" /></div>
        </div>
      </div>
    );
  }
  if (step.kind === 'tool') {
    return (
      <div style={{ display: 'flex', gap: 10, padding: '4px 0 4px 32px', alignItems: 'center' }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--fg-3)', display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <Icon name="tools" size={11} color="var(--fg-3)" />
          <span style={{ color: 'var(--cyan)' }}>{step.tool}</span>
          <span style={{ color: 'var(--fg-4)' }}>·</span>
          <span className="tnum">{step.dur}ms</span>
          <Icon name="check" size={11} color="var(--acid)" />
        </span>
      </div>
    );
  }
  if (step.kind === 'agent_done') {
    return (
      <div style={{ display: 'flex', gap: 10, padding: '8px 0', alignItems: 'flex-start' }}>
        <AgentAvatar agent={agent} size={22} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: agent.accent, fontWeight: 500 }}>{agent.name}</span>
            <span className="chip chip--acid" style={{ marginLeft: 8 }}>tamamlandı · {(step.dur/1000).toFixed(1)}s</span>
          </div>
          <div style={{
            fontSize: 12, color: 'var(--fg-2)', marginTop: 6,
            padding: '8px 10px',
            background: 'var(--bg-inset)',
            border: '1px solid var(--border-faint)',
            borderLeft: `2px solid ${agent.accent}`,
            borderRadius: 3,
            lineHeight: 1.5,
          }}>{step.summary}</div>
        </div>
      </div>
    );
  }
  if (step.kind === 'critic') {
    return (
      <div style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
        <span style={{
          width: 22, height: 22, borderRadius: 3,
          background: 'rgba(155,123,255,0.15)', color: 'var(--violet)',
          border: '1px solid rgba(155,123,255,0.3)',
          display: 'grid', placeItems: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
        }}>CR</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--violet)', fontWeight: 500 }}>Critic</span>
            <span className="mono" style={{ marginLeft: 6, color: 'var(--fg-3)' }}>çıktı kalite skoru</span>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4, display: 'flex', gap: 14 }}>
            <span>concreteness <span style={{ color: 'var(--acid)' }}>{step.scores.concreteness}</span></span>
            <span>numeric <span style={{ color: 'var(--acid)' }}>{step.scores.numeric}</span></span>
            <span>halluc <span style={{ color: 'var(--acid)' }}>{step.scores.halluc}</span></span>
          </div>
        </div>
      </div>
    );
  }
  if (step.kind === 'merge') {
    return (
      <div style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
        <AgentAvatar agent={agent} size={22} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--violet)', fontWeight: 500 }}>Supervisor</span>
            <span className="mono" style={{ marginLeft: 6, color: 'var(--fg-3)' }}>3 ajan çıktısı birleştiriliyor (TR özet)…<span className="caret" /></span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// ----- Markdown-ish render for final answer -----
const renderFinal = (text) => {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.startsWith('**') && line.endsWith('**')) {
      return <div key={i} style={{ fontWeight: 600, color: 'var(--fg-1)', marginTop: 12, marginBottom: 4, fontSize: 13 }}>{line.replace(/\*\*/g, '')}</div>;
    }
    if (line.startsWith('- ')) {
      return <div key={i} style={{ display: 'flex', gap: 8, padding: '2px 0', fontSize: 13, color: 'var(--fg-2)' }}>
        <span style={{ color: 'var(--acid)' }}>·</span>
        <span dangerouslySetInnerHTML={{ __html: line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--fg-1)">$1</strong>') }} />
      </div>;
    }
    if (/^\d+\./.test(line)) {
      const [num, ...rest] = line.split('. ');
      return <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 13, color: 'var(--fg-2)' }}>
        <span className="mono" style={{ color: 'var(--acid)', minWidth: 16 }}>{num}.</span>
        <span dangerouslySetInnerHTML={{ __html: rest.join('. ').replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--fg-1)">$1</strong>') }} />
      </div>;
    }
    if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
    return <div key={i} style={{ fontSize: 13, color: 'var(--fg-2)', padding: '2px 0' }}>{line}</div>;
  });
};

// ============================================================
// Page
// ============================================================
const SupervisorPage = () => {
  const [exchanges, setExchanges] = useState([
    { id: 1, user: SAMPLE.user, steps: [], final: null, complete: false }
  ]);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const scrollRef = useRef(null);

  // Replay sample on mount
  useEffect(() => {
    if (!running) return;
    if (stepIdx >= SAMPLE.steps.length) {
      // Show final
      setTimeout(() => {
        setExchanges(prev => prev.map((e, i) => i === 0 ? { ...e, final: SAMPLE.final, complete: true } : e));
        setRunning(false);
      }, 500);
      return;
    }
    const next = SAMPLE.steps[stepIdx];
    const prev = SAMPLE.steps[stepIdx - 1];
    const delay = next.t - (prev?.t || 0);
    const id = setTimeout(() => {
      setExchanges(es => es.map((e, i) => i === 0 ? { ...e, steps: [...e.steps, next] } : e));
      setStepIdx(s => s + 1);
    }, Math.max(200, delay));
    return () => clearTimeout(id);
  }, [stepIdx, running]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [exchanges]);

  const send = (text) => {
    if (!text.trim()) return;
    setInput('');
    setExchanges(es => [...es, { id: Date.now(), user: text, steps: [{ kind: 'plan', agent: 'supervisor', label: 'Planlanıyor…', meta: { primary: '…', supporting: '…', nodes: '?' } }], final: '⏳ Backend bağlanmadı (mock supervisor)', complete: true }]);
  };

  return (
    <div className="page" style={{ paddingBottom: 0, height: '100%', display: 'flex', flexDirection: 'column', maxWidth: 'none' }}>
      <div className="page__breadcrumb mono">HOME <span>›</span> SUPERVISOR</div>
      <div className="page__header" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="page__title">
            Supervisor
            <span className="page__title-tag">HERMES · SSE</span>
            <span className="chip chip--acid">
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--acid)', boxShadow: '0 0 6px var(--acid)' }} />
              CANLI
            </span>
          </h1>
          <p className="page__sub">
            Doğal dilde komut ver — Hermes uygun ajanlara dağıtır, OpenClaw araçları çağırır, Critic puanlar.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost"><Icon name="refresh" size={12} /> Yeni Görev</button>
          <button className="btn"><Icon name="graph" size={12} /> Grafik Görünüm</button>
        </div>
      </div>

      {/* Conversation area */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto',
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: 20,
        marginBottom: 12,
      }}>
        {exchanges.map(ex => (
          <div key={ex.id} style={{ marginBottom: 32 }}>
            {/* user message */}
            <div style={{
              display: 'flex', gap: 10, justifyContent: 'flex-end', marginBottom: 14,
            }}>
              <div style={{
                maxWidth: '70%',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '10px 14px',
                fontSize: 13,
                color: 'var(--fg-1)',
                lineHeight: 1.5,
              }}>{ex.user}</div>
              <span style={{
                width: 28, height: 28, borderRadius: 4,
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                display: 'grid', placeItems: 'center', color: 'var(--fg-3)', flex: 'none',
              }}><Icon name="user" size={14} /></span>
            </div>

            {/* execution timeline */}
            {ex.steps.length > 0 && (
              <div style={{
                position: 'relative', marginLeft: 6,
                paddingLeft: 20, borderLeft: '1px dashed var(--border)',
              }}>
                <div style={{
                  position: 'absolute', left: -8, top: 0,
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'var(--bg-1)', border: '1px solid var(--violet)',
                  display: 'grid', placeItems: 'center',
                }}>
                  <Icon name="sparkles" size={8} color="var(--violet)" />
                </div>
                <div className="label-eyebrow" style={{ marginBottom: 6, color: 'var(--violet)' }}>
                  HERMES YÜRÜTME · {ex.steps.length} olay
                </div>
                {ex.steps.map((s, i) => <TimelineStep key={i} step={s} />)}
              </div>
            )}

            {/* final answer */}
            {ex.final && (
              <div style={{
                marginTop: 16,
                background: 'var(--bg-0)',
                border: '1px solid var(--border)',
                borderLeft: '2px solid var(--acid)',
                borderRadius: 6,
                padding: '14px 18px',
              }}>
                <div className="label-eyebrow" style={{ marginBottom: 8, color: 'var(--acid)' }}>
                  YÖNETICI ÖZETI · CONFIDENCE 0.89
                </div>
                <div>{typeof ex.final === 'string' ? renderFinal(ex.final) : ex.final}</div>
                {ex.complete && (
                  <div style={{
                    marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-faint)',
                    display: 'flex', alignItems: 'center', gap: 10, fontSize: 11,
                  }} className="mono">
                    <span style={{ color: 'var(--fg-3)' }}>3 ajan · 7 tool · 8.8s · $0.018</span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <button className="btn btn--sm btn--ghost"><Icon name="check" size={10} /> İyi</button>
                      <button className="btn btn--sm btn--ghost"><Icon name="x" size={10} /> Hata</button>
                      <button className="btn btn--sm"><Icon name="graph" size={10} /> DAG Aç</button>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: 10,
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span className="label-eyebrow" style={{ color: 'var(--violet)' }}>
            <span style={{ color: 'var(--acid)' }}>›</span> SUPERVISOR
          </span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
            mode: <span style={{ color: 'var(--acid)' }}>autonomous</span> · model: <span style={{ color: 'var(--fg-2)' }}>gemini-2.5-flash-lite</span>
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {['/plan', '/price', '/reviews', '/reorder'].map(c => (
              <button key={c} className="btn btn--sm btn--ghost" onClick={() => setInput(c + ' ')}>{c}</button>
            ))}
          </span>
        </div>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Görev yaz veya / ile slash komut çalıştır… (Enter gönder · Shift+Enter yeni satır)"
          style={{
            width: '100%', minHeight: 60,
            background: 'transparent', border: 'none', outline: 'none',
            resize: 'vertical', color: 'var(--fg-1)', fontSize: 13,
            lineHeight: 1.5, fontFamily: 'var(--font-sans)',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-faint)' }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
            ⌘K komut paleti · ⌘↵ gönder
          </span>
          <span style={{ marginLeft: 'auto' }} />
          <button className="btn btn--primary" onClick={() => send(input)}>
            <Icon name="zap" size={12} /> Gönder
          </button>
        </div>
      </div>
    </div>
  );
};

window.AOSPages = window.AOSPages || {};
window.AOSPages.Supervisor = SupervisorPage;
