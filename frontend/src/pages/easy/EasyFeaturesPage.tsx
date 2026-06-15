// Tüm özellikler — ana sayfa; tüm ekranlara buradan gidilir.
import React from 'react';
import { Icon } from '@/components/AOS/widgets';
import { EasyPageShell } from '@/components/easy/EasyPageShell';
import { ADVANCED_PAGES } from '@/lib/navigation/hubs';
import { useStore } from '@/stores/useStore';

const STORE_EXTRA = [
  { id: 'tic_products', label: 'Ürünler', icon: 'package', hint: 'Stok listesi' },
  { id: 'tic_orders', label: 'Siparişler', icon: 'bag', hint: 'Sipariş takibi' },
  { id: 'commerce_control', label: 'Mağaza Kontrolü', icon: 'shield', hint: 'AI kontrol katmanı' },
];

const GROUPS = [
  { id: 'store', label: 'Mağaza', items: STORE_EXTRA },
  {
    id: 'advanced',
    label: 'Diğer özellikler',
    items: ADVANCED_PAGES.map((p) => ({
      id: p.id,
      label: p.label,
      icon: p.icon,
      hint: null as string | null,
    })),
  },
];

type EasyFeaturesPageProps = {
  navigate?: (page: string) => void;
  embedded?: boolean;
  isHome?: boolean;
};

export default function EasyFeaturesPage({ navigate, embedded, isHome }: EasyFeaturesPageProps) {
  const product = useStore((s) => s.onboardedProduct);
  const productName = product?.product_name || 'Mağaza';
  const go = (page: string) => navigate?.(page);
  const home = isHome ?? false;

  const body = (
    <div className="easy-features">
      {home && (
        <p className="easy-features__welcome">
          <strong>{productName}</strong> — aşağıdan istediğin bölüme geç.
        </p>
      )}
      {!home && (
        <p className="easy-features__note">
          İstediğin ekrana dokun — tüm özellikler burada, hiçbiri silinmedi.
        </p>
      )}
      {GROUPS.map((group) => (
        <section key={group.id} className="easy-features__group">
          <h2 className="easy-features__group-title">{group.label}</h2>
          <ul className="easy-features__grid">
            {group.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="easy-features__card"
                  onClick={() => go(item.id)}
                >
                  <span className="easy-features__card-icon" aria-hidden="true">
                    <Icon name={item.icon} size={22} />
                  </span>
                  <span className="easy-features__card-label">{item.label}</span>
                  {item.hint && <span className="easy-features__card-hint">{item.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );

  if (embedded) {
    return (
      <div className={`easy-page easy-page--embedded ${home ? 'easy-page--home' : ''}`}>
        <header className="easy-page__head">
          {!home && (
            <button type="button" className="easy-page__back" onClick={() => go('dashboard')}>
              <Icon name="chevleft" size={14} />
              Ana sayfaya dön
            </button>
          )}
          <h1 className="easy-page__title">{home ? 'Tüm özellikler' : 'Tüm özellikler'}</h1>
          <p className="easy-page__sub">
            {home ? 'Mağaza ve tüm araçlar — dokunarak aç.' : 'İstediğin ekrana dokun — hepsi çalışıyor.'}
          </p>
        </header>
        {body}
      </div>
    );
  }

  return (
    <EasyPageShell
      title="Tüm özellikler"
      subtitle="İstediğin ekrana dokun — hepsi çalışıyor."
      onBack={() => go('dashboard')}
      backLabel="Ana sayfaya dön"
    >
      {body}
    </EasyPageShell>
  );
}
