import { useStore } from '@/stores/useStore';
import { BASE_URL } from '@/lib/api';
import { FileText, Search, Bot, User, Settings, Download, FlaskConical, RefreshCw } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

interface TrajSummary {
  id: string;
  task_id: string;
  steps_count: number;
  compressed_steps_count: number | null;
  quality_score: number;
  exported_at: string | null;
  created_at: string;
}

function ResearchPanel() {
  const [trajs, setTrajs] = useState<TrajSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [minQuality, setMinQuality] = useState(0.0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/research/trajectories?min_quality=${minQuality}&limit=50`);
      if (res.ok) setTrajs(await res.json());
    } catch { /* offline */ } finally { setLoading(false); }
  }, [minQuality]);

  useEffect(() => { void load(); }, [load]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/research/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_quality: minQuality, unexported_only: false, use_compressed: true }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'trajectories.jsonl'; a.click();
      URL.revokeObjectURL(url);
      void load();
    } catch { /* offline */ } finally { setExporting(false); }
  };

  const compress = async (id: string) => {
    await fetch(`${BASE_URL}/api/v1/research/trajectories/${id}/compress`, { method: 'POST' });
    void load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <FlaskConical size={14} className="text-purple-400" /> Araştırma Modu
          <span className="text-gray-600 font-normal text-[11px]">{trajs.length} yörünge</span>
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">Min kalite:</span>
          <input
            type="number" min={0} max={1} step={0.1} value={minQuality}
            onChange={(e) => setMinQuality(parseFloat(e.target.value) || 0)}
            className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
          />
          <button onClick={() => void load()} disabled={loading} className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white">
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => void handleExport()} disabled={exporting || trajs.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium disabled:opacity-40"
          >
            <Download size={12} /> {exporting ? 'İndiriliyor…' : 'JSONL İndir'}
          </button>
        </div>
      </div>

      {trajs.length === 0 ? (
        <div className="text-center py-8 text-gray-600 text-sm">
          Henüz yörünge yok. Hermes görevleri otomatik olarak kaydedilir.
        </div>
      ) : (
        <div className="grid gap-2">
          {trajs.map((t) => (
            <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="font-mono text-gray-400">{t.task_id}</span>
                  <span className={`px-1.5 py-0.5 rounded ${t.quality_score >= 0.8 ? 'bg-green-500/20 text-green-400' : t.quality_score >= 0.6 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-700 text-gray-500'}`}>
                    {t.quality_score.toFixed(2)}
                  </span>
                  <span className="text-gray-600">{t.steps_count} adım{t.compressed_steps_count != null ? ` → ${t.compressed_steps_count} sıkıştırılmış` : ''}</span>
                  {t.exported_at && <span className="text-gray-700">✓ dışa aktarıldı</span>}
                </div>
                <div className="text-[10px] text-gray-600 mt-0.5">{new Date(t.created_at).toLocaleString('tr-TR')}</div>
              </div>
              {t.compressed_steps_count == null && (
                <button onClick={() => void compress(t.id)} className="text-[11px] text-purple-400 hover:text-purple-300 px-2 py-1 rounded hover:bg-purple-500/10 shrink-0">
                  Sıkıştır
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AuditPage() {
  const { auditLogs, onboardedProduct } = useStore();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const actionTypes = ['all', ...new Set(auditLogs.map((l) => l.action.split('.')[0]))];

  const filtered = auditLogs
    .filter((l) => typeFilter === 'all' || l.action.startsWith(typeFilter))
    .filter((l) => search === '' || l.details.toLowerCase().includes(search.toLowerCase()) || l.action.toLowerCase().includes(search.toLowerCase()));

  const actorIcon = (type: string) => {
    switch (type) {
      case 'agent': return <Bot size={14} className="text-indigo-400" />;
      case 'user': return <User size={14} className="text-green-400" />;
      default: return <Settings size={14} className="text-gray-400" />;
    }
  };

  const actionColor = (action: string) => {
    if (action.includes('created')) return 'text-blue-400';
    if (action.includes('completed')) return 'text-green-400';
    if (action.includes('approved')) return 'text-green-400';
    if (action.includes('rejected')) return 'text-red-400';
    if (action.includes('failed')) return 'text-red-400';
    if (action.includes('changed')) return 'text-amber-400';
    return 'text-gray-400';
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText size={24} className="text-indigo-400" /> Audit Log
        </h1>
        <p className="text-sm text-gray-500">
          Tüm sistem aksiyonlarının kaydı
          {onboardedProduct && <span className="text-gray-400"> · Aktif ürün: <span className="text-yellow-300 font-medium">{onboardedProduct.product_name}</span></span>}
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Log ara..." className="w-full pl-9 pr-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {actionTypes.map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
              {t === 'all' ? 'Tümü' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Research Panel */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <ResearchPanel />
      </div>

      {/* Log List */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="divide-y divide-gray-800">
          {filtered.map((log) => (
            <div key={log.id} className="px-5 py-3 hover:bg-gray-800/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{actorIcon(log.actor_type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-mono font-medium ${actionColor(log.action)}`}>{log.action}</span>
                    <span className="text-[10px] text-gray-600">•</span>
                    <span className="text-[10px] text-gray-500">{log.actor_name}</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5">{log.details}</p>
                </div>
                <span className="text-[10px] text-gray-500 shrink-0">{new Date(log.timestamp).toLocaleString('tr-TR')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
