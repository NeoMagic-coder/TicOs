// @ts-nocheck
import React from 'react';
import { resolveHubPage, isAdvancedPage } from '@/lib/navigation/hubs';
import { EASY_MODE } from '@/lib/easyMode';
import ModuleFlowPanel from '@/components/ModuleFlowPanel';
import { EasyNav } from '@/components/EasyNav';
import { Icon } from '@/components/AOS/widgets';

type UnifiedConsolePageProps = {
  pageId: string;
  navigate: (page: string) => void;
  PageComponent: React.ComponentType<any>;
};

const UnifiedConsolePage = ({ pageId, navigate, PageComponent }: UnifiedConsolePageProps) => {
  const activePage = resolveHubPage(pageId);
  const showEasyBack =
    EASY_MODE && isAdvancedPage(activePage) && activePage !== 'dashboard';

  return (
    <div className={`unified-console ${EASY_MODE ? 'unified-console--easy' : ''}`}>
      {!EASY_MODE && <ModuleFlowPanel activePage={activePage} navigate={navigate} />}

      {showEasyBack && (
        <div className="easy-advanced-back">
          <button type="button" className="easy-page__back" onClick={() => navigate('dashboard')}>
            <Icon name="chevleft" size={14} />
            Ana sayfaya dön
          </button>
        </div>
      )}

      <div className="unified-console__body hub-embedded-root">
        <PageComponent navigate={navigate} embedded isHome={activePage === 'dashboard'} />
      </div>

      {EASY_MODE && <EasyNav activePage={activePage} navigate={navigate} />}
    </div>
  );
};

export default UnifiedConsolePage;
