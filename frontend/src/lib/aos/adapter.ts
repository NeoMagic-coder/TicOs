/**
 * Zustand store → AOS UI adapters.
 * Thin hooks that shape backend/store data for display components.
 */
import { useMemo } from 'react';
import { AGENT_BY_ID } from '@/data/aos/mockData';
import { telemetry, type Telemetry } from '@/lib/telemetry';
import { useStore } from '@/stores/useStore';
import type { ChatProgressEntry } from '@/stores/useStore';
import type { AgentSpec, Approval, AuditLog, ToolManifest } from '@/types';

// ─── Routing / onboarding ───────────────────────────────────────────────────

export function useStorePage(): [string, (page: string) => void] {
  const page = useStore((s) => s.currentPage);
  const setPage = useStore((s) => s.setCurrentPage);
  return [page, setPage];
}

export function useOnboardingGate(): boolean {
  const complete = useStore((s) => s.onboardingComplete);
  const product = useStore((s) => s.onboardedProduct);
  return !complete || !product;
}

// ─── Agents ─────────────────────────────────────────────────────────────────

type AdaptedAgent = {
  id: string;
  name: string;
  role: string;
  glyph: string;
  accent: string;
  layer: string;
  status: string;
  pid: string;
  conf: number | null;
  tasks: number | null;
  load: number | null;
  tools: number;
  tools_live?: number;
  tools_mock?: number;
};

function mapAgentStatus(spec: AgentSpec): string {
  if (spec.status === 'busy') return 'busy';
  if (spec.status === 'active') return 'running';
  if (spec.status === 'offline') return 'idle';
  return 'idle';
}

export function useAdaptedAgents(): AdaptedAgent[] {
  const agents = useStore((s) => s.agents);
  const tools = useStore((s) => s.tools);
  const tasks = useStore((s) => s.tasks);

  return useMemo(() => {
    const liveTools = tools.filter((t) => t.mode === 'live').length;
    const mockTools = tools.length - liveTools;
    return agents.map((a) => {
      const meta = AGENT_BY_ID[a.agent_id] || {
        name: a.name,
        role: a.role,
        glyph: a.icon?.slice(0, 2)?.toUpperCase() || 'AG',
        accent: a.color || '#7C8497',
        layer: 'core',
      };
      const agentTasks = tasks.filter((t) => t.assigned_agent_id === a.agent_id).length;
      return {
        id: a.agent_id,
        name: meta.name || a.name,
        role: meta.role || a.role,
        glyph: meta.glyph,
        accent: meta.accent || a.color,
        layer: meta.layer || 'core',
        status: mapAgentStatus(a),
        pid: `0x${a.agent_id.slice(0, 4)}`,
        conf: a.stats?.avg_confidence ?? null,
        tasks: agentTasks || a.stats?.tasks_total || null,
        load: a.stats?.success_rate != null ? a.stats.success_rate * 100 : null,
        tools: a.allowed_tools?.length ?? tools.length,
        tools_live: liveTools,
        tools_mock: mockTools,
      };
    });
  }, [agents, tools, tasks]);
}

// ─── Dashboard ──────────────────────────────────────────────────────────────

export function useAdaptedDashboard() {
  const dashboard = useStore((s) => s.dashboard) as Record<string, unknown> | null;

  return useMemo(() => {
    const d = dashboard || {};
    const isDemo = Boolean(d._isDemo);
    const source = isDemo ? 'heuristic' : d._source === 'backend' ? 'backend' : 'derived';
    const measuredAt = (d._measured_at as string | null) ?? null;
    const salesTrend = (d.sales_trend as number[]) || [];
    const ordersTrend = (d.orders_trend as number[]) || [];
    const roasTrend = (d.roas_trend as number[]) || [];
    const dayLabels = salesTrend.map((_, i) => {
      const dt = new Date();
      dt.setDate(dt.getDate() - (salesTrend.length - 1 - i));
      return dt.toLocaleDateString('tr-TR', { weekday: 'short' });
    });

    const mk = (v: unknown): Telemetry<number> =>
      telemetry(typeof v === 'number' ? v : null, source as 'backend' | 'derived' | 'heuristic', measuredAt);

    return {
      isDemo,
      kpis: {
        sales: Number(d.today_sales) || 0,
        orders: Number(d.today_orders) || 0,
        roas: Number(d.today_roas) || 0,
        conversion: Number(d.conversion_rate) || 0,
        salesTrendNums: salesTrend,
        salesTrendLabels: dayLabels,
        ordersTrendNums: ordersTrend,
        roasTrendNums: roasTrend,
      },
      kpisT: {
        sales: mk(d.today_sales),
        orders: mk(d.today_orders),
        roas: mk(d.today_roas),
        conversion: mk(d.conversion_rate),
      },
    };
  }, [dashboard]);
}

// ─── Pricing SKUs ───────────────────────────────────────────────────────────

export function useAdaptedPricingSkus() {
  const econ = useStore((s) => s.productEconomics);
  return useMemo(() => {
    if (!econ?.rows?.length) return [];
    return econ.rows.map((row, i) => ({
      sku: `sku_${i + 1}`,
      name: row.title,
      price: row.price,
      cost: row.cost,
      suggested: row.price,
      margin: row.price > 0 ? ((row.price - row.cost) / row.price) * 100 : 0,
      marketplace: row.marketplace,
      sales_30d: row.sales_30d,
      competitors_source: 'unknown' as const,
      suggested_source: 'unknown' as const,
      competitors: [] as unknown[],
    }));
  }, [econ]);
}

// ─── Experiments ────────────────────────────────────────────────────────────

export function useAdaptedExperiments() {
  return useStore((s) => s.experiments);
}

// ─── Tools ──────────────────────────────────────────────────────────────────

export function useAdaptedTools() {
  const tools = useStore((s) => s.tools);
  return useMemo(
    () =>
      tools.map((t: ToolManifest) => ({
        id: t.tool_id,
        name: t.name,
        category: t.category,
        provider: t.provider,
        mode: t.mode,
        degraded: Boolean((t as { degraded?: boolean }).degraded),
        degradedReason: (t as { degraded_reason?: string }).degraded_reason,
        calls: t.stats?.call_count ?? null,
        ms: t.stats?.avg_duration_ms ?? null,
        success: t.stats?.success_rate != null ? t.stats.success_rate * 100 : null,
        allowed_agents: t.allowed_agents,
        description: t.description,
      })),
    [tools],
  );
}

// ─── Brand ──────────────────────────────────────────────────────────────────

export function useBrandIdentity() {
  return useStore((s) => s.brandIdentity);
}

// ─── Audit log ──────────────────────────────────────────────────────────────

function auditLevel(action: string): 'info' | 'ok' | 'warn' | 'err' {
  if (/error|fail|denied|reject/i.test(action)) return 'err';
  if (/warn|escalat|retry/i.test(action)) return 'warn';
  if (/complete|approve|success|ok/i.test(action)) return 'ok';
  return 'info';
}

export function useAdaptedAuditLog(limit = 500) {
  const logs = useStore((s) => s.auditLogs);
  return useMemo(
    () =>
      logs.slice(-limit).map((log: AuditLog) => ({
        id: log.id,
        ts: log.timestamp,
        timestamp: log.timestamp,
        event: log.action,
        msg: log.details,
        agent: log.actor_id,
        actor_id: log.actor_id,
        actor_name: log.actor_name,
        level: auditLevel(log.action),
        metadata: log.metadata,
      })),
    [logs, limit],
  );
}

// ─── Approvals ──────────────────────────────────────────────────────────────

function adaptApproval(a: Approval) {
  const risk = (a.risk_level || 'medium') as 'low' | 'medium' | 'high' | 'critical';
  const params = (a.params || {}) as Record<string, unknown>;
  const oldPrice = Number(params.old_price);
  const newPrice = Number(params.new_price);
  const delta =
    oldPrice && newPrice
      ? `₺${oldPrice} → ₺${newPrice}`
      : a.expected_impact || a.action;

  return {
    id: a.id,
    status: a.status,
    requester: a.agent_id,
    risk,
    type: a.action,
    title: a.description || a.action,
    createdAt: new Date(a.created_at).toLocaleString('tr-TR'),
    delta,
    confidence: 0.75,
    rationale: a.expected_impact || a.description,
    policy: {
      breach: risk === 'high' || risk === 'critical',
      auto_threshold: 0.75,
      this_action: risk,
    },
    impact: {
      beklenen: a.expected_impact || '—',
      risk: risk,
    },
    tools: [] as string[],
  };
}

export function useAdaptedApprovals() {
  const approvals = useStore((s) => s.approvals);
  return useMemo(() => approvals.map(adaptApproval), [approvals]);
}

// ─── Task graph (SSE progress → DAG) ────────────────────────────────────────

type GraphNode = {
  id: string;
  agent: string;
  title: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  col: number;
  row: number;
  ms?: number;
};

function buildTaskGraph(progress: ChatProgressEntry[]) {
  if (!progress.length) return null;

  const plan = progress.find((e) => e.event === 'plan_ready');
  const planNodes = plan?.nodes || [];
  const nodeMap = new Map<string, GraphNode>();
  const edges: { from: string; to: string }[] = [];

  if (planNodes.length) {
    planNodes.forEach((n, i) => {
      nodeMap.set(n.id, {
        id: n.id,
        agent: n.agent_id,
        title: n.title || n.agent_id,
        status: 'queued',
        col: i % 4,
        row: Math.floor(i / 4),
      });
    });
    const primary = plan?.primary;
    if (primary && planNodes.length > 1) {
      const primaryNode = planNodes.find((n) => n.agent_id === primary) || planNodes[0];
      for (const n of planNodes) {
        if (n.id !== primaryNode.id) edges.push({ from: primaryNode.id, to: n.id });
      }
    }
  } else {
    const agents = new Set<string>();
    for (const e of progress) {
      if (e.agent_id) agents.add(e.agent_id);
    }
    let i = 0;
    for (const agent of agents) {
      const id = `node_${agent}`;
      nodeMap.set(id, {
        id,
        agent,
        title: agent,
        status: 'queued',
        col: i % 4,
        row: Math.floor(i / 4),
      });
      i += 1;
    }
  }

  for (const e of progress) {
    const id = e.node_id || (e.agent_id ? `node_${e.agent_id}` : null);
    if (!id || !nodeMap.has(id)) continue;
    const node = nodeMap.get(id)!;
    if (e.event === 'agent_started') node.status = 'running';
    if (e.event === 'agent_completed') node.status = 'done';
    if (e.event === 'agent_retry') node.status = 'running';
    if (e.event === 'agent_budget_exhausted') node.status = 'failed';
  }

  const nodes = Array.from(nodeMap.values());
  if (!nodes.length) return null;

  let totalCostUsd = 0;
  for (const e of progress) {
    if (typeof e.cost_usd === 'number') totalCostUsd += e.cost_usd;
  }

  const taskStarted = progress.find((e) => e.event === 'task_started');
  const taskId = taskStarted?.task_id || plan?.task_id || 'live';

  return {
    task_id: taskId,
    task: plan?.primary || 'Aktif görev',
    goal: progress[0]?.message || '',
    startedAt: new Date(progress[0]?.ts || Date.now()).toLocaleTimeString('tr-TR'),
    nodes,
    edges,
    totalToolCalls: progress.filter((e) => e.event === 'tool_called').length,
    totalCostUsd,
    linkedTask: taskId,
  };
}

export function useAdaptedTaskGraph() {
  const chatProgress = useStore((s) => s.chatProgress);
  const snapshots = useStore((s) => s.taskProgressSnapshots);
  const isThinking = useStore((s) => s.isThinking);

  return useMemo(() => {
    if (chatProgress.length) return buildTaskGraph(chatProgress);
    if (!isThinking) {
      const keys = Object.keys(snapshots);
      if (keys.length) {
        const lastKey = keys[keys.length - 1];
        return buildTaskGraph(snapshots[lastKey] || []);
      }
    }
    return null;
  }, [chatProgress, snapshots, isThinking]);
}

// ─── Imperative store actions (chat / approvals) ───────────────────────────

export const storeActions = {
  sendMessage: (text: string) => {
    void useStore.getState().sendUserMessage(text);
  },
  sendMessageStream: (text: string) => useStore.getState().sendUserMessageStream(text),
  approveItem: (id: string, note?: string) => useStore.getState().approveItem(id, note),
  rejectItem: (id: string, note: string) => useStore.getState().rejectItem(id, note),
};
