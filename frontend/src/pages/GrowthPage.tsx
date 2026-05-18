// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
import { Icon, AgentAvatar, Sparkline } from '@/components/AOS/widgets';
import { AGENT_BY_ID } from '@/data/aos/mockData';
import { useStore } from '@/stores/useStore';

import { useAdaptedExperiments } from '@/lib/aos/adapter';
import { pushToast } from '@/components/AOS/Toast';
import { BASE_URL } from '@/lib/api';

const GrowthPage = () => {
  const EXPERIMENTS = useAdaptedExperiments();
  const hasExps = EXPERIMENTS.length > 0;
  const product = useStore((s: any) => s.onboardedProduct);
  const quickAsk = useStore((s: any) => s.quickAsk);
  const launchExperiment = useStore((s: any) => s.launchExperiment);
  const [showNew, setShowNew] = useState(false);
  const [detailFor, setDetailFor] = useState<any | null>(null);
  const [newDraft, setNewDraft] = useState<{ hypothesis: string; area: string; }>({ hypothesis: '', area: 'CRO' });
  const submitNewExperiment = async () => {
    if (!newDraft.hypothesis.trim()) {
      pushToast({ kind: 'warn', title: 'Eksik alan', body: 'Hipotez gerekli.' });
      return;
    }
    try {
      const res = await fetch(`${BASE_URL}/api/v1/experiments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDraft.hypothesis.slice(0, 60),
          area: newDraft.area,
          hypothesis: newDraft.hypothesis,
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        pushToast({ kind: 'success', title: 'Deney oluşturuldu', body: data?.id || 'OK' });
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e: any) {
      quickAsk(`Yeni deney oluştur ve plana al — alan: ${newDraft.area}, hipotez: "${newDraft.hypothesis}". Başarı metriği ve süre öner.`);
      pushToast({ kind: 'info', title: 'Hermes üzerinden planlanıyor', body: e?.message || String(e) });
    }
    setShowNew(false);
    setNewDraft({ hypothesis: '', area: 'CRO' });
  };
  const active = EXPERIMENTS.filter((e: any) => e.status === 'running').length;
  const pending = EXPERIMENTS.filter((e: any) => e.status === 'planned' || e.status === 'analyzing').length;
  const shipped = EXPERIMENTS.filter((e: any) => e.status === 'shipped' || e.status === 'killed');
  const won = EXPERIMENTS.filter((e: any) => e.status === 'shipped').length;
  const winRate = shipped.length ? Math.round((won / shipped.length) * 100) : null;
  // Only count uplift values that came back as real numbers — strings like
  // "tahmin +9%" used to be silently parsed into the average too, mixing
  // backend-measured lift with hand-typed projections.
  const liftValues: number[] = EXPERIMENTS
    .map((e: any) => (typeof e.uplift_pct === 'number' ? e.uplift_pct : null))
    .filter((x: any): x is number => typeof x === 'number');
  const avgLift = liftValues.length ? liftValues.reduce((s, v) => s + v, 0) / liftValues.length : null;
  const hasSpendData = EXPERIMENTS.some((e: any) => typeof e.spend === 'number');
  const hasConfidence = EXPERIMENTS.some((e: any) => typeof e.confidence === 'number');
  return (
  <div className="page">
    <div className="page__breadcrumb mono">HOME <span>›</span> BÜYÜME</div>
    <div className="page__header">
      <div>
        <h1 className="page__title">Büyüme & Deneyler<span className="page__title-tag">growth_agent</span></h1>
        <p className="page__sub">CRO, upsell, bundle, yeni kanal deneyleri — hipotezden ölçeklemeye.</p>
      </div>
      <button className="btn btn--primary" onClick={() => setShowNew(true)}>
        <Icon name="plus" size={12} /> Yeni Deney
      </button>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border-faint)', border: '1px solid var(--border)', borderRadius: 6, marginBottom: 16, overflow: 'hidden' }}>
      {[
        { l: 'Aktif',     v: hasExps ? String(active) : '—',  sub: 'çalışıyor' },
        { l: 'Bekleyen',  v: hasExps ? String(pending) : '—', sub: 'analiz / plan' },
        { l: 'Win Rate',
          v: winRate != null ? winRate + '%' : '—',
          sub: shipped.length ? shipped.length + ' sonuçlanan' : 'henüz sonuçlanan deney yok',
          color: winRate != null ? (winRate >= 50 ? 'var(--acid)' : 'var(--amber)') : 'var(--fg-3)' },
        { l: 'Avg Lift',
          v: avgLift != null ? (avgLift >= 0 ? '+' : '') + avgLift.toFixed(1) + '%' : '—',
          sub: avgLift != null ? `${liftValues.length} ölçülen deney` : 'henüz ölçülen lift yok',
          color: avgLift != null ? (avgLift >= 0 ? 'var(--acid)' : 'var(--rose)') : 'var(--fg-3)' },
      ].map(s => (
        <div key={s.l} style={{ padding: '12px 16px', background: 'var(--bg-1)' }}>
          <div className="label-eyebrow" style={{ marginBottom: 4 }}>{s.l}</div>
          <div className="tnum" style={{ fontSize: 20, fontWeight: 500, color: s.color || 'var(--fg-1)' }}>{s.v}</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>{s.sub}</div>
        </div>
      ))}
    </div>

    <div className="panel">
      <div className="panel__head"><h3>Deney Sırası</h3><span className="panel__head-tag">{EXPERIMENTS.length}</span></div>
      {!hasExps && (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 8 }}>╭─ deney kuyruğu boş ─╮</div>
          <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 14 }}>
            {product
              ? `"${product.product_name}" için henüz CRO/upsell/email deneyi oluşturulmadı.`
              : 'Önce bir ürün onboard et.'}
          </div>
          <button className="btn btn--primary" onClick={() => setShowNew(true)}>
            <Icon name="plus" size={12} /> İlk Deneyi Oluştur
          </button>
        </div>
      )}
      {hasExps && EXPERIMENTS.map((e: any) => {
        const agent = AGENT_BY_ID[e.agent];
        const statusChip =
          e.status === 'running'   ? 'amber' :
          e.status === 'shipped'   ? 'acid'  :
          e.status === 'analyzing' ? 'violet': '';
        const hasSpend = typeof e.spend === 'number';
        const hasConf = typeof e.confidence === 'number';
        return (
          <div key={e.id} className="row" style={{ gridTemplateColumns: '24px 1fr 100px 110px 110px 110px 100px', padding: '14px 16px' }}>
            {agent && <AgentAvatar agent={agent} size={20} />}
            <div>
              <div style={{ fontSize: 13 }}>{e.name}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{e.id} · {agent?.name || e.agent || '—'}{e.area ? ` · ${e.area}` : ''}</div>
            </div>
            <span className={`chip chip--${statusChip}`}>{e.status}</span>
            <div>
              <div className="label-eyebrow">CONV LIFT</div>
              <div className="tnum mono" style={{
                fontSize: 13,
                color: typeof e.uplift_pct === 'number' ? (e.uplift_pct > 0 ? 'var(--acid)' : 'var(--rose)') : 'var(--fg-4)',
              }}>
                {e.conv_lift}
              </div>
            </div>
            <div>
              <div className="label-eyebrow">HARCAMA</div>
              <div className="tnum mono" style={{ fontSize: 13, color: hasSpend ? 'var(--fg-1)' : 'var(--fg-4)' }}>
                {hasSpend ? `₺${e.spend.toLocaleString('tr-TR')}` : '—'}
              </div>
            </div>
            <div>
              <div className="label-eyebrow">GÜVEN</div>
              <div className="tnum mono" style={{ fontSize: 13, color: hasConf ? 'var(--fg-1)' : 'var(--fg-4)' }}>
                {hasConf ? `${(e.confidence * 100).toFixed(0)}%` : '—'}
              </div>
            </div>
            <button className="btn btn--sm btn--ghost" onClick={() => setDetailFor(e)}>
              Detay <Icon name="chevright" size={10} />
            </button>
          </div>
        );
      })}
    </div>

    {showNew && (
      <div onClick={() => setShowNew(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 24, width: 460, maxWidth: '92vw' }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>Yeni Deney</h3>
          <div style={{ display: 'grid', gap: 12, fontSize: 12 }}>
            <label>
              <div className="label-eyebrow" style={{ marginBottom: 4 }}>Alan</div>
              <select
                value={newDraft.area}
                onChange={(e) => setNewDraft({ ...newDraft, area: e.target.value })}
                style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg-1)' }}
              >
                <option value="CRO">CRO</option>
                <option value="Pricing">Pricing</option>
                <option value="Upsell">Upsell</option>
                <option value="Email">Email</option>
                <option value="Ads">Ads</option>
                <option value="SEO">SEO</option>
              </select>
            </label>
            <label>
              <div className="label-eyebrow" style={{ marginBottom: 4 }}>Hipotez</div>
              <textarea
                rows={3}
                value={newDraft.hypothesis}
                onChange={(e) => setNewDraft({ ...newDraft, hypothesis: e.target.value })}
                placeholder="Örn: Mobil checkout'ta tek-tıkla ödeme dönüşümü %10 artırır."
                style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg-1)', resize: 'vertical' }}
              />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowNew(false)}>Vazgeç</button>
            <button className="btn btn--primary btn--sm" onClick={submitNewExperiment}>Oluştur</button>
          </div>
        </div>
      </div>
    )}

    {detailFor && (
      <div onClick={() => setDetailFor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 100 }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 8, padding: 24, width: 520, maxWidth: '92vw' }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>{detailFor.name}</h3>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 12 }}>{detailFor.id} · {detailFor.agent}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
            <div><div className="label-eyebrow">Durum</div><div>{detailFor.status}</div></div>
            <div><div className="label-eyebrow">Conv. Lift</div><div>{detailFor.conv_lift}</div></div>
            <div><div className="label-eyebrow">Harcama</div><div>{typeof detailFor.spend === 'number' ? `₺${detailFor.spend.toLocaleString('tr-TR')}` : '—'}</div></div>
            <div><div className="label-eyebrow">Güven</div><div>{typeof detailFor.confidence === 'number' ? `${(detailFor.confidence * 100).toFixed(0)}%` : '—'}</div></div>
            {detailFor.metric && <div><div className="label-eyebrow">Metrik</div><div>{detailFor.metric}</div></div>}
            {detailFor.area && <div><div className="label-eyebrow">Alan</div><div>{detailFor.area}</div></div>}
            {detailFor.started_at && <div><div className="label-eyebrow">Başlangıç</div><div className="mono" style={{ fontSize: 11 }}>{new Date(detailFor.started_at).toLocaleString('tr-TR')}</div></div>}
            {detailFor.ended_at && <div><div className="label-eyebrow">Bitiş</div><div className="mono" style={{ fontSize: 11 }}>{new Date(detailFor.ended_at).toLocaleString('tr-TR')}</div></div>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
            <button className="btn btn--ghost btn--sm" onClick={() => setDetailFor(null)}>Kapat</button>
            {detailFor.status !== 'running' && (
              <button
                className="btn btn--primary btn--sm"
                onClick={() => {
                  if (detailFor.id) launchExperiment(detailFor.id);
                  quickAsk(`${detailFor.name} deneyini başlat ve ilk 7 günlük takvimi planla.`);
                  setDetailFor(null);
                }}
              >
                Başlat
              </button>
            )}
          </div>
        </div>
      </div>
    )}
  </div>
  );
};

// ============================================================
// ONBOARDING — 5 step product onboarding flow
export { GrowthPage };
export default GrowthPage;
