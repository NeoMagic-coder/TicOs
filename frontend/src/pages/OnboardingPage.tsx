import { useState } from 'react';
import { useStore } from '@/stores/useStore';

/** Tek ekran kurulum — isim yaz, devam. */
export function OnboardingPage() {
  const updateOnboardingDraft = useStore((s) => s.updateOnboardingDraft);
  const completeOnboarding = useStore((s) => s.completeOnboarding);

  const [name, setName] = useState('');
  const [starting, setStarting] = useState(false);

  const trimmed = name.trim();
  const canStart = trimmed.length >= 1;

  const handleStart = () => {
    if (!canStart || starting) return;
    setStarting(true);
    updateOnboardingDraft({
      product_name: trimmed,
      category: 'Genel',
      product_description: '',
      stage: 'idea',
      target_market: 'TR',
      channels: ['Shopify'],
      monthly_budget_band: '0-5k',
      priorities: ['fast_sales'],
    });
    completeOnboarding();
  };

  return (
    <div className="quick-onboarding quick-onboarding--minimal" data-testid="quick-onboarding">
      <main className="quick-onboarding__main quick-onboarding__main--minimal">
        <div className="quick-onboarding__card quick-onboarding__card--minimal">
          <img className="quick-onboarding__logo-minimal" src="/ticosclaw-icon.png" alt="" />
          <span className="quick-onboarding__brand-minimal" data-testid="ticosclaw-brand">TicOSClaw</span>
          <h1 className="quick-onboarding__title">Hoş geldin</h1>
          <p className="quick-onboarding__sub-minimal">Ne satıyorsun? Kısaca yaz.</p>

          <input
            id="ob-product-name"
            className="quick-onboarding__input quick-onboarding__input--minimal"
            type="text"
            placeholder="Örn: Tencere"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canStart) handleStart();
            }}
            aria-label="Ürün adı"
          />

          <button
            type="button"
            className="quick-onboarding__cta quick-onboarding__cta--minimal"
            disabled={!canStart || starting}
            onClick={handleStart}
          >
            {starting ? '…' : 'Devam'}
          </button>
        </div>
      </main>
    </div>
  );
}
