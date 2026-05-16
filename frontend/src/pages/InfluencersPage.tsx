import { useStore } from '@/stores/useStore';
import { Mic2, Users, TrendingUp, Sparkles } from 'lucide-react';
import type { Influencer } from '@/types';
import { ChatCommandBar } from '@/components/ChatCommandBar';

const tierMeta: Record<Influencer['tier'], { color: string; label: string }> = {
  nano:  { color: 'bg-gray-500/15 text-gray-300 border-gray-500/40',     label: 'Nano (<10K)' },
  micro: { color: 'bg-blue-500/15 text-blue-300 border-blue-500/40',     label: 'Micro (10-100K)' },
  macro: { color: 'bg-pink-500/15 text-pink-300 border-pink-500/40',     label: 'Macro (100K+)' },
};

const statusMeta: Record<Influencer['contact_status'], { color: string; label: string }> = {
  discovered:  { color: 'bg-[#1a1816] text-gray-400 border-[#3a3633]',                   label: 'Keşfedildi' },
  contacted:   { color: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40',         label: 'İletişimde' },
  negotiating: { color: 'bg-orange-500/15 text-orange-300 border-orange-500/40',         label: 'Müzakere' },
  collab:      { color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',      label: 'İşbirliği' },
  rejected:    { color: 'bg-red-500/15 text-red-300 border-red-500/40',                  label: 'Reddedildi' },
};

const platformEmoji: Record<Influencer['platform'], string> = {
  instagram: '📷', tiktok: '🎵', youtube: '📺', twitter: '🐦',
};

export function InfluencersPage() {
  const influencers = useStore((s) => s.influencers);
  const updateInfluencerStatus = useStore((s) => s.updateInfluencerStatus);
  const quickAsk = useStore((s) => s.quickAsk);
  const product = useStore((s) => s.onboardedProduct);

  const totalReach = influencers.reduce((s, i) => s + i.followers, 0);
  const activeCollabs = influencers.filter((i) => i.contact_status === 'collab').length;
  const totalCost = influencers.filter((i) => ['collab', 'negotiating'].includes(i.contact_status)).reduce((s, i) => s + i.estimated_cost, 0);
  const avgEng = influencers.reduce((s, i) => s + i.engagement_rate, 0) / Math.max(influencers.length, 1);

  return (
    <div className="flex flex-col h-full bg-[#1a1816] text-gray-200 overflow-hidden">
      <header className="px-6 py-4 border-b border-[#2a2624] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mic2 size={22} className="text-pink-400" /> Influencer & PR
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30" title="Gerçek influencer veri kaynağı bağlı değil — listeler seed verisidir">
              DEMO
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Keşif · Outreach · Brief · Sözleşme · Performans · DEMO veri (gerçek influencer API'si yok)</p>
        </div>
        <button onClick={() => quickAsk(`Influencer & PR Agent: ${product?.product_name ?? 'ürün'} kategorisinde 5 yeni mikro/nano influencer keşfet. Niş, tahmini maliyet, engagement ve neden iyi eşleşme olduklarını söyle.`)}
          className="px-4 py-2 bg-pink-500/20 border border-pink-500/50 text-pink-300 rounded-lg flex items-center gap-2 hover:bg-pink-500/30 text-sm font-semibold">
          <Sparkles size={14} /> Yeni Keşif
        </button>
      </header>

      <ChatCommandBar
        commands={[
          { label: 'Influencerlara teklif gönder', message: 'influencerlara teklif gönder' },
          { label: 'Yeni keşif yap', message: `${product?.product_name ?? 'ürünüm'} için 5 yeni mikro-influencer öner, niş ve engagement odaklı` },
          { label: 'Brief hazırla', message: `${product?.product_name ?? 'ürünüm'} için influencer kolaborasyon brief'i hazırla` },
          { label: 'ROI analizi', message: 'influencer kampanyaları için ROI projeksiyonu yap' },
        ]}
      />

      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        <Kpi label="Toplam Erişim" value={`${(totalReach / 1000).toFixed(0)}K`} hint={`${influencers.length} influencer`} icon={<Users size={14} />} color="text-cyan-400" />
        <Kpi label="Aktif İşbirliği" value={String(activeCollabs)} hint="Bu ay" icon={<TrendingUp size={14} />} color="text-emerald-400" />
        <Kpi label="Tahmini Maliyet" value={`₺${totalCost.toLocaleString('tr-TR')}`} hint="Müzakere + İşbirliği" color="text-yellow-400" />
        <Kpi label="Ort. Engagement" value={`${(avgEng * 100).toFixed(1)}%`} hint="Tüm tierlar" color="text-pink-400" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-2 gap-3">
          {influencers.map((i) => {
            const status = statusMeta[i.contact_status];
            const tier = tierMeta[i.tier];
            return (
              <div key={i.id} className="bg-[#262422] border border-[#3a3633] rounded-xl p-4 hover:border-pink-500/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="text-3xl shrink-0">{i.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{i.name}</span>
                      <span className="text-xs text-gray-500">{i.handle}</span>
                      <span>{platformEmoji[i.platform]}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{i.niche}</div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tier.color}`}>{tier.label}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${status.color}`}>{status.label}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                      <Stat label="Takipçi" value={`${(i.followers / 1000).toFixed(0)}K`} />
                      <Stat label="Engagement" value={`${(i.engagement_rate * 100).toFixed(1)}%`} />
                      <Stat label="Tah. Maliyet" value={`₺${(i.estimated_cost / 1000).toFixed(1)}K`} />
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      {i.contact_status === 'discovered' && (
                        <button onClick={() => updateInfluencerStatus(i.id, 'contacted')} className="px-2.5 py-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-300 text-[11px] rounded font-semibold">İletişime Geç</button>
                      )}
                      {i.contact_status === 'contacted' && (
                        <button onClick={() => updateInfluencerStatus(i.id, 'negotiating')} className="px-2.5 py-1 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-orange-300 text-[11px] rounded font-semibold">Müzakereye Geç</button>
                      )}
                      {i.contact_status === 'negotiating' && (
                        <button onClick={() => updateInfluencerStatus(i.id, 'collab')} className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-300 text-[11px] rounded font-semibold">Sözleşmeyi İmzala</button>
                      )}
                      <button onClick={() => quickAsk(`Influencer & PR Agent: ${i.name} (${i.handle}, ${i.platform}, ${i.followers.toLocaleString('tr-TR')} takipçi, niş: ${i.niche}) için ${product?.product_name ?? 'ürün'} ile işbirliği brief'i hazırla. Hedef, deliverable (story/reel/video sayısı), KPI ve onay süreci dahil.`)}
                        className="px-2.5 py-1 bg-[#1a1816] hover:bg-[#262422] border border-[#3a3633] text-[11px] rounded">Brief Oluştur</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#1a1816] rounded-lg px-2 py-1.5 text-center">
      <div className="text-[9px] text-gray-500 uppercase">{label}</div>
      <div className="text-sm font-bold text-gray-200">{value}</div>
    </div>
  );
}

function Kpi({ label, value, hint, icon, color }: { label: string; value: string; hint?: string; icon?: React.ReactNode; color: string }) {
  return (
    <div className="bg-[#262422] border border-[#3a3633] rounded-xl p-4">
      <div className="flex items-center justify-between text-[11px] text-gray-500"><span className="uppercase tracking-wider">{label}</span>{icon}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}
