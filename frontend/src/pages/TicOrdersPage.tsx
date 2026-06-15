// @ts-nocheck
// ============================================================
// TicOSClaw — Multi-Platform Order Management
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import { Icon } from '@/components/AOS/widgets';
import { BASE_URL, backendHeaders } from '@/lib/api';
import { EASY_MODE } from '@/lib/easyMode';
import { EasyPageShell } from '@/components/easy/EasyPageShell';
import { useStore } from '@/stores/useStore';
import { pushToast } from '@/components/AOS/Toast';

const STATUS_LABELS = {
  PENDING: 'Bekliyor', CONFIRMED: 'Onaylandı', PROCESSING: 'Hazırlanıyor',
  SHIPPED: 'Kargoda', DELIVERED: 'Teslim Edildi', CANCELLED: 'İptal', RETURNED: 'İade',
};

const STATUS_COLORS = {
  PENDING: 'var(--amber)', CONFIRMED: 'var(--blue)', PROCESSING: 'var(--violet)',
  SHIPPED: 'var(--purple)', DELIVERED: 'var(--acid)', CANCELLED: 'var(--red)', RETURNED: 'var(--fg-3)',
};

const PLATFORM_ICONS = {
  TRENDYOL: 'zap', HEPSIBURADA: 'shop', AMAZON: 'globe', MANUAL: 'edit',
};

const EMPTY_ORDER_FORM = {
  customer_name: '',
  phone: '',
  product_id: '',
  quantity: '1',
};

const fmtCurrency = (n) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};

const TicOrdersPage = ({ navigate }: { navigate?: (page: string) => void }) => {
  const ordersQuickAddOpen = useStore((s) => s.ordersQuickAddOpen);
  const setOrdersQuickAddOpen = useStore((s) => s.setOrdersQuickAddOpen);

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [stats, setStats] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [orderForm, setOrderForm] = useState(EMPTY_ORDER_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadProducts = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/ticosclaw/tic/products?page_size=50`, { headers: backendHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      const list = data.data || [];
      setProducts(list);
      setOrderForm((f) => (f.product_id ? f : { ...f, product_id: list[0]?.id || '' }));
    } catch (e) { console.error(e); }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);
      const res = await fetch(`${BASE_URL}/api/v1/ticosclaw/tic/orders?${params}`, { headers: backendHeaders() });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setOrders(data.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/ticosclaw/tic/orders/stats`, { headers: backendHeaders() });
      if (res.ok) setStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => { loadOrders(); loadStats(); loadProducts(); }, [loadOrders, loadStats, loadProducts]);

  useEffect(() => {
    if (ordersQuickAddOpen) {
      setShowAddForm(true);
      setOrdersQuickAddOpen(false);
    }
  }, [ordersQuickAddOpen, setOrdersQuickAddOpen]);

  const updateStatus = async (id, status) => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/ticosclaw/tic/orders/${id}/status`, {
        method: 'PATCH',
        headers: backendHeaders(),
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        loadOrders();
        loadStats();
      }
    } catch (e) { console.error(e); }
  };

  const submitOrder = async () => {
    const name = orderForm.customer_name.trim();
    const qty = parseInt(orderForm.quantity, 10) || 1;
    if (!name) {
      setFormError('Müşteri adı yazın.');
      return;
    }
    if (!products.length) {
      setFormError('Önce Ürünler sayfasından ürün ekleyin.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const res = await fetch(`${BASE_URL}/api/v1/ticosclaw/tic/orders/quick`, {
        method: 'POST',
        headers: backendHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          customer_name: name,
          phone: orderForm.phone.trim(),
          product_id: orderForm.product_id || products[0]?.id,
          quantity: qty,
          platform: 'MANUAL',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'Sipariş eklenemedi');
      }
      pushToast({ kind: 'success', title: 'Sipariş eklendi', body: data.order_number || '' });
      setOrderForm({ ...EMPTY_ORDER_FORM, product_id: products[0]?.id || '' });
      setShowAddForm(false);
      loadOrders();
      loadStats();
    } catch (e) {
      setFormError(e?.message || 'Hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const quickStatuses = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  const FILTERS = ['', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

  const addFormBlock = (
    <div className="easy-order-add">
      {showAddForm ? (
        <div className="easy-order-add__form">
          <label className="easy-order-add__label">Müşteri adı</label>
          <input
            className="easy-input"
            value={orderForm.customer_name}
            onChange={(e) => setOrderForm((f) => ({ ...f, customer_name: e.target.value }))}
            placeholder="Örn: Ayşe Yılmaz"
          />
          <label className="easy-order-add__label">Telefon (isteğe bağlı)</label>
          <input
            className="easy-input"
            value={orderForm.phone}
            onChange={(e) => setOrderForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="05xx xxx xx xx"
          />
          <label className="easy-order-add__label">Ürün</label>
          <select
            className="easy-input"
            value={orderForm.product_id}
            onChange={(e) => setOrderForm((f) => ({ ...f, product_id: e.target.value }))}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {fmtCurrency(p.price)}</option>
            ))}
          </select>
          <label className="easy-order-add__label">Adet</label>
          <input
            className="easy-input"
            type="number"
            min={1}
            value={orderForm.quantity}
            onChange={(e) => setOrderForm((f) => ({ ...f, quantity: e.target.value }))}
          />
          {formError && <p className="easy-empty easy-empty--err">{formError}</p>}
          <div className="easy-order-add__actions">
            <button type="button" className="easy-btn easy-btn--ghost" onClick={() => setShowAddForm(false)}>
              Vazgeç
            </button>
            <button type="button" className="easy-btn easy-btn--primary" disabled={saving} onClick={submitOrder}>
              {saving ? 'Kaydediliyor…' : 'Siparişi kaydet'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="easy-btn easy-btn--primary easy-btn--block" onClick={() => setShowAddForm(true)}>
          + Yeni sipariş ekle
        </button>
      )}
    </div>
  );

  if (EASY_MODE) {
    const back = () => navigate?.('dashboard');
    const easyFilters = [
      { id: '', label: 'Tümü' },
      { id: 'PENDING', label: 'Bekleyen' },
    ];
    return (
      <EasyPageShell title="Siparişler" subtitle="Sipariş ekleyin ve takip edin." onBack={back}>
        {addFormBlock}
        <div className="easy-filter-row">
          {easyFilters.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`easy-filter ${filter === f.id ? 'easy-filter--on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {loading ? (
          <p className="easy-empty">Yükleniyor…</p>
        ) : orders.length === 0 ? (
          <p className="easy-empty">Henüz sipariş yok. Yukarıdan ekleyin.</p>
        ) : (
          <ul className="easy-card-list">
            {orders.map((o) => (
              <li key={o.id} className="easy-order-card">
                <p className="easy-order-card__no">{o.order_number}</p>
                <p className="easy-order-card__who">{o.customer_name || 'Müşteri'}</p>
                <div className="easy-order-card__row">
                  <span style={{ color: STATUS_COLORS[o.status] }}>{STATUS_LABELS[o.status] || o.status}</span>
                  <strong>{fmtCurrency(o.total_amount)}</strong>
                </div>
                {o.status === 'PENDING' && (
                  <button
                    type="button"
                    className="easy-btn easy-btn--ok easy-btn--block"
                    onClick={() => updateStatus(o.id, 'CONFIRMED')}
                  >
                    Siparişi onayla
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </EasyPageShell>
    );
  }

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> TICOS <span>›</span> ORDERS</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">Siparişler</h1>
          <p className="page__sub">Trendyol, Hepsiburada ve manuel siparişler</p>
        </div>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowAddForm((v) => !v)}>
          + Yeni sipariş
        </button>
      </div>

      {showAddForm && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel__body easy-order-add__form">
            <div className="easy-order-add__grid">
              <input className="input" placeholder="Müşteri adı" value={orderForm.customer_name}
                onChange={(e) => setOrderForm((f) => ({ ...f, customer_name: e.target.value }))} />
              <input className="input" placeholder="Telefon" value={orderForm.phone}
                onChange={(e) => setOrderForm((f) => ({ ...f, phone: e.target.value }))} />
              <select className="input" value={orderForm.product_id}
                onChange={(e) => setOrderForm((f) => ({ ...f, product_id: e.target.value }))}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input className="input" type="number" min={1} placeholder="Adet" value={orderForm.quantity}
                onChange={(e) => setOrderForm((f) => ({ ...f, quantity: e.target.value }))} />
            </div>
            {formError && <p style={{ color: 'var(--rose)', fontSize: 12 }}>{formError}</p>}
            <button type="button" className="btn btn--primary btn--sm" disabled={saving} onClick={submitOrder}>
              Kaydet
            </button>
          </div>
        </div>
      )}

      {stats && (
        <div className="stat-row">
          <div className="stat-chip"><span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{stats.total_orders}</span> Toplam Sipariş</div>
          <div className="stat-chip"><span className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--amber)' }}>{stats.pending_orders}</span> Bekleyen</div>
          <div className="stat-chip"><span className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--acid)' }}>{fmtCurrency(stats.total_revenue)}</span> Toplam Gelir</div>
        </div>
      )}

      <div className="page-toolbar">
        {FILTERS.map((s) => (
          <button key={s} className={`btn btn--sm ${filter === s ? 'btn--primary' : 'btn--ghost'}`}
            onClick={() => setFilter(s)}>
            {s ? STATUS_LABELS[s] || s : 'Tümü'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="panel empty-state"><div className="panel__body">Yükleniyor...</div></div>
      ) : orders.length === 0 ? (
        <div className="panel empty-state"><div className="panel__body">Sipariş bulunamadı.</div></div>
      ) : (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Sipariş No</th>
                <th>Müşteri</th>
                <th>Platform</th>
                <th>Tutar</th>
                <th>Durum</th>
                <th>Tarih</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="mono" style={{ fontWeight: 500 }}>{o.order_number}</td>
                  <td style={{ fontSize: 12 }}>{o.customer_name || '—'}</td>
                  <td>
                    <Icon name={PLATFORM_ICONS[o.platform] || 'box'} size={12} />{' '}
                    <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{o.platform}</span>
                  </td>
                  <td className="mono">{fmtCurrency(o.total_amount)}</td>
                  <td>
                    <span style={{ color: STATUS_COLORS[o.status], fontSize: 11, fontWeight: 500 }}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 10, color: 'var(--fg-3)' }}>{fmtDate(o.created_at)}</td>
                  <td>
                    <select
                      value={o.status}
                      onChange={(e) => updateStatus(o.id, e.target.value)}
                      className="input"
                      style={{ fontSize: 10, padding: '2px 4px', maxWidth: 100 }}
                    >
                      {quickStatuses.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TicOrdersPage;
