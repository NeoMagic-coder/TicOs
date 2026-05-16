// Cross-page selectors. Anything the chat assistant produces is already in
// `chatMessages` (agent-attributed). Module pages should read from the same
// source so a user can ask "marka ismi öner" in chat and see it on /brand.
import type { AppState } from './useStore';
import type { ChatMessage } from '@/types';

export const selectLastAgentMessage = (agentId: string) => (s: AppState): ChatMessage | undefined => {
  for (let i = s.chatMessages.length - 1; i >= 0; i--) {
    const m = s.chatMessages[i];
    if (m.role === 'assistant' && m.agent_id === agentId) return m;
  }
  return undefined;
};

// ─── Real, formula-based health/reputation/growth scores ───

/** Operational health: combines pending approvals, active alerts and onboarding
 *  completion into a 0-100 score. Pure function over store state. */
export const selectHealthScore = (s: AppState): number => {
  let score = 100;
  const pending = s.approvals.filter((a) => a.status === 'pending').length;
  score -= Math.min(40, pending * 5);                       // -5/onay, max -40
  const critical = (s.dashboard?.critical_alerts || []).length;
  score -= Math.min(30, critical * 10);                     // -10/uyarı, max -30
  if (!s.onboardingComplete) score -= 20;
  return Math.max(0, Math.round(score));
};

/** Reputation score: mean of review ratings on 0-100 scale; 0 when no reviews. */
export const selectReputationScore = (s: AppState): number => {
  if (!s.reviews.length) return 0;
  const sum = s.reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
  const avg = sum / s.reviews.length;                       // 0-5
  return Math.round((avg / 5) * 100);
};

/** Growth score: launched/won experiments × actual uplift, capped at 100. */
export const selectGrowthScore = (s: AppState): number => {
  if (!s.experiments.length) return 0;
  const counted = s.experiments.filter((e) => e.status === 'running' || e.status === 'won');
  if (!counted.length) return 0;
  const liftSum = counted.reduce((acc, e) => acc + (e.uplift_pct ?? 0), 0);
  return Math.min(100, Math.round(liftSum * 2));
};

/** Real revenue total from the sales trend series, 0 if no data. */
export const selectRevenueTotal = (s: AppState): number => {
  const trend = s.dashboard?.sales_trend || [];
  return trend.reduce((acc, p) => acc + (p.value || 0), 0);
};

export const selectOrdersTotal = (s: AppState): number => s.dashboard?.today_orders ?? 0;
export const selectActiveCampaigns = (s: AppState): number => s.dashboard?.active_campaigns ?? 0;

/** Single source of truth for pending approvals — Sidebar and ApprovalsPage
 *  both read this to keep their counts in sync. */
export const selectPendingApprovals = (s: AppState) =>
  s.approvals.filter((a) => a.status === 'pending');

export const selectPendingApprovalCount = (s: AppState): number =>
  selectPendingApprovals(s).length;

/** Live vs mock tool counts for the demo-mode badge. */
export const selectLiveToolCount = (s: AppState): number =>
  s.tools.filter((t) => t.mode === 'live').length;

export const selectMockToolCount = (s: AppState): number =>
  s.tools.filter((t) => t.mode !== 'live').length;
