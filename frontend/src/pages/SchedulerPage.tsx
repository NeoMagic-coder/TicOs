import { BASE_URL } from '@/lib/api';
import { Calendar, Play, Trash2, ToggleLeft, ToggleRight, Plus, RefreshCw, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

interface UserJob {
  id: string;
  name: string;
  prompt: string;
  schedule_expr: string;
  agent_hint: string | null;
  delivery_platform: string;
  delivery_target: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status: string;
  created_at: string;
  last_run: {
    started_at: string;
    finished_at: string;
    status: 'ok' | 'failed';
    tools_used?: number;
    summary?: string;
    error?: string;
  } | null;
}

interface BuiltinJob {
  id: string;
  next_run_time: string | null;
  trigger: string;
  last_run: { status: 'ok' | 'failed'; summary?: string; error?: string } | null;
}

interface SchedulerStatus {
  running: boolean;
  jobs: BuiltinJob[];
}

function useSchedulerData() {
  const [status, setStatus] = useState<SchedulerStatus>({ running: false, jobs: [] });
  const [userJobs, setUserJobs] = useState<UserJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, jobsRes] = await Promise.all([
        fetch(`${BASE_URL}/api/v1/scheduler`, { signal: AbortSignal.timeout(5000) }),
        fetch(`${BASE_URL}/api/v1/automations`, { signal: AbortSignal.timeout(5000) }),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (jobsRes.ok) setUserJobs(await jobsRes.json());
    } catch { /* backend offline */ }
    finally { setLoading(false); }
  }, []);

  const runNow = useCallback(async (jobId: string, isBuiltin: boolean) => {
    setTriggering(jobId);
    try {
      const url = isBuiltin
        ? `${BASE_URL}/api/v1/scheduler/jobs/${encodeURIComponent(jobId)}/run`
        : `${BASE_URL}/api/v1/automations/${encodeURIComponent(jobId)}/trigger`;
      await fetch(url, { method: 'POST' });
      await refresh();
    } finally { setTriggering(null); }
  }, [refresh]);

  const toggleJob = useCallback(async (jobId: string, enabled: boolean) => {
    await fetch(`${BASE_URL}/api/v1/automations/${encodeURIComponent(jobId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    await refresh();
  }, [refresh]);

  const deleteJob = useCallback(async (jobId: string) => {
    if (!window.confirm('Bu otomasyonu silmek istediğinden emin misin?')) return;
    await fetch(`${BASE_URL}/api/v1/automations/${encodeURIComponent(jobId)}`, { method: 'DELETE' });
    await refresh();
  }, [refresh]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { status, userJobs, loading, triggering, refresh, runNow, toggleJob, deleteJob };
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'ok') return (
    <span className="flex items-center gap-1 text-green-400 text-[11px]">
      <CheckCircle size={11} /> başarılı
    </span>
  );
  if (status === 'failed' || status === 'error') return (
    <span className="flex items-center gap-1 text-red-400 text-[11px]">
      <XCircle size={11} /> hatalı
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-gray-500 text-[11px]">
      <Clock size={11} /> {status}
    </span>
  );
}

function fmtTime(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return iso; }
}

interface CreateFormProps {
  onCreated: () => void;
  onCancel: () => void;
}

function CreateJobForm({ onCreated, onCancel }: CreateFormProps) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [schedule, setSchedule] = useState('');
  const [agentHint, setAgentHint] = useState('');
  const [platform, setPlatform] = useState('web');
  const [target, setTarget] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !prompt.trim() || !schedule.trim()) {
      setError('Ad, görev ve zamanlama zorunludur.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${BASE_URL}/api/v1/automations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          prompt: prompt.trim(),
          schedule: schedule.trim(),
          agent_hint: agentHint.trim() || null,
          delivery_platform: platform,
          delivery_target: target.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail ?? `Sunucu hatası (${res.status})`);
        return;
      }
      onCreated();
    } catch (e) {
      setError('Bağlantı hatası.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Plus size={14} className="text-yellow-400" /> Yeni Otomasyon
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] text-gray-400 mb-1">Ad</label>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Haftalık fiyat raporu"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500"
          />
        </div>
        <div>
          <label className="block text-[11px] text-gray-400 mb-1">Zamanlama</label>
          <input
            value={schedule} onChange={(e) => setSchedule(e.target.value)}
            placeholder="Her pazartesi sabah 9'da  veya  0 9 * * 1"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] text-gray-400 mb-1">Görev (ajan için prompt)</label>
        <textarea
          value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3}
          placeholder="Rakip fiyatları analiz et, %5 üzeri farklılıkları ⚠️ ile işaretle."
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500 resize-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] text-gray-400 mb-1">Ajan ipucu (opsiyonel)</label>
          <input
            value={agentHint} onChange={(e) => setAgentHint(e.target.value)}
            placeholder="dynamic_pricing_agent"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500"
          />
        </div>
        <div>
          <label className="block text-[11px] text-gray-400 mb-1">Teslimat platformu</label>
          <select
            value={platform} onChange={(e) => setPlatform(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
          >
            <option value="web">Web (dashboard)</option>
            <option value="telegram">Telegram</option>
            <option value="discord">Discord</option>
            <option value="slack">Slack</option>
            <option value="email">E-posta</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-gray-400 mb-1">Hedef (chat_id / e-posta)</label>
          <input
            value={target} onChange={(e) => setTarget(e.target.value)}
            placeholder="-1001234567890"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-yellow-500"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-[12px] bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-700">İptal</button>
        <button
          onClick={() => void handleSubmit()}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg text-sm bg-yellow-500 text-gray-900 font-semibold hover:bg-yellow-400 disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : 'Oluştur'}
        </button>
      </div>
    </div>
  );
}

export function SchedulerPage() {
  const { status, userJobs, loading, triggering, refresh, runNow, toggleJob, deleteJob } = useSchedulerData();
  const [showCreate, setShowCreate] = useState(false);

  const handleCreated = () => {
    setShowCreate(false);
    void refresh();
  };

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar size={20} className="text-yellow-400" /> Zamanlayıcı
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Otomatik çalışan görevler ve programlanmış analizler</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${status.running ? 'bg-green-500/20 text-green-400' : 'bg-gray-600/30 text-gray-400'}`}>
            {status.running ? '● çalışıyor' : '○ durduruldu'}
          </span>
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white"
            title="Yenile"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500 text-gray-900 text-sm font-semibold hover:bg-yellow-400"
          >
            <Plus size={14} /> Yeni
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateJobForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
      )}

      {/* Built-in jobs */}
      {status.jobs.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Yerleşik Görevler</h2>
          <div className="grid gap-3">
            {status.jobs.map((job) => (
              <div key={job.id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono text-yellow-300 bg-yellow-500/10 px-2 py-0.5 rounded">{job.id}</span>
                    {job.last_run && <StatusBadge status={job.last_run.status} />}
                  </div>
                  <div className="text-[11px] text-gray-500 font-mono">{job.trigger}</div>
                  {job.next_run_time && (
                    <div className="text-[11px] text-gray-500 mt-1">
                      Sonraki: <span className="text-gray-300">{fmtTime(job.next_run_time)}</span>
                    </div>
                  )}
                  {job.last_run?.summary && (
                    <div className="text-[11px] text-gray-400 mt-1 truncate max-w-lg">{job.last_run.summary}</div>
                  )}
                </div>
                <button
                  onClick={() => void runNow(job.id, true)}
                  disabled={triggering === job.id || !status.running}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-[11px] font-medium disabled:opacity-40"
                  title={!status.running ? 'Scheduler çalışmıyor' : 'Şimdi çalıştır'}
                >
                  <Play size={11} /> {triggering === job.id ? 'Çalışıyor…' : 'Çalıştır'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User-defined jobs */}
      <div>
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
          Kullanıcı Otomasyonları
          {userJobs.length > 0 && <span className="ml-2 text-gray-600">({userJobs.length})</span>}
        </h2>

        {userJobs.length === 0 ? (
          <div className="border border-dashed border-gray-700 rounded-xl p-10 text-center">
            <Calendar size={32} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Henüz otomasyon yok.</p>
            <p className="text-gray-600 text-[12px] mt-1">Fiyat raporları, stok uyarıları ve daha fazlasını otomatik çalıştır.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 px-4 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-sm hover:bg-yellow-500/20"
            >
              İlk otomasyonu oluştur
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {userJobs.map((job) => (
              <div key={job.id} className={`border rounded-xl p-4 transition-colors ${job.enabled ? 'bg-gray-800/60 border-gray-700' : 'bg-gray-900/40 border-gray-800 opacity-60'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-white">{job.name}</span>
                      <span className="text-[10px] font-mono text-gray-500 bg-gray-700 px-1.5 py-0.5 rounded">{job.schedule_expr}</span>
                      {job.agent_hint && (
                        <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">{job.agent_hint}</span>
                      )}
                      {job.delivery_platform !== 'web' && (
                        <span className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">{job.delivery_platform}</span>
                      )}
                      <StatusBadge status={job.last_status} />
                    </div>
                    <p className="text-[12px] text-gray-400 line-clamp-2">{job.prompt}</p>
                    <div className="flex gap-4 mt-1.5 text-[11px] text-gray-600">
                      {job.last_run_at && <span>Son: {fmtTime(job.last_run_at)}</span>}
                      {job.next_run_at && <span>Sonraki: <span className="text-gray-400">{fmtTime(job.next_run_at)}</span></span>}
                    </div>
                    {job.last_run?.summary && (
                      <div className="mt-1.5 text-[11px] text-gray-400 bg-gray-900/50 rounded px-2 py-1 truncate">{job.last_run.summary}</div>
                    )}
                    {job.last_run?.error && (
                      <div className="mt-1.5 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded px-2 py-1 truncate">{job.last_run.error}</div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => void toggleJob(job.id, !job.enabled)}
                      className={`p-1.5 rounded-lg transition-colors ${job.enabled ? 'text-green-400 hover:bg-green-500/10' : 'text-gray-600 hover:bg-gray-700'}`}
                      title={job.enabled ? 'Durdur' : 'Etkinleştir'}
                    >
                      {job.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                    </button>
                    <button
                      onClick={() => void runNow(job.id, false)}
                      disabled={triggering === job.id || !status.running || !job.enabled}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30"
                      title="Şimdi çalıştır"
                    >
                      {triggering === job.id ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => void deleteJob(job.id)}
                      className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10"
                      title="Sil"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
