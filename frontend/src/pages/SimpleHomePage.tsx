// @ts-nocheck
// Mağazam — sadece ürün ve sipariş listesi.
import React from 'react';
import { Icon } from '@/components/AOS/widgets';
import { useStore } from '@/stores/useStore';

const SimpleHomePage = ({ navigate, embedded }) => {
  const product = useStore((s) => s.onboardedProduct);
  const productName = product?.product_name || 'Mağaza';
  const go = (page) => navigate?.(page);

  return (
    <div className={`page easy-home easy-home--minimal ${embedded ? 'easy-home--embedded' : ''}`}>
      <header className="easy-home__hero easy-home__hero--minimal">
        <h1 className="easy-home__title easy-home__title--minimal">{productName}</h1>
        <p className="easy-home__intro easy-home__intro--minimal">Ne bakmak istiyorsun?</p>
      </header>

      <div className="easy-home__actions easy-home__actions--minimal">
        <button type="button" className="easy-home__mega" onClick={() => go('tic_products')}>
          <Icon name="package" size={32} />
          <span>Ürünler</span>
        </button>
        <button type="button" className="easy-home__mega easy-home__mega--orders" onClick={() => go('tic_orders')}>
          <Icon name="bag" size={32} />
          <span>Siparişler</span>
        </button>
      </div>

      <p className="easy-home__foot-note">
        Sorunuz varsa alttan <strong>Soru Sor</strong> sekmesine geçin.
      </p>

      <button type="button" className="easy-home__all-features" onClick={() => go('dashboard')}>
        <Icon name="grid" size={20} />
        <span>Tüm özellikler</span>
        <span className="easy-home__all-features-sub">Ajanlar, fiyat, otonomi, panel… hepsi burada</span>
      </button>

      <div className="easy-home__more-row">
        <button type="button" className="easy-home__more-btn" onClick={() => go('integrations')}>
          Bağlantılar
        </button>
        <button type="button" className="easy-home__more-btn" onClick={() => go('approvals')}>
          Onaylar
        </button>
        <button type="button" className="easy-home__more-btn" onClick={() => go('brand')}>
          Marka
        </button>
      </div>
    </div>
  );
};

export default SimpleHomePage;
