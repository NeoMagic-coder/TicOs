import { useCallback, useEffect, useRef, useState } from "react";
import { backendHeaders, backendReachable, BASE_URL, resolveBackendUrl, streamChatBackend } from "@/lib/api";

export type OrgUnitSnapshot = {
  id: string;
  name: string;
  description: string;
  head_agent_id: string | null;
  icon: string;
  color: string;
  member_agent_ids: string[];
};

export type LandingStats = {
  online: boolean;
  agentCount: number;
  toolCount: number;
  liveToolCount: number;
  pendingApprovals: number;
  autonomyAgents: number;
  orgUnits: OrgUnitSnapshot[];
};

export type StreamLine = {
  text: string;
  tone: "signal" | "agent" | "success" | "error";
  agentId?: string;
};

const DEFAULT_STATS: LandingStats = {
  online: false,
  agentCount: 22,
  toolCount: 98,
  liveToolCount: 57,
  pendingApprovals: 0,
  autonomyAgents: 4,
  orgUnits: [],
};

const DEMO_MESSAGE =
  "Rakip Trendyol'da fiyatı %15 düşürdü. Marjımızı koruyarak otomatik fiyat güncellemesi yapılabilir mi?";

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(resolveBackendUrl(path), {
      headers: backendHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function useLandingBackend() {
  const [stats, setStats] = useState<LandingStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [streaming, setStreaming] = useState(false);
  const [streamLines, setStreamLines] = useState<StreamLine[]>([]);
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set());
  const streamAbort = useRef<AbortController | null>(null);
  const demoRan = useRef(false);

  const refresh = useCallback(async () => {
    const online = await backendReachable();
    if (!online) {
      setStats((s) => ({ ...s, online: false }));
      setLoading(false);
      return;
    }

    const [agents, tools, approvals, orgUnits] = await Promise.all([
      fetchJson<Array<{ agent_id: string }>>("/api/v1/agents"),
      fetchJson<Array<{ mode?: string }>>("/api/v1/tools"),
      fetchJson<Array<{ status?: string }>>("/api/v1/approvals"),
      fetchJson<OrgUnitSnapshot[]>("/api/v1/org/units"),
    ]);

    const toolList = tools ?? [];
    const autonomyIds = new Set([
      "negotiation_agent",
      "logistics_agent",
      "dynamic_pricing_agent",
      "autonomous_decision_agent",
    ]);

    setStats({
      online: true,
      agentCount: agents?.length ?? DEFAULT_STATS.agentCount,
      toolCount: toolList.length || DEFAULT_STATS.toolCount,
      liveToolCount: toolList.filter((t) => t.mode === "live").length || DEFAULT_STATS.liveToolCount,
      pendingApprovals: (approvals ?? []).filter((a) => a.status === "pending").length,
      autonomyAgents: (agents ?? []).filter((a) => autonomyIds.has(a.agent_id)).length || 4,
      orgUnits: orgUnits ?? [],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 25_000);
    return () => clearInterval(id);
  }, [refresh]);

  const runLiveDemo = useCallback(async () => {
    if (!stats.online || streaming) return;
    streamAbort.current?.abort();
    const ac = new AbortController();
    streamAbort.current = ac;
    setStreaming(true);
    setStreamLines([{ text: `› signal: ${DEMO_MESSAGE}`, tone: "signal" }]);
    setActiveAgents(new Set());

    try {
      for await (const ev of streamChatBackend({
        message: DEMO_MESSAGE,
        history: [],
        product_context: null,
        language: "tr",
      })) {
        if (ac.signal.aborted) break;
        if (ev.kind === "progress") {
          const agentId = ev.agent_id as string | undefined;
          const toolId = ev.tool_id as string | undefined;
          if (agentId) setActiveAgents((prev) => new Set(prev).add(agentId));
          let text = "";
          let tone: StreamLine["tone"] = "agent";
          switch (ev.event) {
            case "task_started":
              text = "[hermes] görev başlatıldı";
              break;
            case "plan_ready":
              text = `[hermes] plan → primary=${String(ev.primary ?? "?")}`;
              break;
            case "agent_started":
              text = `[${agentId}] çalışıyor…`;
              break;
            case "tool_called":
              text = `[${agentId}] → ${toolId}`;
              break;
            case "critic_scored":
              text = `[critic] ${agentId} skor=${Number(ev.score ?? 0).toFixed(2)}`;
              break;
            case "agent_completed":
              text = `[${agentId}] tamamlandı ✓`;
              tone = "success";
              break;
            case "agent_failed":
              text = `[${agentId}] hata: ${String(ev.error ?? ev.message ?? "?")}`;
              tone = "error";
              break;
            case "merging":
              text = "[hermes] sonuçlar birleştiriliyor…";
              break;
            default:
              text = `[${ev.event}] ${agentId ?? ""}`.trim();
          }
          if (text) setStreamLines((prev) => [...prev.slice(-24), { text, tone, agentId }]);
        } else if (ev.kind === "message") {
          const conf = ev.payload.confidence?.toFixed(2) ?? "?";
          setStreamLines((prev) => [
            ...prev.slice(-24),
            {
              text: `✓ committed · task=${ev.payload.task_id ?? "?"} · güven=${conf}`,
              tone: "success",
            },
          ]);
        } else if (ev.kind === "error") {
          setStreamLines((prev) => [...prev.slice(-24), { text: `✗ ${ev.error}`, tone: "error" }]);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStreamLines((prev) => [...prev.slice(-24), { text: `✗ ${msg}`, tone: "error" }]);
    } finally {
      setStreaming(false);
    }
  }, [stats.online, streaming]);

  /** Auto-run one live demo when terminal scrolls into view (once per session). */
  const maybeAutoDemo = useCallback(() => {
    if (demoRan.current || !stats.online) return;
    demoRan.current = true;
    void runLiveDemo();
  }, [stats.online, runLiveDemo]);

  useEffect(() => () => streamAbort.current?.abort(), []);

  return {
    stats,
    loading,
    streaming,
    streamLines,
    activeAgents,
    refresh,
    runLiveDemo,
    maybeAutoDemo,
    docsUrl: resolveBackendUrl("/docs"),
    appUrl: "/",
  };
}

/** Map backend agent_id → DAG node id for the terminal visual. */
export function agentToDagNode(agentId: string): string | null {
  const id = agentId.toLowerCase();
  if (/shopping|market|competitor|research/.test(id)) return "shopping";
  if (/autonom|decision|negotiat|policy/.test(id)) return "autonomy";
  if (/pricing|inventory|tic|operation|margin/.test(id)) return "tic";
  if (/executor|openclaw|tool|secure/.test(id)) return "exec";
  return null;
}
