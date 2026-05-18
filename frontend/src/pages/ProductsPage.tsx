// @ts-nocheck
// ============================================================
// AGENT.OS — Ürünler (Products) page
// Workspace product registry: list every onboarded product as a
// card, switch active product, edit (re-onboard), remove, or
// kick off a new onboarding flow.
// ============================================================
import React, { useMemo, useState } from 'react';
import { Icon } from '@/components/AOS/widgets';
import { useStore } from '@/stores/useStore';

const STAGE_LABELS: Record<string, string> = {
  idea: 'Fikir',
  product_no_store: 'Ürün Hazır',
  store_growing: 'Mağaza Büyüyor',
  marketplace_opt: 'Ölçeklendirme',
};

const STAGE_COLORS: Record<string, string> = {
  idea: '#8c64dc',
  product_no_store: '#0ea5e9',
  store_growing: '#10b981',
  marketplace_opt: '#f59e0b',
};

const MARKET_LABELS: Record<string, string> = {
  TR: 'Türkiye',
  GLOBAL: 'Global',
  BOTH: 'TR + Global',
};

const BUDGET_LABELS: Record<string, string> = {
  '0-5k': '< 5K ₺/ay',
  '5k-25k': '5K – 25K ₺/ay',
  '25k-100k': '25K – 100K ₺/ay',
  '100k+': '100K+ ₺/ay',
};

const fmtDate = (iso: string): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
};

const healthTone = (score: number): { bg: string; fg: string; label: string } => {
  if (score >= 80) return { bg: 'rgba(16,185,129,0.12)', fg: '#10b981', label: 'Sağlıklı' };
  if (score >= 50) return { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b', label: 'İzlemede' };
  return { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444', label: 'Riskli' };
};

const isEmoji = (s: string): boolean => Boolean(s) && !/^https?:\/\//.test(s);

const ProductImage = ({ src, name }: { src: string; name: string }) => {
  const initials = (name || 'OP').split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase();
  if (!src || isEmoji(src)) {
    return (
      <div
        style={{
          width: '100%', aspectRatio: '16 / 9', borderRadius: 6,
          background: 'linear-gradient(135deg, rgba(140,100,220,0.15), rgba(14,165,233,0.10))',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 56, lineHeight: 1,
        }}
        aria-label={name}
      >
        {src && isEmoji(src) ? src : (initials || '📦')}
      </div>
    );
  }
  return (
    <div
      style={{
        width: '100%', aspectRatio: '16 / 9', borderRadius: 6,
        background: `center / cover no-repeat url(${JSON.stringify(src)})`,
        border: '1px solid var(--border)',
      }}
      aria-label={name}
    />
  );
};

const Pill = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div
    style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 8px', borderRadius: 4,
      background: 'var(--bg-1)', border: '1px solid var(--border)',
      fontSize: 11, color: 'var(--fg-1)',
    }}
  >
    <span style={{ color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.4, fontSize: 9 }}>{label}</span>
    <span style={{ color: color || 'var(--fg-1)', fontWeight: 500 }}>{value}</span>
  </div>
);

const ProductCard = ({
  product, isActive, onActivate, onEdit, onDelete,
}: {
  product: any;
  isActive: boolean;
  onActivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  const stageColor = STAGE_COLORS[product.stage] || 'var(--fg-3)';
  const health = healthTone(product.health_score ?? 0);
  return (
    <div
      style={{
        background: 'var(--bg-2)',
        border: `1px solid ${isActive ? 'var(--acid)' : 'var(--border)'}`,
        borderRadius: 8,
        padding: 16,
        display: 'flex', flexDirection: 'column', gap: 12,
        position: 'relative',
        boxShadow: isActive ? '0 0 0 1px var(--acid), 0 8px 24px rgba(16,185,129,0.10)' : 'none',
      }}
    >
      {isActive && (
        <div
          style={{
            position: 'absolute', top: 12, right: 12,
            background: 'var(--acid)', color: '#06281b',
            padding: '2px 8px', borderRadius: 4,
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          ● AKTİF
        </div>
      )}

      <ProductImage src={product.image_url} name={product.product_name} />

      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 2 }}>
          {product.product_name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>
          {product.category} · katıldı {fmtDate(product.onboarded_at)}
        </div>
      </div>

      {product.product_description && (
        <div
          style={{
            fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {product.product_description}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Pill label="Aşama" value={STAGE_LABELS[product.stage] || product.stage} color={stageColor} />
        <Pill label="Pazar" value={MARKET_LABELS[product.target_market] || product.target_market} />
        <Pill label="Bütçe" value={BUDGET_LABELS[product.monthly_budget_band] || product.monthly_budget_band} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-1)',
            border: '1px solid var(--border)', overflow: 'hidden',
          }}
          title={`Health score: ${product.health_score ?? 0}/100`}
        >
          <div
            style={{
              width: `${Math.max(0, Math.min(100, product.health_score ?? 0))}%`,
              height: '100%', background: health.fg, transition: 'width .4s ease',
            }}
          />
        </div>
        <span
          style={{
            fontSize: 10, padding: '2px 6px', borderRadius: 3,
            background: health.bg, color: health.fg, fontWeight: 600,
          }}
        >
          {product.health_score ?? 0} · {health.label}
        </span>
      </div>

      {Array.isArray(product.channels) && product.channels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {product.channels.slice(0, 5).map((ch: string) => (
            <span
              key={ch}
              style={{
                fontSize: 10, padding: '2px 6px', borderRadius: 3,
                background: 'rgba(140,100,220,0.10)', color: 'var(--violet)',
                border: '1px solid rgba(140,100,220,0.25)',
              }}
            >
              {ch}
            </span>
          ))}
          {product.channels.length > 5 && (
            <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>+{product.channels.length - 5}</span>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border-faint)' }}>
        <button
          type="button"
          onClick={onActivate}
          disabled={isActive}
          title={isActive ? 'Zaten aktif' : 'Aktif ürün yap'}
          style={{
            flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '6px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
            background: isActive ? 'transparent' : 'rgba(16,185,129,0.12)',
            border: `1px solid ${isActive ? 'var(--border)' : 'rgba(16,185,129,0.35)'}`,
            color: isActive ? 'var(--fg-3)' : 'var(--acid)',
            cursor: isActive ? 'default' : 'pointer',
          }}
        >
          <Icon name="check" size={12} /> {isActive ? 'Aktif' : 'Aktif yap'}
        </button>
        <button
          type="button"
          onClick={onEdit}
          title="Onboarding adımlarını yeniden çalıştır"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '6px 10px', borderRadius: 4, fontSize: 11,
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--fg-2)', cursor: 'pointer',
          }}
        >
          <Icon name="refresh" size={12} /> Düzenle
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Ürünü workspace'ten kaldır"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '6px 10px', borderRadius: 4, fontSize: 11,
            background: 'transparent', border: '1px solid rgba(239,68,68,0.35)',
            color: '#ef4444', cursor: 'pointer',
          }}
        >
          <Icon name="x" size={12} /> Sil
        </button>
      </div>
    </div>
  );
};

const EmptyState = ({ onAdd }: { onAdd: () => void }) => (
  <div
    style={{
      gridColumn: '1 / -1',
      background: 'var(--bg-2)', border: '1px dashed var(--border)',
      borderRadius: 8, padding: 48, textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
    }}
  >
    <div style={{ fontSize: 48 }}>📦</div>
    <div style={{ fontSize: 14, color: 'var(--fg-1)', fontWeight: 600 }}>Henüz bir ürün yok</div>
    <div style={{ fontSize: 12, color: 'var(--fg-3)', maxWidth: 360 }}>
      Workspace'inize ilk ürünü ekleyerek başlayın. Onboarding sihirbazı 4 adımda marka, pazar ve bütçe tercihlerinizi alır.
    </div>
    <button
      type="button"
      onClick={onAdd}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '8px 14px', borderRadius: 4, fontSize: 12, fontWeight: 600,
        background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer',
      }}
    >
      <Icon name="plus" size={14} /> İlk ürünü ekle
    </button>
  </div>
);

const ProductsPage = () => {
  const products = useStore((s: any) => s.products) || [];
  const activeProduct = useStore((s: any) => s.onboardedProduct);
  const switchToProduct = useStore((s: any) => s.switchToProduct);
  const removeProduct = useStore((s: any) => s.removeProduct);
  const startNewProductOnboarding = useStore((s: any) => s.startNewProductOnboarding);
  const setCurrentPage = useStore((s: any) => s.setCurrentPage);
  const setOnboardingStep = useStore((s: any) => s.setOnboardingStep);
  const updateOnboardingDraft = useStore((s: any) => s.updateOnboardingDraft);
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p: any) => {
      if (stageFilter !== 'all' && p.stage !== stageFilter) return false;
      if (!q) return true;
      return (
        p.product_name?.toLowerCase().includes(q)
        || p.category?.toLowerCase().includes(q)
        || p.product_description?.toLowerCase().includes(q)
      );
    });
  }, [products, query, stageFilter]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: products.length };
    for (const p of products) counts[p.stage] = (counts[p.stage] || 0) + 1;
    return counts;
  }, [products]);

  const handleEdit = (product: any) => {
    // Pre-fill the onboarding draft with the product's existing fields so
    // the wizard reopens populated rather than blank.
    updateOnboardingDraft?.({ ...product });
    setOnboardingStep?.(1);
    setCurrentPage('onboarding');
  };

  const handleDelete = (product: any) => {
    const ok = window.confirm(
      `"${product.product_name}" ürününü workspace'ten silmek istiyor musun?\n\nBu işlem geri alınamaz. Geçmiş görev/onay logları korunur.`,
    );
    if (!ok) return;
    void removeProduct(product.product_name);
  };

  const FILTERS = [
    { id: 'all',                label: `Tümü (${stageCounts.all || 0})` },
    { id: 'idea',               label: `Fikir (${stageCounts.idea || 0})` },
    { id: 'product_no_store',   label: `Ürün Hazır (${stageCounts.product_no_store || 0})` },
    { id: 'store_growing',      label: `Mağaza Büyüyor (${stageCounts.store_growing || 0})` },
    { id: 'marketplace_opt',    label: `Ölçeklendirme (${stageCounts.marketplace_opt || 0})` },
  ];

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> ÜRÜNLER</div>
      <div className="page__header" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <h1 className="page__title">Ürünler</h1>
          <p className="page__sub">
            {products.length} ürün workspace'te
            {activeProduct ? ` · aktif: ${activeProduct.product_name}` : ' · aktif ürün yok'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => startNewProductOnboarding()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 4, fontSize: 12, fontWeight: 600,
            background: 'var(--violet)', color: '#fff', border: 'none', cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Icon name="plus" size={14} /> Yeni Ürün
        </button>
      </div>

      {products.length > 0 && (
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
            marginBottom: 16, padding: 12,
            background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6,
          }}
        >
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 360 }}>
            <span
              style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--fg-3)', display: 'inline-flex',
              }}
            >
              <Icon name="search" size={12} />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ürün, kategori veya açıklama ara…"
              style={{
                width: '100%', padding: '8px 10px 8px 30px', borderRadius: 4,
                background: 'var(--bg-1)', border: '1px solid var(--border)',
                color: 'var(--fg-1)', fontSize: 12, outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {FILTERS.map((f) => {
              const active = stageFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStageFilter(f.id)}
                  style={{
                    padding: '6px 10px', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                    background: active ? 'rgba(140,100,220,0.15)' : 'transparent',
                    border: `1px solid ${active ? 'rgba(140,100,220,0.45)' : 'var(--border)'}`,
                    color: active ? 'var(--violet)' : 'var(--fg-2)',
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        {products.length === 0 && <EmptyState onAdd={() => startNewProductOnboarding()} />}
        {products.length > 0 && filtered.length === 0 && (
          <div
            style={{
              gridColumn: '1 / -1', padding: 24, textAlign: 'center',
              background: 'var(--bg-2)', border: '1px dashed var(--border)', borderRadius: 6,
              fontSize: 12, color: 'var(--fg-3)',
            }}
          >
            Bu filtreyle eşleşen ürün yok.
          </div>
        )}
        {filtered.map((p: any) => (
          <ProductCard
            key={p.product_name}
            product={p}
            isActive={activeProduct?.product_name === p.product_name}
            onActivate={() => switchToProduct(p.product_name)}
            onEdit={() => handleEdit(p)}
            onDelete={() => handleDelete(p)}
          />
        ))}
      </div>
    </div>
  );
};

export default ProductsPage;
