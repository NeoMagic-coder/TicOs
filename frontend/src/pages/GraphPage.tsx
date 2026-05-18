// @ts-nocheck
// ============================================================
// AGENT.OS — Live Task Graph (Hermes DAG visualization)
// Centerpiece: a real-time view of a multi-agent execution plan.
// ============================================================
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon, StatusDot, AgentAvatar } from '@/components/AOS/widgets';
import { AGENT_BY_ID, AGENTS } from '@/data/aos/mockData';
import { useAdaptedTaskGraph } from '@/lib/aos/adapter';
import { useStore } from '@/stores/useStore';

// Empty-state placeholder shown before any live task graph exists. The page
// previously simulated a fake "Trendyol %30 büyüt" DAG that auto-progressed on
// a timer — confusing because nothing was actually running. We now render a
// real graph from SSE progress (useAdaptedTaskGraph) and show an empty hint
// when there's no active run.
const EMPTY_GRAPH = {
  task_id: '—',
  task: 'Henüz aktif görev yok',
  goal: 'Supervisor\'a komut ver veya yeni bir DAG başlat — yürütme grafiği burada anlık olarak çizilir.',
  startedAt: '—',
  nodes: [],
  edges: [],
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
  const liveGraph = useAdaptedTaskGraph();
  const chatProgress = useStore((s: any) => s.chatProgress) || [];
  const isLive = !!liveGraph;
  const graph = liveGraph || EMPTY_GRAPH;
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    // Auto-select the first running node when the graph updates.
    if (!graph.nodes.length) { setSelected(null); return; }
    const running = graph.nodes.find((n: any) => n.status === 'running');
    setSelected((cur) => cur && graph.nodes.some((n: any) => n.id === cur) ? cur : (running?.id || graph.nodes[0].id));
  }, [graph]);
  // Lightweight progress bar fill for nodes currently running (visual only).
  // We don't synthesize state — we just smoothly fill while SSE shows the
  // agent_started event without a corresponding completion yet.
  const [progress, setProgress] = useState<Record<string, number>>({});
  useEffect(() => {
    const id = setInterval(() => {
      setProgress((prev) => {
        const next = { ...prev };
        for (const n of graph.nodes) {
          if (n.status === 'running') {
            next[n.id] = Math.min(92, (next[n.id] || 10) + 3);
          } else {
            // Completed/queued nodes reset so re-runs animate freshly.
            if (next[n.id] !== undefined) delete next[n.id];
          }
        }
        return next;
      });
    }, 700);
    return () => clearInterval(id);
  }, [graph]);
  const [showNewDag, setShowNewDag] = useState(false);
  const [dagPrompt, setDagPrompt] = useState('');
  // We stream directly instead of going through `quickAsk`, which would
  // navigate to /chat and use the buffered (non-SSE) endpoint — neither of
  // which is what the Graph page wants. Streaming keeps the user here and
  // pumps live progress events into `chatProgress` so the DAG renders.
  const sendUserMessageStream = useStore((s: any) => s.sendUserMessageStream);
  const submitNewDag = () => {
    if (!dagPrompt.trim()) return;
    void sendUserMessageStream(dagPrompt);
    setShowNewDag(false);
    setDagPrompt('');
  };

  const runningSet = useMemo(() => new Set(graph.nodes.filter(n => n.status === 'running').map(n => n.id)), [graph]);
  const doneSet    = useMemo(() => new Set(graph.nodes.filter(n => n.status === 'done').map(n => n.id)), [graph]);
  const queuedSet  = useMemo(() => new Set(graph.nodes.filter(n => n.status === 'queued').map(n => n.id)), [graph]);

  const totalW = PAD_X * 2 + 5 * COL_W + NODE_W;
  const totalH = PAD_Y * 2 + 2 * ROW_H + NODE_H;

  const selectedNode = graph.nodes.find(n => n.id === selected);
  const selectedAgent = selectedNode ? AGENT_BY_ID[selectedNode.agent] : null;

  const completionPct = graph.nodes.length ? Math.round((doneSet.size / graph.nodes.length) * 100) : 0;
  const totalMs = graph.nodes.reduce((s: number, n: any) => s + (n.ms || 0), 0);
  const totalToolCalls = (liveGraph as any)?.totalToolCalls ?? 0;
  const totalCostUsd = (liveGraph as any)?.totalCostUsd ?? 0;
  const linkedTask = (liveGraph as any)?.linkedTask ?? null;

  const reset = () => {
    setProgress({});
    setSelected(null);
  };

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> GÖREV GRAFİĞİ <span>›</span> {graph.task_id}</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            Görev Grafiği
            <span className="page__title-tag">HERMES · DAG</span>
            {isLive && runningSet.size > 0 && (
              <span className="chip chip--amber" style={{ background: 'transparent' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)' }} />
                ÇALIŞIYOR
              </span>
            )}
            {isLive && runningSet.size === 0 && doneSet.size === graph.nodes.length && (
              <span className="chip chip--acid" style={{ background: 'transparent' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--acid)' }} />
                TAMAMLANDI
              </span>
            )}
            {!isLive && (
              <span className="chip" style={{ background: 'transparent', color: 'var(--fg-3)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fg-4)' }} />
                BEKLEMEDE
              </span>
            )}
          </h1>
          <p className="page__sub">
            <span className="mono">{graph.task_id}</span> · {graph.task}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost" onClick={reset} disabled={!isLive}>
            <Icon name="refresh" size={12} /> Sıfırla
          </button>
          <button className="btn btn--primary" onClick={() => setShowNewDag(true)}>
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
          { label: 'İlerleme',  val: graph.nodes.length ? `${completionPct}%` : '—', sub: `${doneSet.size}/${graph.nodes.length} düğüm` },
          { label: 'Çalışıyor', val: runningSet.size,                                sub: 'paralel' },
          { label: 'Sırada',    val: queuedSet.size,                                 sub: 'queued' },
          { label: 'Süre',      val: totalMs ? `${(totalMs/1000).toFixed(1)}s` : '—', sub: 'cumulative' },
          { label: 'Maliyet',   val: totalCostUsd > 0 ? `$${totalCostUsd.toFixed(3)}` : '$0', sub: `${totalToolCalls} tool çağrısı` },
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
            <span className="panel__head-tag">{isLive ? `BAŞLATILDI ${graph.startedAt}` : 'BEKLEMEDE'}</span>
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
            {graph.nodes.length === 0 ? (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24,
                color: 'var(--fg-3)', textAlign: 'center',
              }}>
                <Icon name="flow" size={32} color="var(--fg-4)" />
                <div style={{ fontSize: 13, color: 'var(--fg-2)' }}>Henüz aktif görev yok</div>
                <div className="mono" style={{ fontSize: 11, maxWidth: 380 }}>
                  Supervisor'a komut ver veya <b style={{ color: 'var(--fg-2)' }}>Yeni DAG</b> ile başlat — yürütme grafiği SSE üzerinden anlık çizilir.
                </div>
              </div>
            ) : (
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
            )}
          </div>
        </div>

        {/* Inspector */}
        <div className="panel" style={{ alignSelf: 'flex-start' }}>
          <div className="panel__head">
            <h3>Düğüm İnceleyici</h3>
            <span className="panel__head-tag">{selectedNode?.id}</span>
          </div>
          {!selectedNode && (
            <div style={{ padding: 14, fontSize: 12, color: 'var(--fg-3)' }} className="mono">
              Bir görev başlatıldığında düğümler burada görünecek. Bir düğüme tıklayarak detayını görebilirsin.
            </div>
          )}
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
                  {selectedNode.summary && (
                    <>
                      <div className="label-eyebrow" style={{ marginBottom: 6 }}>Özet</div>
                      <div style={{
                        fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5,
                        padding: '8px 10px', background: 'var(--bg-inset)',
                        border: '1px solid var(--border-faint)', borderRadius: 4,
                        marginBottom: 12,
                      }}>{selectedNode.summary}</div>
                    </>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <div className="label-eyebrow">Süre</div>
                      <div className="mono tnum" style={{ fontSize: 13 }}>{selectedNode.ms ? (selectedNode.ms/1000).toFixed(2) + 's' : '—'}</div>
                    </div>
                    <div>
                      <div className="label-eyebrow">Critic</div>
                      <div className="mono tnum" style={{
                        fontSize: 13,
                        color: typeof selectedNode.confidence === 'number'
                          ? (selectedNode.confidence >= 0.7 ? 'var(--acid)' : selectedNode.confidence >= 0.5 ? 'var(--amber)' : 'var(--rose)')
                          : 'var(--fg-3)',
                      }}>
                        {typeof selectedNode.confidence === 'number' ? selectedNode.confidence.toFixed(2) : '—'}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {selectedNode.status === 'running' && (() => {
                const events = chatProgress
                  .filter((p: any) => p.agent_id === selectedNode.agent)
                  .slice(-6);
                return (
                  <>
                    <div className="label-eyebrow" style={{ marginBottom: 6 }}>Canlı Akış</div>
                    <div style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                      padding: '8px 10px', background: 'var(--bg-inset)',
                      border: '1px solid var(--border-faint)', borderRadius: 4,
                      color: 'var(--fg-2)', lineHeight: 1.55,
                      minHeight: 60, maxHeight: 160, overflow: 'auto',
                    }}>
                      {events.length === 0 ? (
                        <div style={{ color: 'var(--fg-3)' }}>… SSE event bekleniyor</div>
                      ) : (
                        events.map((e: any, i: number) => (
                          <div key={i} style={{ display: 'flex', gap: 6 }}>
                            <span style={{ color: 'var(--fg-4)' }}>{new Date(e.ts).toLocaleTimeString('tr-TR', { hour12: false })}</span>
                            <span style={{ color: 'var(--fg-3)' }}>{e.event}</span>
                            {e.tool_id && <span style={{ color: 'var(--cyan)' }}>· {e.tool_id}()</span>}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                );
              })()}
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

      {/* Critic & merge preview — real per-agent confidence rows from agent_outputs */}
      {(() => {
        const perAgent = graph.nodes
          .filter((n: any) => n.agent !== 'supervisor' && typeof n.confidence === 'number')
          .map((n: any) => ({
            agent: n.agent,
            label: AGENT_BY_ID[n.agent]?.name || n.agent,
            score: n.confidence as number,
          }));
        const mean = perAgent.length
          ? perAgent.reduce((s, r) => s + r.score, 0) / perAgent.length
          : (liveGraph?.confidence ?? null);
        return (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel__head">
              <h3>Critic Skoru & Merge Önizleme</h3>
              <span className="panel__head-tag">
                EŞIK 0.65{mean != null ? ` · ORTALAMA ${mean.toFixed(2)}` : ''}
              </span>
            </div>
            <div style={{ padding: 14 }}>
              {perAgent.length === 0 ? (
                <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                  {isLive
                    ? 'Ajan tamamlandığında critic skoru burada listelenecek.'
                    : 'Henüz tamamlanmış ajan yok.'}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  {perAgent.map((row) => (
                    <div key={row.agent}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span className="label-eyebrow">{row.label}</span>
                        <span className="mono tnum" style={{
                          fontSize: 13,
                          color: row.score >= 0.7 ? 'var(--acid)' : row.score >= 0.5 ? 'var(--amber)' : 'var(--rose)',
                        }}>{row.score.toFixed(2)}</span>
                      </div>
                      <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{
                          width: (row.score * 100) + '%',
                          height: '100%',
                          background: row.score >= 0.7 ? 'var(--acid)' : row.score >= 0.5 ? 'var(--amber)' : 'var(--rose)',
                          opacity: 0.85,
                        }} />
                      </div>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 4 }}>
                        {row.score < 0.65 ? 'eşik altında · yeniden deneme tetiklenebilir' : row.score >= 0.85 ? 'yüksek güven' : 'kabul edilebilir aralık'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {showNewDag && (
        <div onClick={() => setShowNewDag(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 24, width: 520, maxWidth: '92vw' }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Yeni DAG</h3>
            <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 10 }}>
              Hermes orkestratörü prompt'u plana çevirip yeni bir görev grafiği başlatacak.
            </div>
            <textarea
              rows={4}
              value={dagPrompt}
              onChange={(e) => setDagPrompt(e.target.value)}
              placeholder="Örn: Trendyol Q4 satışlarını analiz et, top 5 SKU için pazarlama planı çıkar."
              style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg-1)', fontSize: 12, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setShowNewDag(false)}>Vazgeç</button>
              <button className="btn btn--primary btn--sm" onClick={submitNewDag} disabled={!dagPrompt.trim()}>
                Başlat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};




export default GraphPage;
