import { EasyPageShell } from '@/components/easy/EasyPageShell';
import { useBrandIdentity } from '@/lib/aos/adapter';
import { useStore } from '@/stores/useStore';

export default function EasyBrandPage({ navigate }: { navigate?: (page: string) => void }) {
  const brand = useBrandIdentity();
  const product = useStore((s) => s.onboardedProduct);
  const regenerateBrandIdentity = useStore((s) => s.regenerateBrandIdentity);
  const loading = useStore((s) => s.brandIdentityLoading);

  const back = () => navigate?.('dashboard');

  return (
    <EasyPageShell title="Markanız" subtitle="Logo ve isim önerileri" onBack={back}>
      <div className="easy-brand">
        <p className="easy-brand__product">{product?.product_name || 'Ürün'}</p>
        {brand ? (
          <>
            <h2 className="easy-brand__name">{brand.brand_name || brand.name}</h2>
            <p className="easy-brand__tag">{brand.tagline || '—'}</p>
          </>
        ) : (
          <p className="easy-empty">Henüz marka bilgisi yok.</p>
        )}
        <button
          type="button"
          className="easy-btn easy-btn--primary easy-btn--block"
          disabled={loading}
          onClick={() => void regenerateBrandIdentity()}
        >
          {loading ? 'Hazırlanıyor…' : 'Markayı yeniden oluştur'}
        </button>
      </div>
    </EasyPageShell>
  );
}
