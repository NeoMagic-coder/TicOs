// ============================================================
// TicOSClaw — tek konsol navigasyonu + entegrasyon hattı
// Sistem → Ajan → Ürün OS → Envanter → TicOSClaw
// ============================================================
import React, { useMemo } from 'react';
import { Icon } from '@/components/AOS/widgets';
import { HUB_SECTIONS, getSectionForPage } from '@/lib/navigation/hubs';
import { useStore } from '@/stores/useStore';

type ModuleFlowPanelProps = {
  activePage: string;
  navigate: (page: string) => void;
};

export function ModuleFlowPanel({ activePage, navigate }: ModuleFlowPanelProps) {
  const product = useStore((s: any) => s.onboardedProduct);
  const integrationStatus = useStore((s: any) => s.integrationStatus);
  const refreshAllModules = useStore((s: any) => s.refreshAllModules);
  const syncWorkspaceInventory = useStore((s: any) => s.syncWorkspaceInventory);
  const isThinking = useStore((s: any) => s.isThinking);
  const tasks = useStore((s: any) => s.tasks);
  const approvals = useStore((s: any) => s.approvals);
  const agents = useStore((s: any) => s.agents);
  const products = useStore((s: any) => s.products);
  const tools = useStore((s: any) => s.tools);
  const autonomyEnabled = useStore((s: any) => s.autonomyEnabled);
  const autonomyStatus = useStore((s: any) => s.autonomyStatus);
  const setAutonomyEnabled = useStore((s: any) => s.setAutonomyEnabled);

  const section = getSectionForPage(activePage);

  const flows: Array<{ id: string; label: string; page: string; ok: boolean; detail: string }> =
    integrationStatus?.flows || [];

  const runningTasks = tasks.filter((t: any) =>
    ['in_progress', 'assigned', 'waiting_tool_result', 'waiting_human_approval'].includes(t.status),
  ).length;

  const badges = useMemo(() => {
    const pendingApprovals = approvals.filter(
      (a: any) => a.status === 'pending' || a.status === 'estimating',
    ).length;
    return {
      supervisor: 'live',
      graph: runningTasks ? String(runningTasks) : null,
      office: String(agents.length),
      tasks: pendingApprovals ? `alert:${pendingApprovals}` : runningTasks ? String(runningTasks) : null,
      autonomy_console: 'live',
      products: products?.length ? String(products.length) : null,
      tic_products: integrationStatus?.modules?.inventory?.tic_products
        ? String(integrationStatus.modules.inventory.tic_products)
        : null,
      tic_orders: integrationStatus?.modules?.inventory?.tic_orders
        ? String(integrationStatus.modules.inventory.tic_orders)
        : null,
      shopping: 'new',
      tools: tools.length ? String(tools.length) : null,
    } as Record<string, string | null>;
  }, [agents.length, approvals, runningTasks, products, tools.length, integrationStatus]);

  const flowById = Object.fromEntries(flows.map((f) => [f.id, f]));
  const inv = integrationStatus?.modules?.inventory;
  const linked = inv?.link;
  const inventorySynced = linked?.synced === true;
  const schedulerRunning = autonomyStatus?.scheduler?.running === true;
  const jobCount = autonomyStatus?.job_count ?? 0;
  const staleGoals = autonomyStatus?.goal_loop?.stale_count ?? 0;

  const renderBadge = (badge: string | null | undefined) => {
    if (!badge) return null;
    if (badge === 'live') {
      return <span className="tab__pill tab__pill--live mono">LIVE</span>;
    }
    if (badge === 'new') {
      return <span className="tab__pill tab__pill--new mono">NEW</span>;
    }
    const isAlert = badge.startsWith('alert:');
    const val = isAlert ? badge.split(':')[1] : badge;
    return (
      <span className={`tab__pill ${isAlert ? 'tab__pill--alert' : ''} mono`}>
        {val}
      </span>
    );
  };

  const renderModule = (sec: (typeof HUB_SECTIONS)[0]) => {
    const flow = flowById[sec.id];
    const isActive = section.id === sec.id;
    const ok = flow?.ok ?? false;
    return (
      <button
        key={sec.id}
        type="button"
        className={`module-flow__node ${isActive ? 'module-flow__node--active' : ''}`}
        onClick={() => navigate(sec.defaultPage)}
        title={flow?.detail || sec.label}
      >
        <span className={`module-flow__dot ${ok ? 'module-flow__dot--ok' : 'module-flow__dot--warn'}`} />
        <span className="module-flow__label">{sec.label}</span>
      </button>
    );
  };

  return (
    <nav className="module-flow" aria-label="Ana navigasyon">
      <div className="module-flow__row module-flow__row--primary">
        <div className="module-flow__pipeline">
          {HUB_SECTIONS.map((sec) => renderModule(sec))}
        </div>

        <div className="module-flow__actions">
          {isThinking && (
            <span className="module-flow__sync" aria-live="polite">Çalışıyor…</span>
          )}
          {!inventorySynced && product && (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => void syncWorkspaceInventory()}
              title="Ürün OS kaydını envantere bağla"
            >
              Envantere bağla
            </button>
          )}
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => void refreshAllModules()}
            title="Verileri yenile"
            aria-label="Senkronize et"
          >
            <Icon name="refresh" size={12} />
          </button>
        </div>
      </div>

      {section.pages.length > 0 && (
        <div className="module-flow__row module-flow__row--pages">
          <div className="module-flow__section-pages" aria-label={`${section.label} sayfaları`}>
            {section.pages.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`module-flow__page-link ${activePage === p.id ? 'module-flow__page-link--active' : ''}`}
                onClick={() => navigate(p.id)}
              >
                <span>{p.label}</span>
                {renderBadge(badges[p.id])}
              </button>
            ))}
          </div>

          <div className="module-flow__actions module-flow__actions--secondary">
            <button
              type="button"
              className={`module-flow__autonomy ${autonomyEnabled ? 'module-flow__autonomy--on' : ''}`}
              onClick={() => void setAutonomyEnabled(!autonomyEnabled)}
              title={
                autonomyEnabled
                  ? `Otonom mod açık · ${jobCount} zamanlanmış iş`
                  : 'Otonom mod kapalı'
              }
            >
              <span className={`module-flow__autonomy-dot ${autonomyEnabled && schedulerRunning ? 'module-flow__autonomy-dot--live' : ''}`} />
              <span>{autonomyEnabled ? 'Otonom' : 'Manuel'}</span>
              {autonomyEnabled && staleGoals > 0 && (
                <span className="module-flow__stale-goals" title="Bekleyen hedefler">{staleGoals}</span>
              )}
            </button>
            {inventorySynced && linked?.sku && (
              <span className="module-flow__linked" title={`SKU: ${linked.sku}`}>{linked.sku}</span>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export default ModuleFlowPanel;
