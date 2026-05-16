import { useMemo, useState } from 'react';
import { useStore } from '@/stores/useStore';
import {
  Handshake, Truck, TrendingUp, Compass, ShieldCheck, AlertTriangle, CheckCircle2,
} from 'lucide-react';

type Tab = 'negotiation' | 'logistics' | 'dynamic_pricing' | 'decisions';

const TABS: { id: Tab; label: string; icon: any; agentId: string; accent: string }[] = [
  { id: 'negotiation',     label: 'Müzakere',          icon: Handshake,  agentId: 'negotiation_agent',        accent: '#0ea5e9' },
  { id: 'logistics',       label: 'Lojistik',          icon: Truck,      agentId: 'logistics_agent',          accent: '#14b8a6' },
  { id: 'dynamic_pricing', label: 'Dinamik Fiyat',     icon: TrendingUp, agentId: 'dynamic_pricing_agent',    accent: '#f59e0b' },
  { id: 'decisions',       label: 'Otonom Karar',      icon: Compass,    agentId: 'autonomous_decision_agent',accent: '#a855f7' },
];

export function AutonomyPage() {
  const [tab, setTab] = useState<Tab>('negotiation');
  const { agents, onboardedProduct, quickAsk } = useStore();
  const activeMeta = TABS.find((t) => t.id === tab)!;
  const activeAgent = agents.find((a) => a.agent_id === activeMeta.agentId);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🧠</span> Otonomi Katmanı
          </h1>
          <p className="text-sm text-gray-500">
            Çok-ajan otonom karar, müzakere, lojistik ve dinamik fiyatlandırma.
            {onboardedProduct && (
              <span className="text-gray-400"> · <span className="text-yellow-300 font-medium">{onboardedProduct.product_name}</span></span>
            )}
          </p>
        </div>
        {activeAgent && (
          <button
            onClick={() => quickAsk(`${activeAgent.name}: bu hafta yapman gereken 3 somut aksiyonu önceliklendir.`)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/40 text-yellow-300"
          >
            {activeAgent.icon} {activeAgent.name}'a sor
          </button>
        )}
      </header>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                active
                  ? 'bg-gray-800 text-white border border-gray-700'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900'
              }`}
              style={active ? { boxShadow: `inset 0 -2px 0 0 ${t.accent}` } : undefined}
            >
              <Icon size={14} /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'negotiation'     && <NegotiationPanel />}
      {tab === 'logistics'       && <LogisticsPanel />}
      {tab === 'dynamic_pricing' && <DynamicPricingPanel />}
      {tab === 'decisions'       && <DecisionsPanel />}
    </div>
  );
}

/* ============================ Negotiation ================================ */

type NegRound = { round: number; buyer: number; seller: number; gap: number };
type NegResult = { outcome: 'agreement' | 'walk_away'; finalPrice: number | null; rounds: NegRound[] };

function runNegotiation(buyerTarget: number, buyerWalk: number, sellerTarget: number, sellerWalk: number, style: number, maxRounds: number): NegResult {
  const rounds: NegRound[] = [];
  if (sellerWalk > buyerWalk) return { outcome: 'walk_away', finalPrice: null, rounds };
  let buyer = buyerTarget;
  let seller = sellerTarget;
  const close = Math.max(0.5, 0.01 * ((buyerTarget + sellerTarget) / 2));
  for (let i = 1; i <= maxRounds; i++) {
    const gap = seller - buyer;
    rounds.push({ round: i, buyer, seller, gap });
    if (gap <= close) return { outcome: 'agreement', finalPrice: +((buyer + seller) / 2).toFixed(2), rounds };
    buyer = Math.min(buyer + gap * style, buyerWalk);
    seller = Math.max(seller - gap * style, sellerWalk);
    if (buyer >= seller) return { outcome: 'agreement', finalPrice: +((buyer + seller) / 2).toFixed(2), rounds };
  }
  return { outcome: 'walk_away', finalPrice: null, rounds };
}

function NegotiationPanel() {
  const [buyerTarget, setBuyerTarget] = useState(40);
  const [buyerWalk, setBuyerWalk] = useState(50);
  const [sellerTarget, setSellerTarget] = useState(55);
  const [sellerWalk, setSellerWalk] = useState(42);
  const [style, setStyle] = useState(0.30);
  const [maxRounds, setMaxRounds] = useState(6);

  const result = useMemo(
    () => runNegotiation(buyerTarget, buyerWalk, sellerTarget, sellerWalk, style, maxRounds),
    [buyerTarget, buyerWalk, sellerTarget, sellerWalk, style, maxRounds],
  );

  const hasZopa = sellerWalk <= buyerWalk;
  const zopaMin = Math.max(sellerWalk, buyerTarget);
  const zopaMax = Math.min(buyerWalk, sellerTarget);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Müzakere Parametreleri" icon={Handshake} accent="#0ea5e9">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <Slider label="Alıcı hedefi (₺)" value={buyerTarget} min={10} max={100} step={1} onChange={setBuyerTarget} />
          <Slider label="Alıcı walk-away" value={buyerWalk} min={10} max={120} step={1} onChange={setBuyerWalk} />
          <Slider label="Satıcı hedefi (₺)" value={sellerTarget} min={10} max={120} step={1} onChange={setSellerTarget} />
          <Slider label="Satıcı walk-away" value={sellerWalk} min={10} max={100} step={1} onChange={setSellerWalk} />
          <Slider label="Concession (oran)" value={style} min={0.1} max={0.5} step={0.05} onChange={setStyle} fixed={2} />
          <Slider label="Max tur" value={maxRounds} min={3} max={12} step={1} onChange={setMaxRounds} />
        </div>
        <div className="mt-4 p-3 rounded-lg bg-gray-950/60 border border-gray-800 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">ZOPA</span>
            {hasZopa
              ? <span className="text-emerald-400 font-mono">[{zopaMin}₺ — {zopaMax}₺]</span>
              : <span className="text-red-400">Yok (anlaşma imkânsız)</span>}
          </div>
        </div>
      </Card>

      <Card title="Sonuç" icon={result.outcome === 'agreement' ? CheckCircle2 : AlertTriangle} accent={result.outcome === 'agreement' ? '#10b981' : '#ef4444'}>
        {result.outcome === 'agreement' ? (
          <div className="space-y-2">
            <div className="text-3xl font-bold text-emerald-300">{result.finalPrice}₺</div>
            <div className="text-xs text-gray-400">
              {result.rounds.length} turda anlaşma sağlandı. Alıcı hedefine göre kazanç:
              <span className="text-emerald-300 ml-1 font-semibold">
                {(((sellerTarget - (result.finalPrice ?? 0)) / sellerTarget) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-red-300">Anlaşma sağlanamadı. Walk-away.</div>
        )}

        <div className="mt-4 space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
          {result.rounds.map((r) => (
            <div key={r.round} className="flex items-center gap-2 text-[11px]">
              <span className="text-gray-500 w-10">Tur {r.round}</span>
              <Bar label="Alıcı" value={r.buyer} max={sellerTarget * 1.1} color="#22d3ee" />
              <Bar label="Satıcı" value={r.seller} max={sellerTarget * 1.1} color="#f472b6" />
              <span className="text-gray-500 font-mono w-12 text-right">Δ{r.gap.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ============================ Logistics ================================ */

const CARRIERS = [
  { name: 'Aras Kargo',     base: 28, perKg: 4.5, slaPct: 0.96, etaH: 36 },
  { name: 'Yurtiçi Kargo',  base: 32, perKg: 4.2, slaPct: 0.95, etaH: 28 },
  { name: 'MNG Kargo',      base: 26, perKg: 5.0, slaPct: 0.93, etaH: 42 },
  { name: 'UPS',            base: 65, perKg: 8.5, slaPct: 0.98, etaH: 18 },
  { name: 'DHL',            base: 72, perKg: 9.0, slaPct: 0.99, etaH: 16 },
];

function LogisticsPanel() {
  const [weight, setWeight] = useState(2.5);
  const [stops, setStops] = useState<string[]>(['İstanbul · Kadıköy', 'İstanbul · Üsküdar', 'Kocaeli · İzmit']);
  const [newStop, setNewStop] = useState('');

  const quotes = useMemo(() => CARRIERS.map((c) => ({
    ...c,
    cost: +(c.base + c.perKg * weight).toFixed(2),
  })).sort((a, b) => a.cost - b.cost), [weight]);

  const cheapest = quotes[0];
  const fastest = [...quotes].sort((a, b) => a.etaH - b.etaH)[0];

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Taşıyıcı Tarife Karşılaştırması" icon={Truck} accent="#14b8a6">
        <Slider label="Paket ağırlığı (kg)" value={weight} min={0.5} max={20} step={0.5} onChange={setWeight} fixed={1} />
        <div className="mt-4 space-y-2">
          {quotes.map((q) => (
            <div key={q.name} className="flex items-center gap-3 p-2 rounded-lg bg-gray-950/60 border border-gray-800">
              <div className="flex-1">
                <div className="text-sm text-white">{q.name}</div>
                <div className="text-[10px] text-gray-500">SLA %{(q.slaPct * 100).toFixed(0)} · ETA {q.etaH}sa</div>
              </div>
              <div className="text-sm font-mono text-emerald-300">{q.cost.toFixed(2)}₺</div>
              {q.name === cheapest.name && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">En ucuz</span>}
              {q.name === fastest.name && <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">En hızlı</span>}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Rota Planı" icon={Truck} accent="#22d3ee">
        <div className="space-y-1.5 mb-3">
          {stops.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-[10px] text-cyan-300">{i + 1}</span>
              <span className="flex-1 text-gray-300">{s}</span>
              <button onClick={() => setStops(stops.filter((_, idx) => idx !== i))} className="text-gray-600 hover:text-red-400 text-[10px]">×</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newStop}
            onChange={(e) => setNewStop(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && newStop.trim()) { setStops([...stops, newStop.trim()]); setNewStop(''); } }}
            placeholder="Yeni durak ekle..."
            className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none"
          />
          <button
            onClick={() => { if (newStop.trim()) { setStops([...stops, newStop.trim()]); setNewStop(''); } }}
            className="px-3 py-1.5 text-xs bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 rounded-lg"
          >
            Ekle
          </button>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-gray-950/60 border border-gray-800 grid grid-cols-3 gap-2 text-center">
          <Stat label="Durak" value={stops.length.toString()} />
          <Stat label="Tahm. km" value={(stops.length * 14.5).toFixed(0)} />
          <Stat label="Tahm. sa" value={(stops.length * 0.6 + 1).toFixed(1)} />
        </div>
      </Card>
    </div>
  );
}

/* ============================ Dynamic Pricing ============================ */

function DynamicPricingPanel() {
  const [currentPrice, setCurrentPrice] = useState(449);
  const [elasticity, setElasticity] = useState(-1.4);
  const [competitorAvg, setCompetitorAvg] = useState(472);
  const [demand, setDemand] = useState(0.71);
  const [stockDays, setStockDays] = useState(18);

  // Simple recommendation: combine signals into a delta.
  const recommended = useMemo(() => {
    const competitorDelta = (competitorAvg - currentPrice) / currentPrice;        // +ise yukarı baskı
    const demandDelta = (demand - 0.5) * 0.20;                                    // yüksek talep → +%
    const stockDelta = stockDays < 14 ? 0.04 : stockDays > 45 ? -0.05 : 0;        // az stok → +; çok stok → -
    const raw = competitorDelta * 0.4 + demandDelta + stockDelta;
    const dampened = raw / (1 + Math.abs(elasticity) * 0.3);
    const newPrice = Math.max(1, currentPrice * (1 + dampened));
    const deltaPct = ((newPrice - currentPrice) / currentPrice) * 100;
    const expectedLift = -elasticity * (deltaPct / 100) * 100; // rough revenue-side approximation
    return {
      newPrice: +newPrice.toFixed(2),
      deltaPct: +deltaPct.toFixed(2),
      expectedLift: +expectedLift.toFixed(1),
      confidence: +Math.max(0.5, Math.min(0.95, 0.7 + demand * 0.25 - Math.abs(deltaPct) / 50)).toFixed(2),
    };
  }, [currentPrice, elasticity, competitorAvg, demand, stockDays]);

  const requiresApproval = Math.abs(recommended.deltaPct) > 5;

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Sinyal Girişleri" icon={TrendingUp} accent="#f59e0b">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <Slider label="Mevcut fiyat (₺)" value={currentPrice} min={50} max={5000} step={5} onChange={setCurrentPrice} />
          <Slider label="Rakip ort. (₺)" value={competitorAvg} min={50} max={5000} step={5} onChange={setCompetitorAvg} />
          <Slider label="Talep skoru (0-1)" value={demand} min={0} max={1} step={0.05} onChange={setDemand} fixed={2} />
          <Slider label="Stok günü" value={stockDays} min={1} max={90} step={1} onChange={setStockDays} />
          <Slider label="Esneklik" value={elasticity} min={-3} max={-0.3} step={0.1} onChange={setElasticity} fixed={2} />
        </div>
      </Card>

      <Card title="Önerilen Fiyat" icon={TrendingUp} accent={requiresApproval ? '#ef4444' : '#10b981'}>
        <div className="flex items-end gap-3">
          <div>
            <div className="text-[10px] text-gray-500 uppercase">Yeni fiyat</div>
            <div className="text-3xl font-bold text-amber-300">{recommended.newPrice}₺</div>
          </div>
          <div className={`text-sm font-mono ${recommended.deltaPct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
            {recommended.deltaPct >= 0 ? '+' : ''}{recommended.deltaPct}%
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Stat label="Beklenen gelir Δ" value={`${recommended.expectedLift >= 0 ? '+' : ''}${recommended.expectedLift}%`} />
          <Stat label="Güven" value={recommended.confidence.toFixed(2)} />
        </div>

        {requiresApproval ? (
          <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-200 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>⚠️ %5 üstü değişim — Autonomous Decision Agent insan onayına eskalate edecek.</span>
          </div>
        ) : (
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-2">
            <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
            <span>Politika sınırları içinde — otomatik uygulanabilir.</span>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================ Decisions ================================ */

function DecisionsPanel() {
  const [maxPricePct, setMaxPricePct] = useState(5);
  const [maxCarrier, setMaxCarrier] = useState(500);
  const [minConfidence, setMinConfidence] = useState(0.7);

  const sample = useMemo(() => ([
    { id: 'dec_000043', type: 'price_change_pct',         value: 3.2,   conf: 0.88, risk: 'low' },
    { id: 'dec_000042', type: 'carrier_switch_cost_try',  value: 320,   conf: 0.81, risk: 'low' },
    { id: 'dec_000041', type: 'price_change_pct',         value: 8.0,   conf: 0.92, risk: 'medium' },
    { id: 'dec_000040', type: 'carrier_switch_cost_try',  value: 640,   conf: 0.74, risk: 'low' },
    { id: 'dec_000039', type: 'price_change_pct',         value: -2.5,  conf: 0.65, risk: 'low' },
    { id: 'dec_000038', type: 'negotiation_commit_try',   value: 24800, conf: 0.83, risk: 'low' },
  ]), []);

  const evaluated = sample.map((d) => {
    let status: 'auto_approved' | 'needs_approval' = 'auto_approved';
    let reason = 'Politika sınırları içinde, otomatik onaylandı.';
    if (d.conf < minConfidence) { status = 'needs_approval'; reason = `Güven ${d.conf} < ${minConfidence}`; }
    else if (d.type === 'price_change_pct' && Math.abs(d.value) > maxPricePct) { status = 'needs_approval'; reason = `|Δ%|=${Math.abs(d.value)} > ${maxPricePct}`; }
    else if (d.type === 'carrier_switch_cost_try' && d.value > maxCarrier) { status = 'needs_approval'; reason = `${d.value}₺ > ${maxCarrier}₺`; }
    else if (d.risk !== 'low') { status = 'needs_approval'; reason = `Risk: ${d.risk}`; }
    return { ...d, status, reason };
  });

  const autoCount = evaluated.filter((d) => d.status === 'auto_approved').length;

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card title="Otonomi Politikası" icon={ShieldCheck} accent="#a855f7">
        <div className="space-y-4 text-xs">
          <Slider label="Max fiyat değişimi %" value={maxPricePct} min={1} max={20} step={1} onChange={setMaxPricePct} />
          <Slider label="Max kargo değişim ₺" value={maxCarrier} min={100} max={2000} step={50} onChange={setMaxCarrier} />
          <Slider label="Min güven" value={minConfidence} min={0.5} max={0.95} step={0.05} onChange={setMinConfidence} fixed={2} />
        </div>
        <div className="mt-4 p-3 rounded-lg bg-gray-950/60 border border-gray-800 grid grid-cols-2 gap-2 text-center">
          <Stat label="Otomatik" value={`${autoCount}/${evaluated.length}`} accent="#10b981" />
          <Stat label="Eskalate" value={`${evaluated.length - autoCount}`} accent="#ef4444" />
        </div>
      </Card>

      <Card title="Son Kararlar" icon={Compass} accent="#a855f7" className="lg:col-span-2">
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {evaluated.map((d) => (
            <div key={d.id} className={`flex items-center gap-3 p-2.5 rounded-lg border ${
              d.status === 'auto_approved'
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : 'bg-red-500/5 border-red-500/20'
            }`}>
              {d.status === 'auto_approved'
                ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                : <AlertTriangle size={16} className="text-red-400 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white flex items-center gap-2">
                  <span className="font-mono text-gray-500">{d.id}</span>
                  <span className="text-gray-300">{d.type}</span>
                  <span className="font-mono">{d.value}</span>
                </div>
                <div className="text-[10px] text-gray-500">{d.reason} · güven {d.conf} · risk {d.risk}</div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                d.status === 'auto_approved'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'bg-red-500/15 text-red-300'
              }`}>
                {d.status === 'auto_approved' ? 'Otomatik' : 'Onay gerek'}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ============================ Primitives ================================ */

function Card({ title, icon: Icon, accent, children, className = '' }: { title: string; icon: any; accent: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-xl p-5 ${className}`}
      style={{ boxShadow: `inset 0 1px 0 0 ${accent}25` }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} style={{ color: accent }} />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, fixed = 0,
}: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; fixed?: number }) {
  return (
    <label className="block">
      <div className="flex justify-between mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-mono">{value.toFixed(fixed)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-yellow-400"
      />
    </label>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex-1 h-2 rounded bg-gray-800 relative overflow-hidden" title={`${label}: ${value.toFixed(1)}`}>
      <div className="absolute inset-y-0 left-0 rounded transition-all duration-300" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold" style={{ color: accent ?? '#fff' }}>{value}</div>
    </div>
  );
}
