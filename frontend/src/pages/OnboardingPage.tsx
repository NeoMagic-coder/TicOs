import { useStore } from '@/stores/useStore';
import type { OnboardingStage } from '@/types';
import { Sparkles, ArrowRight, ArrowLeft, Check } from 'lucide-react';

const stageOptions: { value: OnboardingStage; label: string; hint: string; icon: string }[] = [
  { value: 'idea',             label: 'Sıfırdan, fikir aşamasındayım',         hint: 'Ürün henüz yok. Araştırmadan başla.',      icon: '💡' },
  { value: 'product_no_store', label: 'Ürünüm var, mağaza yok',                hint: 'Marka + Shopify/pazaryeri kurulumu.',      icon: '📦' },
  { value: 'store_growing',    label: 'Mağazam var, büyümek istiyorum',        hint: 'Reklam, CRO, email, yeni kanal.',          icon: '🚀' },
  { value: 'marketplace_opt',  label: 'Pazaryerindeyim, optimize etmek istiyorum', hint: 'Listing, fiyat, yorum.',              icon: '🎯' },
];

const channelOptions = ['Shopify', 'WooCommerce', 'Trendyol', 'Hepsiburada', 'Amazon TR', 'Amazon Global', 'Etsy', 'TikTok Shop', 'Sahibinden', 'Dolap'];
const priorityOptions = [
  { id: 'fast_sales',     label: 'Hızlı satış başlatmak' },
  { id: 'brand_building', label: 'Marka kurmak' },
  { id: 'cost_reduction', label: 'Maliyeti düşürmek' },
  { id: 'scaling',        label: 'Ölçeklenmek' },
];

export function OnboardingPage() {
  const step = useStore((s) => s.onboardingStep);
  const draft = useStore((s) => s.onboardingDraft);
  const setOnboardingStep = useStore((s) => s.setOnboardingStep);
  const updateOnboardingDraft = useStore((s) => s.updateOnboardingDraft);
  const completeOnboarding = useStore((s) => s.completeOnboarding);

  const canAdvance = (() => {
    if (step === 1) return !!(draft.product_name && draft.category);
    if (step === 2) return !!draft.stage;
    if (step === 3) return !!draft.target_market && !!draft.monthly_budget_band && (draft.channels?.length ?? 0) > 0;
    if (step === 4) return (draft.priorities?.length ?? 0) > 0;
    return true;
  })();

  /** Human-readable list of fields still missing for the current step.
   *  Surfaced as inline error text below the form so the user understands
   *  why the "Devam" button is greyed out (instead of just disabled). */
  const missingFields = (() => {
    if (canAdvance) return [];
    if (step === 1) {
      const missing: string[] = [];
      if (!draft.product_name) missing.push('Ürün adı');
      if (!draft.category) missing.push('Kategori');
      return missing;
    }
    if (step === 2) return draft.stage ? [] : ['Başlangıç aşaması'];
    if (step === 3) {
      const missing: string[] = [];
      if (!draft.target_market) missing.push('Hedef pazar');
      if ((draft.channels?.length ?? 0) === 0) missing.push('En az bir kanal');
      if (!draft.monthly_budget_band) missing.push('Aylık bütçe');
      return missing;
    }
    if (step === 4) return (draft.priorities?.length ?? 0) === 0 ? ['En az bir öncelik'] : [];
    return [];
  })();

  return (
    <div className="min-h-full bg-gradient-to-br from-[#1a1816] via-[#1a1816] to-[#241c14] text-gray-100 px-6 py-10 flex justify-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-yellow-500 text-3xl">⚡</span>
          <div>
            <h1 className="text-2xl font-bold">OneProduct Agent OS</h1>
            <p className="text-sm text-gray-400">Bir ürün. Tüm e-ticaret. Tamamen otonom.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-8 mb-8">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="flex-1 flex items-center gap-2">
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                n < step ? 'bg-yellow-500 border-yellow-500 text-black' :
                n === step ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300' :
                'bg-transparent border-[#3a3633] text-gray-600'
              }`}>
                {n < step ? <Check size={14} /> : n}
              </div>
              {n < 5 && <div className={`h-0.5 flex-1 ${n < step ? 'bg-yellow-500' : 'bg-[#3a3633]'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-[#262422] border border-[#3a3633] rounded-2xl p-8 min-h-[400px]">
          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold mb-1">Ürününüz ne?</h2>
              <p className="text-sm text-gray-500 mb-6">Tüm ajanlar bu profile göre çalışacak.</p>
              <Field label="Ürün adı / tanımı *">
                <input required aria-required="true" value={draft.product_name ?? ''} onChange={(e) => updateOnboardingDraft({ product_name: e.target.value })} placeholder="örn. Granit Yanmaz Tencere Seti" className="w-full bg-[#1a1816] border border-[#3a3633] rounded-lg px-3 py-2.5 text-sm focus:border-yellow-500 outline-none" />
              </Field>
              <Field label="Kısa açıklama">
                <textarea value={draft.product_description ?? ''} onChange={(e) => updateOnboardingDraft({ product_description: e.target.value })} rows={3} placeholder="Özellikler, hedef kitle, farklılaştırıcı..." className="w-full bg-[#1a1816] border border-[#3a3633] rounded-lg px-3 py-2.5 text-sm focus:border-yellow-500 outline-none resize-none" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Kategori *">
                  <input required aria-required="true" value={draft.category ?? ''} onChange={(e) => updateOnboardingDraft({ category: e.target.value })} placeholder="örn. Ev & Mutfak" className="w-full bg-[#1a1816] border border-[#3a3633] rounded-lg px-3 py-2.5 text-sm focus:border-yellow-500 outline-none" />
                </Field>
                <Field label="Referans URL (opsiyonel)">
                  <input value={draft.reference_url ?? ''} onChange={(e) => updateOnboardingDraft({ reference_url: e.target.value })} placeholder="https://..." className="w-full bg-[#1a1816] border border-[#3a3633] rounded-lg px-3 py-2.5 text-sm focus:border-yellow-500 outline-none" />
                </Field>
              </div>
              <Field label="Emoji / ikon">
                <input value={draft.image_url ?? ''} onChange={(e) => updateOnboardingDraft({ image_url: e.target.value })} placeholder="📦" className="w-24 bg-[#1a1816] border border-[#3a3633] rounded-lg px-3 py-2.5 text-2xl text-center focus:border-yellow-500 outline-none" />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-xl font-bold mb-1">Nereden başlamak istiyorsunuz?</h2>
              <p className="text-sm text-gray-500 mb-6">CEO Agent yol haritasını buna göre kuracak.</p>
              <div className="space-y-2">
                {stageOptions.map((opt) => (
                  <button key={opt.value} onClick={() => updateOnboardingDraft({ stage: opt.value })}
                    className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border text-left transition-all ${
                      draft.stage === opt.value
                        ? 'border-yellow-500 bg-yellow-500/10'
                        : 'border-[#3a3633] bg-[#1a1816] hover:border-[#4a4643]'
                    }`}>
                    <span className="text-3xl shrink-0">{opt.icon}</span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{opt.hint}</div>
                    </div>
                    {draft.stage === opt.value && <Check size={18} className="text-yellow-500" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold mb-1">Hedef pazarınız ve bütçeniz?</h2>
              <p className="text-sm text-gray-500 mb-6">Kanal ve reklam stratejisi şekillenecek.</p>
              <Field label="Hedef pazar *">
                <div className="grid grid-cols-3 gap-2">
                  {(['TR', 'GLOBAL', 'BOTH'] as const).map((m) => (
                    <button key={m} onClick={() => updateOnboardingDraft({ target_market: m })}
                      className={`py-2.5 rounded-lg border text-sm font-semibold ${draft.target_market === m ? 'border-yellow-500 bg-yellow-500/10 text-yellow-300' : 'border-[#3a3633] bg-[#1a1816] text-gray-400'}`}>
                      {m === 'TR' ? '🇹🇷 Türkiye' : m === 'GLOBAL' ? '🌍 Global' : '🌐 İkisi de'}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Kanal tercihi * (en az 1)">
                <div className="flex flex-wrap gap-2">
                  {channelOptions.map((c) => {
                    const selected = draft.channels?.includes(c);
                    return (
                      <button key={c} onClick={() => {
                        const arr = draft.channels ?? [];
                        updateOnboardingDraft({ channels: selected ? arr.filter((x) => x !== c) : [...arr, c] });
                      }}
                        className={`px-3 py-1.5 rounded-full border text-xs font-medium ${selected ? 'border-yellow-500 bg-yellow-500/15 text-yellow-300' : 'border-[#3a3633] bg-[#1a1816] text-gray-400'}`}>
                        {c}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Aylık reklam bütçesi *">
                <div className="grid grid-cols-4 gap-2">
                  {(['0-5k', '5k-25k', '25k-100k', '100k+'] as const).map((b) => (
                    <button key={b} onClick={() => updateOnboardingDraft({ monthly_budget_band: b })}
                      className={`py-2.5 rounded-lg border text-xs font-semibold ${draft.monthly_budget_band === b ? 'border-yellow-500 bg-yellow-500/10 text-yellow-300' : 'border-[#3a3633] bg-[#1a1816] text-gray-400'}`}>
                      ₺{b}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold mb-1">Öncelikleriniz?</h2>
              <p className="text-sm text-gray-500 mb-6">Ajanlar görev önceliğini buna göre belirler.</p>
              <div className="space-y-2">
                {priorityOptions.map((p) => {
                  const selected = draft.priorities?.includes(p.id);
                  return (
                    <button key={p.id} onClick={() => {
                      const arr = draft.priorities ?? [];
                      updateOnboardingDraft({ priorities: selected ? arr.filter((x) => x !== p.id) : [...arr, p.id] });
                    }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold ${selected ? 'border-yellow-500 bg-yellow-500/10 text-yellow-300' : 'border-[#3a3633] bg-[#1a1816] text-gray-300'}`}>
                      <span>{p.label}</span>
                      {selected && <Check size={16} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="flex flex-col items-center text-center py-8">
              <div className="text-6xl mb-4">{draft.image_url || '✨'}</div>
              <h2 className="text-2xl font-bold mb-2">Hazırız!</h2>
              <p className="text-sm text-gray-400 max-w-md mb-6">
                <span className="text-yellow-400 font-semibold">{draft.product_name}</span> için 18 ajan ve 70+ tool eşliğinde uçtan uca operasyon kuruluyor.
              </p>
              <div className="bg-[#1a1816] border border-[#3a3633] rounded-xl px-6 py-4 text-left text-xs text-gray-400 space-y-1.5 max-w-md w-full">
                <Summary label="Ürün" value={draft.product_name} />
                <Summary label="Kategori" value={draft.category} />
                <Summary label="Aşama" value={stageOptions.find((s) => s.value === draft.stage)?.label} />
                <Summary label="Pazar" value={draft.target_market} />
                <Summary label="Kanallar" value={draft.channels?.join(', ')} />
                <Summary label="Bütçe" value={`₺${draft.monthly_budget_band}/ay`} />
                <Summary label="Öncelikler" value={(draft.priorities ?? []).map((p) => priorityOptions.find((o) => o.id === p)?.label).join(', ')} />
              </div>
              <button onClick={completeOnboarding} className="mt-8 px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl flex items-center gap-2">
                <Sparkles size={16} /> İlk Analizi Başlat
              </button>
            </div>
          )}
        </div>

        {step < 5 && (
          <>
            {missingFields.length > 0 && (
              <div
                role="alert"
                aria-live="polite"
                className="mt-4 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[12px] text-red-300"
              >
                Devam etmek için: <span className="font-semibold">{missingFields.join(', ')}</span>
              </div>
            )}
            <div className="flex items-center justify-between mt-6">
              <button onClick={() => setOnboardingStep(Math.max(1, step - 1))} disabled={step === 1}
                className="px-4 py-2 bg-[#262422] hover:bg-[#2e2a27] disabled:opacity-30 border border-[#3a3633] rounded-lg flex items-center gap-2 text-sm">
                <ArrowLeft size={14} /> Geri
              </button>
              <span className="text-xs text-gray-500">Adım {step} / 5</span>
              <button onClick={() => setOnboardingStep(step + 1)} disabled={!canAdvance}
                aria-disabled={!canAdvance}
                title={missingFields.length > 0 ? `Eksik: ${missingFields.join(', ')}` : 'Sonraki adım'}
                className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-30 disabled:cursor-not-allowed text-black font-semibold rounded-lg flex items-center gap-2 text-sm">
                Devam <ArrowRight size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="block text-xs font-semibold text-gray-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 text-right truncate">{value || '—'}</span>
    </div>
  );
}
