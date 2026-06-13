// @ts-nocheck
// ============================================================
// TicOSClaw — birleşik konsol (tüm sayfalar tek kabuk)
// ============================================================
import React from 'react';
import { resolveHubPage } from '@/lib/navigation/hubs';
import ModuleFlowPanel from '@/components/ModuleFlowPanel';

type UnifiedConsolePageProps = {
  pageId: string;
  navigate: (page: string) => void;
  PageComponent: React.ComponentType<any>;
};

const UnifiedConsolePage = ({ pageId, navigate, PageComponent }: UnifiedConsolePageProps) => {
  const activePage = resolveHubPage(pageId);

  return (
    <div className="unified-console">
      <ModuleFlowPanel activePage={activePage} navigate={navigate} />

      <div className="unified-console__body hub-embedded-root">
        <PageComponent navigate={navigate} embedded />
      </div>
    </div>
  );
};

export default UnifiedConsolePage;
