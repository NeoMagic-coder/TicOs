// Sade üst navigasyon — 3 sekme, alt menü yalnızca Mağaza'da.
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Icon } from '@/components/AOS/widgets';
import {
  HUB_SECTIONS,
  ADVANCED_PAGES,
  getSectionForPage,
  isAdvancedPage,
  sectionHasSubNav,
} from '@/lib/navigation/hubs';
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
  const approvals = useStore((s: any) => s.approvals);

  const section = getSectionForPage(activePage);
  const advancedActive = isAdvancedPage(activePage);
  const showSubNav = sectionHasSubNav(section.id) && !advancedActive;
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [moreOpen]);

  const inv = integrationStatus?.modules?.inventory;
  const inventorySynced = inv?.link?.synced === true;

  const pendingApprovals = approvals.filter(
    (a: any) => a.status === 'pending' || a.status === 'estimating',
  ).length;

  const badges = useMemo(
    () =>
      ({
        tic_orders: null,
        commerce_control: null,
      }) as Record<string, string | null>,
    [],
  );

  return (
    <nav className="module-flow module-flow--simple" aria-label="Ana menü">
      <div className="module-flow__row module-flow__row--primary">
        <div className="module-flow__sections" role="tablist">
          {HUB_SECTIONS.map((sec) => {
            const isActive = section.id === sec.id && !advancedActive;
            return (
              <button
                key={sec.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`module-flow__section-tab ${isActive ? 'module-flow__section-tab--active' : ''}`}
                onClick={() => navigate(sec.defaultPage)}
              >
                {sec.label}
              </button>
            );
          })}

          <div className="module-flow__more module-flow__more--inline" ref={moreRef}>
            <button
              type="button"
              className={`module-flow__section-tab module-flow__section-tab--more ${advancedActive ? 'module-flow__section-tab--active' : ''}`}
              onClick={() => setMoreOpen((o) => !o)}
              aria-expanded={moreOpen}
            >
              Diğer
              {pendingApprovals > 0 && (
                <span className="tab__pill tab__pill--alert mono">{pendingApprovals}</span>
              )}
            </button>
            {moreOpen && (
              <div className="module-flow__more-menu" role="menu">
                {ADVANCED_PAGES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    role="menuitem"
                    className={`module-flow__more-item ${activePage === p.id ? 'module-flow__more-item--active' : ''}`}
                    onClick={() => { navigate(p.id); setMoreOpen(false); }}
                  >
                    <Icon name={p.icon} size={13} />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="module-flow__actions">
          {!inventorySynced && product && (
            <button
              type="button"
              className="btn btn--sm btn--primary"
              onClick={() => void syncWorkspaceInventory()}
            >
              Envantere bağla
            </button>
          )}
          <button
            type="button"
            className="btn btn--sm btn--ghost"
            onClick={() => void refreshAllModules()}
            aria-label="Yenile"
            title="Yenile"
          >
            <Icon name="refresh" size={12} />
          </button>
        </div>
      </div>

      {showSubNav && (
        <div className="module-flow__row module-flow__row--pages">
          <div className="module-flow__section-pages">
            {section.pages.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`module-flow__page-link ${activePage === p.id ? 'module-flow__page-link--active' : ''}`}
                onClick={() => navigate(p.id)}
              >
                <Icon name={p.icon} size={13} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

export default ModuleFlowPanel;
