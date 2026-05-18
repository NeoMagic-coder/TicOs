/* global React, AOSWidgets, AGENT_OS_DATA */
// ============================================================
// AGENT.OS — Live Task Graph (Hermes DAG visualization)
// Centerpiece: a real-time view of a multi-agent execution plan.
// ============================================================
const { useState, useEffect, useRef, useMemo } = React;
const { Icon, StatusDot, AgentAvatar } = window.AOSWidgets;
const { AGENT_BY_ID, AGENTS } = window.AGENT_OS_DATA;

// ----- Graph definition: real "scale Trendyol channel" plan -----
const GRAPH = {
  task_id: 't_8c3f42',
  task: 'Trendyol kanalını Mayıs ayında %30 büyüt',
  goal: 'Rakip analizi → fiyat pozisyonu → kampanya planı → içerik + onay',
  startedAt: '14:21:03',
  nodes: [
    { id: 'n1', agent: 'supervisor',                label: 'Görev planlama & rota',                col: 0, row: 1, status: 'done',    ms: 1240, tools: ['knowledge_search'], summary: 'TaskGraph 7 düğümde planlandı. primary=market_research, supporting=analytics,pricing,marketing.' },
    { id: 'n2', agent: 'market_research_agent',     label: 'Pazar & rakip taraması',               col: 1, row: 0, status: 'done',    ms: 4820, tools: ['amazon_bestseller_scrape','trendyol_category_analysis','competitor_profile_builder'], summary: 'Top 3 rakip: AvenoLab, Skinjoy, Pureline. Avg fiyat ₺234. Kategori büyümesi 18%.' },
    { id: 'n3', agent: 'analytics_agent',           label: 'Trendyol son 30 gün',                  col: 1, row: 2, status: 'done',    ms: 2480, tools: ['ga4_sessions_report','analytics_channel_perf'], summary: 'Trendyol session 1,840/gün, dönüşüm 1.9%, ROAS 2.8x. Mobile dominant.' },
    { id: 'n4', agent: 'pricing_agent',             label: 'Fiyat pozisyonu & marj',               col: 2, row: 0, status: 'running', ms: 0,    tools: ['competitor_price_lookup','margin_calculator'], summary: '' },
    { id: 'n5', agent: 'marketing_agent',           label: 'Kampanya draft (Meta + Trendyol)',     col: 2, row: 2, status: 'running', ms: 0,    tools: ['meta_ads_create_draft','budget_allocator'], summary: '' },
    { id: 'n6', agent: 'content_seo_agent',         label: 'Listing optimizasyon + creative brief',col: 3, row: 1, status: 'queued',  ms: 0,    tools: ['seo_keyword_research','content_generator'], summary: '' },
    { id: 'n7', agent: 'compliance_agent',          label: 'Trendyol uyum kontrolü',               col: 4, row: 0, status: 'queued',  ms: 0,    tools: ['listing_compliance_check'], summary: '' },
    { id: 'n8', agent: 'autonomous_decision_agent', label: 'Otonomi politikası + onay yönlendir',  col: 4, row: 2, status: 'queued',  ms: 0,    tools: ['autonomy_policy_check'], summary: '' },
    { id: 'n9', agent: 'supervisor',                label: 'Merge & Yönetici Özeti (TR)',          col: 5, row: 1, status: 'queued',  ms: 0,    tools: [], summary: '' },
  ],
  edges: [
    ['n1','n2'], ['n1','n3'],
    ['n2','n4'], ['n3','n4'],
    ['n2','n5'], ['n3','n5'],
    ['n4','n6'], ['n5','n6'],
    ['n6','n7'], ['n6','n8'],
    ['n7','n9'], ['n8','n9'],
  ],
};

// Layout constants
const COL_W = 220;
const ROW_H = 96;
const NODE_W = 188;
const NODE_H = 72;
const PAD_X = 30;
const PAD_Y = 30;

const nodeCenterX = (n) => PAD_X + n.col * COL_W + NODE_W / 2;
const nodeCenterY = (n) => PAD_Y + n.row * ROW_H + NODE_H / 2;
const nodeLeft   = (n) => PAD_X + n.col * COL_W;
const nodeTop    = (n) => PAD_Y + n.row * ROW_H;

// Smooth bezier edge
const edgePath = (src, dst) => {
  const x1 = nodeLeft(src) + NODE_W;
  const y1 = nodeCenterY(src);
  const x2 = nodeLeft(dst);
  const y2 = nodeCenterY(dst);
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
};

// ============================================================
// Graph node
// ============================================================
const GraphNode = ({ node, selected, onClick, runningProgress }) => {
  const agent = AGENT_BY_ID[node.agent] || { name: node.agent, glyph: '??', accent: '#7C8497' };
  const status = node.status;

  const statusColor =
    status === 'done'    ? 'var(--acid)' :
    status === 'running' ? 'var(--amber)' :
    status === 'failed'  ? 'var(--rose)'  :
                            'var(--fg-4)';

  const borderColor =
    status === 'done'    ? 'rgba(199,255,61,0.4)' :
    status === 'running' ? 'rgba(255,177,61,0.7)' :
    status === 'failed'  ? 'rgba(255,92,122,0.5)' :
                            'rgba(255,255,255,0.1)';

  return (
    <foreignObject
      x={nodeLeft(node)}
      y={nodeTop(node)}
      width={NODE_W}
      height={NODE_H}
      style={{ overflow: 'visible' }}
    >
      <div
        onClick={() => onClick(node)}
        style={{
          width: '100%', height: '100%',
          background: selected ? 'var(--bg-2)' : 'var(--bg-1)',
          border: `1px solid ${selected ? 'var(--acid)' : borderColor}`,
          borderRadius: 6,
          padding: '8px 10px',
          display: 'flex', flexDirection: 'column',
          cursor: 'pointer',
          position: 'relative',
          boxShadow: status === 'running'
            ? '0 0 0 4px rgba(255,177,61,0.08), 0 0 24px rgba(255,177,61,0.15)'
            : selected ? '0 0 0 4px rgba(199,255,61,0.1)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <AgentAvatar agent={agent} size={18} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)',
            letterSpacing: '0.04em',
          }}>{node.id}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            {status === 'running' && (
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--amber)',
                animation: 'pulse-running 1.2s ease-out infinite',
              }} />
            )}
            {status === 'done' && <Icon name="check" size={12} color="var(--acid)" />}
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: statusColor,
            }}>{status}</span>
          </span>
        </div>
        <div style={{
          fontSize: 12, lineHeight: 1.25, color: 'var(--fg-1)',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>{node.label}</div>
        {status === 'running' && (
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: -1,
            height: 2, background: 'var(--bg-3)', borderRadius: 1,
            overflow: 'hidden',
          }}>
            <div style={{
              width: runningProgress + '%', height: '100%',
              background: 'var(--amber)',
              transition: 'width 0.4s linear',
            }} />
          </div>
        )}
      </div>
    </foreignObject>
  );
};

// ============================================================
// Animated data packet flowing along an edge
// ============================================================
const Packet = ({ d, color = 'var(--acid)', delay = 0 }) => (
  <circle r={3} fill={color}>
    <animateMotion dur="2.4s" repeatCount="indefinite" begin={`${delay}s`} path={d.replace(/^M\s*/, '').replace(/[A-Z]/g, ' ').replace(/,/g, ' ')} keyTimes="0;1" keyPoints="0;1">
      <mpath />
    </animateMotion>
  </circle>
);

// (animateMotion path needs the original d via mpath. Use mpath via xlink for compat.)
const FlowEdges = ({ graph, runningSet, doneSet }) => {
  // SVG <path id="..."/> + <animateMotion><mpath/></animateMotion>
  return (
    <g>
      {graph.edges.map(([sid, did], i) => {
        const s = graph.nodes.find(n => n.id === sid);
        const d = graph.nodes.find(n => n.id === did);
        const pathD = edgePath(s, d);
        const isLive = doneSet.has(sid) && runningSet.has(did);
        const isFlow = doneSet.has(sid) && doneSet.has(did);
        const isLatent = !doneSet.has(sid);

        const stroke = isLive ? 'var(--amber)' : isFlow ? 'rgba(199,255,61,0.5)' : 'rgba(255,255,255,0.10)';
        const strokeWidth = isLive ? 1.6 : 1.2;
        const dash = isLive ? '4 4' : isLatent ? '2 4' : 'none';

        return (
          <g key={i}>
            <path id={`edge-${i}`} d={pathD} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={dash} />
            {isLive && (
              <circle r={3.5} fill="var(--amber)">
                <animateMotion dur="2s" repeatCount="indefinite">
                  <mpath href={`#edge-${i}`} />
                </animateMotion>
              </circle>
            )}
            {isFlow && (
              <circle r={2.5} fill="var(--acid)" opacity="0.7">
                <animateMotion dur="3s" repeatCount="indefinite" begin={`${(i * 0.4) % 3}s`}>
                  <mpath href={`#edge-${i}`} />
                </animateMotion>
              </circle>
            )}
          </g>
        );
      })}
    </g>
  );
};

// ============================================================
// Main Page
// ============================================================
const GraphPage = () => {
  const [graph, setGraph] = useState(GRAPH);
  const [selected, setSelected] = useState(graph.nodes.find(n => n.status === 'running')?.id || 'n1');
  const [progress, setProgress] = useState({});
  const [tickCount, setTickCount] = useState(0);
  const [paused, setPaused] = useState(false);

  // Advance running nodes' progress over time
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setTickCount(t => t + 1);
      setProgress(prev => {
        const next = { ...prev };
        graph.nodes.forEach(n => {
          if (n.status === 'running') {
            next[n.id] = Math.min(95, (next[n.id] || 10) + 4 + Math.random() * 6);
          }
        });
        return next;
      });
    }, 800);
    return () => clearInterval(id);
  }, [graph, paused]);

  // Periodically tick: complete a running node, start next
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setGraph(g => {
        const running = g.nodes.find(n => n.status === 'running');
        if (!running || (progress[running.id] || 0) < 90) return g;
        // complete running, start its dependents (if all parents done)
        const newNodes = g.nodes.map(n => {
          if (n.id === running.id) return { ...n, status: 'done', ms: 2400 + Math.floor(Math.random()*2400) };
          return n;
        });
        // Find newly-eligible queued nodes
        const doneSet = new Set(newNodes.filter(n => n.status === 'done').map(n => n.id));
        const parentsOf = (nid) => g.edges.filter(([s,d]) => d === nid).map(([s,d]) => s);
        const eligible = newNodes
          .filter(n => n.status === 'queued')
          .filter(n => parentsOf(n.id).every(p => doneSet.has(p)));
        // Only start the first one or two
        eligible.slice(0, 2).forEach(n => { n.status = 'running'; });
        return { ...g, nodes: newNodes };
      });
    }, 6000);
    return () => clearInterval(id);
  }, [progress, paused]);

  const runningSet = useMemo(() => new Set(graph.nodes.filter(n => n.status === 'running').map(n => n.id)), [graph]);
  const doneSet    = useMemo(() => new Set(graph.nodes.filter(n => n.status === 'done').map(n => n.id)), [graph]);
  const queuedSet  = useMemo(() => new Set(graph.nodes.filter(n => n.status === 'queued').map(n => n.id)), [graph]);

  const totalW = PAD_X * 2 + 5 * COL_W + NODE_W;
  const totalH = PAD_Y * 2 + 2 * ROW_H + NODE_H;

  const selectedNode = graph.nodes.find(n => n.id === selected);
  const selectedAgent = selectedNode ? AGENT_BY_ID[selectedNode.agent] : null;

  const completionPct = Math.round((doneSet.size / graph.nodes.length) * 100);

  const reset = () => {
    setGraph(GRAPH);
    setProgress({});
    setSelected('n1');
  };

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> GÖREV GRAFİĞİ <span>›</span> {graph.task_id}</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            Görev Grafiği
            <span className="page__title-tag">HERMES · DAG</span>
            <span className="chip chip--amber" style={{ background: 'transparent' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)' }} />
              ÇALIŞIYOR
            </span>
          </h1>
          <p className="page__sub">
            <span className="mono">{graph.task_id}</span> · {graph.task}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost" onClick={reset}>
            <Icon name="refresh" size={12} /> Sıfırla
          </button>
          <button className="btn" onClick={() => setPaused(p => !p)}>
            <Icon name={paused ? 'play' : 'pause'} size={12} /> {paused ? 'Devam' : 'Duraklat'}
          </button>
          <button className="btn btn--primary">
            <Icon name="zap" size={12} /> Yeni DAG
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 1, background: 'var(--border-faint)',
        border: '1px solid var(--border)', borderRadius: 6,
        marginBottom: 16, overflow: 'hidden',
      }}>
        {[
          { label: 'İlerleme',  val: `${completionPct}%`,                       sub: `${doneSet.size}/${graph.nodes.length} düğüm` },
          { label: 'Çalışıyor', val: runningSet.size,                            sub: 'paralel' },
          { label: 'Sırada',    val: queuedSet.size,                             sub: 'queued' },
          { label: 'Süre',      val: `${(graph.nodes.reduce((s,n)=>s+(n.ms||0),0)/1000).toFixed(1)}s`, sub: 'cumulative' },
          { label: 'Maliyet',   val: '$0.018',                                   sub: '12 tool çağrısı' },
        ].map((s) => (
          <div key={s.label} style={{ padding: '12px 16px', background: 'var(--bg-1)' }}>
            <div className="label-eyebrow" style={{ marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.02em' }} className="tnum">{s.val}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Main grid: graph canvas + inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        <div className="panel">
          <div className="panel__head">
            <h3>Yürütme Grafiği</h3>
            <span className="panel__head-tag">CANLI · {tickCount} TICK</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: 11, color: 'var(--fg-3)' }} className="mono">
              <span><span style={{ color: 'var(--acid)' }}>━</span> tamamlandı</span>
              <span><span style={{ color: 'var(--amber)' }}>┅</span> çalışıyor</span>
              <span><span style={{ color: 'var(--fg-4)' }}>┄</span> bekliyor</span>
            </span>
          </div>
          <div style={{
            position: 'relative',
            background: 'var(--bg-inset)',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.045) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            overflow: 'auto',
            minHeight: 320,
          }}>
            <svg width={totalW} height={totalH} style={{ display: 'block' }}>
              <defs>
                <marker id="arrow-done" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(199,255,61,0.5)" />
                </marker>
              </defs>
              <FlowEdges graph={graph} runningSet={runningSet} doneSet={doneSet} />
              {graph.nodes.map(n => (
                <GraphNode
                  key={n.id}
                  node={n}
                  selected={selected === n.id}
                  onClick={(node) => setSelected(node.id)}
                  runningProgress={progress[n.id] || 0}
                />
              ))}
            </svg>
          </div>
        </div>

        {/* Inspector */}
        <div className="panel" style={{ alignSelf: 'flex-start' }}>
          <div className="panel__head">
            <h3>Düğüm İnceleyici</h3>
            <span className="panel__head-tag">{selectedNode?.id}</span>
          </div>
          {selectedNode && selectedAgent && (
            <div style={{ padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <AgentAvatar agent={selectedAgent} size={36} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{selectedAgent.name}</div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{selectedAgent.role}</div>
                </div>
                <span className={`chip chip--${
                  selectedNode.status === 'done' ? 'acid' :
                  selectedNode.status === 'running' ? 'amber' :
                  selectedNode.status === 'failed' ? 'rose' : ''
                }`}>{selectedNode.status}</span>
              </div>

              <div style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 12, lineHeight: 1.45 }}>
                {selectedNode.label}
              </div>

              <div className="label-eyebrow" style={{ marginBottom: 6 }}>Tool Çağrıları</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                {selectedNode.tools.length ? selectedNode.tools.map(t => (
                  <div key={t} className="mono" style={{
                    fontSize: 11, padding: '5px 8px',
                    background: 'var(--bg-inset)', border: '1px solid var(--border-faint)',
                    borderRadius: 3, color: 'var(--fg-2)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Icon name="tools" size={11} color="var(--fg-3)" />
                    {t}()
                  </div>
                )) : <div style={{ fontSize: 11, color: 'var(--fg-4)' }} className="mono">tool yok</div>}
              </div>

              {selectedNode.status === 'done' && (
                <>
                  <div className="label-eyebrow" style={{ marginBottom: 6 }}>Özet</div>
                  <div style={{
                    fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5,
                    padding: '8px 10px', background: 'var(--bg-inset)',
                    border: '1px solid var(--border-faint)', borderRadius: 4,
                    marginBottom: 12,
                  }}>{selectedNode.summary}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div className="label-eyebrow">Süre</div>
                      <div className="mono tnum" style={{ fontSize: 13 }}>{(selectedNode.ms/1000).toFixed(2)}s</div>
                    </div>
                    <div>
                      <div className="label-eyebrow">Critic</div>
                      <div className="mono tnum" style={{ fontSize: 13, color: 'var(--acid)' }}>0.{Math.floor(82+Math.random()*15)}</div>
                    </div>
                  </div>
                </>
              )}
              {selectedNode.status === 'running' && (
                <>
                  <div className="label-eyebrow" style={{ marginBottom: 6 }}>Canlı Çıktı</div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    padding: '8px 10px', background: 'var(--bg-inset)',
                    border: '1px solid var(--border-faint)', borderRadius: 4,
                    color: 'var(--fg-2)', lineHeight: 1.5,
                    minHeight: 60, position: 'relative',
                  }}>
                    <div style={{ color: 'var(--fg-3)' }}>→ {selectedNode.tools[0]}()</div>
                    <div>analyzing {Math.floor((progress[selectedNode.id]||0)*1.2)} records<span className="caret" /></div>
                  </div>
                </>
              )}
              {selectedNode.status === 'queued' && (
                <div style={{
                  padding: 10, background: 'var(--bg-inset)',
                  border: '1px dashed var(--border)', borderRadius: 4,
                  fontSize: 11, color: 'var(--fg-3)',
                }} className="mono">
                  ⏸ Beklemede — bağımlılık: {graph.edges.filter(([s,d])=>d===selectedNode.id).map(([s])=>s).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Critic & merge preview */}
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel__head">
          <h3>Critic Skoru & Merge Önizleme</h3>
          <span className="panel__head-tag">EŞIK 0.65 · MEVCUT 0.89</span>
        </div>
        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {[
            { label: 'Concreteness', score: 0.91, hint: 'sayısal kanıt yoğun'},
            { label: 'Numeric grounding', score: 0.86, hint: 'rakip fiyat + GA4 metrik'},
            { label: 'Hallucination risk', score: 0.08, hint: 'düşük · doğrulanmış kaynak'},
          ].map(s => (
            <div key={s.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span className="label-eyebrow">{s.label}</span>
                <span className="mono tnum" style={{
                  fontSize: 13,
                  color: s.label.includes('Hallucination') ? (s.score < 0.2 ? 'var(--acid)' : 'var(--amber)') : (s.score > 0.7 ? 'var(--acid)' : 'var(--amber)'),
                }}>{s.score.toFixed(2)}</span>
              </div>
              <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: (s.score*100) + '%',
                  height: '100%',
                  background: s.label.includes('Hallucination') ? 'var(--amber)' : 'var(--acid)',
                  opacity: 0.85,
                }} />
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>{s.hint}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

window.AOSPages = window.AOSPages || {};
window.AOSPages.Graph = GraphPage;
