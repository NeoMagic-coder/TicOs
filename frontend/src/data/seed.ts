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
 *  real data flows in. The structure (channels + 7-day grid skeleton) is
 *  derived from the product so the UI has something to render. */
export function makeDashboardForProduct(product: OnboardedProduct | null): DashboardSummary {
  const channels = product?.channels?.length ? product.channels : ['Shopify'];
  const today = new Date();
  const dateLabel = (offset: number) =>
    new Date(today.getTime() - offset * 86400000).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
    });

  const sales_trend = Array.from({ length: 7 }, (_, i) => ({ date: dateLabel(6 - i), value: 0 }));
  const orders_trend = Array.from({ length: 7 }, () => 0);
  const roas_trend = Array.from({ length: 7 }, () => 0);
  const channel_performance = channels.map((channel) => ({ channel, sales: 0, orders: 0 }));

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
    sales_trend,
    orders_trend,
    roas_trend,
    channel_performance,
  };
}

/** Same shape as the zero dashboard but pre-filled with deterministic demo
 *  numbers. Used by `loadDemoFixtures` so the UI is evaluable when the backend
 *  is offline or no real data is flowing. Stage modulates the base scale. */
export function makeDemoDashboardForProduct(product: OnboardedProduct | null): DashboardSummary {
  const channels = product?.channels?.length ? product.channels : ['Shopify'];
  const today = new Date();
  const dateLabel = (offset: number) =>
    new Date(today.getTime() - offset * 86400000).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: 'short',
    });

  const stageScale: Record<string, number> = {
    idea: 0.3, prototype: 0.5, launched: 1.0, scaling: 2.0,
  };
  const scale = stageScale[product?.stage || 'launched'] || 1.0;
  const salesShape = [0.62, 0.71, 0.68, 0.83, 0.95, 0.79, 1.00];
  const baseSales = Math.round(8200 * scale);
  const aov = 174;
  const sales_trend = salesShape.map((m, i) => ({
    date: dateLabel(6 - i),
    value: Math.round(baseSales * m),
  }));
  const orders_trend = sales_trend.map((p) => Math.round(p.value / aov));
  const roas_trend = [2.6, 2.9, 2.8, 3.1, 3.5, 3.2, 3.4];
  const today_sales = sales_trend[sales_trend.length - 1].value;
  const today_orders = orders_trend[orders_trend.length - 1];
  const today_roas = roas_trend[roas_trend.length - 1];

  const weights = channels.map((_, i) => [0.46, 0.28, 0.18, 0.08][i] ?? 0.04);
  const wsum = weights.reduce((a, b) => a + b, 0) || 1;
  const channel_performance = channels.map((channel, i) => {
    const share = weights[i] / wsum;
    const sales = i === channels.length - 1
      ? today_sales - channels.slice(0, -1).reduce((s, _c, j) => s + Math.round(today_sales * (weights[j] / wsum)), 0)
      : Math.round(today_sales * share);
    const orders = i === channels.length - 1
      ? today_orders - channels.slice(0, -1).reduce((s, _c, j) => s + Math.round(today_orders * (weights[j] / wsum)), 0)
      : Math.round(today_orders * share);
    return { channel, sales: Math.max(0, sales), orders: Math.max(0, orders) };
  });

  return {
    today_sales,
    today_orders,
    today_roas,
    avg_order_value: aov,
    conversion_rate: 0.028,
    active_campaigns: 4,
    pending_approvals: 3,
    active_tasks: 5,
    critical_alerts: [],
    recent_tasks: [],
    agent_activity: [],
    sales_trend,
    orders_trend,
    roas_trend,
    channel_performance,
  };
}
