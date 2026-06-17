// @ts-nocheck
// ============================================================
// AGENT.OS — Supervisor (Chat) page
// Streaming execution view: prompt → plan → tool calls → answer
// ============================================================
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon, StatusDot, AgentAvatar } from '@/components/AOS/widgets';
import { AGENT_BY_ID, AGENTS } from '@/data/aos/mockData';
import { useStore } from '@/stores/useStore';
import { storeActions } from '@/lib/aos/adapter';

// The previous version of this file shipped a 35-line pre-scripted SAMPLE
// exchange ("Trendyol Mayıs ayında büyüt" with confident fake metrics like
// "₺28.1k → ₺36.0k") that was never referenced after onboarding completed.
// It has been removed so a curious reader can't mistake it for live state.

const LLM_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) || 'openai.gpt-oss-120b';

const TimelineStep = ({ step }) => {
  const agent = AGENT_BY_ID[step.agent] || { name: 'critic', glyph: 'CR', accent: '#9B7BFF', role: 'Critic' };
  if (step.kind === 'plan') {
    const { primary, supporting, nodes } = step.meta;
    const hasMeta = (primary && primary !== '—') || (supporting && supporting !== '—') || (nodes && nodes !== '—');
    return (
      <div style={{ display: 'flex', gap: 10, padding: '8px 0' }}>
        <AgentAvatar agent={agent} size={22} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 500 }}>
            <span style={{ color: 'var(--fg-1)' }}>{agent.name}</span>
            <span style={{ color: 'var(--fg-3)', marginLeft: 6 }} className="mono">— {step.label}</span>
          </div>
          {hasMeta ? (
            <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
              {primary && primary !== '—' ? <>primary=<span style={{ color: 'var(--fg-2)' }}>{primary}</span></> : null}
              {supporting && supporting !== '—' ? <> · supporting=[{supporting}]</> : null}
              {nodes && nodes !== '—' ? <> · nodes={nodes}</> : null}
            </div>
          ) : (
            <div className="mono" style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 4, fontStyle: 'italic' }}>
              plan henüz oluşmadı
            </div>
          )}
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
          {typeof step.dur === 'number' && step.dur > 0 && (
            <>
              <span style={{ color: 'var(--fg-4)' }}>·</span>
              <span className="tnum">{step.dur}ms</span>
            </>
          )}
          <Icon name="check" size={11} color="var(--acid)" />
        </span>
      </div>
    );
  }
  if (step.kind === 'agent_done') {
    const hasDur = typeof step.dur === 'number' && step.dur > 0;
    return (
      <div style={{ display: 'flex', gap: 10, padding: '8px 0', alignItems: 'flex-start' }}>
        <AgentAvatar agent={agent} size={22} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12 }}>
            <span style={{ color: agent.accent, fontWeight: 500 }}>{agent.name}</span>
            <span className="chip chip--acid" style={{ marginLeft: 8 }}>
              tamamlandı{hasDur ? ` · ${(step.dur/1000).toFixed(1)}s` : ''}
            </span>
          </div>
          {step.summary && (
            <div style={{
              fontSize: 12, color: 'var(--fg-2)', marginTop: 6,
              padding: '8px 10px',
              background: 'var(--bg-inset)',
              border: '1px solid var(--border-faint)',
              borderLeft: `2px solid ${agent.accent}`,
              borderRadius: 3,
              lineHeight: 1.5,
            }}>{step.summary}</div>
          )}
        </div>
      </div>
    );
  }
  if (step.kind === 'critic') {
    const hasScore = typeof step.score === 'number';
    const color = hasScore ? (step.score >= 0.65 ? 'var(--acid)' : 'var(--amber)') : 'var(--fg-3)';
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
            <span className="mono" style={{ marginLeft: 6, color: 'var(--fg-3)' }}>
              {step.target_agent ? `${step.target_agent} →` : 'çıktı kalite skoru'}
            </span>
            {hasScore && (
              <span className="mono tnum" style={{ marginLeft: 8, color }}>
                {step.score.toFixed(2)}
              </span>
            )}
          </div>
          {step.reason && (
            <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>{step.reason}</div>
          )}
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
const SupervisorPage = ({
  navigate,
  embedded = false,
}: {
  navigate?: (page: string) => void;
  embedded?: boolean;
}) => {
  const chatMessages = useStore((s: any) => s.chatMessages);
  const chatProgress = useStore((s: any) => s.chatProgress);
  const isThinking = useStore((s: any) => s.isThinking);
  const llmDegraded = useStore((s: any) => s.llmDegraded);
  const llmDegradedReason = useStore((s: any) => s.llmDegradedReason);
  const setCurrentPage = useStore((s: any) => s.setCurrentPage);
  const addAuditLog = useStore((s: any) => s.addAuditLog);
  const [input, setInput] = useState('');
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskDraft, setNewTaskDraft] = useState({ title: '', description: '' });
  const scrollRef = useRef(null);
  const addTask = useStore((s: any) => s.addTask);
  const submitNewTask = () => {
    if (!newTaskDraft.title.trim()) return;
    addTask({ title: newTaskDraft.title, description: newTaskDraft.description, priority: 'medium' });
    setShowNewTask(false);
    setNewTaskDraft({ title: '', description: '' });
  };
  const recordFeedback = (taskId: string | undefined, quality: 'good' | 'bad') => {
    addAuditLog({
      action: `chat.feedback.${quality}`,
      actor_type: 'user',
      actor_id: 'user_1',
      actor_name: 'Kullanıcı',
      details: `Yanıt ${quality === 'good' ? 'olumlu' : 'olumsuz'} değerlendirildi (${taskId ?? 'no-task'})`,
    });
    import('@/components/AOS/Toast').then((m) =>
      m.pushToast({ kind: quality === 'good' ? 'success' : 'info', title: 'Geri bildirim kaydedildi', body: quality === 'good' ? 'Critic skorunu güçlendirir.' : 'İyileştirme sırasına eklendi.' }),
    );
  };

  const progressSteps = useMemo(() => {
    if (!chatProgress || !chatProgress.length) return [];
    const steps: any[] = [];
    for (const ev of chatProgress) {
      if (ev.event === 'task_started') {
        steps.push({ kind: 'agent_run', agent: 'supervisor', label: 'TicOSClaw planlamaya başladı', t: 0 });
      } else if (ev.event === 'plan_ready') {
        const primary = (ev as any).primary || ev.agent_id || '—';
        const supporting = Array.isArray((ev as any).supporting) ? (ev as any).supporting.join(', ') : ((ev as any).supporting || '—');
        const nodeCount = (ev as any).node_count;
        steps.push({
          kind: 'plan',
          agent: 'supervisor',
          label: 'TaskGraph hazır',
          meta: {
            primary,
            supporting,
            nodes: typeof nodeCount === 'number' ? String(nodeCount) : '—',
          },
          t: 0,
        });
      } else if (ev.event === 'agent_started') {
        steps.push({ kind: 'agent_run', agent: ev.agent_id, label: ev.label || (ev.agent_id + ' çalışıyor'), t: 0 });
      } else if (ev.event === 'tool_called') {
        steps.push({ kind: 'tool', agent: ev.agent_id, tool: ev.tool_id, dur: 0, t: 0 });
      } else if (ev.event === 'agent_completed') {
        steps.push({ kind: 'agent_done', agent: ev.agent_id, summary: ev.label, dur: 0, t: 0 });
      } else if (ev.event === 'critic_scored') {
        steps.push({
          kind: 'critic',
          agent: 'critic',
          target_agent: ev.agent_id,
          score: typeof ev.score === 'number' ? ev.score : null,
          reason: ev.reason || null,
          t: 0,
        });
      } else if (ev.event === 'merging') {
        steps.push({ kind: 'merge', agent: 'supervisor', t: 0 });
      }
    }
    return steps;
  }, [chatProgress]);

  const tasks = useStore((s: any) => s.tasks);
  const taskById = useMemo(
    () => Object.fromEntries(tasks.map((t: any) => [t.task_id, t])),
    [tasks],
  );

  // Group chat messages into user/assistant exchange pairs for the timeline view.
  const exchanges = useMemo(() => {
    const out: any[] = [];
    let current: any = null;
    for (const m of chatMessages) {
      if (m.role === 'user') {
        if (current) out.push(current);
        current = { id: m.id, user: m.content, steps: [], final: null, complete: false, confidence: null };
      } else if (m.role === 'assistant') {
        if (!current) current = { id: m.id, user: '(continuation)', steps: [], final: null, complete: false, confidence: null };
        current.final = m.content;
        current.complete = true;
        current.taskId = m.task_id;
        // Pull confidence from the linked Task, if any.
        if (m.task_id && taskById[m.task_id]?.confidence != null) {
          current.confidence = taskById[m.task_id].confidence;
        }
        if (m.tools_used?.length) {
          current.steps = m.tools_used.map((t: string, i: number) => ({ kind: 'tool', agent: m.agent_id || 'supervisor', tool: t, dur: 0, t: i * 100 }));
        }
      } else if (m.role === 'system') {
        if (current) {
          current.steps = current.steps || [];
          current.steps.push({ kind: 'agent_run', agent: m.agent_id || 'supervisor', label: m.content, t: 0 });
        }
      }
    }
    // Last user-only exchange (no assistant reply yet) gets live progress steps.
    if (current && !current.final && isThinking && progressSteps.length) {
      current.steps = progressSteps;
    }
    if (current) out.push(current);
    return out;
  }, [chatMessages, progressSteps, isThinking, taskById]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [exchanges]);

  const send = (text: string) => {
    if (!text.trim()) return;
    setInput('');
    storeActions.sendMessageStream(text).catch(() => storeActions.sendMessage(text));
  };

  const goGraph = () => {
    if (navigate) navigate('graph');
    else setCurrentPage('graph');
  };

  return (
    <div className={`page supervisor-page ${embedded ? 'supervisor-page--embedded' : ''}`}>
      {!embedded && (
        <div className="page__breadcrumb mono">HOME <span>›</span> SUPERVISOR</div>
      )}
      <div className="page__header" style={embedded ? { marginBottom: 0, paddingBottom: 0, borderBottom: 'none' } : { marginBottom: 12 }}>
        <div>
          {!embedded && (
            <>
              <h1 className="page__title">
                Supervisor Chat
                <span className="page__title-tag">HERMES · SSE</span>
                {llmDegraded && (
                  <span
                    className="chip chip--amber"
                    title={
                      llmDegradedReason === 'gemini_quota_exhausted'
                        ? 'LLM kotası tükendi — yanıtlar MockProvider fallback ile üretiliyor.'
                        : 'AWS_BEARER_TOKEN_BEDROCK yapılandırılmadı — yanıtlar MockProvider tarafından üretiliyor.'
                    }
                    style={{ marginLeft: 8 }}
                  >
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)' }} />
                    MOCK LLM
                  </span>
                )}
                {isThinking ? (
                  <span className="chip chip--amber">
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)', boxShadow: '0 0 6px var(--amber)' }} />
                    ÇALIŞIYOR
                  </span>
                ) : chatMessages?.length ? (
                  <span className="chip chip--acid">
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--acid)', boxShadow: '0 0 6px var(--acid)' }} />
                    HAZIR
                  </span>
                ) : (
                  <span className="chip" style={{ background: 'transparent', color: 'var(--fg-3)' }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--fg-4)' }} />
                    BEKLEMEDE
                  </span>
                )}
              </h1>
              <p className="page__sub">
                Doğal dilde komut ver — TicOSClaw uygun ajanlara dağıtır, araçları çağırır ve sonuçları puanlar.
              </p>
            </>
          )}
        </div>
        <div className="supervisor-page__toolbar">
          {embedded && isThinking && (
            <span className="chip chip--violet">
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--violet)' }} />
              LIVE
            </span>
          )}
          <button className="btn btn--ghost btn--sm" onClick={() => setShowNewTask(true)}>
            <Icon name="refresh" size={12} /> Yeni Görev
          </button>
          <button className="btn btn--sm" onClick={goGraph}>
            <Icon name="graph" size={12} /> Görev Grafiği
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="supervisor-page__feed">
        {exchanges.length === 0 && !isThinking && (
          <div className="supervisor-page__empty">
            <div className="supervisor-page__empty-icon">
              <Icon name="sparkles" size={24} color="var(--violet)" />
            </div>
            <div>
              <div className="supervisor-page__empty-title">Supervisor'a ne sormak istiyorsun?</div>
              <div className="supervisor-page__empty-sub">
                Doğal dilde komut yaz — TicOSClaw plan kurar, araçları çağırır ve sonucu Türkçe özetler.
              </div>
            </div>
            <div className="supervisor-page__prompts">
              {[
                'Bugün için günün planını çıkar',
                'Bekleyen tüm onayları onayla',
                'Marka kimliğini yeniden üret',
                'En kritik 3 görev hangisi?',
                'Anomalileri göster',
                'Tüm entegrasyonları senkronize et',
              ].map((s) => (
                <button key={s} className="btn btn--sm btn--ghost" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {exchanges.map(ex => (
          <div key={ex.id} className="supervisor-page__exchange">
            <div className="supervisor-page__user-row">
              <div className="supervisor-page__user-bubble">{ex.user}</div>
              <span className="supervisor-page__avatar"><Icon name="user" size={14} /></span>
            </div>

            {ex.steps.length > 0 && (
              <div className="supervisor-page__timeline">
                <div className="supervisor-page__timeline-dot">
                  <Icon name="sparkles" size={8} color="var(--violet)" />
                </div>
                <div className="label-eyebrow" style={{ marginBottom: 6, color: 'var(--violet)' }}>
                  HERMES YÜRÜTME · {ex.steps.length} olay
                </div>
                {ex.steps.map((s, i) => <TimelineStep key={i} step={s} />)}
              </div>
            )}

            {ex.final && (
              <div className="supervisor-page__answer">
                <div className="label-eyebrow" style={{ marginBottom: 8, color: 'var(--acid)' }}>
                  YÖNETICI ÖZETI{ex.confidence != null ? ` · CONFIDENCE ${ex.confidence.toFixed(2)}` : ''}
                </div>
                <div>{typeof ex.final === 'string' ? renderFinal(ex.final) : ex.final}</div>
                {ex.complete && (
                  <div className="supervisor-page__answer-footer mono">
                    <span style={{ color: 'var(--fg-3)' }}>
                      {ex.steps?.filter((s: any) => s.kind === 'tool').length || 0} tool · {ex.steps?.length || 0} olay
                    </span>
                    <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <button className="btn btn--sm btn--ghost" onClick={() => recordFeedback(ex.taskId, 'good')}>
                        <Icon name="check" size={10} /> İyi
                      </button>
                      <button className="btn btn--sm btn--ghost" onClick={() => recordFeedback(ex.taskId, 'bad')}>
                        <Icon name="x" size={10} /> Hata
                      </button>
                      <button className="btn btn--sm" onClick={goGraph}>
                        <Icon name="graph" size={10} /> DAG Aç
                      </button>
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="supervisor-page__composer">
        <div className="supervisor-page__composer-meta">
          <span className="label-eyebrow" style={{ color: 'var(--violet)' }}>
            <span style={{ color: 'var(--acid)' }}>›</span> SUPERVISOR
          </span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
            mode: <span style={{ color: 'var(--acid)' }}>autonomous</span> · model: <span style={{ color: 'var(--fg-2)' }}>{LLM_MODEL}</span>
          </span>
          <div className="supervisor-page__slash-row">
            {['/plan', '/price', '/brand', '/reviews', '/sync'].map(c => (
              <button key={c} className="btn btn--sm btn--ghost" title={`${c} komutunu hemen çalıştır`} onClick={() => send(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Supervisor'a mesaj — Görev yaz veya / ile slash komut çalıştır… (Enter gönder · Shift+Enter yeni satır)"
          className="supervisor-page__composer-input"
        />
        <div className="supervisor-page__composer-footer">
          <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
            ⌘K dock · ⌘↵ gönder
          </span>
          <span style={{ marginLeft: 'auto' }} />
          <button className="btn btn--primary btn--sm" onClick={() => send(input)}>
            <Icon name="zap" size={12} /> Gönder
          </button>
        </div>
      </div>

      {showNewTask && (
        <div onClick={() => setShowNewTask(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 24, width: 480, maxWidth: '92vw' }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Yeni Görev</h3>
            <div style={{ display: 'grid', gap: 12, fontSize: 12 }}>
              <label>
                <div className="label-eyebrow" style={{ marginBottom: 4 }}>Başlık</div>
                <input
                  value={newTaskDraft.title}
                  onChange={(e) => setNewTaskDraft({ ...newTaskDraft, title: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg-1)' }}
                />
              </label>
              <label>
                <div className="label-eyebrow" style={{ marginBottom: 4 }}>Açıklama</div>
                <textarea
                  rows={4}
                  value={newTaskDraft.description}
                  onChange={(e) => setNewTaskDraft({ ...newTaskDraft, description: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg-1)', resize: 'vertical' }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setShowNewTask(false)}>Vazgeç</button>
              <button className="btn btn--primary btn--sm" onClick={submitNewTask} disabled={!newTaskDraft.title.trim()}>
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};




export default SupervisorPage;
