import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Zap, ArrowRight, BookOpen, Cpu, Shield, TrendingUp,
  Activity, Terminal, Check, GitBranch, FileText, Boxes, Brain, Lock,
  Gauge, Network, Sparkles, ChevronRight, Database, Server, Layers,
  CircleDollarSign, Workflow, ScanSearch, PackageCheck, Megaphone,
  ShieldCheck, Building2, Bot, Radio, Globe, Play,
} from "lucide-react";
import {
  agentToDagNode,
  useLandingBackend,
  type LandingStats,
  type StreamLine,
} from "./useLandingBackend";

/* ============================================================
   Scroll reveal hook
   ============================================================ */
function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, cls: `lp-reveal ${shown ? "lp-in" : ""}` };
}

/* ============================================================
   Section heading
   ============================================================ */
function SectionTag({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[var(--lp-border)] bg-[var(--lp-bg-2)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--lp-fg-2)]">
      <Icon size={13} className="text-[var(--lp-coral)]" />
      {children}
    </div>
  );
}

/* ============================================================
   Nav
   ============================================================ */
function Nav({ stats, appUrl }: { stats: LandingStats; appUrl: string }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links = [
    ["Terminal", "#terminal"],
    ["Departments", "#departments"],
    ["Architecture", "#architecture"],
    ["Pricing", "#pricing"],
  ];
  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-[var(--lp-border)] bg-[rgba(11,11,12,0.78)] backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--lp-coral-soft)] text-lg lp-coral-glow">
            🦞
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Tic<span className="text-[var(--lp-coral)]">OS</span>Claw
          </span>
        </a>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-[13px] font-medium text-[var(--lp-fg-2)] transition-colors hover:text-[var(--lp-fg-1)]"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <span
            className="hidden items-center gap-1.5 rounded-full border border-[var(--lp-border)] px-2.5 py-1 sm:flex"
            title={stats.online ? "Backend bağlı" : "Backend çevrimdışı — demo modu"}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${stats.online ? "bg-[var(--lp-green)] lp-dot-pulse" : "bg-[var(--lp-fg-3)]"}`}
            />
            <span className="lp-mono text-[10px] uppercase tracking-wide text-[var(--lp-fg-3)]">
              {stats.online ? "API live" : "offline"}
            </span>
          </span>
          <a
            href={appUrl}
            className="hidden rounded-lg px-3.5 py-2 text-[13px] font-medium text-[var(--lp-fg-2)] transition-colors hover:text-[var(--lp-fg-1)] sm:block"
          >
            Console
          </a>
          <a
            href={appUrl}
            className="group inline-flex items-center gap-1.5 rounded-lg bg-[var(--lp-coral)] px-4 py-2 text-[13px] font-semibold text-[#1a0a05] transition-all hover:brightness-110"
          >
            Deploy Agent
            <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </header>
  );
}

/* ============================================================
   Live SSE dashboard mock (hero)
   ============================================================ */
const SSE_EVENTS = [
  { agent: "market_research_agent", color: "var(--lp-cyan)", text: "Trendyol fiyat taraması tamamlandı · 142 SKU", tag: "scan" },
  { agent: "dynamic_pricing_agent", color: "var(--lp-coral)", text: "Rakip -%15 tespit edildi → marj kontrolü", tag: "price" },
  { agent: "autonomy_layer", color: "var(--lp-amber)", text: "Politika kapısı: değişim sınırı %12 içinde ✓", tag: "policy" },
  { agent: "inventory_agent", color: "var(--lp-green)", text: "Stok 318 adet · reorder noktası güvenli", tag: "stock" },
  { agent: "secure_executor", color: "var(--lp-coral)", text: "Mağaza fiyatı 449₺ → 419₺ güncellendi", tag: "exec" },
  { agent: "review_agent", color: "var(--lp-violet, #9B7BFF)", text: "3 yeni yorum yanıtlandı · sentiment +0.82", tag: "ops" },
  { agent: "finance_agent", color: "var(--lp-green)", text: "Günlük marj raporu derlendi · +%4.1", tag: "audit" },
];

function LiveDashboard({ stats, streamLines }: { stats: LandingStats; streamLines: StreamLine[] }) {
  const [lines, setLines] = useState<typeof SSE_EVENTS>([]);
  const [tick, setTick] = useState(0);
  const idxRef = useRef(0);

  useEffect(() => {
    if (stats.online && streamLines.length > 0) return;
    const id = setInterval(() => {
      const ev = SSE_EVENTS[idxRef.current % SSE_EVENTS.length];
      idxRef.current += 1;
      setLines((prev) => [...prev.slice(-5), ev]);
      setTick((t) => t + 1);
    }, 1700);
    return () => clearInterval(id);
  }, [stats.online, streamLines.length]);

  const liveStream = useMemo(() => {
    if (!stats.online || streamLines.length === 0) return null;
    return streamLines.slice(-6).map((l) => ({
      agent: l.agentId ?? "hermes",
      color:
        l.tone === "success"
          ? "var(--lp-green)"
          : l.tone === "error"
            ? "var(--lp-rose, #FF5C7A)"
            : l.tone === "signal"
              ? "var(--lp-coral)"
              : "var(--lp-cyan)",
      text: l.text.replace(/^\[.*?\]\s*/, "").slice(0, 80),
      tag: "live",
    }));
  }, [stats.online, streamLines]);

  const displayLines = liveStream && liveStream.length > 0 ? liveStream : lines;

  const metrics = useMemo(() => {
    const base = tick;
    if (stats.online) {
      return [
        { label: "Active agents", value: String(stats.agentCount), sub: `+${stats.autonomyAgents} autonomy` },
        { label: "Tool manifests", value: String(stats.toolCount), sub: `${stats.liveToolCount} live` },
        { label: "Pending approvals", value: String(stats.pendingApprovals), sub: "policy-gated" },
        { label: "Hermes API", value: "Online", sub: "SSE /chat/stream" },
      ];
    }
    return [
      { label: "Active agents", value: "22", sub: "+4 autonomy" },
      { label: "Tool calls / 24h", value: `${(1842 + base * 7).toLocaleString()}`, sub: "98 manifests" },
      { label: "Margin uplift", value: `+${(4.1 + (base % 5) * 0.1).toFixed(1)}%`, sub: "this week" },
      { label: "Approvals", value: "0", sub: "auto-cleared" },
    ];
  }, [tick, stats]);

  const spark = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) =>
        18 + Math.round(Math.abs(Math.sin(i * 0.6 + tick * 0.3) * 22) + (i % 4) * 2)
      ),
    [tick]
  );

  return (
    <div className="lp-glow-border relative overflow-hidden rounded-2xl border border-[var(--lp-border-strong)] bg-[var(--lp-bg-1)]/90 shadow-2xl backdrop-blur-sm">
      {/* window chrome */}
      <div className="flex items-center justify-between border-b border-[var(--lp-border)] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="lp-mono ml-3 text-[11px] text-[var(--lp-fg-3)]">ticos://orchestrator/live</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-[var(--lp-border)] px-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--lp-green)] lp-dot-pulse" />
          <span className="lp-mono text-[10px] uppercase tracking-wide text-[var(--lp-green)]">
            {stats.online ? "SSE live" : "demo"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-px bg-[var(--lp-border)] sm:grid-cols-2">
        {/* metrics */}
        <div className="grid grid-cols-2 gap-px bg-[var(--lp-border)]">
          {metrics.map((m) => (
            <div key={m.label} className="bg-[var(--lp-bg-1)] p-4">
              <div className="lp-mono text-[10px] uppercase tracking-wider text-[var(--lp-fg-3)]">{m.label}</div>
              <div className="mt-1.5 text-2xl font-semibold tracking-tight text-[var(--lp-fg-1)]">{m.value}</div>
              <div className="mt-0.5 text-[11px] text-[var(--lp-coral)]">{m.sub}</div>
            </div>
          ))}
        </div>

        {/* event stream */}
        <div className="bg-[var(--lp-bg-1)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="lp-mono text-[10px] uppercase tracking-wider text-[var(--lp-fg-3)]">agent stream</span>
            <Activity size={13} className="text-[var(--lp-coral)]" />
          </div>
          <div className="lp-scroll flex h-[148px] flex-col justify-end gap-2 overflow-hidden">
            {displayLines.map((l, i) => (
              <div
                key={`${l.agent}-${i}-${tick}`}
                className="flex items-start gap-2 text-[12px] leading-tight"
                style={{ animation: "lp-fade-up 0.4s ease both" }}
              >
                <span
                  className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: l.color, boxShadow: `0 0 8px ${l.color}` }}
                />
                <div>
                  <span className="lp-mono text-[10px] text-[var(--lp-fg-3)]">{l.agent}</span>
                  <div className="text-[var(--lp-fg-2)]">{l.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* sparkline footer */}
      <div className="flex items-end gap-[3px] border-t border-[var(--lp-border)] px-4 py-3" style={{ height: 56 }}>
        {spark.map((h, i) => (
          <span
            key={i}
            className="flex-1 rounded-sm transition-all duration-500"
            style={{
              height: `${h}px`,
              background:
                i > spark.length - 5
                  ? "var(--lp-coral)"
                  : "linear-gradient(180deg, rgba(255,87,51,0.5), rgba(255,87,51,0.08))",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Hero
   ============================================================ */
function Hero({ stats, streamLines, appUrl, docsUrl }: { stats: LandingStats; streamLines: StreamLine[]; appUrl: string; docsUrl: string }) {
  return (
    <section id="top" className="relative isolate overflow-hidden pt-28 pb-20 sm:pt-36">
      <div className="pointer-events-none absolute inset-0 -z-10 lp-grid-bg lp-grid-fade" />
      <div
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-[820px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(255,87,51,0.18), transparent)" }}
      />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--lp-border)] bg-[var(--lp-bg-2)]/80 px-3.5 py-1.5 text-[12px] text-[var(--lp-fg-2)] backdrop-blur">
            <Zap size={13} className="text-[var(--lp-coral)]" />
            Powered by Enterprise Agentic Orchestrator &amp; Secure Execution Layer
          </div>

          <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            <span className="lp-text-gradient">Single Product. Zero Employees.</span>
            <br />
            <span className="lp-text-coral-gradient">100% Autonomous E-Commerce.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-pretty text-[15px] leading-relaxed text-[var(--lp-fg-2)] sm:text-[17px]">
            Transform your single-product e-commerce into a self-operating enterprise.{" "}
            <span className="text-[var(--lp-fg-1)]">{stats.agentCount} specialized AI agents</span> orchestrating market research,
            dynamic pricing, inventory control, and customer operations — 24/7.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={appUrl}
              className="lp-coral-glow group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--lp-coral)] px-6 py-3.5 text-[14px] font-semibold text-[#1a0a05] transition-all hover:brightness-110 sm:w-auto"
            >
              Deploy Your First Agent
              <span className="rounded-md bg-black/15 px-1.5 py-0.5 text-[11px] font-medium">7-Day Free Trial</span>
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href={docsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--lp-border-strong)] bg-[var(--lp-bg-2)]/50 px-6 py-3.5 text-[14px] font-semibold text-[var(--lp-fg-1)] transition-all hover:border-[var(--lp-coral)] hover:bg-[var(--lp-bg-3)] sm:w-auto"
            >
              <BookOpen size={16} />
              Read the Architecture Wiki
            </a>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-[var(--lp-fg-3)]">
            <span className="flex items-center gap-1.5"><Check size={13} className="text-[var(--lp-green)]" /> No credit card</span>
            <span className="flex items-center gap-1.5"><Check size={13} className="text-[var(--lp-green)]" /> Policy-gated autonomy</span>
            <span className="flex items-center gap-1.5"><Check size={13} className="text-[var(--lp-green)]" /> Self-hostable</span>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-5xl lp-float">
          <LiveDashboard stats={stats} streamLines={streamLines} />
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Live Agent Terminal — animated TaskGraph DAG
   ============================================================ */
type NodeState = "idle" | "thinking" | "executing" | "done";

const DAG_NODES = [
  { id: "input", label: "User Signal", sub: "Trendyol -%15", icon: Radio, x: 60, y: 130 },
  { id: "shopping", label: "Shopping Agent", sub: "scans prices", icon: ScanSearch, x: 250, y: 60 },
  { id: "autonomy", label: "Autonomy Layer", sub: "policy limits", icon: Shield, x: 250, y: 200 },
  { id: "tic", label: "TIC Module", sub: "margin check", icon: Boxes, x: 470, y: 130 },
  { id: "exec", label: "Secure Executor", sub: "update price", icon: Lock, x: 680, y: 130 },
];
const DAG_EDGES: [string, string][] = [
  ["input", "shopping"],
  ["input", "autonomy"],
  ["shopping", "tic"],
  ["autonomy", "tic"],
  ["tic", "exec"],
];

// scenario steps: which node activates at each step
const SCENARIO: { node: string; state: NodeState; log: string }[] = [
  { node: "input", state: "executing", log: "› signal: Competitor dropped price on Trendyol by 15%" },
  { node: "shopping", state: "thinking", log: "[shopping_agent] scanning 142 SKUs across marketplaces…" },
  { node: "shopping", state: "done", log: "[shopping_agent] competitor=419₺  ours=449₺  Δ=-15%" },
  { node: "autonomy", state: "thinking", log: "[autonomy_layer] evaluating max_price_change_pct=12%…" },
  { node: "autonomy", state: "done", log: "[autonomy_layer] within policy ✓  confidence=0.94" },
  { node: "tic", state: "thinking", log: "[tic_module] margin@419₺ = 31.2%  > floor 22% ✓" },
  { node: "tic", state: "done", log: "[tic_module] reorder safe · stock=318 · approve" },
  { node: "exec", state: "executing", log: "[secure_executor] PUT /price 449→419  schema ✓ perms ✓" },
  { node: "exec", state: "done", log: "✓ committed · audit#a91f · latency 1.2s · cost $0.004" },
];

function dotColor(s: NodeState) {
  if (s === "executing") return "var(--lp-coral)";
  if (s === "thinking") return "var(--lp-amber)";
  if (s === "done") return "var(--lp-green)";
  return "var(--lp-fg-3)";
}
function stateLabel(s: NodeState) {
  return s === "idle" ? "Idle" : s === "thinking" ? "Thinking" : s === "executing" ? "Executing" : "Done";
}

function LiveTerminal({
  stats,
  streamLines,
  streaming,
  runLiveDemo,
  maybeAutoDemo,
}: {
  stats: LandingStats;
  streamLines: StreamLine[];
  streaming: boolean;
  runLiveDemo: () => void;
  maybeAutoDemo: () => void;
}) {
  const { ref, cls } = useReveal<HTMLDivElement>();
  const [step, setStep] = useState(-1);
  const [mockLogs, setMockLogs] = useState<string[]>([]);
  const [mockStates, setMockStates] = useState<Record<string, NodeState>>({});
  const logRef = useRef<HTMLDivElement | null>(null);
  const useLive = stats.online;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) maybeAutoDemo();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [maybeAutoDemo, ref]);

  useEffect(() => {
    if (useLive) return;
    let s = -1;
    const reset = () => {
      s = -1;
      setStep(-1);
      setMockLogs([]);
      setMockStates({});
    };
    const id = setInterval(() => {
      s += 1;
      if (s >= SCENARIO.length) {
        setTimeout(reset, 2600);
        s = SCENARIO.length;
        return;
      }
      if (s < SCENARIO.length) {
        const cur = SCENARIO[s];
        setStep(s);
        setMockStates((prev) => ({ ...prev, [cur.node]: cur.state }));
        setMockLogs((prev) => [...prev, cur.log]);
      }
    }, 1500);
    return () => clearInterval(id);
  }, [useLive]);

  const liveStates = useMemo(() => {
    const next: Record<string, NodeState> = { input: streaming ? "executing" : "idle" };
    for (const line of streamLines) {
      const node = line.agentId ? agentToDagNode(line.agentId) : null;
      if (!node) continue;
      if (line.tone === "success" || line.text.includes("tamamlandı")) next[node] = "done";
      else if (line.text.includes("→")) next[node] = "executing";
      else next[node] = "thinking";
    }
    if (streamLines.some((l) => l.tone === "success" && l.text.startsWith("✓"))) {
      next.exec = "done";
    }
    return next;
  }, [streamLines, streaming]);

  const logs = useLive ? streamLines.map((l) => l.text) : mockLogs;
  const states = useLive ? liveStates : mockStates;
  const activeNode =
    !useLive && step >= 0 && step < SCENARIO.length ? SCENARIO[step].node : null;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [logs]);

  return (
    <section id="terminal" className="relative border-t border-[var(--lp-border)] py-24">
      <div ref={ref} className={`mx-auto max-w-7xl px-5 sm:px-8 ${cls}`}>
        <div className="mx-auto max-w-2xl text-center">
          <SectionTag icon={Terminal}>Live Agent Terminal</SectionTag>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            Watch the <span className="lp-text-coral-gradient">TaskGraph</span> route in real time
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--lp-fg-2)]">
            {useLive
              ? "Connected to Hermes via POST /api/v1/chat/stream — live SSE progress from your backend."
              : "Backend offline — showing simulated orchestration. Start the API on :8000 for live data."}
          </p>
          {useLive && (
            <button
              type="button"
              onClick={() => void runLiveDemo()}
              disabled={streaming}
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[var(--lp-coral)] bg-[var(--lp-coral-soft)] px-5 py-2.5 text-[13px] font-semibold text-[var(--lp-fg-1)] transition-all hover:brightness-110 disabled:opacity-60"
            >
              <Play size={14} className="text-[var(--lp-coral)]" />
              {streaming ? "Hermes çalışıyor…" : "Canlı Demo Çalıştır"}
            </button>
          )}
        </div>

        <div className="lp-glow-border mt-12 grid grid-cols-1 overflow-hidden rounded-2xl border border-[var(--lp-border-strong)] bg-[var(--lp-bg-1)] lg:grid-cols-5">
          {/* DAG canvas */}
          <div className="relative col-span-1 border-b border-[var(--lp-border)] bg-[var(--lp-bg-0)] p-4 lg:col-span-3 lg:border-b-0 lg:border-r">
            <div className="absolute inset-0 lp-grid-bg opacity-40" />
            <svg viewBox="0 0 780 300" className="relative w-full" style={{ minHeight: 280 }}>
              {DAG_EDGES.map(([from, to]) => {
                const a = DAG_NODES.find((n) => n.id === from)!;
                const b = DAG_NODES.find((n) => n.id === to)!;
                const active =
                  (states[from] === "done" || states[from] === "executing") &&
                  (activeNode === to || states[to]);
                return (
                  <line
                    key={`${from}-${to}`}
                    x1={a.x + 70}
                    y1={a.y + 26}
                    x2={b.x}
                    y2={b.y + 26}
                    stroke={active ? "var(--lp-coral)" : "var(--lp-border-strong)"}
                    strokeWidth={active ? 2 : 1.2}
                    className={active ? "lp-edge-flow" : ""}
                    opacity={active ? 0.95 : 0.5}
                  />
                );
              })}
              {DAG_NODES.map((n) => {
                const st = (states[n.id] ?? "idle") as NodeState;
                const isActive = activeNode === n.id;
                const Icon = n.icon;
                return (
                  <foreignObject key={n.id} x={n.x} y={n.y} width={150} height={56}>
                    <div
                      className="flex h-[52px] items-center gap-2 rounded-xl border px-2.5 transition-all duration-300"
                      style={{
                        borderColor: isActive ? "var(--lp-coral)" : "var(--lp-border-strong)",
                        background: isActive ? "var(--lp-coral-soft)" : "var(--lp-bg-2)",
                        boxShadow: isActive ? "0 0 24px -6px var(--lp-coral-glow)" : "none",
                      }}
                    >
                      <span
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                        style={{ background: "var(--lp-bg-3)" }}
                      >
                        <Icon size={15} style={{ color: dotColor(st) }} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-semibold leading-tight text-[var(--lp-fg-1)]">
                          {n.label}
                        </span>
                        <span className="flex items-center gap-1">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${st === "thinking" || st === "executing" ? "lp-dot-pulse" : ""}`}
                            style={{ background: dotColor(st), boxShadow: `0 0 6px ${dotColor(st)}` }}
                          />
                          <span className="lp-mono text-[9px] uppercase tracking-wide text-[var(--lp-fg-3)]">
                            {stateLabel(st)}
                          </span>
                        </span>
                      </span>
                    </div>
                  </foreignObject>
                );
              })}
            </svg>
            <div className="relative mt-2 flex flex-wrap items-center gap-4 px-1 text-[11px] text-[var(--lp-fg-3)]">
              {(["idle", "thinking", "executing", "done"] as NodeState[]).map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: dotColor(s) }} />
                  {stateLabel(s)}
                </span>
              ))}
            </div>
          </div>

          {/* log console */}
          <div className="col-span-1 flex flex-col bg-[var(--lp-bg-0)] lg:col-span-2">
            <div className="flex items-center justify-between border-b border-[var(--lp-border)] px-4 py-3">
              <span className="lp-mono text-[11px] text-[var(--lp-fg-3)]">
                stdout · hermes.orchestrator{useLive ? " · live" : " · mock"}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${useLive ? "bg-[var(--lp-green)] lp-dot-pulse" : "bg-[var(--lp-amber)]"}`}
                />
                <span className={`lp-mono text-[10px] uppercase ${useLive ? "text-[var(--lp-green)]" : "text-[var(--lp-amber)]"}`}>
                  {streaming ? "streaming" : useLive ? "ready" : "simulated"}
                </span>
              </span>
            </div>
            <div ref={logRef} className="lp-scroll h-[260px] overflow-y-auto p-4">
              <div className="lp-mono space-y-1.5 text-[11.5px] leading-relaxed">
                {logs.map((l, i) => (
                  <div
                    key={i}
                    className={
                      l.startsWith("✓")
                        ? "text-[var(--lp-green)]"
                        : l.startsWith("›") || l.startsWith("✗")
                          ? l.startsWith("✗")
                            ? "text-[var(--lp-rose,#FF5C7A)]"
                            : "text-[var(--lp-coral)]"
                          : "text-[var(--lp-fg-2)]"
                    }
                    style={{ animation: "lp-fade-up 0.3s ease both" }}
                  >
                    {l}
                  </div>
                ))}
                <div className="flex items-center text-[var(--lp-coral)]">
                  <span>$</span>
                  <span className="ml-1 h-3.5 w-1.5 bg-[var(--lp-coral)] lp-caret" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   5 Departments — bento grid
   ============================================================ */
const DEPARTMENTS = [
  {
    icon: Building2,
    title: "Management Node",
    blurb: "Policy enforcement, automated goal loop, and budget negotiation across the agent grid.",
    points: ["Goal decomposition", "Per-agent budget caps", "Autonomy policy gate"],
    big: true,
  },
  {
    icon: ScanSearch,
    title: "R&D & Market Intelligence",
    blurb: "Continuous parameter optimization & web scraping of Trendyol / Hepsiburada.",
    points: ["Competitor scan", "Trend detection", "Niche scoring"],
  },
  {
    icon: PackageCheck,
    title: "Operations · TIC Module",
    blurb: "Autonomous order fulfillment, inventory logs, and dashboard rollups.",
    points: ["Order fulfillment", "Stock forecasting", "Live rollups"],
  },
  {
    icon: Megaphone,
    title: "Marketing & SEO",
    blurb: "Automated content, ad-spend optimization, and customer review response loops.",
    points: ["Content engine", "Ad optimization", "Review replies"],
  },
  {
    icon: ShieldCheck,
    title: "Finance & Auditing",
    blurb: "Strict JSON-schema validation, tool permission gates, and execution audit trails.",
    points: ["Schema validation", "Permission gates", "Immutable audit log"],
    big: true,
  },
];

const ORG_ICONS: Record<string, typeof Building2> = {
  yonetim: Building2,
  arge: ScanSearch,
  operasyon: PackageCheck,
  pazarlama: Megaphone,
  finans: ShieldCheck,
};

function Departments({ stats }: { stats: LandingStats }) {
  const { ref, cls } = useReveal<HTMLDivElement>();

  const cards = useMemo(() => {
    if (!stats.orgUnits.length) return DEPARTMENTS;
    return stats.orgUnits.map((u) => ({
      icon: ORG_ICONS[u.id] ?? Building2,
      title: u.name,
      blurb: u.description || `${u.member_agent_ids.length} agent üyesi`,
      points: [
        `${u.member_agent_ids.length} registered agents`,
        u.head_agent_id ? `Head: ${u.head_agent_id.replace(/_agent$/, "")}` : "Department head",
        "Live from /api/v1/org/units",
      ],
      big: u.id === "yonetim" || u.id === "finans",
    }));
  }, [stats.orgUnits]);
  return (
    <section id="departments" className="relative border-t border-[var(--lp-border)] py-24">
      <div ref={ref} className={`mx-auto max-w-7xl px-5 sm:px-8 ${cls}`}>
        <div className="mx-auto max-w-2xl text-center">
          <SectionTag icon={Network}>Organizational Units</SectionTag>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            Five <span className="lp-text-coral-gradient">autonomous departments</span>, one operating system
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--lp-fg-2)]">
            Every agent reports into a department head. The whole company runs itself — structured exactly like a
            real org chart.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((d) => {
            const Icon = d.icon;
            return (
              <div
                key={d.title}
                className={`lp-glow-border group relative flex flex-col rounded-2xl border border-[var(--lp-border)] bg-[var(--lp-bg-1)] p-6 transition-all hover:border-[var(--lp-border-strong)] ${
                  d.big ? "lg:col-span-1" : ""
                }`}
              >
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-[var(--lp-border)] bg-[var(--lp-bg-2)] text-[var(--lp-coral)] transition-all group-hover:bg-[var(--lp-coral-soft)]">
                  <Icon size={20} />
                </div>
                <h3 className="text-[16px] font-semibold tracking-tight text-[var(--lp-fg-1)]">{d.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--lp-fg-2)]">{d.blurb}</p>
                <ul className="mt-4 space-y-2">
                  {d.points.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-[12.5px] text-[var(--lp-fg-2)]">
                      <ChevronRight size={13} className="text-[var(--lp-coral)]" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {/* stat tile to balance bento */}
          <div className="lp-glow-border relative flex flex-col justify-center rounded-2xl border border-[var(--lp-border)] bg-gradient-to-br from-[var(--lp-coral-soft)] to-[var(--lp-bg-1)] p-6">
            <div className="text-4xl font-semibold tracking-tight text-[var(--lp-fg-1)]">{stats.agentCount}</div>
            <div className="text-[13px] text-[var(--lp-fg-2)]">specialized agents</div>
            <div className="mt-4 text-4xl font-semibold tracking-tight text-[var(--lp-coral)]">{stats.toolCount}</div>
            <div className="text-[13px] text-[var(--lp-fg-2)]">tool manifests · {stats.liveToolCount} live</div>
            <div className="mt-4 flex items-center gap-1.5 text-[12px] text-[var(--lp-fg-3)]">
              <Bot size={13} className="text-[var(--lp-coral)]" /> zero human operators required
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Technical specifications & architecture
   ============================================================ */
const STACK = [
  { icon: Server, label: "Backend", value: "Python 3.11 · FastAPI", note: "async DAG orchestration" },
  { icon: Brain, label: "LLM Gateway", value: "OpenRouter → Gemini 2.5 Flash Lite", note: "ultra-low latency proxy" },
  { icon: Cpu, label: "Frontend", value: "Vite + React 19 · Zustand", note: "single-file SPA build" },
  { icon: Database, label: "Memory", value: "pgvector cosine search", note: "embedded knowledge recall" },
  { icon: Workflow, label: "Orchestrator", value: "Hermes TaskGraph (DAG)", note: "asyncio.gather parallelism" },
  { icon: Shield, label: "Execution", value: "OpenClaw secure layer", note: "permission + schema gated" },
];

function Architecture() {
  const { ref, cls } = useReveal<HTMLDivElement>();
  return (
    <section id="architecture" className="relative border-t border-[var(--lp-border)] py-24">
      <div ref={ref} className={`mx-auto max-w-7xl px-5 sm:px-8 ${cls}`}>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionTag icon={Layers}>For Devs &amp; Investors</SectionTag>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Built on a <span className="lp-text-coral-gradient">secure, auditable</span> architecture
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--lp-fg-2)]">
              A FastAPI backend proxies all completions to OpenRouter (Gemini 2.5 Flash Lite) for ultra-low latency,
              paired with a Vite + React 19 + Zustand frontend.
            </p>

            <div className="mt-7 rounded-2xl border border-[var(--lp-coral)]/40 bg-[var(--lp-coral-soft)] p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--lp-bg-0)] text-[var(--lp-coral)]">
                  <Lock size={18} />
                </span>
                <div>
                  <div className="text-[14px] font-semibold text-[var(--lp-fg-1)]">
                    Policy-Gated Autonomy Layer
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--lp-fg-2)]">
                    All agent actions pass through our autonomy layer.{" "}
                    <span className="text-[var(--lp-fg-1)]">Zero prompt injections. Absolute security.</span> Every
                    tool call is JSON-schema validated, permission-scoped, and written to an immutable audit trail.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {["JSON schema validation", "Tool permission gates", "Circuit breakers", "Cost/budget tracking", "Audit log"].map(
                (t) => (
                  <span
                    key={t}
                    className="lp-mono rounded-md border border-[var(--lp-border)] bg-[var(--lp-bg-2)] px-2.5 py-1 text-[11px] text-[var(--lp-fg-2)]"
                  >
                    {t}
                  </span>
                )
              )}
            </div>
          </div>

          {/* stack table */}
          <div className="lp-glow-border overflow-hidden rounded-2xl border border-[var(--lp-border-strong)] bg-[var(--lp-bg-1)]">
            <div className="flex items-center justify-between border-b border-[var(--lp-border)] px-5 py-3.5">
              <span className="lp-mono text-[11px] uppercase tracking-wider text-[var(--lp-fg-3)]">tech_stack.json</span>
              <Gauge size={14} className="text-[var(--lp-coral)]" />
            </div>
            <div className="divide-y divide-[var(--lp-border)]">
              {STACK.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[var(--lp-bg-2)]">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--lp-border)] bg-[var(--lp-bg-2)] text-[var(--lp-coral)]">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="lp-mono text-[10px] uppercase tracking-wider text-[var(--lp-fg-3)]">{s.label}</div>
                      <div className="truncate text-[13.5px] font-medium text-[var(--lp-fg-1)]">{s.value}</div>
                    </div>
                    <div className="hidden text-right text-[11.5px] text-[var(--lp-fg-3)] sm:block">{s.note}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Pricing
   ============================================================ */
const PLANS = [
  {
    name: "Seed Registry",
    price: "$49",
    period: "/mo",
    blurb: "Bootstrap with the core autonomous loop.",
    icon: Sparkles,
    features: [
      "4 core autonomous agents",
      "Mock + 10 live tool manifests",
      "Single marketplace router",
      "Community support",
      "Audit log (7-day retention)",
    ],
    cta: "Start free trial",
    highlight: false,
  },
  {
    name: "Growth Enterprise",
    price: "$299",
    period: "/mo",
    blurb: "The full company-in-a-box. Most popular.",
    icon: TrendingUp,
    features: [
      "Full 22-agent grid",
      "All 98 tool manifests (57 live)",
      "5 org departments + goal loop",
      "Dynamic pricing + autonomy layer",
      "Per-agent budget controls",
      "Priority support + SLA",
    ],
    cta: "Deploy Growth",
    highlight: true,
  },
  {
    name: "Custom Cluster",
    price: "Custom",
    period: "",
    blurb: "Self-hosted, your infrastructure, your rules.",
    icon: Server,
    features: [
      "Self-hosted Docker Compose",
      "Custom marketplace routers",
      "Bring-your-own LLM keys",
      "pgvector memory cluster",
      "Observability stack (Prom + Grafana)",
      "Dedicated solutions engineer",
    ],
    cta: "Talk to sales",
    highlight: false,
  },
];

function Pricing() {
  const { ref, cls } = useReveal<HTMLDivElement>();
  return (
    <section id="pricing" className="relative border-t border-[var(--lp-border)] py-24">
      <div ref={ref} className={`mx-auto max-w-7xl px-5 sm:px-8 ${cls}`}>
        <div className="mx-auto max-w-2xl text-center">
          <SectionTag icon={CircleDollarSign}>Deployment Plans</SectionTag>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            Scale from a <span className="lp-text-coral-gradient">seed registry</span> to a full cluster
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--lp-fg-2)]">
            Every plan includes the secure execution layer. Upgrade as your autonomous workforce grows.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {PLANS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.name}
                className={`relative flex flex-col rounded-2xl border p-7 transition-all ${
                  p.highlight
                    ? "border-[var(--lp-coral)] bg-[var(--lp-bg-1)] lp-coral-glow lg:-translate-y-2"
                    : "lp-glow-border border-[var(--lp-border)] bg-[var(--lp-bg-1)] hover:border-[var(--lp-border-strong)]"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--lp-coral)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#1a0a05]">
                    Most Popular
                  </span>
                )}
                <div className="flex items-center gap-2.5">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--lp-border)] bg-[var(--lp-bg-2)] text-[var(--lp-coral)]">
                    <Icon size={17} />
                  </span>
                  <span className="text-[15px] font-semibold text-[var(--lp-fg-1)]">{p.name}</span>
                </div>
                <p className="mt-3 text-[13px] text-[var(--lp-fg-2)]">{p.blurb}</p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight text-[var(--lp-fg-1)]">{p.price}</span>
                  <span className="text-[14px] text-[var(--lp-fg-3)]">{p.period}</span>
                </div>
                <a
                  href="#"
                  className={`mt-6 inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-3 text-[13.5px] font-semibold transition-all ${
                    p.highlight
                      ? "bg-[var(--lp-coral)] text-[#1a0a05] hover:brightness-110"
                      : "border border-[var(--lp-border-strong)] text-[var(--lp-fg-1)] hover:border-[var(--lp-coral)] hover:bg-[var(--lp-bg-2)]"
                  }`}
                >
                  {p.cta}
                  <ArrowRight size={15} />
                </a>
                <ul className="mt-7 space-y-3 border-t border-[var(--lp-border)] pt-6">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px] text-[var(--lp-fg-2)]">
                      <Check size={15} className="mt-0.5 shrink-0 text-[var(--lp-coral)]" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Footer
   ============================================================ */
function Footer({ docsUrl, appUrl }: { docsUrl: string; appUrl: string }) {
  const cols = [
    { title: "Product", links: [["Live Terminal", "#terminal"], ["Departments", "#departments"], ["Architecture", "#architecture"], ["Pricing", "#pricing"]] },
    {
      title: "Developers",
      links: [
        ["GitHub Repository", "https://github.com/NeoMagic-coder/Ticosclaw"],
        ["Swagger Docs · /docs", docsUrl],
        ["OpenAPI JSON", `${docsUrl.replace(/\/docs$/, "")}/openapi.json`],
        ["Agent Console", appUrl],
      ],
    },
    { title: "Legal", links: [["KVKK", "#"], ["MIT License", "https://github.com/NeoMagic-coder/Ticosclaw/blob/main/LICENSE"], ["Privacy", "#"], ["Security", "#"]] },
  ];
  return (
    <footer className="relative border-t border-[var(--lp-border)] bg-[var(--lp-bg-0)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px lp-shimmer" />
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-5">
          <div className="col-span-2">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--lp-coral-soft)] text-lg">🦞</span>
              <span className="text-[15px] font-semibold tracking-tight">
                Tic<span className="text-[var(--lp-coral)]">OS</span>Claw
              </span>
            </div>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-[var(--lp-fg-3)]">
              The Autonomous Multi-Agent AI Operating System for single-product e-commerce. Single product. Zero
              employees. 100% autonomous.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <a href="https://github.com/NeoMagic-coder/Ticosclaw" target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--lp-border)] bg-[var(--lp-bg-1)] text-[var(--lp-fg-2)] transition-colors hover:border-[var(--lp-coral)] hover:text-[var(--lp-coral)]">
                <GitBranch size={16} />
              </a>
              <a href={docsUrl} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--lp-border)] bg-[var(--lp-bg-1)] text-[var(--lp-fg-2)] transition-colors hover:border-[var(--lp-coral)] hover:text-[var(--lp-coral)]">
                <FileText size={16} />
              </a>
              <a href={appUrl} className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--lp-border)] bg-[var(--lp-bg-1)] text-[var(--lp-fg-2)] transition-colors hover:border-[var(--lp-coral)] hover:text-[var(--lp-coral)]">
                <Globe size={16} />
              </a>
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="lp-mono text-[11px] uppercase tracking-wider text-[var(--lp-fg-3)]">{c.title}</div>
              <ul className="mt-4 space-y-2.5">
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="text-[13px] text-[var(--lp-fg-2)] transition-colors hover:text-[var(--lp-coral)]">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-[var(--lp-border)] pt-7 sm:flex-row">
          <p className="text-[12.5px] text-[var(--lp-fg-3)]">
            © {new Date().getFullYear()} TicOSClaw · MIT License
          </p>
          <p className="text-[12.5px] text-[var(--lp-fg-2)]">
            Built for the next generation of e-commerce hackers. <span className="lp-float inline-block">🦞</span>
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   Page
   ============================================================ */
export default function LandingPage() {
  const { stats, streamLines, streaming, runLiveDemo, maybeAutoDemo, docsUrl, appUrl } =
    useLandingBackend();

  return (
    <div className="lp-root">
      <Nav stats={stats} appUrl={appUrl} />
      <main>
        <Hero stats={stats} streamLines={streamLines} appUrl={appUrl} docsUrl={docsUrl} />
        <LiveTerminal
          stats={stats}
          streamLines={streamLines}
          streaming={streaming}
          runLiveDemo={runLiveDemo}
          maybeAutoDemo={maybeAutoDemo}
        />
        <Departments stats={stats} />
        <Architecture />
        <Pricing />
      </main>
      <Footer docsUrl={docsUrl} appUrl={appUrl} />
    </div>
  );
}
