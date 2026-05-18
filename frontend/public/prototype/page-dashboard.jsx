/* global React, AOSWidgets, AGENT_OS_DATA */
// ============================================================
// AGENT.OS — Dashboard page
// ============================================================
const { useState, useEffect, useRef, useMemo } = React;
const { Icon, StatusDot, Sparkline, AgentAvatar, KpiTile, SectionHead } = window.AOSWidgets;
const { AGENTS, AGENT_BY_ID, SALES_TREND, CHANNELS, makeEvent } = window.AGENT_OS_DATA;

// ============================================================
// Sales trend chart
// ============================================================
const SalesTrend = () => {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const W = c.parentElement.clientWidth - 28;
    const H = 260;
    c.width = W * dpr; c.height = H * dpr;
    c.style.width = W + 'px'; c.style.height = H + 'px';
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);

    const padL = 50, padR = 16, padT = 16, padB = 30;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const data = SALES_TREND.map(d => d.sales);
    const min = 0, max = Math.max(...data) * 1.1;
    const stepX = innerW / (data.length - 1);
    const points = data.map((v, i) => [padL + i * stepX, padT + innerH - (v / max) * innerH]);

    ctx.clearRect(0, 0, W, H);
    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    ctx.font = '10px "Geist Mono", monospace';
    ctx.fillStyle = '#4A5060';
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * innerH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + innerW, y); ctx.stroke();
      const val = Math.round(max * (1 - i/4));
      ctx.fillText('₺' + (val / 1000).toFixed(0) + 'k', 8, y + 3);
    }
    // X labels
    SALES_TREND.forEach((d, i) => {
      ctx.fillStyle = '#7C8497';
      ctx.fillText(d.day, padL + i * stepX - 12, padT + innerH + 18);
    });

    // Gradient fill
    const grad = ctx.createLinearGradient(0, padT, 0, padT + innerH);
    grad.addColorStop(0, 'rgba(199,255,61,0.25)');
    grad.addColorStop(1, 'rgba(199,255,61,0.00)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(points[0][0], padT + innerH);
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(points[points.length-1][0], padT + innerH);
    ctx.closePath(); ctx.fill();

    // Line
    ctx.strokeStyle = '#C7FF3D';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();

    // Dots
    points.forEach(([x, y], i) => {
      ctx.fillStyle = '#0D0F13';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#C7FF3D';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI*2); ctx.stroke();
    });

    // Highlight today's spike with a label
    const lastIdx = points.length - 1;
    const [lx, ly] = points[lastIdx];
    ctx.fillStyle = '#C7FF3D';
    ctx.font = '600 11px "Geist Mono", monospace';
    ctx.fillText('₺13.6k', lx - 38, ly - 10);

  }, []);

  return (
    <div style={{ position: 'relative', padding: 14 }}>
      <canvas ref={ref} />
    </div>
  );
};

// ============================================================
// Channel bars
// ============================================================
const ChannelBars = () => {
  const total = CHANNELS.reduce((s, c) => s + c.sales, 0);
  return (
    <div style={{ padding: '8px 0' }}>
      {CHANNELS.map(c => (
        <div key={c.name} style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, background: c.color, borderRadius: 2 }} />
              <span style={{ color: 'var(--fg-1)' }}>{c.name}</span>
              <span style={{ color: 'var(--fg-3)' }} className="mono">{c.orders} sipariş</span>
            </span>
            <span style={{ color: 'var(--fg-1)' }} className="mono tnum">
              ₺{c.sales.toLocaleString('tr-TR')}
              <span style={{ color: 'var(--fg-3)', marginLeft: 8 }}>{Math.round(c.share*100)}%</span>
            </span>
          </div>
          <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: (c.sales/total*100) + '%', height: '100%', background: c.color, opacity: 0.85 }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// Live agent activity feed
// ============================================================
const LiveAgentFeed = () => {
  const [items, setItems] = useState(() => {
    const arr = [];
    const now = Date.now();
    for (let i = 7; i > 0; i--) {
      arr.push({ ...makeEvent(new Date(now - i * 3500)), _key: i });
    }
    return arr;
  });
  useEffect(() => {
    const id = setInterval(() => {
      setItems(prev => {
        const next = [{...makeEvent(new Date()), _key: Date.now()}, ...prev].slice(0, 10);
        return next;
      });
    }, 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: 4 }}>
      {items.map((it, i) => {
        const agent = AGENT_BY_ID[it.agent];
        const color = it.level === 'warn' ? 'var(--amber)' : it.level === 'ok' ? 'var(--acid)' : 'var(--fg-2)';
        return (
          <div
            key={it._key}
            style={{
              display: 'grid',
              gridTemplateColumns: '72px 22px 130px 1fr',
              gap: 8,
              padding: '5px 10px',
              alignItems: 'center',
              opacity: 1 - (i * 0.04),
              borderBottom: '1px solid var(--border-faint)',
              borderRadius: 2,
              background: i === 0 ? 'var(--acid-soft)' : 'transparent',
              transition: 'background 0.6s ease',
            }}
          >
            <span style={{ color: 'var(--fg-3)' }}>{it.ts.slice(0, 8)}</span>
            {agent ? <AgentAvatar agent={agent} size={18} /> : <span style={{ width: 18, height: 18, background: 'var(--bg-3)', borderRadius: 3 }} />}
            <span style={{ color }}>{it.event}</span>
            <span style={{ color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.msg}</span>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// Active integrations
// ============================================================
const INTEGRATIONS = [
  { name: 'Shopify',     status: 'live',     latency: 412, lastSync: '2 dk önce', color: '#95BF47' },
  { name: 'Trendyol',    status: 'live',     latency: 514, lastSync: '1 dk önce', color: '#F27A1A' },
  { name: 'Meta Ads',    status: 'mock',     latency: 740, lastSync: 'mock',       color: '#0866FF' },
  { name: 'GA4',         status: 'live',     latency: 1124,lastSync: '5 sn önce',  color: '#F9AB00' },
  { name: 'Hepsiburada', status: 'live',     latency: 488, lastSync: '3 dk önce',  color: '#FF6000' },
  { name: 'Amazon SP',   status: 'degraded', latency: 2240,lastSync: 'breaker open',color: '#FF9900' },
  { name: 'pgvector',    status: 'live',     latency: 142, lastSync: '1 sn önce',  color: '#9B7BFF' },
  { name: 'Gemini API',  status: 'live',     latency: 1820,lastSync: '12 sn önce', color: '#4285F4' },
];
const IntegrationGrid = () => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border-faint)' }}>
    {INTEGRATIONS.map(it => {
      const dotColor = it.status === 'live' ? 'var(--acid)' : it.status === 'mock' ? 'var(--fg-3)' : 'var(--amber)';
      return (
        <div key={it.name} style={{ padding: '10px 12px', background: 'var(--bg-1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor }} />
            <span style={{ fontSize: 12, color: 'var(--fg-1)' }}>{it.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
            <span>{it.latency}ms</span>
            <span style={{ color: it.status === 'degraded' ? 'var(--amber)' : 'var(--fg-3)' }}>{it.lastSync}</span>
          </div>
        </div>
      );
    })}
  </div>
);

// ============================================================
// Top-of-page critical alerts (banner row)
// ============================================================
const AlertBanner = () => (
  <div style={{
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: 1,
    background: 'var(--border-faint)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 20,
  }}>
    <div style={{ padding: '12px 16px', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: 26, height: 26, borderRadius: 4,
        background: 'var(--rose-soft)', color: 'var(--rose)',
        display: 'grid', placeItems: 'center', flex: 'none',
      }}>
        <Icon name="alert" size={14} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>Stok tükenme uyarısı</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>OP-CRM-50ML · 12 gün</div>
      </div>
      <button className="btn btn--sm">Reorder</button>
    </div>
    <div style={{ padding: '12px 16px', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: 26, height: 26, borderRadius: 4,
        background: 'var(--amber-soft)', color: 'var(--amber)',
        display: 'grid', placeItems: 'center', flex: 'none',
      }}>
        <Icon name="approvals" size={14} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>5 onay bekliyor</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>1 yüksek risk · 3 orta · 1 düşük</div>
      </div>
      <button className="btn btn--sm">İncele</button>
    </div>
    <div style={{ padding: '12px 16px', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: 26, height: 26, borderRadius: 4,
        background: 'var(--violet-soft)', color: 'var(--violet)',
        display: 'grid', placeItems: 'center', flex: 'none',
      }}>
        <Icon name="sparkles" size={14} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>Otonom karar: kargo değişimi</div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>autonomous_decision_agent · onaya gönderildi</div>
      </div>
      <button className="btn btn--sm">Aç</button>
    </div>
  </div>
);

// ============================================================
// Daily plan card (next-step intelligence)
// ============================================================
const DailyPlan = () => {
  const items = [
    { t: '14:30', label: 'pricing.daily_review',      agent: 'pricing_agent',   status: 'queued' },
    { t: '15:00', label: 'reviews.daily_sweep',       agent: 'review_reputation_agent', status: 'queued' },
    { t: '15:30', label: 'campaign.refresh',          agent: 'marketing_agent', status: 'queued' },
    { t: '16:00', label: 'ops.hourly_sweep',          agent: 'operations_agent',status: 'queued' },
    { t: '18:00', label: 'memory.consolidation',      agent: 'autonomous_decision_agent', status: 'queued' },
  ];
  return (
    <div style={{ padding: '4px 0' }}>
      {items.map(it => {
        const agent = AGENT_BY_ID[it.agent];
        return (
          <div key={it.label} className="row" style={{ gridTemplateColumns: '48px 22px 1fr auto' }}>
            <span className="mono" style={{ color: 'var(--fg-3)', fontSize: 11 }}>{it.t}</span>
            <AgentAvatar agent={agent} size={20} />
            <div>
              <div style={{ fontSize: 12 }}>{it.label}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{agent?.name}</div>
            </div>
            <button className="btn btn--sm btn--ghost">
              <Icon name="play" size={10} /> şimdi
            </button>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// DASHBOARD page
// ============================================================
const DashboardPage = () => {
  const trend = SALES_TREND.map(d => d.sales);
  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> DASHBOARD</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            Dashboard
            <span className="page__title-tag">UPTIME 03:42:18</span>
          </h1>
          <p className="page__sub">
            Sistem genel durumu — KPI'lar, kanal performansı ve canlı ajan aktivitesi. Veri 30 sn'de bir yenilenir.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost">
            <Icon name="refresh" size={12} /> Yenile
          </button>
          <button className="btn">
            <Icon name="flow" size={12} /> Günü Planla
          </button>
          <button className="btn btn--primary">
            <Icon name="zap" size={12} /> Komut Ver
            <span className="btn__kbd">⌘K</span>
          </button>
        </div>
      </div>

      <AlertBanner />

      <div className="grid grid--4" style={{ marginBottom: 20 }}>
        <KpiTile
          label="Bugünkü Satış"
          icon="money"
          value="₺13,620"
          delta="%+12.4"
          deltaDir="up"
          sub="dün ₺12,124"
          trend={trend}
          color="var(--acid)"
        />
        <KpiTile
          label="Siparişler"
          icon="bag"
          value="78"
          delta="%+18"
          deltaDir="up"
          sub="AOV ₺174.6"
          trend={SALES_TREND.map(d => d.orders)}
          color="var(--cyan)"
        />
        <KpiTile
          label="ROAS"
          icon="activity"
          value="4.2x"
          delta="%+7.6"
          deltaDir="up"
          sub="hedef 3.5x"
          trend={SALES_TREND.map(d => d.roas)}
          color="var(--violet)"
        />
        <KpiTile
          label="Dönüşüm"
          icon="growth"
          value="2.84%"
          delta="%-0.3"
          deltaDir="down"
          sub="2 aktif kampanya"
          trend={[2.1, 2.4, 2.2, 2.6, 2.9, 3.1, 2.84]}
          color="var(--amber)"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="panel">
          <div className="panel__head">
            <h3>Satış Trendi</h3>
            <span className="panel__head-tag">SON 7 GÜN</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: 'var(--fg-3)' }} className="mono">
              <span><span style={{ color: 'var(--acid)' }}>●</span> Satış</span>
              <span>Toplam: <span style={{ color: 'var(--fg-1)' }}>₺73,830</span></span>
            </span>
          </div>
          <SalesTrend />
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>Kanal Performansı</h3>
            <span className="panel__head-tag">BUGÜN</span>
          </div>
          <ChannelBars />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="panel">
          <div className="panel__head">
            <h3>Canlı Ajan Aktivitesi</h3>
            <span className="panel__head-tag">REALTIME · hermes.log</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--acid)' }} className="mono">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acid)', boxShadow: '0 0 6px var(--acid)' }} />
              CANLI
            </span>
          </div>
          <LiveAgentFeed />
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>Bugünün Planı</h3>
            <span className="panel__head-tag">SCHEDULER</span>
          </div>
          <DailyPlan />
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h3>Entegrasyonlar</h3>
          <span className="panel__head-tag">12 LIVE · 64 MOCK</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-3)' }} className="mono">
            ortalama gecikme <span style={{ color: 'var(--fg-1)' }}>684ms</span>
          </span>
        </div>
        <div className="panel__body panel__body--flush">
          <IntegrationGrid />
        </div>
      </div>
    </div>
  );
};

window.AOSPages = window.AOSPages || {};
window.AOSPages.Dashboard = DashboardPage;
