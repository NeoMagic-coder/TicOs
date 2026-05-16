import { useStore } from '@/stores/useStore';
import { FileText, Search, Bot, User, Settings } from 'lucide-react';
import { useState } from 'react';

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
