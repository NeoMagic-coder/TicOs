import { useStore } from '@/stores/useStore';
import { Activity, Zap, CheckCircle, Clock, ArrowLeft, BarChart2 } from 'lucide-react';
import { useState } from 'react';

export function AgentsPage() {
  const { agents, selectedAgentId, setSelectedAgent, tasks, tools, onboardedProduct, quickAsk } = useStore();
  const [filter, setFilter] = useState<string>('all');

  const selectedAgent = agents.find((a) => a.agent_id === selectedAgentId);

  if (selectedAgent) {
    return <AgentDetail agent={selectedAgent} product={onboardedProduct} onBack={() => setSelectedAgent(null)} tasks={tasks} tools={tools} />;
  }

  const filteredAgents = filter === 'all' ? agents : agents.filter((a) => a.status === filter);

  // For each agent, find the most recent task/audit timestamp so cards can
  // surface a "Şu an: boşta — son aktivite Xdk önce" line instead of all-zero stats.
  const lastActivity = (agentId: string): { status: string; ago: string } => {
    const recentTask = tasks
      .filter((t) => t.assigned_agent_id === agentId)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
    if (!recentTask) {
      return { status: 'boşta', ago: 'son aktivite yok' };
    }
    const minutes = Math.floor((Date.now() - new Date(recentTask.updated_at).getTime()) / 60000);
    const agoLabel =
      minutes < 1 ? 'az önce' :
      minutes < 60 ? `${minutes}dk önce` :
      minutes < 1440 ? `${Math.floor(minutes / 60)}sa önce` :
      `${Math.floor(minutes / 1440)}g önce`;
    const isLive = ['in_progress', 'waiting_tool_result', 'assigned'].includes(recentTask.status);
    return {
      status: isLive ? `şu an: ${recentTask.title.slice(0, 36)}` : `son aktivite: ${recentTask.title.slice(0, 32)}`,
      ago: agoLabel,
    };
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Agent Office</h1>
          <p className="text-sm text-gray-500">
            Tüm ajanlar ve durumları
            {onboardedProduct && <span className="text-gray-400"> · Aktif ürün: <span className="text-yellow-300 font-medium">{onboardedProduct.product_name}</span></span>}
          </p>
        </div>
        {onboardedProduct && (
          <button
            onClick={() => quickAsk(`CEO Agent: ${onboardedProduct.product_name} için bu hafta hangi ajanların sırayla devreye girmesi gerekir? Her ajan için somut görev tanımı ve beklenen çıktıyı listele.`)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/40 text-yellow-300"
          >
            Ajan Sırası Önerisi
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2" role="tablist" aria-label="Ajan durum filtresi">
        {[
          { id: 'all', label: 'Tümü' },
          { id: 'active', label: '🟢 Aktif' },
          { id: 'busy', label: '🟡 Meşgul' },
          { id: 'idle', label: '⚪ Boşta' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            role="tab"
            aria-selected={filter === f.id}
            aria-label={f.label}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${
              filter === f.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredAgents.map((agent) => {
          const activity = lastActivity(agent.agent_id);
          return (
          <div
            key={agent.agent_id}
            onClick={() => setSelectedAgent(agent.agent_id)}
            className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-600 cursor-pointer transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="text-3xl">{agent.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white truncate">{agent.name}</h3>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    agent.status === 'active' ? 'bg-green-400' :
                    agent.status === 'busy' ? 'bg-amber-400 animate-pulse' :
                    agent.status === 'idle' ? 'bg-gray-400' : 'bg-red-400'
                  }`} />
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">{agent.role}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center">
                <p className="text-lg font-bold text-white">{agent.stats.tasks_completed_today}</p>
                <p className="text-[10px] text-gray-500">Bugün</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white">{(agent.stats.success_rate * 100).toFixed(0)}%</p>
                <p className="text-[10px] text-gray-500">Başarı</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-white">{(agent.stats.avg_confidence * 100).toFixed(0)}%</p>
                <p className="text-[10px] text-gray-500">Güven</p>
              </div>
            </div>

            <div className="mt-3 px-2.5 py-1.5 rounded-md bg-gray-800/40 border border-gray-800 text-[10.5px] text-gray-400 truncate" title={activity.status}>
              <span className="text-gray-500">●</span> <span className="text-gray-300">{activity.status}</span>
              <span className="text-gray-600"> — {activity.ago}</span>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <Zap size={12} /> {agent.stats.tools_used_today} tool kullanıldı
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                <Clock size={12} /> {(agent.stats.avg_duration_ms / 1000).toFixed(1)}s ort.
              </div>
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
}

function AgentDetail({ agent, product, onBack, tasks: allTasks, tools: allTools }: {
  agent: import('@/types').AgentSpec;
  product: import('@/types').OnboardedProduct | null;
  onBack: () => void;
  tasks: import('@/types').Task[];
  tools: import('@/types').ToolManifest[];
}) {
  const agentTasks = allTasks.filter((t) => t.assigned_agent_id === agent.agent_id);
  const agentTools = allTools.filter((t) => t.allowed_agents.includes(agent.agent_id));
  const auditLogs = useStore((s) => s.auditLogs);
  const chatMessages = useStore((s) => s.chatMessages);

  // Build a coarse trace: agent-specific tool calls + audit lines + assistant
  // messages tagged with this agent. Sorted newest-first, capped at 30 entries.
  const trace = (() => {
    type Row = { ts: string; kind: 'tool' | 'audit' | 'message'; text: string };
    const rows: Row[] = [];
    for (const t of agentTasks) {
      for (const tc of t.tools_called || []) {
        rows.push({
          ts: tc.timestamp,
          kind: 'tool',
          text: `${tc.tool_id} (${tc.duration_ms}ms, ${tc.status})`,
        });
      }
    }
    for (const log of auditLogs) {
      if (log.actor_id === agent.agent_id || log.details.includes(agent.agent_id)) {
        rows.push({ ts: log.timestamp, kind: 'audit', text: `${log.action}: ${log.details.slice(0, 120)}` });
      }
    }
    for (const m of chatMessages) {
      if (m.agent_id === agent.agent_id && m.role === 'assistant') {
        rows.push({ ts: m.timestamp, kind: 'message', text: m.content.slice(0, 160) });
      }
    }
    return rows
      .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
      .slice(0, 30);
  })();

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
        <ArrowLeft size={16} /> Tüm Ajanlar
      </button>

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="text-5xl">{agent.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white">{agent.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                agent.status === 'active' ? 'bg-green-500/20 text-green-400' :
                agent.status === 'busy' ? 'bg-amber-500/20 text-amber-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>{agent.status}</span>
            </div>
            <p className="text-sm text-gray-400 mt-1">{agent.role}</p>
            <p className="text-xs text-gray-500 mt-2">{agent.goal}</p>
            <p className="text-xs text-gray-600 mt-1 italic">Kişilik: {agent.personality}</p>
          </div>
          <button onClick={() => useStore.getState().quickAsk(`CEO Agent: ${agent.name} (${agent.agent_id}) ajanına ${product?.product_name ?? 'aktif ürün'} (${product?.category ?? '—'}) için bir görev ver. Bu ajanın rolüne uygun, somut ve aksiyona dönük tek bir görev tanımla; beklenen çıktı ve süreyle birlikte.`)}
            className="shrink-0 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 rounded-lg text-xs font-semibold flex items-center gap-1">
            <Zap size={12} /> Göreve Başlat
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mt-6">
          <MiniStat icon={CheckCircle} label="Toplam Görev" value={agent.stats.tasks_total.toString()} />
          <MiniStat icon={Activity} label="Başarı Oranı" value={`${(agent.stats.success_rate * 100).toFixed(0)}%`} />
          <MiniStat icon={BarChart2} label="Ort. Güven" value={`${(agent.stats.avg_confidence * 100).toFixed(0)}%`} />
          <MiniStat icon={Zap} label="Tool Kullanım" value={agent.stats.tools_used_today.toString()} />
          <MiniStat icon={Clock} label="Ort. Süre" value={`${(agent.stats.avg_duration_ms / 1000).toFixed(1)}s`} />
          <MiniStat icon={Activity} label="Eşik" value={`${(agent.escalation_threshold * 100).toFixed(0)}%`} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tools */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">🔧 Yetkili Tool'lar ({agentTools.length})</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {agentTools.map((tool) => (
              <div key={tool.tool_id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/50">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white truncate">{tool.name}</p>
                  <p className="text-[10px] text-gray-500">{tool.category}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                  tool.mode === 'live' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                }`}>{tool.mode}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tasks */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">📋 Görev Geçmişi ({agentTasks.length})</h3>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {agentTasks.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">Henüz görev yok</p>
            ) : (
              agentTasks.map((task) => (
                <div key={task.task_id} className="p-2.5 rounded-lg bg-gray-800/50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-white truncate flex-1">{task.title}</p>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      task.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      task.status === 'in_progress' ? 'bg-amber-500/20 text-amber-400' :
                      task.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>{task.status}</span>
                  </div>
                  {task.confidence != null && (
                    <p className="text-[10px] text-gray-500 mt-1">Güven: {(task.confidence * 100).toFixed(0)}%</p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Trace — recent tool calls + audit + replies for this agent */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3">🔍 Trace — Son Aktivite</h3>
        {trace.length === 0 ? (
          <p className="text-xs text-gray-500">
            Henüz iz yok. Bu ajan görev alıp tool çağırdığında ya da mesaj ürettiğinde burada görünecek.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto">
            {trace.map((row, i) => (
              <div key={i} className="flex items-start gap-2 p-2 rounded-md bg-gray-800/40 border border-gray-800">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase shrink-0 ${
                  row.kind === 'tool' ? 'bg-indigo-500/20 text-indigo-300' :
                  row.kind === 'audit' ? 'bg-amber-500/20 text-amber-300' :
                  'bg-emerald-500/20 text-emerald-300'
                }`}>{row.kind}</span>
                <span className="text-[10px] text-gray-500 shrink-0 font-mono">
                  {new Date(row.ts).toLocaleTimeString('tr-TR')}
                </span>
                <span className="text-xs text-gray-300 line-clamp-2">{row.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delegation & SOP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">🔗 Delegasyon Yapabilir</h3>
          <div className="flex flex-wrap gap-2">
            {agent.can_delegate_to.length === 0 ? (
              <p className="text-xs text-gray-500">Delegasyon yetkisi yok</p>
            ) : (
              agent.can_delegate_to.map((id, i) => (
                <span key={`del-${id}-${i}`} className="px-2.5 py-1 rounded-lg bg-gray-800 text-xs text-gray-300">{id}</span>
              ))
            )}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">📄 SOP Dokümanları</h3>
          <div className="flex flex-wrap gap-2">
            {agent.sop_document_ids.map((id, i) => (
              <span key={`sop-${id}-${i}`} className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-xs text-indigo-400">{id}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 text-center">
      <Icon size={14} className="mx-auto text-gray-500 mb-1" />
      <p className="text-sm font-bold text-white">{value}</p>
      <p className="text-[10px] text-gray-500">{label}</p>
    </div>
  );
}
