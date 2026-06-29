import { useStore } from '@/stores/useStore';
import { Activity, Target, Wallet, Layers, ChevronRight, ChevronDown, Sparkles, AlertCircle, Wifi, WifiOff, Command } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const stageLabel: Record<string, string> = {
  idea: 'Fikir',
  product_no_store: 'Ürün var, mağaza yok',
  store_growing: 'Mağaza büyüyor',
  marketplace_opt: 'Pazaryeri optimizasyonu',
};

const marketLabel: Record<string, string> = {
  TR: 'Türkiye',
  GLOBAL: 'Global',
  BOTH: 'TR + Global',
};

/** Rotating suggestion chips, shown in the header command launcher. */
const SUGGESTIONS = [
  'Bugün için günün planını çıkar',
  'Bekleyen tüm onayları onayla',
  'Marka kimliğini yeniden üret',
  'En kritik 3 görev hangisi?',
  'Anomalileri göster',
  'Tüm entegrasyonları senkronize et',
];

/**
 * Global product-context strip rendered above every page via Layout.
 * Adds: product switcher dropdown, backend-health badge, always-visible
 * command launcher hint with rotating suggestions.
 */
export function ProductContextBar() {
  const product = useStore((s) => s.onboardedProduct);
  const products = useStore((s) => s.products);
  const switchToProduct = useStore((s) => s.switchToProduct);
  const setCurrentPage = useStore((s) => s.setCurrentPage);
  const setOnboardingStep = useStore((s) => s.setOnboardingStep);
  const resetOnboardingDraft = useStore((s) => s.resetOnboardingDraft);
  const quickAsk = useStore((s) => s.quickAsk);
  const currentPage = useStore((s) => s.currentPage);
  const backendStatus = useStore((s) => s.backendStatus);
  const fallbackActive = useStore((s) => s.fallbackActive);
  const pingBackend = useStore((s) => s.pingBackend);
  const loadTools = useStore((s) => s.loadTools);
  const toggleSupervisorDock = useStore((s) => s.toggleSupervisorDock);
  const sendUserMessage = useStore((s) => s.sendUserMessage);

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Close the product switcher on any outside click. Without this, the dropdown
  // can swallow the first row-click via focus/blur races, requiring a second
  // click to actually switch.
  useEffect(() => {
    if (!switcherOpen) return;
    const onDocDown = (e: MouseEvent) => {
      if (!switcherRef.current) return;
      if (!switcherRef.current.contains(e.target as Node)) setSwitcherOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [switcherOpen]);

  // Poll backend health every 20s. Cheap GET /health with a 2s timeout.
  // Also sync tool manifests from the backend on first mount so live/mock
  // badges reflect the real manifest mode rather than static seed data.
  useEffect(() => {
    void pingBackend();
    void loadTools();
    const interval = setInterval(() => void pingBackend(), 20000);
    return () => clearInterval(interval);
  }, [pingBackend, loadTools]);

  // Rotate the suggestion chip every 6s so it stays discoverable.
  useEffect(() => {
    const interval = setInterval(() => {
      setSuggestionIdx((i) => (i + 1) % SUGGESTIONS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Derived health score. Subtract penalties for pending approvals + critical
  // alerts + backend offline so the badge is a real signal, not always 100.
  const computedHealth = useStore((s) => {
    let score = 100;
    const pending = s.approvals.filter((a) => a.status === 'pending').length;
    score -= Math.min(40, pending * 5);
    const critical = (s.dashboard?.critical_alerts || []).length;
    score -= Math.min(30, critical * 10);
    if (!s.onboardingComplete) score -= 20;
    if (s.backendStatus === 'offline') score -= 15;
    return Math.max(0, Math.round(score));
  });

  if (!product) return null;

  const health = computedHealth;
  const healthColor =
    health >= 75 ? 'text-emerald-400' : health >= 50 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="sticky top-0 z-30 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-2 flex items-center gap-3 text-xs flex-wrap min-w-0">
      {/* Product switcher — click to open dropdown, then pick to switch active product. */}
      <div className="relative" ref={switcherRef}>
        <button
          type="button"
          onClick={() => setSwitcherOpen((v) => !v)}
          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-800/70 transition-colors"
          title="Aktif ürünü değiştir"
          aria-label={`Aktif ürünü değiştir: ${product.product_name}`}
          aria-haspopup="listbox"
          aria-expanded={switcherOpen}
        >
          <span className="text-lg leading-none">{product.image_url}</span>
          <div className="text-left">
            <div className="text-[9px] text-gray-500 uppercase tracking-widest">Aktif Ürün</div>
            <div className="text-sm font-semibold text-white truncate max-w-[180px]" title={product.product_name}>
              {product.product_name}
            </div>
          </div>
          {products.length > 1 ? (
            <ChevronDown size={12} className="text-gray-500" />
          ) : (
            <ChevronRight size={12} className="text-gray-600" />
          )}
        </button>
        {switcherOpen && (
          <div
            className="absolute top-full left-0 mt-1 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl z-50 p-1"
            role="listbox"
          >
            {products.map((p) => (
              <button
                key={p.product_name}
                type="button"
                onMouseDown={(e) => {
                  // Use mousedown so the switch fires before any focus/blur on
                  // the trigger can re-toggle the menu. Without this, the first
                  // click could be swallowed by the open/close race.
                  e.preventDefault();
                  if (p.product_name !== product.product_name) switchToProduct(p.product_name);
                  setSwitcherOpen(false);
                }}
                onClick={(e) => {
                  // Keyboard activation (Enter) doesn't fire mousedown — keep
                  // a click handler for accessibility.
                  if (e.detail !== 0) return; // skip when triggered by mouse (already handled)
                  if (p.product_name !== product.product_name) switchToProduct(p.product_name);
                  setSwitcherOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-xs transition-colors ${
                  p.product_name === product.product_name
                    ? 'bg-yellow-500/15 text-yellow-300'
                    : 'hover:bg-gray-800 text-gray-200'
                }`}
                role="option"
                aria-selected={p.product_name === product.product_name}
              >
                <span className="text-base">{p.image_url}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{p.product_name}</div>
                  <div className="text-[10px] text-gray-500 truncate">{p.category} · {marketLabel[p.target_market] ?? p.target_market}</div>
                </div>
                {p.product_name === product.product_name && (
                  <span className="text-[10px] text-yellow-400">aktif</span>
                )}
              </button>
            ))}
            <div className="border-t border-gray-800 mt-1 pt-1">
              <button
                type="button"
                onClick={() => {
                  // Wipe any leftover wizard state so step 1 starts blank,
                  // not pre-filled with the previously-onboarded product.
                  resetOnboardingDraft();
                  setOnboardingStep(1);
                  setCurrentPage('onboarding');
                  setSwitcherOpen(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-md text-left text-xs hover:bg-gray-800 text-indigo-300"
              >
                <Sparkles size={12} /> Yeni ürün ekle
              </button>
            </div>
          </div>
        )}
      </div>

      <Divider />

      <Pill icon={<Layers size={11} />} label="Kategori" value={product.category} />
      <Pill icon={<Activity size={11} />} label="Aşama" value={stageLabel[product.stage] ?? product.stage} hideOn="lg" />
      <Pill icon={<Target size={11} />} label="Pazar" value={marketLabel[product.target_market] ?? product.target_market} hideOn="lg" />
      <Pill
        icon={<Wallet size={11} />}
        label="Bütçe"
        value={product.monthly_budget_band ? `₺${product.monthly_budget_band}/ay` : '—'}
        hideOn="xl"
      />

      {/* Command launcher — always visible, rotating suggestion chip. */}
      <div className="hidden md:flex items-center gap-1.5 ml-2">
        <button
          onClick={() => toggleSupervisorDock()}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-900 border border-gray-800 hover:border-indigo-500/60 transition-colors"
          title="Komut paletini aç (Ctrl+K)"
          aria-label="Komut paletini aç"
        >
          <Command size={11} className="text-indigo-400" />
          <span className="text-[10px] text-gray-400">Komut</span>
          <kbd className="px-1 py-0 rounded bg-gray-800 text-[9px] text-gray-500 border border-gray-700">⌘K</kbd>
        </button>
        <button
          onClick={() => sendUserMessage(SUGGESTIONS[suggestionIdx])}
          className="px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] hover:bg-indigo-500/20 transition-colors max-w-[220px] truncate"
          title={`Supervisor'a gönder: "${SUGGESTIONS[suggestionIdx]}"`}
          aria-label={SUGGESTIONS[suggestionIdx]}
        >
          {SUGGESTIONS[suggestionIdx]}
        </button>
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Backend health pill — yellow when offline + Gemini fallback,
            red when offline without fallback, green when online. */}
        <BackendStatusBadge status={backendStatus} fallbackActive={fallbackActive} />

        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-gray-500 uppercase tracking-widest">Sağlık</span>
          <span className={`text-sm font-bold ${healthColor}`}>{health}</span>
          <span className="text-[10px] text-gray-600">/100</span>
        </div>

        {currentPage !== 'chat' && (
          <button
            onClick={() =>
              quickAsk(
                `${product.product_name} (${product.category}, ${stageLabel[product.stage] ?? product.stage}) için ${currentPage} bağlamında öncelikli aksiyonları çıkar ve sıralı plan ver.`,
              )
            }
            className="px-2.5 py-1 rounded-md bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/40 text-yellow-300 text-[11px] font-semibold"
            title="Bu sayfa için Hermes'ten plan iste"
          >
            Hermes'e Sor
          </button>
        )}
      </div>
    </div>
  );
}

function BackendStatusBadge({
  status,
  fallbackActive,
}: {
  status: 'online' | 'offline' | 'unknown';
  fallbackActive: boolean;
}) {
  if (status === 'unknown') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-900 border border-gray-800" title="Backend durumu kontrol ediliyor">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
        <span className="text-[10px] text-gray-500">Backend: kontrol ediliyor</span>
      </div>
    );
  }
  if (status === 'online') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30" title="Backend ulaşılabilir">
        <Wifi size={11} className="text-emerald-400" />
        <span className="text-[10px] text-emerald-300">Backend: online</span>
      </div>
    );
  }
  // offline
  const color = fallbackActive ? 'amber' : 'red';
  const Icon = fallbackActive ? AlertCircle : WifiOff;
  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${
        color === 'amber'
          ? 'bg-amber-500/10 border-amber-500/40'
          : 'bg-red-500/10 border-red-500/40'
      }`}
      title={
        fallbackActive
          ? 'Backend çevrimdışı — LLM proxy fallback aktif. Sonuçlar backend üzerinden üretiliyor.'
          : 'Backend çevrimdışı — tüm AI çağrıları başarısız olacak.'
      }
    >
      <Icon size={11} className={color === 'amber' ? 'text-amber-400' : 'text-red-400'} />
      <span className={`text-[10px] ${color === 'amber' ? 'text-amber-200' : 'text-red-200'}`}>
        Backend: çevrimdışı{fallbackActive ? ' — fallback aktif' : ''}
      </span>
    </div>
  );
}

function Pill({
  icon,
  label,
  value,
  hideOn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hideOn?: 'lg' | 'xl';
}) {
  const hideClass = hideOn === 'lg' ? 'hidden lg:flex' : hideOn === 'xl' ? 'hidden xl:flex' : 'flex';
  return (
    <div
      className={`${hideClass} items-center gap-1.5 px-2 py-1 rounded-md bg-gray-900 border border-gray-800`}
      title={`${label}: ${value}`}
    >
      <span className="text-gray-500">{icon}</span>
      <span className="text-[9px] text-gray-500 uppercase tracking-widest">{label}</span>
      <span className="text-[11px] font-medium text-gray-200 truncate max-w-[140px]">{value}</span>
    </div>
  );
}

function Divider() {
  return <span className="h-5 w-px bg-gray-800" aria-hidden />;
}
