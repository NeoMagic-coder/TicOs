import { useStore } from '@/stores/useStore';
import { Mail, Play, Pause, Plus, MousePointerClick, Inbox, TrendingUp } from 'lucide-react';
import type { EmailFlow } from '@/types';
import { ChatCommandBar } from '@/components/ChatCommandBar';

const triggerMeta: Record<EmailFlow['trigger'], { icon: string; label: string; color: string }> = {
  welcome:         { icon: '👋', label: 'Hoş Geldin',         color: 'border-emerald-500/40 bg-emerald-500/5' },
  abandoned_cart:  { icon: '🛒', label: 'Terk Edilmiş Sepet', color: 'border-yellow-500/40 bg-yellow-500/5' },
  post_purchase:   { icon: '📦', label: 'Satın Alma Sonrası', color: 'border-blue-500/40 bg-blue-500/5' },
  winback:         { icon: '💔', label: 'Win-back',           color: 'border-pink-500/40 bg-pink-500/5' },
  birthday:        { icon: '🎂', label: 'Doğum Günü',         color: 'border-violet-500/40 bg-violet-500/5' },
};

const statusMeta: Record<EmailFlow['status'], string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  paused: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40',
  draft:  'bg-gray-500/15 text-gray-300 border-gray-500/40',
};

export function EmailFlowsPage() {
  const flows = useStore((s) => s.emailFlows);
  const toggleFlow = useStore((s) => s.toggleEmailFlow);
  const publishFlow = useStore((s) => s.publishEmailFlow);
  const quickAsk = useStore((s) => s.quickAsk);
  const product = useStore((s) => s.onboardedProduct);

  const totalRevenue = flows.reduce((s, f) => s + f.revenue_30d, 0);
  const totalRecipients = flows.reduce((s, f) => s + f.recipients_30d, 0);
  const avgOpen = flows.filter((f) => f.recipients_30d > 0).reduce((s, f) => s + f.open_rate, 0) / Math.max(flows.filter((f) => f.recipients_30d > 0).length, 1);
  const avgClick = flows.filter((f) => f.recipients_30d > 0).reduce((s, f) => s + f.click_rate, 0) / Math.max(flows.filter((f) => f.recipients_30d > 0).length, 1);

  return (
    <div className="flex flex-col h-full bg-[#1a1816] text-gray-200 overflow-hidden">
      <header className="px-6 py-4 border-b border-[#2a2624] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Mail size={22} className="text-violet-400" /> E-posta Akışları</h1>
          <p className="text-xs text-gray-500 mt-0.5">Klaviyo benzeri yaşam döngüsü akışları · Email & CRM Agent</p>
        </div>
        <button onClick={() => quickAsk(`Email & CRM Agent: ${product?.product_name ?? 'ürün'} için yeni bir e-posta akışı tasarla. Trigger, adım sayısı, her adımın konusu, bekleme süresi ve segment kriteri olsun.`)}
          className="px-4 py-2 bg-violet-500/20 border border-violet-500/50 text-violet-300 rounded-lg flex items-center gap-2 hover:bg-violet-500/30 text-sm font-semibold">
          <Plus size={14} /> Yeni Akış
        </button>
      </header>

      <ChatCommandBar
        commands={[
          { label: 'Tüm akışları yayına al', message: 'tüm e-posta akışlarını hepsini yayına al' },
          { label: 'A/B testi öner', message: `${product?.product_name ?? 'ürünüm'} e-posta akışları için A/B test önerileri ver` },
          { label: 'Açılma oranı iyileştir', message: `${product?.product_name ?? 'ürünüm'} e-posta açılma oranını artırmak için konu satırı optimizasyon önerileri ver` },
          { label: 'Yeni akış tasarla', message: `${product?.product_name ?? 'ürünüm'} için yeni winback e-posta akışı tasarla` },
        ]}
      />

      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        <Kpi label="30g Gelir" value={`₺${totalRevenue.toLocaleString('tr-TR')}`} hint="Akışlardan" icon={<TrendingUp size={14} />} color="text-emerald-400" />
        <Kpi label="Alıcı" value={totalRecipients.toLocaleString('tr-TR')} hint="30 gün" icon={<Inbox size={14} />} color="text-cyan-400" />
        <Kpi label="Ort. Açılma" value={`${(avgOpen * 100).toFixed(0)}%`} hint="Aktif akışlar" color="text-yellow-400" />
        <Kpi label="Ort. Tıklama" value={`${(avgClick * 100).toFixed(0)}%`} hint="Aktif akışlar" icon={<MousePointerClick size={14} />} color="text-violet-400" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
        {flows.map((f) => {
          const meta = triggerMeta[f.trigger];
          const revPerRecipient = f.recipients_30d > 0 ? f.revenue_30d / f.recipients_30d : 0;
          return (
            <div key={f.id} className={`bg-[#262422] border rounded-xl p-4 ${meta.color} hover:border-violet-500/40 transition-colors`}>
              <div className="flex items-start gap-4">
                <div className="text-4xl shrink-0">{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-sm font-bold text-white">{f.name}</h3>
                    <span className="text-[10px] text-gray-500">{meta.label}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusMeta[f.status]}`}>{f.status === 'active' ? 'Aktif' : f.status === 'paused' ? 'Duraklatıldı' : 'Taslak'}</span>
                    <span className="text-[10px] text-gray-500">· {f.steps_count} adım</span>
                  </div>

                  {/* Steps visualization */}
                  <div className="flex items-center gap-1 my-3 flex-wrap">
                    {Array.from({ length: f.steps_count }).map((_, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <div className="w-8 h-8 rounded-lg bg-[#1a1816] border border-[#3a3633] flex items-center justify-center text-[10px] font-bold text-gray-400">
                          {i + 1}
                        </div>
                        {i < f.steps_count - 1 && <div className="w-3 h-0.5 bg-[#3a3633]" />}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-[11px]">
                    <Stat label="Alıcı (30g)" value={f.recipients_30d.toLocaleString('tr-TR')} />
                    <Stat label="Açılma" value={`${(f.open_rate * 100).toFixed(0)}%`} />
                    <Stat label="Tıklama" value={`${(f.click_rate * 100).toFixed(0)}%`} />
                    <Stat label="Gelir / kişi" value={`₺${revPerRecipient.toFixed(1)}`} />
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-gray-500 uppercase">30g Gelir</div>
                    <div className="text-lg font-bold text-emerald-400">₺{f.revenue_30d.toLocaleString('tr-TR')}</div>
                  </div>
                  {f.status !== 'draft' && (
                    <button onClick={() => toggleFlow(f.id)} className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg flex items-center gap-1 ${
                      f.status === 'active'
                        ? 'bg-yellow-500/15 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/25'
                        : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                    }`}>
                      {f.status === 'active' ? <><Pause size={11} /> Durdur</> : <><Play size={11} /> Başlat</>}
                    </button>
                  )}
                  {f.status === 'draft' && (
                    <button onClick={() => publishFlow(f.id)} className="px-3 py-1.5 text-[11px] font-semibold rounded-lg bg-violet-500/15 border border-violet-500/40 text-violet-300 hover:bg-violet-500/25">
                      Yayına Al
                    </button>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1a1816] rounded-lg px-2 py-1.5 text-center">
      <div className="text-[9px] text-gray-500 uppercase">{label}</div>
      <div className="text-xs font-bold text-gray-200">{value}</div>
    </div>
  );
}

function Kpi({ label, value, hint, icon, color }: { label: string; value: string; hint?: string; icon?: React.ReactNode; color: string }) {
  return (
    <div className="bg-[#262422] border border-[#3a3633] rounded-xl p-4">
      <div className="flex items-center justify-between text-[11px] text-gray-500">
        <span className="uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}
