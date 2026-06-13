import type { AppState } from './useStore';

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

/** Failed task count — surfaced as a Sidebar badge on "Görevler". */
export const selectFailedTaskCount = (s: AppState): number =>
  (s.tasks || []).filter((t: any) => t.status === 'failed' || t.status === 'FAILED').length;
