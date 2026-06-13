// @ts-nocheck
// ============================================================
// TicOSClaw — Multi-Platform Order Management
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import { Icon } from '@/components/AOS/widgets';
import { BASE_URL, backendHeaders } from '@/lib/api';

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

const fmtCurrency = (n) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);
const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};

const TicOrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [stats, setStats] = useState(null);

  const loadOrders = useCallback(async () => {
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

  useEffect(() => { loadOrders(); loadStats(); }, [loadOrders, loadStats]);

  const updateStatus = async (id, status) => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/ticosclaw/tic/orders/${id}/status`, {
        method: 'PATCH',
        headers: backendHeaders(),
        body: JSON.stringify({ status }),
      });
      if (res.ok) loadOrders();
    } catch (e) { console.error(e); }
  };

  const quickStatuses = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
  const FILTERS = ['', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> TICOS <span>›</span> ORDERS</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">Siparişler</h1>
          <p className="page__sub">Trendyol, Hepsiburada ve manuel siparişler</p>
        </div>
      </div>

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
