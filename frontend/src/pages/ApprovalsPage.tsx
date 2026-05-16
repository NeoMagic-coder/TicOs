import { useStore } from '@/stores/useStore';
import { selectPendingApprovalCount } from '@/stores/selectors';
import { CheckCircle, XCircle, AlertTriangle, Clock, Shield } from 'lucide-react';
import { useState } from 'react';

export function ApprovalsPage() {
  const { approvals, approveItem, rejectItem, agents, onboardedProduct, estimateApprovalImpact, loadDemoFixtures } = useStore();
  const [filter, setFilter] = useState<string>('pending');
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<string | null>(null);

  const filtered = filter === 'all' ? approvals : approvals.filter((a) => a.status === filter);
  const pendingCount = useStore(selectPendingApprovalCount);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          Onay Merkezi
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-sm font-bold bg-red-500 text-white">{pendingCount}</span>
          )}
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30" title="Onay akışı henüz kalıcı bir backend'e bağlı değil; oturum sona erince kayıtlar kaybolur">
            DEMO
          </span>
        </h1>
        <p className="text-sm text-gray-500">
          İnsan onayı gerektiren tüm aksiyonlar — şu an kalıcı bir backend yok, durum tarayıcı belleğinde tutulur
          {onboardedProduct && <span className="text-gray-400"> · Aktif ürün: <span className="text-yellow-300 font-medium">{onboardedProduct.product_name}</span></span>}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2" role="tablist" aria-label="Onay filtresi">
        {[
          { id: 'pending', label: '⏳ Bekleyen', count: pendingCount },
          { id: 'approved', label: '✅ Onaylanan', count: approvals.filter((a) => a.status === 'approved').length },
          { id: 'rejected', label: '❌ Reddedilen', count: approvals.filter((a) => a.status === 'rejected').length },
          { id: 'all', label: 'Tümü', count: approvals.length },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            role="tab"
            aria-selected={filter === f.id}
            aria-label={`${f.label} (${f.count})`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${
              filter === f.id ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Approval List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <CheckCircle size={40} className="mx-auto text-gray-600 mb-3" />
            <p className="text-sm text-gray-400">Bu kategoride onay bulunmuyor</p>
            {filter === 'pending' && (
              <>
                <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto">
                  Human-in-the-loop iş akışını test etmek istiyorsan, demo onay fixture'ı yükleyebilirsin (fiyat değişikliği, bütçe artışı, reorder).
                </p>
                <button
                  onClick={loadDemoFixtures}
                  className="mt-4 px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-lg text-xs font-medium text-amber-300 transition-colors"
                >
                  🧪 Demo onaylar yükle
                </button>
              </>
            )}
          </div>
        ) : (
          filtered.map((approval) => {
            const agent = agents.find((a) => a.agent_id === approval.agent_id);
            return (
              <div key={approval.id} className={`bg-gray-900 border rounded-xl p-5 transition-colors ${
                approval.status === 'pending' ? 'border-amber-500/30' :
                approval.status === 'approved' ? 'border-green-500/20' :
                'border-red-500/20'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl shrink-0 ${
                    approval.risk_level === 'high' || approval.risk_level === 'critical' ? 'bg-red-500/10' :
                    approval.risk_level === 'medium' ? 'bg-amber-500/10' : 'bg-green-500/10'
                  }`}>
                    {approval.risk_level === 'high' || approval.risk_level === 'critical' ? (
                      <AlertTriangle size={20} className="text-red-400" />
                    ) : approval.risk_level === 'medium' ? (
                      <Shield size={20} className="text-amber-400" />
                    ) : (
                      <CheckCircle size={20} className="text-green-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white">{approval.action}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        approval.risk_level === 'high' || approval.risk_level === 'critical' ? 'bg-red-500/20 text-red-400' :
                        approval.risk_level === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-green-500/20 text-green-400'
                      }`}>
                        {approval.risk_level === 'high' ? 'Yüksek Risk' : approval.risk_level === 'medium' ? 'Orta Risk' : 'Düşük Risk'}
                      </span>
                      {approval.status !== 'pending' && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          approval.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>{approval.status === 'approved' ? 'Onaylandı' : 'Reddedildi'}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">{approval.description}</p>

                    <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500">
                      {agent && <span>{agent.icon} {agent.name}</span>}
                      <span className="flex items-center gap-1"><Clock size={10} /> {new Date(approval.created_at).toLocaleString('tr-TR')}</span>
                    </div>

                    {approval.expected_impact ? (
                      <div className="mt-2 p-2 rounded-lg bg-indigo-500/5 border border-indigo-500/10">
                        <p className="text-[11px] text-indigo-300">💡 Beklenen Etki: {approval.expected_impact}</p>
                      </div>
                    ) : approval.status === 'pending' && (
                      <button
                        onClick={() => void estimateApprovalImpact(approval.id)}
                        className="mt-2 text-[11px] text-indigo-300 hover:text-indigo-200 underline decoration-dotted"
                      >
                        💡 Beklenen etkiyi tahmin et (LLM)
                      </button>
                    )}

                    {approval.reviewer_note && (
                      <div className="mt-2 p-2 rounded-lg bg-gray-800">
                        <p className="text-[11px] text-gray-400">📝 Not: {approval.reviewer_note}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {approval.status === 'pending' && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => approveItem(approval.id)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-xs font-medium text-white transition-colors"
                      >
                        <CheckCircle size={14} /> Onayla
                      </button>
                      {showRejectInput === approval.id ? (
                        <div className="space-y-1.5">
                          <input
                            value={rejectNote[approval.id] || ''}
                            onChange={(e) => setRejectNote({ ...rejectNote, [approval.id]: e.target.value })}
                            placeholder="Red nedeni..."
                            className="w-full px-2.5 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                          />
                          <button
                            onClick={() => {
                              rejectItem(approval.id, rejectNote[approval.id] || 'Reddedildi');
                              setShowRejectInput(null);
                            }}
                            className="w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-[11px] font-medium text-white transition-colors"
                          >
                            Reddet
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowRejectInput(approval.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-red-600/80 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-colors"
                        >
                          <XCircle size={14} /> Reddet
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
