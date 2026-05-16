import { useStore } from '@/stores/useStore';
import { Layout } from '@/components/Layout';
import { DashboardPage } from '@/pages/DashboardPage';
import { AgentsPage } from '@/pages/AgentsPage';
import { TasksPage } from '@/pages/TasksPage';
import { ApprovalsPage } from '@/pages/ApprovalsPage';
import { ToolsPage } from '@/pages/ToolsPage';
import { ChatPage } from '@/pages/ChatPage';
import { KnowledgePage } from '@/pages/KnowledgePage';
import { AnalyticsPage } from '@/pages/AnalyticsPage';
import { IntegrationsPage } from '@/pages/IntegrationsPage';
import { AuditPage } from '@/pages/AuditPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { GrowthPage } from '@/pages/GrowthPage';
import { ReviewsPage } from '@/pages/ReviewsPage';
import { InfluencersPage } from '@/pages/InfluencersPage';
import { BrandPage } from '@/pages/BrandPage';
import { EmailFlowsPage } from '@/pages/EmailFlowsPage';
import { PricingPage } from '@/pages/PricingPage';
import { AutonomyPage } from '@/pages/AutonomyPage';

function PageRouter() {
  const currentPage = useStore((s) => s.currentPage);

  switch (currentPage) {
    case 'dashboard': return <DashboardPage />;
    case 'brand': return <BrandPage />;
    case 'pricing': return <PricingPage />;
    case 'growth': return <GrowthPage />;
    case 'reviews': return <ReviewsPage />;
    case 'influencers': return <InfluencersPage />;
    case 'email_flows': return <EmailFlowsPage />;
    case 'autonomy': return <AutonomyPage />;
    case 'agents': return <AgentsPage />;
    case 'tasks': return <TasksPage />;
    case 'approvals': return <ApprovalsPage />;
    case 'tools': return <ToolsPage />;
    case 'chat': return <ChatPage />;
    case 'knowledge': return <KnowledgePage />;
    case 'analytics': return <AnalyticsPage />;
    case 'integrations': return <IntegrationsPage />;
    case 'audit': return <AuditPage />;
    case 'settings': return <SettingsPage />;
    default: return <DashboardPage />;
  }
}

export default function App() {
  const onboardingComplete = useStore((s) => s.onboardingComplete);
  const currentPage = useStore((s) => s.currentPage);

  if (!onboardingComplete || currentPage === 'onboarding') {
    return <OnboardingPage />;
  }

  return (
    <Layout>
      <PageRouter />
    </Layout>
  );
}
