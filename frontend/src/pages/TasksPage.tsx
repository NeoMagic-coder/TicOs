import { useStore } from '@/stores/useStore';
import { BASE_URL } from '@/lib/api';
import { StatusBadge, PriorityBadge } from './DashboardPage';
import { Plus, ArrowLeft, Clock, Zap, CheckCircle, AlertTriangle, RotateCcw, FileText, History, HelpCircle, Filter } from 'lucide-react';
import { useState } from 'react';

export function TasksPage() {
  const { tasks, agents, selectedTaskId, setSelectedTask, addTask, onboardedProduct } = useStore();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium');

  const selectedTask = tasks.find((t) => t.task_id === selectedTaskId);

  if (selectedTask) {
    return <TaskDetail task={selectedTask} agents={agents} onBack={() => setSelectedTask(null)} />;
  }

  const filtered = statusFilter === 'all' ? tasks : tasks.filter((t) => t.status === statusFilter);

  const handleCreateTask = () => {
    if (!newTitle.trim()) return;
    addTask({ title: newTitle, description: newDesc, priority: newPriority });
    setNewTitle('');
    setNewDesc('');
    setShowNewTask(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Görevler</h1>
          <p className="text-sm text-gray-500">
            Tüm görevler ve durumları
            {onboardedProduct && <span className="text-gray-400"> · Aktif ürün: <span className="text-yellow-300 font-medium">{onboardedProduct.product_name}</span></span>}
          </p>
        </div>
        <button onClick={() => setShowNewTask(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Yeni Görev
        </button>
      </div>

      {/* New Task Modal */}
      {showNewTask && (
        <div className="bg-gray-900 border border-indigo-500/30 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Yeni Görev Oluştur</h3>
          <div className="space-y-3">
            {onboardedProduct && (
              <div className="text-[11px] text-yellow-300 bg-yellow-500/10 border border-yellow-500/30 rounded-md px-2.5 py-1.5">
                Bu görev <span className="font-semibold">{onboardedProduct.product_name}</span> ({onboardedProduct.category}) bağlamında ilgili ajanlara dağıtılacak.
              </div>
            )}
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Görev başlığı..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Açıklama..."
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center gap-3">
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as 'low' | 'medium' | 'high' | 'critical')}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="low">Düşük</option>
                <option value="medium">Orta</option>
                <option value="high">Yüksek</option>
                <option value="critical">Kritik</option>
              </select>
              <div className="flex-1" />
              <button onClick={() => setShowNewTask(false)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300">İptal</button>
              <button onClick={handleCreateTask} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium">Oluştur</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label="Görev durum filtresi">
        <Filter size={14} className="text-gray-500" />
        {['all', 'created', 'assigned', 'in_progress', 'waiting_human_approval', 'completed', 'failed'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            role="tab"
            aria-selected={statusFilter === s}
            aria-label={s === 'all' ? 'Tüm görevler' : `Durum: ${s.replace(/_/g, ' ')}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${
              statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {s === 'all' ? 'Tümü' : s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {filtered.map((task) => {
          const agent = agents.find((a) => a.agent_id === task.assigned_agent_id);
          return (
            <div
              key={task.task_id}
              onClick={() => setSelectedTask(task.task_id)}
              className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-600 cursor-pointer transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-white">{task.title}</h3>
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                    {task.approval_required && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/20 text-orange-400">Onay Gerekli</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-1">{task.description}</p>
                </div>
                <div className="text-right shrink-0">
                  {agent && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span>{agent.icon}</span>
                      <span>{agent.name}</span>
                    </div>
                  )}
                  {task.confidence != null && (
                    <p className="text-[10px] text-gray-500 mt-1">Güven: {(task.confidence * 100).toFixed(0)}%</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskDetail({ task, agents, onBack }: {
  task: import('@/types').Task;
  agents: import('@/types').AgentSpec[];
  onBack: () => void;
}) {
  const agent = agents.find((a) => a.agent_id === task.assigned_agent_id);
  const retryTask = useStore((s) => s.retryTask);
  const auditLogs = useStore((s) => s.auditLogs);
  const [tab, setTab] = useState<'result' | 'logs' | 'iterations'>('result');
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  const fetchExplanation = async () => {
    if (explanation) { setExplanation(null); return; }
    setLoadingExplanation(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/tasks/${task.task_id}/explain`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setExplanation(data.explanation ?? null);
      } else {
        setExplanation('Açıklama alınamadı (backend yanıt vermedi).');
      }
    } catch {
      setExplanation('Açıklama alınamadı (bağlantı hatası).');
    } finally {
      setLoadingExplanation(false);
    }
  };

  // Pull every audit record that mentions this task. Covers the full
  // lifecycle: materialized → tool_called → approval_queued → retry.
  const relatedLogs = auditLogs.filter(
    (log) =>
      log.details.includes(task.task_id) ||
      log.metadata?.source_task_id === task.task_id ||
      log.details.includes(task.title),
  );

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
        <ArrowLeft size={16} /> Tüm Görevler
      </button>

      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            <span className="text-[10px] text-gray-500 font-mono">{task.task_id}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void fetchExplanation()}
              disabled={loadingExplanation}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 border border-gray-600/40 rounded-lg text-xs font-semibold text-gray-300 transition-colors disabled:opacity-50"
              title="Bu görevin neden oluşturulduğunu açıkla"
            >
              <HelpCircle size={12} /> {loadingExplanation ? 'Açıklanıyor…' : explanation ? 'Gizle' : 'Neden?'}
            </button>
            <button
              onClick={() => {
                retryTask(task.task_id);
                onBack();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 rounded-lg text-xs font-semibold text-indigo-300 transition-colors"
              title="Bu görevi yeni bir Hermes çağrısıyla yeniden çalıştır"
            >
              <RotateCcw size={12} /> Yeniden Çalıştır
            </button>
          </div>
        </div>
        <h1 className="text-xl font-bold text-white">{task.title}</h1>
        <p className="text-sm text-gray-400 mt-2">{task.description}</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 mb-0.5">Atanan Ajan</p>
            <p className="text-sm font-medium text-white">{agent ? `${agent.icon} ${agent.name}` : 'Atanmadı'}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 mb-0.5">Güven Skoru</p>
            <p className="text-sm font-medium text-white">{task.confidence != null ? `${(task.confidence * 100).toFixed(0)}%` : '—'}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 mb-0.5">İterasyon</p>
            <p className="text-sm font-medium text-white">{task.iterations_used} / {task.max_iterations}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-[10px] text-gray-500 mb-0.5">Oluşturulma</p>
            <p className="text-sm font-medium text-white">{new Date(task.created_at).toLocaleString('tr-TR')}</p>
          </div>
        </div>
      </div>

      {/* "Neden?" explanation panel */}
      {explanation && (
        <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-4 flex items-start gap-3">
          <HelpCircle size={16} className="text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-sm text-indigo-200">{explanation}</p>
        </div>
      )}

      {/* Tabs: Result · Logs · Iterations */}
      <div className="flex items-center gap-1 border-b border-gray-800" role="tablist" aria-label="Görev detay sekmeleri">
        {[
          { id: 'result' as const, label: 'Sonuç', icon: CheckCircle },
          { id: 'logs' as const, label: `Loglar (${relatedLogs.length})`, icon: FileText },
          { id: 'iterations' as const, label: `İterasyon (${task.iterations_used}/${task.max_iterations})`, icon: History },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              role="tab"
              aria-selected={tab === t.id}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                tab === t.id
                  ? 'border-indigo-500 text-indigo-300'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon size={12} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'logs' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Audit Logları</h3>
          {relatedLogs.length === 0 ? (
            <p className="text-xs text-gray-500">Bu göreve ait audit kaydı bulunamadı. Görev yeni eklenmişse loglar birkaç saniye içinde görünür.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {relatedLogs.map((log) => (
                <div key={log.id} className="border border-gray-800 rounded-lg p-2.5 bg-gray-800/30">
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-1">
                    <span className="font-mono text-indigo-400">{log.action}</span>
                    <span>·</span>
                    <span>{log.actor_name}</span>
                    <span>·</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString('tr-TR')}</span>
                  </div>
                  <p className="text-xs text-gray-300">{log.details}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'iterations' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">İterasyon Geçmişi</h3>
          {task.iterations_used === 0 ? (
            <div className="text-xs text-gray-500 space-y-2">
              <p>Bu görev <span className="text-amber-300 font-semibold">0 iterasyon</span> kullandı.</p>
              <p>Olası nedenler:</p>
              <ul className="list-disc list-inside ml-2 space-y-1 text-gray-400">
                <li>Backend görev oluşturulurken hata verdi (Tool çağrısı tetiklenmedi).</li>
                <li>Hermes planlama aşamasında reddetti (örn. politika ihlali).</li>
                <li>LLM provider çağrısı timeout'a uğradı.</li>
              </ul>
              <p className="mt-2">Loglar sekmesinden hata detayına bakabilir ya da <span className="text-indigo-300 font-semibold">Yeniden Çalıştır</span>'a basabilirsin.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">
                Toplam <span className="font-semibold text-white">{task.iterations_used}</span> iterasyon kullanıldı (max: {task.max_iterations}).
              </p>
              {task.result && (
                <div className="mt-3 space-y-1 text-[11px] text-gray-400">
                  <p>Başladı: {new Date(task.result.metadata.started_at).toLocaleString('tr-TR')}</p>
                  <p>Bitti: {new Date(task.result.metadata.completed_at).toLocaleString('tr-TR')}</p>
                  <p>Süre: {(task.result.metadata.total_duration_ms / 1000).toFixed(2)}s</p>
                  <p>Tool maliyeti: ${task.result.metadata.total_tool_cost_usd.toFixed(4)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Task Result */}
      {tab === 'result' && task.result && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-400" /> Sonuç
          </h3>
          <p className="text-sm text-gray-300">{task.result.summary}</p>

          {task.result.findings.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-2">Bulgular</h4>
              <ul className="space-y-1.5">
                {task.result.findings.map((f, i) => (
                  <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                    <span className="text-indigo-400 mt-0.5">•</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {task.result.recommended_actions.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-2">Önerilen Aksiyonlar</h4>
              <div className="space-y-2">
                {task.result.recommended_actions.map((a, i) => (
                  <div key={i} className="p-3 rounded-lg border border-gray-700 bg-gray-800/50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-white">{a.action}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        a.risk_level === 'high' ? 'bg-red-500/20 text-red-400' :
                        a.risk_level === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>{a.risk_level}</span>
                      {a.requires_approval && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/20 text-orange-400">Onay Gerekli</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400">{a.expected_impact}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {task.result.tools_called.length > 0 && (
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-1">
                <Zap size={12} /> Tool Çağrıları
              </h4>
              <div className="flex flex-wrap gap-2">
                {task.result.tools_called.map((tc, i) => (
                  <span key={i} className={`px-2 py-1 rounded-lg text-[10px] font-mono ${
                    tc.status === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {tc.tool_id} ({tc.duration_ms}ms)
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-4 text-[10px] text-gray-500">
            <span className="flex items-center gap-1"><Clock size={10} /> {task.result.metadata.total_duration_ms / 1000}s toplam</span>
            <span className="flex items-center gap-1"><AlertTriangle size={10} /> ${task.result.metadata.total_tool_cost_usd.toFixed(4)} maliyet</span>
          </div>
        </div>
      )}

      {/* Goal & Constraints — visible only on Result tab */}
      {tab === 'result' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-2">🎯 Hedef</h3>
            <p className="text-xs text-gray-300">{task.goal || '—'}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-2">⚠️ Kısıtlar</h3>
            {task.constraints.length > 0 ? (
              <ul className="space-y-1">
                {task.constraints.map((c, i) => (
                  <li key={i} className="text-xs text-gray-300">• {c}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">Kısıt tanımlanmamış</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
