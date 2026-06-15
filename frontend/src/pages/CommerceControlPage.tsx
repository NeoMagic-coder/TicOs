// @ts-nocheck
// ============================================================
// TicOSClaw — Commerce Control Layer (AI e-ticaret kontrol paneli)
// ============================================================
import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '@/components/AOS/widgets';
import { BASE_URL, backendHeaders } from '@/lib/api';
import { pushToast } from '@/components/AOS/Toast';

const STATUS_COLORS = {
  healthy: 'var(--acid)',
  attention: 'var(--amber)',
  critical: 'var(--red)',
};

const STATUS_LABELS = {
  healthy: 'Sağlıklı',
  attention: 'Dikkat',
  critical: 'Kritik',
};

const MODULE_ICONS = {
  products: 'box',
  stock: 'package',
  orders: 'bag',
  payment: 'wallet',
  support: 'message',
  fraud: 'shield',
};

const CommerceControlPage = () => {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const url = `${BASE_URL}/api/v1/commerce/control/snapshot?refresh=${refresh}`;
      const res = await fetch(url, { headers: backendHeaders() });
      if (!res.ok) throw new Error('snapshot failed');
      setSnapshot(await res.json());
    } catch (e) {
      console.error(e);
      pushToast('Commerce Control yüklenemedi', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(false); }, [load]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/commerce/control/scan`, {
        method: 'POST',
        headers: backendHeaders(),
      });
      if (!res.ok) throw new Error('scan failed');
      setSnapshot(await res.json());
      pushToast('Modül taraması tamamlandı', 'success');
    } catch (e) {
      pushToast('Tarama başarısız', 'error');
    } finally {
      setScanning(false);
    }
  };

  const proposeAction = async (actionType, moduleId, params = {}) => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/commerce/control/actions/propose`, {
        method: 'POST',
        headers: backendHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ action_type: actionType, module_id: moduleId, params, confidence: 0.85 }),
      });
      const data = await res.json();
      if (data.approval_id) {
        pushToast(`Onay kuyruğuna eklendi: ${data.approval_id}`, 'info');
      } else {
        pushToast(`Karar: ${data.decision_status}`, 'success');
      }
    } catch (e) {
      pushToast('Aksiyon önerilemedi', 'error');
    }
  };

  if (loading && !snapshot) {
    return (
      <div className="page">
        <p className="page__sub">Commerce Control yükleniyor…</p>
      </div>
    );
  }

  const overall = snapshot?.overall_status || 'attention';
  const health = snapshot?.overall_health ?? 0;

  return (
    <div className="page commerce-control">
      <header className="page__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page__title">AI E-Ticaret Kontrol</h1>
          <p className="page__sub">
            Ürün, stok, sipariş, ödeme, destek ve dolandırıcılık modüllerinin birleşik yapay zeka katmanı.
          </p>
        </div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={handleScan}
          disabled={scanning}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <Icon name="refresh" size={14} />
          {scanning ? 'Taranıyor…' : 'Yeniden Tara'}
        </button>
      </header>

      <div
        className="card"
        style={{
          marginBottom: 20,
          padding: 16,
          borderLeft: `4px solid ${STATUS_COLORS[overall] || 'var(--fg-3)'}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>Genel Sağlık</span>
            <div style={{ fontSize: 28, fontWeight: 700, color: STATUS_COLORS[overall] }}>
              %{Math.round(health * 100)}
            </div>
          </div>
          <span
            className="badge"
            style={{ background: STATUS_COLORS[overall], color: '#000', padding: '4px 10px', borderRadius: 6, fontSize: 12 }}
          >
            {STATUS_LABELS[overall] || overall}
          </span>
        </div>
        {snapshot?.scanned_at && (
          <p style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 8 }}>
            Son tarama: {new Date(snapshot.scanned_at).toLocaleString('tr-TR')}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {(snapshot?.modules || []).map((mod) => (
          <div key={mod.module_id} className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name={MODULE_ICONS[mod.module_id] || 'grid'} size={18} />
              <strong>{mod.label}</strong>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 10,
                  color: STATUS_COLORS[mod.status],
                  textTransform: 'uppercase',
                }}
              >
                {STATUS_LABELS[mod.status]}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 8 }}>
              AI: {mod.ai_technique} · Otomasyon: {mod.automation_level}
            </div>
            <div className="mono tnum" style={{ fontSize: 22, marginBottom: 10 }}>
              %{Math.round((mod.health_score || 0) * 100)}
            </div>
            {mod.signals?.length > 0 && (
              <ul style={{ fontSize: 11, color: 'var(--fg-2)', margin: '0 0 8px', paddingLeft: 16 }}>
                {mod.signals.slice(0, 3).map((s, i) => (
                  <li key={i}>
                    {s.type}
                    {s.count != null ? ` (${s.count})` : ''}
                    {s.fraud_score != null ? ` — skor ${s.fraud_score}` : ''}
                  </li>
                ))}
              </ul>
            )}
            {mod.recommendations?.[0] && (
              <p style={{ fontSize: 11, color: 'var(--fg-2)', margin: '0 0 10px' }}>{mod.recommendations[0]}</p>
            )}
            {mod.module_id === 'fraud' && mod.signals?.length > 0 && (
              <button
                type="button"
                className="btn btn--ghost"
                style={{ fontSize: 11 }}
                onClick={() => proposeAction('flag_order_review', 'fraud', { order_id: mod.signals[0]?.order_id })}
              >
                İncelemeye Al
              </button>
            )}
            {mod.module_id === 'stock' && mod.signals?.some((s) => s.type === 'low_stock') && (
              <button
                type="button"
                className="btn btn--ghost"
                style={{ fontSize: 11 }}
                onClick={() => proposeAction('suggest_restock', 'stock')}
              >
                Stok Öner
              </button>
            )}
          </div>
        ))}
      </div>

      {snapshot?.limitations?.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, marginBottom: 8 }}>Bilinen Sınırlamalar</h2>
          <ul style={{ fontSize: 12, color: 'var(--fg-3)', paddingLeft: 18 }}>
            {snapshot.limitations.map((lim, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{lim}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default CommerceControlPage;
