import { useStore } from '@/stores/useStore';
import { selectRevenueTotal } from '@/stores/selectors';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Package, Users, DollarSign } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function AnalyticsPage() {
  const { dashboard, agents, tools, onboardedProduct, quickAsk, setCurrentPage, setOnboardingStep } = useStore();
  const revenueTotal = useStore(selectRevenueTotal);
  const newCustomersTotal = (dashboard?.sales_trend?.length ?? 0) > 0
    ? Math.round(((dashboard?.today_orders ?? 0) * 0.6))   // proxy: 60% new-customer share of orders
    : 0;

  const agentProductivity = agents.map((a) => ({
    name: a.name.replace(' Agent', ''),
    görevler: a.stats?.tasks_completed_today ?? 0,
    başarı: Math.round((a.stats?.success_rate ?? 0) * 100),
  }));

  const categoryData = tools.reduce((acc, t) => {
    const calls = t.stats?.total_calls ?? 0;
    const existing = acc.find((c) => c.name === t.category);
    if (existing) {
      existing.value += calls;
    } else {
      acc.push({ name: t.category, value: calls });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  if (!dashboard) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <span className="text-6xl mb-6">📊</span>
          <h2 className="text-2xl font-bold text-white mb-3">Henüz aktif bir ürün yok</h2>
          <p className="text-gray-400 mb-8 max-w-md">
            Analitik verileri aktif bir ürün onboard edildikten sonra görüntülenebilir.
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Analitik</h1>
          <p className="text-sm text-gray-500">
            Performans metrikleri ve trendler
            {onboardedProduct && <span className="text-gray-400"> · Aktif ürün: <span className="text-yellow-300 font-medium">{onboardedProduct.product_name}</span></span>}
          </p>
        </div>
        {onboardedProduct && (
          <button
            onClick={() => quickAsk(`Analytics Agent: ${onboardedProduct.product_name} için son 7 günün performansını yorumla. ROAS, dönüşüm ve kanal kırılımındaki anomalileri çıkar, düzeltici aksiyonları öncelik sırasına diz.`)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/40 text-yellow-300"
          >
            Performans Yorumu İste
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={DollarSign} label="Haftalık Gelir" value={`₺${revenueTotal.toLocaleString('tr-TR')}`} change={revenueTotal > 0 ? '' : 'Veri yok'} positive />
        <SummaryCard icon={Package} label="Toplam Sipariş" value={(dashboard?.today_orders ?? 0).toLocaleString('tr-TR')} change="" positive />
        <SummaryCard icon={Users} label="Yeni Müşteri" value={newCustomersTotal.toLocaleString('tr-TR')} change="" positive />
        <SummaryCard icon={TrendingUp} label="Dönüşüm Oranı" value={`%${((dashboard?.conversion_rate ?? 0) * 100).toFixed(1)}`} change="" positive />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sales Trend */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">📈 Satış Trendi</h3>
          <div className="h-64">
            {(dashboard.sales_trend?.length ?? 0) === 0 ? (
              <EmptyChart label="Satış verisi yok — entegrasyonlar bekliyor" />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboard.sales_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v: number) => `₺${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} name="Satış" />
              </LineChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Channel Performance */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">📊 Kanal Bazlı Satışlar</h3>
          <div className="h-64">
            {(dashboard.channel_performance?.length ?? 0) === 0 ? (
              <EmptyChart label="Kanal verisi yok" />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.channel_performance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="channel" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v: number) => `₺${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                <Bar dataKey="sales" fill="#6366f1" radius={[4, 4, 0, 0]} name="Satış" />
                <Bar dataKey="orders" fill="#10b981" radius={[4, 4, 0, 0]} name="Sipariş" />
              </BarChart>
            </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Agent Productivity */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">🤖 Ajan Üretkenliği (Bugün)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentProductivity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis type="number" stroke="#6b7280" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={10} width={90} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
                <Bar dataKey="görevler" fill="#6366f1" radius={[0, 4, 4, 0]} name="Tamamlanan Görev" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tool Category Distribution */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">🔧 Tool Kategori Dağılımı</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name }) => name}>
                  {categoryData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tool Usage Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">🔧 En Çok Kullanılan Tool'lar</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Tool</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Çağrı</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Başarı</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Ort. Süre</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Maliyet</th>
              </tr>
            </thead>
            <tbody>
              {[...tools].sort((a, b) => (b.stats?.total_calls ?? 0) - (a.stats?.total_calls ?? 0)).slice(0, 10).map((t) => (
                <tr key={t.tool_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="py-2 px-3 text-white font-medium">{t.name}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{t.stats?.total_calls ?? 0}</td>
                  <td className="py-2 px-3 text-right text-gray-300">{((t.stats?.success_rate ?? 0) * 100).toFixed(0)}%</td>
                  <td className="py-2 px-3 text-right text-gray-300">{t.stats?.avg_duration_ms ?? 0}ms</td>
                  <td className="py-2 px-3 text-right text-gray-300">${(t.stats?.total_cost_usd ?? 0).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center text-xs text-gray-500 border border-dashed border-gray-800 rounded-lg">
      {label}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, change, positive }: { icon: React.ElementType; label: string; value: string; change: string; positive: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-gray-500" />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      <p className={`text-xs mt-1 ${positive ? 'text-green-400' : 'text-red-400'}`}>{change} geçen haftaya göre</p>
    </div>
  );
}
