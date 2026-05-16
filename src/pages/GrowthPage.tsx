import { useState } from 'react';
import { useStore } from '@/stores/useStore';
import { selectGrowthScore } from '@/stores/selectors';
import { chatBackend } from '@/lib/api';
import { Rocket, Beaker, TrendingUp, Lightbulb, Play, Loader2 } from 'lucide-react';
import type { GrowthExperiment } from '@/types';

const statusMeta: Record<GrowthExperiment['status'], { color: string; label: string }> = {
  idea:         { color: 'bg-gray-500/15 text-gray-300 border-gray-500/40',         label: 'Fikir' },
  running:      { color: 'bg-blue-500/15 text-blue-300 border-blue-500/40',         label: 'Çalışıyor' },
  won:          { color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', label: 'Kazandı' },
  lost:         { color: 'bg-red-500/15 text-red-300 border-red-500/40',             label: 'Kaybetti' },
  inconclusive: { color: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40',   label: 'Belirsiz' },
};

const areaIcon: Record<GrowthExperiment['area'], string> = {
  pricing: '💰', listing: '📋', ads: '📣', email: '✉️', ux: '🎨', bundle: '🎁',
};

export function GrowthPage() {
  const experiments = useStore((s) => s.experiments);
  const launchExperiment = useStore((s) => s.launchExperiment);
  const agents = useStore((s) => s.agents);
  const product = useStore((s) => s.onboardedProduct);
  const quickAsk = useStore((s) => s.quickAsk);
  const growthScore = useStore(selectGrowthScore);
  const [bundleSuggestion, setBundleSuggestion] = useState<string | null>(null);
  const [channelSuggestion, setChannelSuggestion] = useState<string | null>(null);
  const [loadingBundle, setLoadingBundle] = useState(false);
  const [loadingChannel, setLoadingChannel] = useState(false);

  const askGrowth = async (kind: 'bundle' | 'channel') => {
    if (!product) return;
    const setter = kind === 'bundle' ? setBundleSuggestion : setChannelSuggestion;
    const loader = kind === 'bundle' ? setLoadingBundle : setLoadingChannel;
    const prompt = kind === 'bundle'
      ? `Growth Agent: "${product.product_name}" (${product.category}) için 1 somut bundle/upsell fırsatı öner. 2-3 cümlede: hangi ek ürün, beklenen AOV etkisi (yaklaşık %), uygulama zorluğu. Genel "set + kapak" gibi laflar etme — bu ürünün kategorisine göre özgün ol.`
      : `Growth Agent: "${product.product_name}" (${product.category}, pazar=${product.target_market}) için bu ürünün şu an aktif olmadığı 1 yeni satış kanalı öner. 2-3 cümlede: kanal adı, neden uygun, beklenen ilk ay etkisi, kurulum süresi.`;
    loader(true);
    try {
      const res = await chatBackend({
        message: prompt,
        history: [],
        product_context: {
          product_name: product.product_name,
          category: product.category,
          stage: product.stage,
          target_market: product.target_market,
          channels: product.channels,
          monthly_budget_band: product.monthly_budget_band,
          priorities: product.priorities,
        },
      });
      setter((res.content || '').trim() || 'Öneri üretilemedi.');
    } catch (e) {
      setter(`Üretilemedi: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      loader(false);
    }
  };

  const ideas    = experiments.filter((e) => e.status === 'idea');
  const running  = experiments.filter((e) => e.status === 'running');
  const finished = experiments.filter((e) => ['won', 'lost', 'inconclusive'].includes(e.status));
  const wins = experiments.filter((e) => e.status === 'won');
  const winRate = finished.length > 0 ? Math.round((wins.length / finished.length) * 100) : 0;
  const totalUplift = wins.reduce((s, e) => s + (e.uplift_pct ?? 0), 0);

  return (
    <div className="flex flex-col h-full bg-[#1a1816] text-gray-200 overflow-hidden">
      <header className="px-6 py-4 border-b border-[#2a2624] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2"><Rocket size={22} className="text-emerald-400" /> Büyüme Merkezi</h1>
          <p className="text-xs text-gray-500 mt-0.5">CRO · A/B Test · Upsell · Bundle · Yeni Kanal · {product?.product_name ?? '—'}</p>
        </div>
        <button onClick={() => quickAsk(`Growth Agent: ${product?.product_name ?? 'ürün'} için 3 yeni deney önerisi tasarla. Her birinde hipotez + ölçülecek metrik + örneklem büyüklüğü ve tahmini etki süresi olsun.`)}
          className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 rounded-lg flex items-center gap-2 hover:bg-emerald-500/30 text-sm font-semibold">
          <Beaker size={14} /> Yeni Deney Tasarla
        </button>
      </header>

      <div className="grid grid-cols-4 gap-4 px-6 py-4">
        <Kpi label="Büyüme Skoru" value={`${growthScore}/100`} hint={growthScore === 0 ? 'Henüz deney yok' : 'Deney upliftlerinden'} icon={<TrendingUp size={14} />} color="text-emerald-400" />
        <Kpi label="Çalışan Deney" value={String(running.length)} hint={`${ideas.length} fikir bekliyor`} icon={<Beaker size={14} />} color="text-blue-400" />
        <Kpi label="Kazanma Oranı" value={`${winRate}%`} hint={`${wins.length}/${finished.length} biten`} color="text-yellow-400" />
        <Kpi label="Toplam Uplift" value={`+${totalUplift}%`} hint="Kazanan deneylerden" color="text-pink-400" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
        <Section title="Çalışan Deneyler" count={running.length} accent="border-blue-500/40">
          {running.map((e) => <ExpCard key={e.id} e={e} agents={agents} />)}
          {running.length === 0 && <Empty>Aktif deney yok.</Empty>}
        </Section>

        <Section title="Açık Fırsatlar (Fikir)" count={ideas.length} accent="border-yellow-500/40">
          {ideas.map((e) => (
            <ExpCard key={e.id} e={e} agents={agents} action={
              <button onClick={() => launchExperiment(e.id)} className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-300 text-xs rounded-lg font-semibold flex items-center gap-1">
                <Play size={12} /> Başlat
              </button>
            } />
          ))}
        </Section>

        <Section title="Geçmiş Deneyler" count={finished.length} accent="border-gray-500/40">
          {finished.map((e) => <ExpCard key={e.id} e={e} agents={agents} />)}
        </Section>

        <div className="grid grid-cols-2 gap-4">
          <SuggestionCard
            icon={<Lightbulb className="text-yellow-400" size={18} />}
            title="Bundle / Upsell Önerisi"
            body={bundleSuggestion}
            loading={loadingBundle}
            cta={bundleSuggestion ? 'Detaylı planı iste' : 'Öneri Al'}
            onClick={() => {
              if (!bundleSuggestion) return void askGrowth('bundle');
              quickAsk(`Growth Agent: yukarıda önerdiğin bundle için fiyat, marj etkisi, A/B test planını ayrıntılandır:\n${bundleSuggestion}`);
            }}
          />
          <SuggestionCard
            icon={<Rocket className="text-pink-400" size={18} />}
            title="Yeni Kanal Önerisi"
            body={channelSuggestion}
            loading={loadingChannel}
            cta={channelSuggestion ? 'Açılış planı iste' : 'Öneri Al'}
            onClick={() => {
              if (!channelSuggestion) return void askGrowth('channel');
              quickAsk(`Store Setup Agent: yukarıdaki kanal için açılış planı çıkar — adımlar, evraklar, listeleme, risk:\n${channelSuggestion}`);
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Section({ title, count, accent, children }: { title: string; count: number; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={`flex items-center gap-2 mb-2 pl-3 border-l-2 ${accent}`}>
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-300">{title}</h2>
        <span className="text-xs text-gray-500">({count})</span>
      </div>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function ExpCard({ e, agents, action }: { e: GrowthExperiment; agents: ReturnType<typeof useStore.getState>['agents']; action?: React.ReactNode }) {
  const meta = statusMeta[e.status];
  const owner = agents.find((a) => a.agent_id === e.owner_agent_id);
  return (
    <div className="bg-[#262422] border border-[#3a3633] rounded-xl p-4 hover:border-emerald-500/40 transition-colors">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-xl shrink-0">{areaIcon[e.area]}</span>
        <p className="text-sm text-gray-200 flex-1 leading-snug">{e.hypothesis}</p>
      </div>
      <div className="flex items-center justify-between text-[11px] text-gray-500 mt-3">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full border ${meta.color}`}>{meta.label}</span>
          <span>{e.metric}</span>
        </div>
        <div className="flex items-center gap-2">
          {e.uplift_pct !== null && (
            <span className={e.uplift_pct > 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
              {e.uplift_pct > 0 ? '+' : ''}{e.uplift_pct}%
            </span>
          )}
          {owner && <span title={owner.name}>{owner.icon}</span>}
          {action}
        </div>
      </div>
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

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="col-span-2 bg-[#262422]/60 border border-dashed border-[#3a3633] rounded-xl p-6 text-center text-xs text-gray-500">{children}</div>;
}

function SuggestionCard({
  icon, title, body, cta, onClick, loading,
}: { icon: React.ReactNode; title: string; body: string | null; cta: string; onClick?: () => void; loading?: boolean }) {
  return (
    <div className="bg-gradient-to-br from-[#262422] to-[#1f1c1a] border border-[#3a3633] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<h3 className="text-sm font-bold">{title}</h3></div>
      <p className="text-xs text-gray-400 leading-relaxed mb-3 whitespace-pre-wrap min-h-[40px]">
        {loading ? 'Growth Agent öneri üretiyor…' : (body ?? 'Henüz önerilmedi — Öneri Al ile Growth Agent ürününe özel hipotez üretecek.')}
      </p>
      <button
        onClick={onClick}
        disabled={loading}
        className="px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 text-yellow-300 text-xs rounded-lg font-semibold disabled:opacity-50 flex items-center gap-1.5"
      >
        {loading && <Loader2 size={12} className="animate-spin" />}
        {cta}
      </button>
    </div>
  );
}
