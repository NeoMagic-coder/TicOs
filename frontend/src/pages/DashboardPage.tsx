import { useStore } from '@/stores/useStore';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, ShoppingCart, Target, DollarSign, AlertTriangle, Clock, CheckCircle, Users } from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub, color, isDemo }: { icon: React.ElementType; label: string; value: string; sub?: string; color: string; isDemo?: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
            {isDemo && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30" title="Bu veri demo modundadır — gerçek entegrasyon verisi değil">
                DEMO
              </span>
            )}
          </div>
          <p className="text-2xl font-bold mt-1 text-white">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`p-2.5 rounded-xl bg-opacity-15`} style={{ backgroundColor: `${color}22` }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { dashboard, tasks, approvals, agents, setCurrentPage, onboardedProduct, quickAsk, resetAll, setOnboardingStep, loadDemoFixtures } = useStore();
  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const activeTasks = tasks.filter((t) => !['completed', 'failed'].includes(t.status));

  // Dashboard exists but all numbers are zero → user is post-onboard with no
  // backend data yet. Surface a one-click "demo veriyle doldur" button so the
  // UI is evaluable without running the full backend pipeline.
  const isEmptyDashboard =
    !!dashboard &&
    dashboard.today_sales === 0 &&
    dashboard.today_orders === 0 &&
    dashboard.today_roas === 0;

  if (!dashboard) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <span className="text-6xl mb-6">📊</span>
          <h2 className="text-2xl font-bold text-white mb-3">Henüz aktif bir ürün yok</h2>
          <p className="text-gray-400 mb-8 max-w-md">
            Dashboard verileri aktif bir ürün onboard edildikten sonra otomatik olarak oluşur.
          </p>
          <button
            onClick={() => { setOnboardingStep(1); setCurrentPage('onboarding'); }}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold transition-colors"
          >
            🚀 Ürün Onboard Et
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-gray-500">
            E-Commerce Agent Office — Bugünün özeti
            {onboardedProduct && <span className="text-gray-400"> · Aktif ürün: <span className="text-yellow-300 font-medium">{onboardedProduct.product_name}</span></span>}
          </p>
        </div>
        <div className="flex gap-2">
          {onboardedProduct && (
            <button
              onClick={() => quickAsk(`Dashboard: ${onboardedProduct.product_name} için bugünkü öncelikli aksiyonları, riskleri ve büyüme fırsatlarını sıralı plan halinde çıkar.`)}
              className="px-4 py-2 bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/40 text-yellow-300 rounded-lg text-sm font-semibold transition-colors"
            >
              📋 Günün Planını İste
            </button>
          )}
          <button onClick={() => setCurrentPage('chat')} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-medium transition-colors">
            💬 Chat ile Görev Ver
          </button>
          {isEmptyDashboard && (
            <button
              onClick={loadDemoFixtures}
              className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded-lg text-sm font-medium text-amber-300 transition-colors"
              title="Geliştirme/demo modu: dashboard ve onayları sahte ama gerçekçi verilerle doldur"
            >
              🧪 Örnek veriyi yükle (demo)
            </button>
          )}
          <button onClick={resetAll} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm font-medium transition-colors text-gray-400 hover:text-white">
            ↺ Tümünü Sıfırla
          </button>
        </div>
      </div>

      {dashboard._isDemo && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl px-5 py-4 flex items-start gap-3">
          <span className="text-2xl">🧪</span>
          <div>
            <p className="text-sm font-bold text-amber-300">DEMO modu — bu sayfadaki tüm metrikler sahte verilerdir.</p>
            <p className="text-xs text-amber-200/70 mt-1">
              Satış, sipariş, ROAS ve grafikler örnek değerlerle dolduruldu; gerçek bir Shopify/GA4 entegrasyonu bağlı değil.
              Karar verme amacıyla kullanmayın.
            </p>
          </div>
        </div>
      )}
      {isEmptyDashboard && !dashboard._isDemo && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-200/80">
          <span className="font-semibold">Henüz veri yok.</span> Tüm sayılar sıfır görünüyor — ya backend henüz veri üretmedi ya da entegrasyonlar bağlanmadı.
          Hızlı bir önizleme için sağ üstteki <span className="font-semibold">Örnek veriyi yükle (demo)</span> butonunu kullanabilirsin.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Bugünkü Satışlar" value={`₺${dashboard.today_sales.toLocaleString('tr-TR')}`} sub={onboardedProduct ? onboardedProduct.product_name : undefined} color="#10b981" isDemo={dashboard._isDemo} />
        <StatCard icon={ShoppingCart} label="Siparişler" value={dashboard.today_orders.toString()} sub={`AOV: ₺${dashboard.avg_order_value.toFixed(0)}`} color="#3b82f6" isDemo={dashboard._isDemo} />
        <StatCard icon={Target} label="ROAS" value={`${dashboard.today_roas}x`} sub={onboardedProduct?.channels?.join(' + ') || undefined} color="#8b5cf6" isDemo={dashboard._isDemo} />
        <StatCard icon={TrendingUp} label="Dönüşüm Oranı" value={`%${dashboard.conversion_rate}`} sub={`${dashboard.active_campaigns} aktif kampanya`} color="#f59e0b" isDemo={dashboard._isDemo} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales Trend */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">📈 Satış Trendi (Son 7 Gün)</h3>
          <div className="h-64">
            {(dashboard.sales_trend ?? []).every((d) => d.value === 0) ? (
              <div className="h-full flex flex-col items-center justify-center text-center border border-dashed border-gray-800 rounded-lg">
                <span className="text-3xl mb-2">📉</span>
                <p className="text-xs text-gray-500">Henüz satış verisi yok</p>
                <p className="text-[10px] text-gray-600 mt-1">Entegrasyon bağlandığında ya da demo verisi yüklendiğinde dolacak.</p>
              </div>
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboard.sales_trend}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                <YAxis stroke="#6b7280" fontSize={12} tickFormatter={(v: number) => `₺${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#9ca3af' }}
                  formatter={(value) => [`₺${Number(value).toLocaleString('tr-TR')}`, 'Satış']}
                />
                <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#salesGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Channel Performance */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">📊 Kanal Performansı</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.channel_performance} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" stroke="#6b7280" fontSize={11} tickFormatter={(v: number) => `₺${(v / 1000).toFixed(0)}K`} />
                <YAxis dataKey="channel" type="category" stroke="#6b7280" fontSize={11} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                  formatter={(value) => [`₺${Number(value).toLocaleString('tr-TR')}`, 'Satış']}
                />
                <Bar dataKey="sales" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Critical Alerts */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" /> Kritik Uyarılar
          </h3>
          <div className="space-y-3">
            {dashboard.critical_alerts.map((alert) => (
              <div key={alert.id} className={`p-3 rounded-lg border ${
                alert.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
                alert.severity === 'warning' ? 'border-amber-500/30 bg-amber-500/5' :
                'border-blue-500/30 bg-blue-500/5'
              }`}>
                <p className="text-xs font-semibold text-white">{alert.title}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{alert.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <CheckCircle size={16} className="text-indigo-400" /> Bekleyen Onaylar
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white">{pendingApprovals.length}</span>
            </h3>
            <button onClick={() => setCurrentPage('approvals')} className="text-xs text-indigo-400 hover:text-indigo-300">Tümü →</button>
          </div>
          <div className="space-y-2.5">
            {pendingApprovals.slice(0, 4).map((a) => (
              <div key={a.id} className="p-3 rounded-lg border border-gray-700 bg-gray-800/50">
                <p className="text-xs font-medium text-white">{a.action}</p>
                <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{a.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    a.risk_level === 'high' ? 'bg-red-500/20 text-red-400' :
                    a.risk_level === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>{a.risk_level}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Activity */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Users size={16} className="text-green-400" /> Ajan Aktivitesi
            </h3>
            <button onClick={() => setCurrentPage('agents')} className="text-xs text-indigo-400 hover:text-indigo-300">Tümü →</button>
          </div>
          <div className="space-y-2.5">
            {agents.slice(0, 5).map((agent) => (
              <div key={agent.agent_id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-800/50 transition-colors">
                <span className="text-lg">{agent.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-white truncate">{agent.name}</p>
                  <p className="text-[10px] text-gray-500">{agent.stats.tasks_completed_today} görev bugün</p>
                </div>
                <span className={`w-2 h-2 rounded-full ${
                  agent.status === 'active' ? 'bg-green-400' :
                  agent.status === 'busy' ? 'bg-amber-400' :
                  agent.status === 'idle' ? 'bg-gray-400' : 'bg-red-400'
                }`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active Tasks */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Clock size={16} className="text-blue-400" /> Aktif Görevler
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400">{activeTasks.length}</span>
          </h3>
          <button onClick={() => setCurrentPage('tasks')} className="text-xs text-indigo-400 hover:text-indigo-300">Tümü →</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Görev</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Durum</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Öncelik</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Atanan Ajan</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Güven</th>
              </tr>
            </thead>
            <tbody>
              {activeTasks.slice(0, 5).map((t) => {
                const agent = agents.find((a) => a.agent_id === t.assigned_agent_id);
                return (
                  <tr key={t.task_id} className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer" onClick={() => { useStore.getState().setSelectedTask(t.task_id); setCurrentPage('tasks'); }}>
                    <td className="py-2.5 px-3 text-white font-medium">{t.title}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={t.status} /></td>
                    <td className="py-2.5 px-3"><PriorityBadge priority={t.priority} /></td>
                    <td className="py-2.5 px-3 text-gray-400">{agent ? `${agent.icon} ${agent.name}` : '—'}</td>
                    <td className="py-2.5 px-3 text-gray-400">{t.confidence != null ? `${(t.confidence * 100).toFixed(0)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    created: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Oluşturuldu' },
    triaged: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Sınıflandı' },
    assigned: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Atandı' },
    in_progress: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Devam Ediyor' },
    waiting_tool_result: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Tool Bekliyor' },
    waiting_human_approval: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Onay Bekliyor' },
    completed: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'Tamamlandı' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Başarısız' },
    escalated: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Yükseltildi' },
  };
  const c = config[status] || config.created;
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { bg: string; text: string }> = {
    critical: { bg: 'bg-red-500/20', text: 'text-red-400' },
    high: { bg: 'bg-orange-500/20', text: 'text-orange-400' },
    medium: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    low: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  };
  const c = config[priority] || config.medium;
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${c.bg} ${c.text}`}>{priority}</span>;
}
