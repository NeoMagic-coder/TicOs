import type { RecommendedAction } from '@/types';
import { AUTO_EXECUTE_ACTIONS } from '@/lib/easyMode';

export type ActionRunResult = {
  executed: string[];
  skipped: string[];
  queued: string[];
};

export const SUPERVISOR_INTENTS = new Set([
  'navigate',
  'approve_all',
  'reject_all',
  'regenerate_brand',
  'regenerate_pricing',
  'sync_all_integrations',
  'sync_integration',
  'autonomy_sweep',
  'goal_loop_tick',
  'publish_all_flows',
  'launch_all_experiments',
  'launch_experiment',
  'approve_one',
  'draft_review_responses',
  'contact_influencers',
  'set_wallpaper',
  'clear_wallpaper',
  'reset_all',
  'toggle_debug',
]);

/** Asistan metnindeki madde işaretli satırları aksiyon metnine çevir. */
export function extractActionLines(content: string): string[] {
  if (!content) return [];
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[-•*⚠️]|\d+\./.test(l))
    .map((l) => l.replace(/^[-•*⚠️]+\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter((l) => l.length > 4);
}

export function shouldAutoRun(
  rec: RecommendedAction,
  autonomyEnabled: boolean,
): boolean {
  if (!AUTO_EXECUTE_ACTIONS && !autonomyEnabled) return false;
  if (!rec.requires_approval) return true;
  return rec.risk_level === 'low';
}

export function formatRunSummary(result: ActionRunResult): string {
  const parts: string[] = [];
  if (result.executed.length) {
    parts.push(`**Yapılan (${result.executed.length}):**\n${result.executed.map((x) => `• ${x}`).join('\n')}`);
  }
  if (result.queued.length) {
    parts.push(`**Onay bekliyor (${result.queued.length}):**\n${result.queued.map((x) => `• ${x}`).join('\n')}`);
  }
  return parts.join('\n\n');
}
