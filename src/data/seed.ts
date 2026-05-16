import type { Task, Approval, KnowledgeDocument, ChatMessage, DashboardSummary, AuditLog, Integration, OnboardedProduct } from '@/types';

// All seed lists are intentionally empty. Real data arrives only after a
// product is onboarded and the agents/integrations populate it. This keeps
// the dashboard, tasks, approvals, knowledge, audit, integrations and chat
// from showing data that has nothing to do with the active product.

export const seedTasks: Task[] = [];
export const seedApprovals: Approval[] = [];
export const seedKnowledge: KnowledgeDocument[] = [];
export const seedAuditLogs: AuditLog[] = [];
export const seedIntegrations: Integration[] = [];
export const seedChatHistory: ChatMessage[] = [];

/** Build a fresh-onboard dashboard tied to the active product.
 *  All numeric metrics start at zero — agents/integrations fill them as
 *  real data flows in. The structure (channels, agent slots, 7-day grid)
 *  is derived from the product so the UI has something to render. */
export function makeDashboardForProduct(product: OnboardedProduct | null): DashboardSummary {
  const channels = product?.channels?.length ? product.channels : ['Shopify'];
  const today = new Date();
  const dateLabel = (offset: number) =>
    new Date(today.getTime() - offset * 86400000).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
    });

  return {
    today_sales: 0,
    today_orders: 0,
    today_roas: 0,
    avg_order_value: 0,
    conversion_rate: 0,
    active_campaigns: 0,
    pending_approvals: 0,
    active_tasks: 0,
    critical_alerts: [],
    recent_tasks: [],
    agent_activity: [],
    sales_trend: Array.from({ length: 7 }, (_, i) => ({
      date: dateLabel(6 - i),
      value: 0,
    })),
    channel_performance: channels.map((channel) => ({
      channel,
      sales: 0,
      orders: 0,
    })),
  };
}
