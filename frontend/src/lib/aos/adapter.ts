/**
 * Thin view-model layer: maps Zustand store shapes to the AOS UI contract.
 * Pages import hooks from here instead of duplicating merge logic.
 */
import { useMemo } from 'react';
import { AGENT_BY_ID } from '@/data/aos/mockData';
import { makeTelemetry } from '@/lib/telemetry';
import { useStore } from '@/stores/useStore';
import type { ChatProgressEntry } from '@/stores/useStore';

const CHANNEL_COLORS: Record<string, string> = {
  shopify: '#95BF47',
  trendyol: '#F27A1A',
  hepsiburada: '#FF6000',
  amazon: '#FF9900',
  meta: '#0866FF',
  google: '#4285F4',
};

function mapAgentStatus(
  agentId: string,
  storeStatus: string,
  running: Set<string>,
  completed: Set<string>,
): 'running' | 'busy' | 'idle' {
  if (running.has(agentId)) return 'running';
  if (storeStatus === 'busy') return 'busy';
  if (completed.has(agentId)) return 'idle';
  if (storeStatus === 'active' || storeStatus === 'idle' || storeStatus === 'offline') return 'idle';
  return 'idle';
}

function liveSets(chatProgress: ChatProgressEntry[]) {
  const running = new Set<string>();
  const completed = new Set<string>();
  for (const p of chatProgress) {
    if (p.event === 'agent_started' && p.agent_id) running.add(p.agent_id);
    if (p.event === 'agent_completed' && p.agent_id) {
      running.delete(p.agent_id);
      completed.add(p.agent_id);
    }
    if (p.event === 'agent_failed' && p.agent_id) running.delete(p.agent_id);
  }
  return { running, completed };
}

export function useStorePage(): [string, (page: string) => void] {
  const page = useStore((s) => s.currentPage);
  const setPage = useStore((s) => s.setCurrentPage);
  return [page, setPage];
}

export function useOnboardingGate(): boolean {
  return useStore((s) => !s.onboardingComplete || s.currentPage === 'onboarding');
}

export function useAdaptedAgents() {
  const agents = useStore((s) => s.agents);
  const tools = useStore((s) => s.tools);
  const chatProgress = useStore((s) => s.chatProgress);

  return useMemo(() => {
    const { running, completed } = liveSets(chatProgress);
    const liveToolCount = tools.filter((t) => t.mode === 'live').length;
    const mockToolCount = tools.length - liveToolCount;

    return agents.map((a) => {
      const meta = AGENT_BY_ID[a.agent_id] || {
        name: a.name,
        role: a.role,
        glyph: a.icon?.slice(0, 2)?.toUpperCase() || '??',
        accent: a.color,
        layer: 'core',
      };
      const lastProgress = [...chatProgress].reverse().find((p) => p.agent_id === a.agent_id);
      const loadPct =
        a.max_concurrent_tasks > 0
          ? Math.min(100, (running.has(a.agent_id) ? 1 : 0) * (100 / a.max_concurrent_tasks))
          : null;

      return {
        id: a.agent_id,
        pid: a.agent_id.replace(/_agent$/, '').slice(0, 6),
        name: meta.name || a.name,
        role: meta.role || a.role,
        glyph: meta.glyph,
        accent: meta.accent || a.color,
        layer: meta.layer,
        status: mapAgentStatus(a.agent_id, a.status, running, completed),
        conf: a.stats.avg_confidence || null,
        tasks: a.stats.tasks_total || null,
        load: loadPct,
        tools: a.allowed_tools?.length ?? 0,
        tools_live: tools.length ? liveToolCount : null,
        tools_mock: tools.length ? mockToolCount : null,
        lastTool: lastProgress?.tool_id || null,
      };
    });
  }, [agents, tools, chatProgress]);
}

export function useAdaptedDashboard() {
  const dashboard = useStore((s) => s.dashboard);
  return useMemo(() => {
    const d = dashboard;
    const source = d?._source === 'demo' ? 'demo' : d?._source === 'backend' ? 'backend' : 'derived';
    const measuredAt = d?._measured_at ?? null;
    const salesTrend = d?.sales_trend || [];
    const ordersTrend = d?.orders_trend || [];
    const roasTrend = d?.roas_trend || [];

    return {
      isDemo: Boolean(d?._isDemo),
      kpis: {
        sales: d?.today_sales ?? 0,
        orders: d?.today_orders ?? 0,
        roas: d?.today_roas ?? 0,
        conversion: d?.conversion_rate ?? 0,
        salesTrendNums: salesTrend.map((x) => x.value),
        salesTrendLabels: salesTrend.map((x) => x.date),
        ordersTrendNums: ordersTrend,
        roasTrendNums: roasTrend,
      },
      kpisT: {
        sales: makeTelemetry(d?.today_sales, source, { measured_at: measuredAt }),
        orders: makeTelemetry(d?.today_orders, source, { measured_at: measuredAt }),
        roas: makeTelemetry(d?.today_roas, source, { measured_at: measuredAt }),
        conversion: makeTelemetry(d?.conversion_rate, source, { measured_at: measuredAt }),
      },
      channels: (d?.channel_performance || []).map((c) => ({
        name: c.channel,
        sales: c.sales,
        orders: c.orders,
        color: CHANNEL_COLORS[c.channel.toLowerCase()] || '#9B7BFF',
      })),
    };
  }, [dashboard]);
}

export function useAdaptedTools() {
  const tools = useStore((s) => s.tools);
  return useMemo(
    () =>
      tools.map((t) => {
        const stats = t.stats;
        const success =
          stats && stats.total_calls > 0
            ? (stats.successful_calls / stats.total_calls) * 100
            : null;
        return {
          id: t.tool_id,
          name: t.name,
          category: t.category,
          provider: t.provider,
          mode: t.mode,
          calls: stats?.total_calls ?? null,
          ms: stats?.avg_duration_ms ?? null,
          success,
          degraded: Boolean((stats as Record<string, unknown> | undefined)?.degraded),
          degradedReason: (stats as Record<string, unknown> | undefined)?.degraded_reason as string | undefined,
        };
      }),
    [tools],
  );
}

export function useAdaptedApprovals() {
  const approvals = useStore((s) => s.approvals);
  return useMemo(
    () =>
      approvals.map((a: Record<string, unknown>) => {
        const risk = (a.risk_level || a.risk || 'medium') as string;
        const confidence = typeof a.confidence === 'number' ? a.confidence : 0.85;
        return {
          id: String(a.id),
          status: a.status,
          type: String(a.kind || a.type || 'genel'),
          title: String(a.title || a.action || a.description || 'Onay'),
          requester: String(a.agent_id || a.requester || 'supervisor'),
          risk,
          confidence,
          delta: String(a.change_summary || a.delta || a.expected_impact || '—'),
          rationale: String(a.rationale || a.description || ''),
          createdAt: String(a.created_at || ''),
          tools: Array.isArray(a.tools_used) ? a.tools_used : Array.isArray(a.tools) ? a.tools : [],
          impact: (a.impact as Record<string, unknown>) || {
            revenue: a.expected_impact || '—',
            margin: '—',
            risk: risk,
          },
          policy: (a.policy as Record<string, unknown>) || {
            auto_threshold: 'medium',
            this_action: risk,
            breach: risk === 'high' || risk === 'critical',
          },
        };
      }),
    [approvals],
  );
}

export function useAdaptedAuditLog(limit = 500) {
  const auditLogs = useStore((s) => s.auditLogs);
  return useMemo(
    () =>
      auditLogs.slice(0, limit).map((log) => {
        const md = log.metadata || {};
        const levelRaw = (md.level as string) || 'info';
        const level =
          levelRaw === 'warning'
            ? 'warn'
            : levelRaw === 'error' || levelRaw === 'critical'
              ? 'err'
              : levelRaw === 'success'
                ? 'ok'
                : levelRaw;
        return {
          _key: log.id,
          ts: new Date(log.timestamp).toLocaleTimeString('tr-TR', { hour12: false }),
          event: log.action,
          agent: log.actor_id,
          level,
          msg: log.details,
        };
      }),
    [auditLogs, limit],
  );
}

export function useBrandIdentity() {
  return useStore((s) => s.brandIdentity);
}

export function useAdaptedPricingSkus() {
  const econ = useStore((s) => s.productEconomics);
  return useMemo(() => {
    if (!econ?.rows?.length) return [];
    return econ.rows.map((row, i) => {
      const price = row.price || 0;
      const cost = row.cost || 0;
      const margin = price > 0 ? (price - cost) / price : 0;
      const spread = Math.max(20, price * 0.08);
      return {
        sku: `${row.marketplace}-${i + 1}`.toLowerCase(),
        name: row.title,
        marketplace: row.marketplace,
        price,
        cost,
        margin,
        sales_30d: row.sales_30d || 0,
        suggested: price,
        suggested_source: 'heuristic' as const,
        competitors: {
          min: Math.max(0, price - spread),
          max: price + spread,
          avg: price,
        },
        competitors_source: 'estimated' as const,
      };
    });
  }, [econ]);
}

export function useAdaptedExperiments() {
  const experiments = useStore((s) => s.experiments);
  return useMemo(
    () =>
      experiments.map((e) => ({
        ...e,
        agent: 'growth_agent',
        status:
          e.status === 'idea'
            ? 'planned'
            : e.status === 'won'
              ? 'shipped'
              : e.status === 'lost'
                ? 'killed'
                : e.status === 'inconclusive'
                  ? 'analyzing'
                  : e.status,
      })),
    [experiments],
  );
}

type GraphNode = {
  id: string;
  agent: string;
  title: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  col: number;
  row: number;
  ms?: number;
  handoffFrom?: string;
};

function buildTaskGraph(chatProgress: ChatProgressEntry[]) {
  if (!chatProgress.length) return null;

  const nodes = new Map<string, GraphNode>();
  let primary: string | null = null;
  const supporting: string[] = [];
  let taskId = '—';
  let taskTitle = 'Aktif görev';
  let totalToolCalls = 0;
  let totalCostUsd = 0;

  const ensureNode = (id: string, agent: string, title: string, col: number, row: number) => {
    if (!nodes.has(id)) {
      nodes.set(id, { id, agent, title, status: 'queued', col, row });
    }
    return nodes.get(id)!;
  };

  for (const p of chatProgress) {
    if (p.task_id) taskId = p.task_id;
    if (p.event === 'task_started') taskTitle = p.label || taskTitle;
    if (p.event === 'plan_ready') {
      primary = (p.primary as string) || primary;
      if (Array.isArray(p.supporting)) supporting.push(...p.supporting);
      if (Array.isArray(p.nodes)) {
        p.nodes.forEach((n, idx) => {
          ensureNode(n.id, n.agent_id, n.title, idx % 5, Math.floor(idx / 5));
        });
      }
    }
    if (p.event === 'node_injected' && p.agent_id) {
      const id = p.node_id || `inj_${p.agent_id}_${nodes.size}`;
      ensureNode(id, p.agent_id, p.title || p.agent_id, nodes.size % 5, Math.floor(nodes.size / 5));
      if (p.from_agent) {
        const from = [...nodes.values()].find((n) => n.agent === p.from_agent);
        if (from) ensureNode(id, p.agent_id, p.title || p.agent_id, from.col + 1, from.row).handoffFrom = from.agent;
      }
    }
    if (p.event === 'tool_called') totalToolCalls += 1;
    if (typeof p.cost_usd === 'number') totalCostUsd += p.cost_usd;

    const agentId = p.agent_id;
    if (!agentId) continue;
    const nodeId = p.node_id || agentId;
    const col = primary === agentId ? 0 : supporting.indexOf(agentId) >= 0 ? 1 + supporting.indexOf(agentId) : 2;
    const row = primary === agentId ? 1 : 0;
    const node = ensureNode(nodeId, agentId, p.title || AGENT_BY_ID[agentId]?.name || agentId, col, row);
    if (p.event === 'agent_started') node.status = 'running';
    if (p.event === 'agent_completed') {
      node.status = 'done';
      if (typeof p.confidence === 'number') node.ms = Math.round(p.confidence * 1000);
    }
    if (p.event === 'agent_failed') node.status = 'failed';
  }

  if (primary) ensureNode(primary, primary, AGENT_BY_ID[primary]?.name || primary, 0, 1);
  supporting.forEach((aid, idx) => ensureNode(aid, aid, AGENT_BY_ID[aid]?.name || aid, 1 + (idx % 4), idx < 2 ? 0 : 2));

  const nodeList = [...nodes.values()];
  if (!nodeList.length) return null;

  const edges: { from: string; to: string }[] = [];
  if (primary) {
    for (const n of nodeList) {
      if (n.agent !== primary && !n.handoffFrom) edges.push({ from: primary, to: n.id });
    }
  }

  return {
    task_id: taskId,
    task: taskTitle,
    goal: taskTitle,
    startedAt: new Date(chatProgress[0]?.ts || Date.now()).toLocaleTimeString('tr-TR', { hour12: false }),
    nodes: nodeList,
    edges,
    totalToolCalls,
    totalCostUsd,
    linkedTask: taskId !== '—' ? taskId : null,
  };
}

export function useAdaptedTaskGraph() {
  const chatProgress = useStore((s) => s.chatProgress);
  return useMemo(() => buildTaskGraph(chatProgress), [chatProgress]);
}

export const storeActions = {
  sendMessage: (text: string) => useStore.getState().sendUserMessage(text),
  sendMessageStream: (text: string) => useStore.getState().sendUserMessageStream(text),
  approveItem: (id: string, note?: string) => useStore.getState().approveItem(id, note),
  rejectItem: (id: string, note: string) => useStore.getState().rejectItem(id, note),
};
