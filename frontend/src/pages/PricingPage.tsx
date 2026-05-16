import { useStore } from '@/stores/useStore';
import { DollarSign, TrendingUp, Wallet, Target, Activity, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { ChatCommandBar } from '@/components/ChatCommandBar';

export function PricingPage() {
  const product = useStore((s) => s.onboardedProduct);
  const econ = useStore((s) => s.productEconomics);
  const loading = useStore((s) => s.productEconomicsLoading);
  const error = useStore((s) => s.productEconomicsError);
  const regenerate = useStore((s) => s.regenerateProductEconomics);

  return (
    <div className="flex flex-col h-full bg-[#1a1816] text-gray-200 overflow-hidden">
      <header className="px-6 py-4 border-b border-[#2a2624] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><DollarSign size={22} className="text-emerald-400" /> Fiyat & Finans</h1>
          <p className="text-xs text-gray-500 mt-0.5">Marj · COGS · CAC · LTV · ROAS · Finansman ihtiyacı — Pricing & Finance Agent</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-gray-500">Aktif ürün: <span className="text-yellow-300">{product?.product_name ?? '—'}</span></div>
          <button
            onClick={() => { void regenerate(); }}
            disabled={loading || !product}
            className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 rounded-lg flex items-center gap-2 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? 'Üretiliyor…' : econ ? 'Yeniden Üret' : 'Üret'}
          </button>
        </div>
      </header>

      <ChatCommandBar
        commands={[
          { label: 'Fiyat analizi üret', message: 'fiyat analizini yeniden üret' },
          { label: 'Marj optimizasyonu', message: `${product?.product_name ?? 'ürünüm'} için marj optimizasyon önerileri ver` },
          { label: 'Rekabetçi fiyat analizi', message: `${product?.product_name ?? 'ürünüm'} için rakip fiyatları analiz et ve optimum fiyat bandı öner` },
          { label: 'Kanal kârlılığı', message: 'kanal bazlı kârlılık raporu oluştur' },
          { label: 'İndirim stratejisi', message: `${product?.product_name ?? 'ürünüm'} için satış hızlandırıcı indirim stratejisi öner` },
        ]}
      />

      {!product && (
        <div className="p-6">
          <EmptyState title="Önce bir ürün onboard et" body="Fiyat & finans analizi için aktif bir ürüne ihtiyaç var." />
        </div>
      )}

      {product && !econ && !loading && !error && (
        <div className="p-6">
          <EmptyState
            title={`${product.product_name} için fiyat & finans verisi henüz yok`}
            body={`Sağ üstteki "Üret" butonuna bas — Pricing & Finance Agent ${product.category} ürünün için varyant fiyatları, kanal ROAS'ı, LTV/CAC ve finansman ihtiyacı tahmini hazırlayacak.`}
          />
        </div>
      )}

      {loading && product && (
        <div className="p-6">
          <div className="bg-[#262422] border border-[#3a3633] rounded-2xl p-12 text-center">
            <Loader2 size={32} className="text-emerald-400 animate-spin mx-auto mb-3" />
            <div className="text-sm text-gray-300">Pricing & Finance Agent çalışıyor…</div>
            <div className="text-xs text-gray-500 mt-1">{product.product_name} için ekonomi modeli hazırlanıyor</div>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="p-6">
          <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-red-300">Üretim başarısız</div>
              <div className="text-xs text-gray-400 mt-1 break-words">{error}</div>
            </div>
          </div>
        </div>
      )}

      {econ && <PricingDashboard econ={econ} />}
    </div>
  );
}

function PricingDashboard({ econ }: { econ: import('@/types').ProductEconomicsSnapshot }) {
  const productRows = econ.rows;
  const channelStats = econ.channel_stats;
  const totalCustomers = Math.max(econ.total_customers, 1);

  const totalRevenue = productRows.reduce((s, p) => s + p.price * p.sales_30d, 0);
  const totalCost = productRows.reduce((s, p) => s + p.cost * p.sales_30d, 0);
  const grossProfit = totalRevenue - totalCost;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const adSpend = channelStats.reduce((s, c) => s + c.spent, 0);
  const adRevenue = channelStats.reduce((s, c) => s + c.revenue, 0);
  const blendedRoas = adSpend > 0 ? adRevenue / adSpend : 0;

  const cac = totalCustomers > 0 ? adSpend / totalCustomers : 0;
  const ltv = econ.ltv_per_customer;
  const ltvCacRatio = cac > 0 ? ltv / cac : 0;
  const totalOrders = productRows.reduce((s, p) => s + p.sales_30d, 0);
  const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const productEconomics = productRows.map((p) => {
    const marketplaceFeePct = p.marketplace === 'Shopify' ? 0.029 : 0.18;
    const shipping = 35;
    const fee = p.price * marketplaceFeePct;
    const netRevenue = p.price - fee - shipping;
    const profit = netRevenue - p.cost;
    const marginPct = p.price > 0 ? (profit / p.price) * 100 : 0;
    return { ...p, fee, shipping, netRevenue, profit, marginPct };
  });

  const channelData = channelStats.map((c) => ({ ...c, roas: c.spent > 0 ? c.revenue / c.spent : 0 })).sort((a, b) => b.roas - a.roas);
  const monthlyCogs = totalCost;
  const fundingNeed = (adSpend + monthlyCogs) * 3 * 0.4;

  return (
    <>
      <div className="grid grid-cols-6 gap-3 px-6 py-4">
        <Kpi label="Brüt Marj" value={`${grossMargin.toFixed(1)}%`} hint={`₺${grossProfit.toLocaleString('tr-TR')}`} color={grossMargin >= 30 ? 'text-emerald-400' : 'text-yellow-400'} icon={<TrendingUp size={14} />} />
        <Kpi label="AOV" value={`₺${aov.toFixed(0)}`} hint={`${totalOrders.toLocaleString('tr-TR')} sipariş`} color="text-cyan-400" />
        <Kpi label="CAC" value={`₺${cac.toFixed(0)}`} hint="Müşteri başına" color="text-pink-400" icon={<Target size={14} />} />
        <Kpi label="LTV" value={`₺${ltv}`} hint="Ortalama" color="text-violet-400" icon={<Wallet size={14} />} />
        <Kpi label="LTV / CAC" value={`${ltvCacRatio.toFixed(1)}x`} hint={ltvCacRatio >= 3 ? 'Sağlıklı' : 'İzlenmeli'} color={ltvCacRatio >= 3 ? 'text-emerald-400' : 'text-red-400'} />
        <Kpi label="Blended ROAS" value={`${blendedRoas.toFixed(1)}x`} hint="Tüm kanallar" color="text-yellow-400" icon={<Activity size={14} />} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
        <Card title="Ürün Ekonomisi" hint="Liste fiyatından net kâra">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-[10px] uppercase text-gray-500 tracking-wider">
                <tr className="border-b border-[#3a3633]">
                  <th className="text-left py-2 px-2">Ürün</th>
                  <th className="text-left py-2 px-2">Kanal</th>
                  <th className="text-right py-2 px-2">Fiyat</th>
                  <th className="text-right py-2 px-2">COGS</th>
                  <th className="text-right py-2 px-2">Komisyon</th>
                  <th className="text-right py-2 px-2">Kargo</th>
                  <th className="text-right py-2 px-2">Net Gelir</th>
                  <th className="text-right py-2 px-2">Kâr</th>
                  <th className="text-right py-2 px-2">Marj %</th>
                </tr>
              </thead>
              <tbody>
                {productEconomics.map((row) => (
                  <tr key={row.title} className="border-b border-[#2a2624] hover:bg-[#262422]/50">
                    <td className="py-2 px-2 text-gray-200 truncate max-w-[220px]">{row.title}</td>
                    <td className="py-2 px-2 text-gray-400">{row.marketplace}</td>
                    <td className="py-2 px-2 text-right text-gray-300">₺{row.price.toFixed(0)}</td>
                    <td className="py-2 px-2 text-right text-red-300">-₺{row.cost.toFixed(0)}</td>
                    <td className="py-2 px-2 text-right text-orange-300">-₺{row.fee.toFixed(0)}</td>
                    <td className="py-2 px-2 text-right text-orange-300">-₺{row.shipping}</td>
                    <td className="py-2 px-2 text-right text-gray-300">₺{row.netRevenue.toFixed(0)}</td>
                    <td className={`py-2 px-2 text-right font-semibold ${row.profit > 0 ? 'text-emerald-400' : 'text-red-400'}`}>₺{row.profit.toFixed(0)}</td>
                    <td className={`py-2 px-2 text-right font-bold ${row.marginPct >= 25 ? 'text-emerald-400' : row.marginPct >= 15 ? 'text-yellow-400' : 'text-red-400'}`}>{row.marginPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card title="Kanal Bazında ROAS" hint="Reklam yatırım getirisi">
            <div className="space-y-2">
              {channelData.map((c) => {
                const max = Math.max(...channelData.map((x) => x.roas), 1);
                const pct = (c.roas / max) * 100;
                return (
                  <div key={c.channel}>
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-gray-300 font-medium">{c.channel}</span>
                      <span className="text-yellow-300 font-bold">{c.roas.toFixed(1)}x</span>
                    </div>
                    <div className="h-2 bg-[#1a1816] rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-yellow-500 to-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">Harcama: ₺{c.spent.toLocaleString('tr-TR')} · Gelir: ₺{c.revenue.toLocaleString('tr-TR')}</div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card title="Finansman İhtiyacı" hint="Sonraki 90 gün — agent tahmini">
            <div className="text-3xl font-bold text-yellow-400">₺{fundingNeed.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</div>
            <p className="text-[11px] text-gray-500 mt-1 mb-3">Stok + reklam + operasyon işletme sermayesi (40% tampon)</p>
            <div className="space-y-1.5 text-xs">
              <Line label="Aylık reklam" value={`₺${adSpend.toLocaleString('tr-TR')}`} />
              <Line label="Aylık COGS" value={`₺${monthlyCogs.toLocaleString('tr-TR')}`} />
              <Line label="3 ay × giderler" value={`₺${((adSpend + monthlyCogs) * 3).toLocaleString('tr-TR')}`} />
              <Line label="Tampon (40%)" value={`₺${fundingNeed.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`} highlight />
            </div>
          </Card>
        </div>

        {econ.suggestions.length > 0 && (
          <Card title="Pricing Agent Önerileri" hint="Marj koruyarak büyüme">
            <div className="space-y-2">
              {econ.suggestions.map((s, i) => (
                <Suggestion key={i} priority={s.priority} text={s.text} />
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#262422] border border-[#3a3633] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-gray-200">{title}</h3>{hint && <span className="text-[10px] text-gray-500">{hint}</span>}</div>
      {children}
    </div>
  );
}

function Kpi({ label, value, hint, icon, color }: { label: string; value: string; hint?: string; icon?: React.ReactNode; color: string }) {
  return (
    <div className="bg-[#262422] border border-[#3a3633] rounded-xl p-3">
      <div className="flex items-center justify-between text-[10px] text-gray-500"><span className="uppercase tracking-wider">{label}</span>{icon}</div>
      <div className={`text-xl font-bold mt-1 ${color}`}>{value}</div>
      {hint && <div className="text-[10px] text-gray-500 mt-0.5">{hint}</div>}
    </div>
  );
}

function Line({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${highlight ? 'border-t border-[#3a3633] pt-1.5 mt-1 font-semibold' : ''}`}>
      <span className="text-gray-400">{label}</span>
      <span className={highlight ? 'text-yellow-300' : 'text-gray-200'}>{value}</span>
    </div>
  );
}

function Suggestion({ priority, text }: { priority: 'high' | 'medium' | 'low'; text: string }) {
  const map = { high: { dot: 'bg-red-400', label: 'YÜKSEK' }, medium: { dot: 'bg-yellow-400', label: 'ORTA' }, low: { dot: 'bg-gray-400', label: 'DÜŞÜK' } };
  return (
    <div className="flex items-start gap-3 bg-[#1a1816] rounded-lg px-3 py-2">
      <div className={`w-1.5 h-1.5 rounded-full ${map[priority].dot} mt-1.5 shrink-0`} />
      <div className="flex-1">
        <span className="text-[9px] font-bold text-gray-500 tracking-widest">{map[priority].label}</span>
        <p className="text-xs text-gray-300 leading-relaxed mt-0.5">{text}</p>
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-[#262422] border border-dashed border-[#3a3633] rounded-2xl p-10 text-center">
      <DollarSign size={32} className="text-emerald-400/40 mx-auto mb-3" />
      <div className="text-base font-semibold text-gray-200">{title}</div>
      <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto leading-relaxed">{body}</p>
    </div>
  );
}
