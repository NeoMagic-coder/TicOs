// @ts-nocheck
// ============================================================
// TicOSClaw — Envanter Ürünleri
// ============================================================
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Icon } from '@/components/AOS/widgets';
import { BASE_URL, backendHeaders } from '@/lib/api';
import { useStore } from '@/stores/useStore';

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);

const EMPTY_FORM = {
  name: '',
  sku: '',
  price: '',
  stock: '0',
  category: '',
  brand: '',
  barcode: '',
  description: '',
};

const TicProductsPage = ({ navigate }: { navigate?: (page: string) => void }) => {
  const activeProduct = useStore((s: any) => s.onboardedProduct);
  const integrationStatus = useStore((s: any) => s.integrationStatus);
  const syncWorkspaceInventory = useStore((s: any) => s.syncWorkspaceInventory);
  const loadIntegrationStatus = useStore((s: any) => s.loadIntegrationStatus);

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const linked = integrationStatus?.modules?.inventory?.link;
  const linkedSku = linked?.synced ? linked.sku : null;
  const expectedSku = linked?.expected_sku || linkedSku || '';

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      params.set('page_size', '100');
      const res = await fetch(`${BASE_URL}/api/v1/ticosclaw/tic/products?${params}`, {
        headers: backendHeaders(),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error('Envanter listesi yüklenemedi');
      const data = await res.json();
      setProducts(data.data || []);
      setTotal(data.pagination?.total ?? (data.data || []).length);
    } catch (e: any) {
      setLoadError(e?.message || 'Bağlantı hatası');
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const sortedProducts = useMemo(() => {
    if (!linkedSku) return products;
    return [...products].sort((a: any, b: any) => {
      if (a.sku === linkedSku) return -1;
      if (b.sku === linkedSku) return 1;
      return 0;
    });
  }, [products, linkedSku]);

  const stats = useMemo(() => {
    const lowStock = products.filter((p: any) => p.stock <= 5).length;
    const linkedItem = linkedSku ? products.find((p: any) => p.sku === linkedSku) : null;
    return { lowStock, linkedStock: linkedItem?.stock ?? linked?.stock ?? null };
  }, [products, linkedSku, linked?.stock]);

  const openAddForm = () => {
    if (activeProduct && !showForm) {
      setForm({
        name: activeProduct.product_name || '',
        sku: expectedSku || '',
        price: '99',
        stock: '0',
        category: activeProduct.category || '',
        brand: '',
        barcode: '',
        description: activeProduct.product_description || '',
      });
    }
    setShowForm((v) => !v);
    setError('');
  };

  const handleSync = async () => {
    await syncWorkspaceInventory();
    await loadIntegrationStatus();
    await loadProducts();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const price = Number(form.price);
    if (!form.name.trim() || !form.sku.trim()) {
      setError('Ürün adı ve SKU zorunludur.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError('Fiyat 0\'dan büyük olmalıdır.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/ticosclaw/tic/products`, {
        method: 'POST',
        headers: backendHeaders(),
        body: JSON.stringify({
          name: form.name.trim(),
          sku: form.sku.trim(),
          price,
          stock: Number(form.stock) || 0,
          category: form.category.trim(),
          brand: form.brand.trim(),
          barcode: form.barcode.trim(),
          description: form.description.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Kayıt başarısız');
      }
      setShowForm(false);
      setForm(EMPTY_FORM);
      await loadProducts();
      await loadIntegrationStatus();
    } catch (e: any) {
      setError(e?.message || 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> ENVANTER <span>›</span> ÜRÜNLER</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">Envanter Ürünleri</h1>
          <p className="page__sub">Stok takibi — Ürün OS kaydı envanter SKU&apos;su ile eşleşir</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {navigate && (
            <button type="button" className="btn btn--ghost" onClick={() => navigate('tic_orders')}>
              <Icon name="cart" size={12} /> Siparişler
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={() => void loadProducts()} disabled={loading}>
            <Icon name="refresh" size={12} /> Yenile
          </button>
          <button type="button" className="btn btn--primary" onClick={openAddForm}>
            <Icon name="plus" size={14} /> {showForm ? 'İptal' : 'Ürün Ekle'}
          </button>
        </div>
      </div>

      {!loading && !loadError && (
        <div className="stat-row">
          <div className="stat-chip">
            <span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{total}</span> Toplam kayıt
          </div>
          {stats.lowStock > 0 && (
            <div className="stat-chip">
              <span className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--amber)' }}>{stats.lowStock}</span> Düşük stok
            </div>
          )}
          {linkedSku && stats.linkedStock != null && (
            <div className="stat-chip">
              <span className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--acid)' }}>{stats.linkedStock}</span> Aktif ürün stoku
            </div>
          )}
        </div>
      )}

      {activeProduct && (
        <div className={`panel context-banner ${linkedSku ? 'context-banner--linked' : ''}`}>
          <div className="panel__body">
            <span>
              <strong>Ürün OS:</strong> {activeProduct.product_name}
              {linkedSku ? (
                <span style={{ color: 'var(--acid)', marginLeft: 8 }}>· SKU {linkedSku}</span>
              ) : (
                <span style={{ color: 'var(--amber)', marginLeft: 8 }}>· envantere henüz bağlanmadı</span>
              )}
            </span>
            {!linkedSku && (
              <button type="button" className="btn btn--sm" onClick={() => void handleSync()}>
                Envantere bağla
              </button>
            )}
            {navigate && (
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => navigate('products')}>
                Ürün OS
              </button>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="panel">
          <div className="panel__head">
            <h3>Yeni Envanter Ürünü</h3>
            {activeProduct && (
              <span className="panel__head-tag">Ürün OS&apos;tan ön dolduruldu</span>
            )}
          </div>
          <form onSubmit={handleSubmit} className="panel__body form-grid">
            <input placeholder="Ürün Adı *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="input" />
            <input placeholder="SKU *" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required className="input" />
            <input placeholder="Fiyat (₺) *" type="number" step="0.01" min="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="input" required />
            <input placeholder="Stok" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="input" />
            <input placeholder="Kategori" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="input" />
            <input placeholder="Marka" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="input" />
            <input placeholder="Barkod" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} className="input span-full" />
            <textarea placeholder="Açıklama" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input span-full" style={{ minHeight: 60 }} rows={2} />
            {error && <p className="span-full" style={{ color: 'var(--rose)', fontSize: 12, margin: 0 }}>{error}</p>}
            <button type="submit" className="btn btn--primary span-full" disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </form>
        </div>
      )}

      <div className="page-toolbar">
        <input
          className="input"
          placeholder="Ürün veya SKU ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loadError && (
        <div className="panel" style={{ borderColor: 'var(--rose)' }}>
          <div className="panel__body" style={{ color: 'var(--rose)', fontSize: 13 }}>{loadError}</div>
        </div>
      )}

      {loading ? (
        <div className="panel empty-state"><div className="panel__body">Yükleniyor…</div></div>
      ) : !loadError && products.length === 0 ? (
        <div className="panel empty-state">
          <div className="panel__body">
            <p style={{ margin: '0 0 12px' }}>Henüz envanter ürünü yok.</p>
            {activeProduct && !linkedSku ? (
              <button type="button" className="btn btn--primary btn--sm" onClick={() => void handleSync()}>
                Ürün OS&apos;u envantere bağla
              </button>
            ) : (
              <button type="button" className="btn btn--primary btn--sm" onClick={openAddForm}>
                İlk ürünü ekle
              </button>
            )}
          </div>
        </div>
      ) : !loadError ? (
        <div className="panel">
          <div className="panel__head">
            <h3>Stok Listesi</h3>
            <span className="panel__head-tag">{sortedProducts.length} kayıt</span>
          </div>
          <div className="panel__body panel__body--flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>SKU</th>
                  <th>Stok</th>
                  <th>Fiyat</th>
                  <th>Kategori</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((p: any) => (
                  <tr key={p.id} className={p.sku === linkedSku ? 'table-row--linked' : undefined}>
                    <td className="mono" style={{ fontWeight: 500 }}>
                      {p.sku === linkedSku && (
                        <span className="chip chip--acid" style={{ marginRight: 8, fontSize: 9 }}>AKTİF</span>
                      )}
                      {p.name}
                    </td>
                    <td className="mono" style={{ color: 'var(--fg-3)', fontSize: 11 }}>{p.sku}</td>
                    <td>
                      <span
                        className="mono tnum"
                        style={{
                          color: p.stock <= 5 ? 'var(--rose)' : p.stock <= 20 ? 'var(--amber)' : 'var(--fg-1)',
                          fontWeight: p.stock <= 5 ? 600 : 400,
                        }}
                      >
                        {p.stock}
                      </span>
                    </td>
                    <td className="mono tnum">{fmtCurrency(p.price)}</td>
                    <td style={{ color: 'var(--fg-3)', fontSize: 11 }}>{p.category || '—'}</td>
                    <td>
                      <span className={`chip ${p.is_active ? 'chip--acid' : ''}`}>
                        {p.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TicProductsPage;
