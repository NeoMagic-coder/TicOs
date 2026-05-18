import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AgentSpec, Task, Approval, ToolManifest, KnowledgeDocument, ChatMessage, DashboardSummary, AuditLog, Integration, OnboardedProduct, ProductReview, Influencer, GrowthExperiment, EmailFlow, BrandIdentity, ProductEconomicsSnapshot, Skill } from '@/types';
import { agents as seedAgents } from '@/data/agents';
import { tools as seedTools } from '@/data/tools';
import { seedTasks, seedApprovals, seedKnowledge, seedAuditLogs, seedIntegrations, seedChatHistory, makeDashboardForProduct, makeDemoDashboardForProduct } from '@/data/seed';
import { seedOnboardedProduct, seedReviews, seedInfluencers, seedExperiments, seedEmailFlows } from '@/data/oneproduct';
import { callGemini, isGeminiConfigured } from '@/lib/gemini';
import { BASE_URL, chatBackend, chatWithFallback, backendReachable, estimateApprovalImpact as estimateApprovalImpactApi, resolveBackendUrl, streamChatBackend, type ChatBackendResponse, type ChatStreamEvent } from '@/lib/api';
import { v4 as uuidv4 } from 'uuid';
import { pushToast } from '@/components/AOS/Toast';

const ALLOWED_RISK = new Set(['low', 'medium', 'high', 'critical']);

/** Extract /images/... URLs from agent content and resolve them to absolute backend URLs. */
function extractImageUrls(content: string): string[] {
  const urls = new Set<string>();
  for (const m of content.matchAll(/(\/images\/[A-Za-z0-9._-]+)/g)) urls.add(resolveBackendUrl(m[1]));
  for (const m of content.matchAll(/https?:\/\/[^\s)]+\.(?:png|jpe?g|webp|gif)/gi)) urls.add(m[0]);
  return Array.from(urls);
}

interface PersistArgs {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  startedAt: string;
  response: ChatBackendResponse;
}

/** Compact one-line product brief appended to outgoing prompts so the router,
 *  planner and merger all see the active product even when the user's text
 *  doesn't mention it explicitly. */
function productBrief(p: OnboardedProduct | null): string {
  if (!p) return '';
  const channels = p.channels?.length ? p.channels.join(', ') : '—';
  const priorities = p.priorities?.length ? p.priorities.join(', ') : '—';
  return (
    `Aktif ürün: ${p.product_name} · Kategori: ${p.category} · Aşama: ${p.stage} · ` +
    `Pazar: ${p.target_market} · Kanallar: ${channels} · Bütçe: ${p.monthly_budget_band}/ay · ` +
    `Öncelikler: ${priorities}`
  );
}

/** Prepend the product brief to a user/quick-ask message (idempotent). */
function withProductBrief(message: string, p: OnboardedProduct | null): string {
  if (!p) return message;
  const brief = productBrief(p);
  if (message.includes(brief)) return message;
  return `${brief}\n\n${message}`;
}

/** Human-readable label for a Hermes SSE progress event. */
function formatProgressLabel(ev: Extract<ChatStreamEvent, { kind: 'progress' }>): string {
  const agent = (ev.agent_id as string | undefined) ?? '';
  const tool = (ev.tool_id as string | undefined) ?? '';
  switch (ev.event) {
    case 'task_started':    return 'Hermes planlamaya başladı';
    case 'plan_ready':      return `Plan hazır → ${(ev as Record<string, unknown>).primary ?? ''}`;
    case 'agent_started':   return `${agent} çalışıyor`;
    case 'tool_called':     return `${agent} → ${tool}`;
    case 'critic_scored':   return `Critic: ${agent} = ${((ev as Record<string, unknown>).score as number | undefined)?.toFixed(2) ?? '?'}`;
    case 'agent_retry':     return `${agent} yeniden deneniyor`;
    case 'agent_completed': return `${agent} tamamlandı`;
    case 'agent_failed':    return `${agent} hata verdi`;
    case 'merging':         return 'Sonuçlar birleştiriliyor';
    default:                return '';
  }
}

/** Extract the first JSON object/array from a markdown-ish LLM response.
 *  Handles ```json fences, leading/trailing prose, and minor trailing commas. */
function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/i);
  const candidates: string[] = [];
  if (fenced) candidates.push(fenced[1]);
  // Greedy: first { ... last }
  const objStart = text.indexOf('{');
  const objEnd = text.lastIndexOf('}');
  if (objStart >= 0 && objEnd > objStart) candidates.push(text.slice(objStart, objEnd + 1));
  for (const raw of candidates) {
    const cleaned = raw.replace(/,(\s*[}\]])/g, '$1').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // try next
    }
  }
  return null;
}

/** Known app pages — keyed by Turkish synonyms the user may speak. */
const PAGE_ALIASES: Record<string, string> = {
  dashboard: 'dashboard', anasayfa: 'dashboard', 'ana sayfa': 'dashboard', özet: 'dashboard', ozet: 'dashboard',
  chat: 'chat', sohbet: 'chat', supervisor: 'chat',
  marka: 'brand', brand: 'brand', 'marka kimliği': 'brand', 'marka kimligi': 'brand',
  fiyat: 'pricing', pricing: 'pricing', finans: 'pricing', 'fiyat ve finans': 'pricing',
  'email akışları': 'email_flows', 'email akislari': 'email_flows', email: 'email_flows', eposta: 'email_flows', 'e-posta': 'email_flows',
  büyüme: 'growth', buyume: 'growth', growth: 'growth', deney: 'growth', deneyler: 'growth',
  yorumlar: 'reviews', yorum: 'reviews', reviews: 'reviews',
  influencer: 'influencers', 'influencer\'lar': 'influencers', influencers: 'influencers',
  agents: 'agents', ajan: 'agents', ajanlar: 'agents', 'agent office': 'agents',
  görevler: 'tasks', gorevler: 'tasks', tasks: 'tasks', görev: 'tasks',
  onaylar: 'approvals', onay: 'approvals', approvals: 'approvals',
  araçlar: 'tools', araclar: 'tools', tools: 'tools',
  bilgi: 'knowledge', knowledge: 'knowledge', 'bilgi bankası': 'knowledge',
  analitik: 'analytics', analytics: 'analytics', metrikler: 'analytics',
  entegrasyon: 'integrations', entegrasyonlar: 'integrations', integrations: 'integrations',
  audit: 'audit', denetim: 'audit', 'denetim kayıtları': 'audit',
  ayarlar: 'settings', settings: 'settings', ayar: 'settings',
  otonom: 'autonomy', otonomi: 'autonomy', autonomy: 'autonomy', 'otonom karar': 'autonomy',
};

/** Lightweight intent matcher — translates a Turkish chat command into a
 *  supervisor-action verb the store can dispatch. Returns null when no
 *  deterministic action is detected (so the LLM still handles the message).
 *
 *  Uses simple substring matching instead of \b word boundaries because
 *  Turkish agglutination appends case suffixes (-a, -e, -ı, -ları, etc.)
 *  that break ASCII word-boundary logic. */
// Slash command registry — `/foo args` → intent + params. Keeps the dock's
// quick buttons honest (each chip now dispatches a real action instead of
// just prefilling the input box).
const SLASH_COMMANDS: Record<string, (rest: string) => { intent: string; params?: Record<string, string> } | null> = {
  plan:     () => ({ intent: 'navigate', params: { page: 'graph' } }),
  price:    () => ({ intent: 'regenerate_pricing' }),
  pricing:  () => ({ intent: 'regenerate_pricing' }),
  brand:    () => ({ intent: 'regenerate_brand' }),
  reviews:  () => ({ intent: 'draft_review_responses' }),
  reorder:  () => ({ intent: 'navigate', params: { page: 'pricing' } }),
  approve:  () => ({ intent: 'approve_all' }),
  reject:   () => ({ intent: 'reject_all' }),
  sync:     () => ({ intent: 'sync_all_integrations' }),
  reset:    () => ({ intent: 'reset_all' }),
  debug:    () => ({ intent: 'toggle_debug' }),
};

function detectIntent(raw: string): { intent: string; params?: Record<string, string> } | null {
  const t = raw.toLowerCase().trim();
  if (!t) return null;

  // ── Slash commands ──────────────────────────────────────────────────────
  if (t.startsWith('/')) {
    const [head, ...rest] = t.slice(1).split(/\s+/);
    const cmd = SLASH_COMMANDS[head];
    if (cmd) return cmd(rest.join(' '));
    // Unknown slash command — fall through so the message is sent verbatim
    // (Hermes can still try to interpret it).
  }

  const has = (...words: string[]) => words.some((w) => t.includes(w));
  const match = (re: RegExp) => re.test(t);

  // ── Navigation ──────────────────────────────────────────────────────────────
  // A nav intent needs a navigation verb AND a known page alias as substring.
  // Substring matching handles Turkish suffixes: "onaylara", "büyümeye", etc.
  const hasNavVerb =
    has('git', 'sayfas', 'görüntüle', 'goruntule', 'gidelim', 'gidin') ||
    match(/\b(aç|ac|göster|goster|getir|gel)\b/);
  if (hasNavVerb) {
    // Longer aliases first to avoid short-alias false matches.
    const sorted = Object.entries(PAGE_ALIASES).sort((a, b) => b[0].length - a[0].length);
    for (const [alias, page] of sorted) {
      if (t.includes(alias)) return { intent: 'navigate', params: { page } };
    }
  }

  // ── Approvals ────────────────────────────────────────────────────────────────
  if (has('tüm', 'tum', 'hepsi', 'bekleyen') && has('onay') && has('onayla', 'kabul'))
    return { intent: 'approve_all' };
  if (has('tüm', 'tum', 'hepsi', 'bekleyen') && has('onay') && has('reddet', 'iptal', 'red'))
    return { intent: 'reject_all' };

  // Approve / reject single approval by keyword
  const approveOneMatch = t.match(/(.{2,40}?)\s+onayla(?:yı|yı)?\s+onayla|onayla\s+(.{2,40}?)\s+onayl/i);
  if (approveOneMatch) {
    const kw = (approveOneMatch[1] || approveOneMatch[2] || '').trim();
    if (kw) return { intent: 'approve_one', params: { keyword: kw } };
  }

  // ── Brand & Pricing ──────────────────────────────────────────────────────────
  if (has('marka', 'brand') && has('yenile', 'üret', 'uret', 'oluştur', 'olustur', 'yeniden'))
    return { intent: 'regenerate_brand' };
  if (has('fiyat', 'pricing', 'finans', 'ekonomi') && has('yenile', 'üret', 'uret', 'oluştur', 'olustur', 'yeniden', 'analiz'))
    return { intent: 'regenerate_pricing' };

  // ── Integrations ─────────────────────────────────────────────────────────────
  if (has('tüm', 'tum', 'hepsi', 'bütün', 'butun') && has('entegrasyon') && has('senkron', 'sync', 'güncelle', 'guncelle'))
    return { intent: 'sync_all_integrations' };
  const intMatch = t.match(/([a-zçğıöşü0-9.-]+)\s+entegrasyon.{0,20}?(senkron|sync|güncelle|guncelle|bağla|bagla|connect)/i);
  if (intMatch) return { intent: 'sync_integration', params: { platform: intMatch[1] } };

  // ── Email flows ───────────────────────────────────────────────────────────────
  if (has('email', 'e-posta', 'eposta', 'akış', 'akis') && has('yayın', 'yayin', 'başlat', 'baslat', 'aktif', 'hepsini'))
    return { intent: 'publish_all_flows' };

  // ── Experiments ───────────────────────────────────────────────────────────────
  if (has('deney', 'experiment') && has('başlat', 'baslat', 'çalıştır', 'calistir', 'launch') && has('tüm', 'tum', 'hepsi', 'hepsini'))
    return { intent: 'launch_all_experiments' };
  // Single experiment by keyword
  const expMatch = t.match(/(.{2,40}?)\s+deney[i]?\s+(?:başlat|baslat|çalıştır|launch)/i);
  if (expMatch) return { intent: 'launch_experiment', params: { keyword: expMatch[1].trim() } };

  // ── Reviews ───────────────────────────────────────────────────────────────────
  if (has('tüm', 'tum', 'hepsi', 'olumsuz', 'negatif') && has('yorum') && has('yanıt', 'yanit', 'cevap', 'hazırla', 'hazirla'))
    return { intent: 'draft_review_responses' };

  // ── Influencers ───────────────────────────────────────────────────────────────
  if (has('influencer') && has('teklif', 'mesaj', 'gönder', 'gonder', 'ulaş', 'ulas'))
    return { intent: 'contact_influencers' };

  // ── Tools ─────────────────────────────────────────────────────────────────────
  if ((has('araç', 'arac', 'tool') || has('mock', 'live')) && has('mock') && has('live', 'canlı', 'canli') && has('geçir', 'gecir', 'değiştir', 'degistir'))
    return { intent: 'navigate', params: { page: 'tools' } };

  // ── Reset ─────────────────────────────────────────────────────────────────────
  if (has('sıfırla', 'sifirla', 'reset') && has('tüm', 'tum', 'sistem', 'her'))
    return { intent: 'reset_all' };

  // ── Debug ─────────────────────────────────────────────────────────────────────
  if (has('debug') && has('aç', 'kapat', 'toggle'))
    return { intent: 'toggle_debug' };

  return null;
}

/** Materialize a backend Hermes response into Tasks + Approvals + Audit logs. */
let _persistImpl:
  | ((args: PersistArgs) => { taskId: string; approvalCount: number })
  | null = null;
function persistBackendResult(args: PersistArgs) {
  if (!_persistImpl) throw new Error('persist impl not bound');
  return _persistImpl(args);
}

export interface AppState {
  // Navigation
  currentPage: string;
  setCurrentPage: (page: string) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // Agents
  agents: AgentSpec[];
  selectedAgentId: string | null;
  setSelectedAgent: (id: string | null) => void;

  // Tasks
  tasks: Task[];
  selectedTaskId: string | null;
  setSelectedTask: (id: string | null) => void;
  addTask: (task: Partial<Task>) => void;
  updateTaskStatus: (taskId: string, status: Task['status']) => void;

  // Approvals
  approvals: Approval[];
  ingestExternalApproval: (apv: any) => void;
  approveItem: (id: string, note?: string) => void;
  rejectItem: (id: string, note: string) => void;
  estimateApprovalImpact: (id: string) => Promise<void>;

  // Tools
  tools: ToolManifest[];
  selectedToolId: string | null;
  setSelectedTool: (id: string | null) => void;
  toggleToolMode: (toolId: string) => void;
  loadTools: () => Promise<void>;

  // Knowledge
  knowledge: KnowledgeDocument[];
  addKnowledge: (doc: Partial<KnowledgeDocument>) => void;

  // Dashboard
  dashboard: DashboardSummary | null;
  resetAll: () => void;

  // Chat
  chatMessages: ChatMessage[];
  isThinking: boolean;
  /** Backend last-response marker — true when MockProvider was used (no
   *  GEMINI_API_KEY) or Gemini fell back due to quota. UI surfaces a badge. */
  llmDegraded: boolean;
  llmDegradedReason: string | null;
  chatProgress: { event: string; agent_id?: string; tool_id?: string; ts: number; label: string; score?: number; reason?: string; confidence?: number; cost_usd?: number }[];
  /** Frozen chatProgress snapshots per task_id so the Graph page can replay a
   *  completed task's DAG instead of going blank as soon as the next prompt
   *  starts (#26). */
  taskProgressSnapshots: Record<string, { event: string; agent_id?: string; tool_id?: string; ts: number; label: string; score?: number; reason?: string }[]>;
  recentCommands: string[];
  commandHistory: string[];
  addChatMessage: (msg: Partial<ChatMessage>) => void;
  sendUserMessage: (content: string) => void;
  sendUserMessageStream: (content: string) => Promise<void>;
  pushCommandHistory: (cmd: string) => void;

  // Skills (Learning Loop)
  skills: Skill[];
  loadSkills: () => Promise<void>;

  // Audit Logs
  auditLogs: AuditLog[];
  addAuditLog: (log: Partial<AuditLog>) => void;
  clearAuditLogs: () => void;

  // Integrations
  integrations: Integration[];

  // OneProduct — Onboarding
  onboardingComplete: boolean;
  onboardingStep: number;
  onboardingDraft: Partial<OnboardedProduct>;
  onboardedProduct: OnboardedProduct | null;
  setOnboardingStep: (step: number) => void;
  updateOnboardingDraft: (patch: Partial<OnboardedProduct>) => void;
  resetOnboardingDraft: () => void;
  completeOnboarding: () => void;
  /** Reset the onboarding draft + step and route the app back to the wizard
   *  without losing existing products. Used by the sidebar "+ Yeni ürün ekle"
   *  shortcut. */
  startNewProductOnboarding: () => void;
  /** Phase 3 re-hydration. Pulls `/api/v1/products` and the active product's
   *  latest dashboard snapshot from the backend so a page reload restores
   *  what the user had on screen. */
  hydrateFromBackend: () => Promise<void>;
  /** Soft reset: clear transient state (chat, progress, audit) while keeping
   *  products, brand identity and onboarding history. Used by sidebar
   *  "Sayfayı sıfırla". */
  resetTransientState: () => void;
  resetOnboarding: () => void;

  // OneProduct — Brand Identity (agent-generated, per active product)
  brandIdentity: BrandIdentity | null;
  brandIdentityLoading: boolean;
  brandIdentityError: string | null;
  regenerateBrandIdentity: () => Promise<void>;

  // OneProduct — Product Economics (agent-generated, per active product)
  productEconomics: ProductEconomicsSnapshot | null;
  productEconomicsLoading: boolean;
  productEconomicsError: string | null;
  regenerateProductEconomics: () => Promise<void>;
  setProductEconomics: (econ: ProductEconomicsSnapshot | null) => void;

  // OneProduct — Reviews
  reviews: ProductReview[];
  respondToReview: (id: string, response: string) => void;

  // OneProduct — Influencers
  influencers: Influencer[];
  updateInfluencerStatus: (id: string, status: Influencer['contact_status']) => void;

  // OneProduct — Experiments
  experiments: GrowthExperiment[];
  launchExperiment: (id: string) => void;

  // OneProduct — Email flows
  emailFlows: EmailFlow[];
  toggleEmailFlow: (id: string) => void;
  publishEmailFlow: (id: string) => void;

  // Integrations actions
  syncIntegration: (id: string) => Promise<void>;
  fetchIntegrations: () => Promise<void>;
  connectIntegration: (platform: string, icon: string) => Promise<void>;

  // Helper: jump to chat with a prefilled question (used by buttons across pages)
  quickAsk: (content: string) => void;

  // Supervisor command bus — lets the chat actually mutate app state from any page
  executeSupervisorAction: (intent: string, params?: Record<string, string>) => string | null;

  // Floating supervisor dock (global chat on every page)
  supervisorDockOpen: boolean;
  toggleSupervisorDock: () => void;
  setSupervisorDockOpen: (open: boolean) => void;

  // Debug mode
  debugMode: boolean;
  toggleDebugMode: () => void;

  // Backend health (polled every ~15s)
  backendStatus: 'online' | 'offline' | 'unknown';
  backendStatusCheckedAt: string | null;
  fallbackActive: boolean;            // becomes true when last call used Gemini fallback
  setBackendStatus: (s: 'online' | 'offline' | 'unknown', fallback?: boolean) => void;
  pingBackend: () => Promise<void>;

  // Multi-product switcher
  products: OnboardedProduct[];
  switchToProduct: (productName: string) => void;
  addProductToWorkspace: (product: OnboardedProduct) => void;
  /** Removes a product from the workspace. Best-effort DELETE to the backend
   *  registry; if the removed product was active, switches to the next
   *  available one (or clears `onboardedProduct` if list becomes empty). */
  removeProduct: (productName: string) => Promise<void>;

  // Demo / fixture loading
  loadDemoFixtures: () => void;

  // Task retry & detail
  retryTask: (taskId: string) => void;
}

export const useStore = create<AppState>()(persist((set, get) => ({
  // Navigation
  currentPage: 'dashboard',
  setCurrentPage: (page) => set({ currentPage: page }),
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  // Agents
  agents: seedAgents,
  selectedAgentId: null,
  setSelectedAgent: (id) => set({ selectedAgentId: id }),

  // Tasks
  tasks: seedTasks,
  selectedTaskId: null,
  setSelectedTask: (id) => set({ selectedTaskId: id }),
  addTask: (task) => {
    const startedAt = new Date().toISOString();
    const product = get().onboardedProduct;
    const message = task.description
      ? `${task.title || 'Yeni Görev'}\n\n${task.description}`
      : task.title || 'Yeni Görev';

    chatBackend({
      message: withProductBrief(message, product),
      history: [],
      product_context: product
        ? {
            product_name: product.product_name,
            category: product.category,
            stage: product.stage,
            target_market: product.target_market,
            channels: product.channels,
            monthly_budget_band: product.monthly_budget_band,
            priorities: product.priorities,
          }
        : null,
    })
      .then((res) => {
        persistBackendResult({
          title: task.title || 'Yeni Görev',
          description: task.description || '',
          priority: task.priority || 'medium',
          startedAt,
          response: res,
        });
      })
      .catch((err: Error) => {
        // Persist a failed-task placeholder so the user sees what went wrong.
        const tid = `task_${uuidv4().slice(0, 8)}`;
        const failedAt = new Date().toISOString();
        const failed: Task = {
          task_id: tid,
          parent_task_id: null,
          title: task.title || 'Yeni Görev',
          description: task.description || '',
          goal: task.goal || '',
          status: 'failed',
          priority: task.priority || 'medium',
          assigned_agent_id: null,
          context: {},
          constraints: [],
          required_capabilities: [],
          output_schema: {},
          max_iterations: 5,
          deadline: null,
          approval_required: false,
          confidence: null,
          iterations_used: 0,
          sub_tasks: [],
          tools_called: [],
          messages: [],
          created_at: startedAt,
          updated_at: failedAt,
          completed_at: failedAt,
          result: null,
        };
        set((s) => ({ tasks: [failed, ...s.tasks] }));
        get().addAuditLog({
          action: 'task.failed',
          actor_type: 'system', actor_id: 'backend', actor_name: 'Backend',
          details: `"${failed.title}" başarısız: ${err.message}`,
        });
      });
  },
  updateTaskStatus: (taskId, status) => {
    set((s) => ({
      tasks: s.tasks.map((t) => t.task_id === taskId ? { ...t, status, updated_at: new Date().toISOString() } : t),
    }));
  },

  // Approvals
  approvals: seedApprovals,
  ingestExternalApproval: (apv: any) => {
    if (!apv?.id) return;
    set((s) => {
      if (s.approvals.some((a) => a.id === apv.id)) return s;
      const normalized: any = {
        id: apv.id,
        agent_id: apv.requester || apv.agent_id || 'system',
        action: apv.title || apv.action || 'Onay',
        title: apv.title || apv.action || 'Onay',
        kind: apv.type || apv.kind || 'genel',
        rationale: apv.rationale || '',
        risk_level: apv.risk || 'medium',
        confidence: apv.confidence ?? 0.85,
        status: 'pending',
        change_summary: apv.delta || '',
        tools_used: Array.isArray(apv.tools) ? apv.tools : [],
        created_at: new Date().toISOString(),
      };
      return { approvals: [normalized, ...s.approvals] };
    });
  },
  approveItem: (id, note) => {
    const target = get().approvals.find((a) => a.id === id);
    set((s) => ({
      approvals: s.approvals.map((a) => a.id === id ? { ...a, status: 'approved' as const, reviewer_note: note || 'Onaylandı', resolved_at: new Date().toISOString() } : a),
    }));
    get().addAuditLog({ action: 'approval.approved', actor_type: 'user', actor_id: 'user_1', actor_name: 'Kullanıcı', details: `Onay #${id} kabul edildi` });
    pushToast({ kind: 'success', title: 'Onaylandı', body: target?.action || `#${id}` });
  },
  rejectItem: (id, note) => {
    const target = get().approvals.find((a) => a.id === id);
    set((s) => ({
      approvals: s.approvals.map((a) => a.id === id ? { ...a, status: 'rejected' as const, reviewer_note: note, resolved_at: new Date().toISOString() } : a),
    }));
    get().addAuditLog({ action: 'approval.rejected', actor_type: 'user', actor_id: 'user_1', actor_name: 'Kullanıcı', details: `Onay #${id} reddedildi: ${note}` });
    pushToast({ kind: 'info', title: 'Reddedildi', body: target?.action || `#${id}` });
  },
  estimateApprovalImpact: async (id) => {
    const impact = await estimateApprovalImpactApi(id);
    if (!impact) return;
    set((s) => ({
      approvals: s.approvals.map((a) => a.id === id ? { ...a, expected_impact: impact } : a),
    }));
    get().addAuditLog({
      action: 'approval.impact_estimated',
      actor_type: 'agent', actor_id: 'supervisor', actor_name: 'Supervisor',
      details: `#${id}: ${impact.slice(0, 120)}`,
    });
  },

  // Tools
  tools: seedTools,
  selectedToolId: null,
  setSelectedTool: (id) => set({ selectedToolId: id }),
  toggleToolMode: (toolId) => {
    set((s) => ({
      tools: s.tools.map((t) => t.tool_id === toolId ? { ...t, mode: t.mode === 'mock' ? 'live' as const : 'mock' as const } : t),
    }));
    const tool = get().tools.find((t) => t.tool_id === toolId);
    get().addAuditLog({ action: 'tool.mode_changed', actor_type: 'user', actor_id: 'user_1', actor_name: 'Kullanıcı', details: `${tool?.name} → ${tool?.mode}` });
  },
  loadTools: async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/tools`);
      if (!res.ok) return;
      const data: ToolManifest[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        set({ tools: data });
      }
    } catch {
      // Backend unreachable — keep seed tools as fallback
    }
  },

  // Knowledge
  knowledge: seedKnowledge,
  addKnowledge: (doc) => {
    const newDoc: KnowledgeDocument = {
      id: `doc_${uuidv4().slice(0, 8)}`,
      title: doc.title || 'Yeni Doküman',
      type: doc.type || 'md',
      category: doc.category || 'Genel',
      tags: doc.tags || [],
      content_preview: doc.content_preview || '',
      chunks_count: 0,
      uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    set((s) => ({ knowledge: [newDoc, ...s.knowledge] }));
  },

  // Dashboard — only populated when a product is onboarded
  dashboard: null,
  resetAll: () => {
    const keepCurrentPage = get().currentPage;
    const product = get().onboardedProduct;
    set({
      agents: JSON.parse(JSON.stringify(seedAgents)),
      selectedAgentId: null,
      tasks: JSON.parse(JSON.stringify(seedTasks)),
      selectedTaskId: null,
      approvals: JSON.parse(JSON.stringify(seedApprovals)),
      tools: JSON.parse(JSON.stringify(seedTools)),
      selectedToolId: null,
      knowledge: JSON.parse(JSON.stringify(seedKnowledge)),
      dashboard: product ? JSON.parse(JSON.stringify(makeDashboardForProduct(product))) : null,
      chatMessages: JSON.parse(JSON.stringify(seedChatHistory)),
      isThinking: false,
      auditLogs: JSON.parse(JSON.stringify(seedAuditLogs)),
      integrations: JSON.parse(JSON.stringify(seedIntegrations)),
      brandIdentity: null,
      brandIdentityLoading: false,
      brandIdentityError: null,
      productEconomics: null,
      productEconomicsLoading: false,
      productEconomicsError: null,
      reviews: JSON.parse(JSON.stringify(seedReviews)),
      influencers: JSON.parse(JSON.stringify(seedInfluencers)),
      experiments: JSON.parse(JSON.stringify(seedExperiments)),
      emailFlows: JSON.parse(JSON.stringify(seedEmailFlows)),
      debugMode: false,
      currentPage: keepCurrentPage,
    });
    get().addAuditLog({
      action: 'system.reset',
      actor_type: 'system', actor_id: 'system', actor_name: 'Sistem',
      details: product
        ? `Tüm veri sıfırlandı — ${product.product_name} için yeniden başlatıldı`
        : 'Tüm veri sıfırlandı',
    });
  },

  // Chat
  chatMessages: seedChatHistory,
  isThinking: false,
  chatProgress: [],
  taskProgressSnapshots: {},
  llmDegraded: false,
  llmDegradedReason: null,
  recentCommands: [],
  commandHistory: [],
  pushCommandHistory: (cmd) => {
    set((s) => ({
      commandHistory: [cmd, ...s.commandHistory.filter((c) => c !== cmd)].slice(0, 50),
    }));
  },

  // Skills (Learning Loop)
  skills: [],
  loadSkills: async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/skills`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) set({ skills: data });
    } catch {
      // backend unreachable
    }
  },

  addChatMessage: (msg) => {
    const newMsg: ChatMessage = {
      id: `chat_${uuidv4().slice(0, 8)}`,
      role: msg.role || 'user',
      content: msg.content || '',
      agent_id: msg.agent_id,
      task_id: msg.task_id,
      thinking: msg.thinking,
      tools_used: msg.tools_used,
      timestamp: new Date().toISOString(),
    };
    set((s) => ({ chatMessages: [...s.chatMessages, newMsg] }));
  },
  sendUserMessage: async (content) => {
    const state = get();
    state.addChatMessage({ role: 'user', content });

    // Track recent commands (last 5 unique) + full command history (last 50).
    set((s) => ({
      recentCommands: [content, ...s.recentCommands.filter((c) => c !== content)].slice(0, 5),
    }));
    get().pushCommandHistory(content);

    // First, try to handle the message as a deterministic supervisor command.
    // If matched, run it locally and short-circuit the backend call so the
    // chat truly affects every page (navigation, approvals, syncs, etc.).
    const intent = detectIntent(content);
    if (intent) {
      const ack = get().executeSupervisorAction(intent.intent, intent.params);
      if (ack) {
        get().addChatMessage({
          role: 'assistant',
          agent_id: 'supervisor',
          content: ack,
        });
        return;
      }
    }

    set({ isThinking: true });

    const product = state.onboardedProduct;
    const history = state.chatMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const startedAt = new Date().toISOString();

    try {
      const res = await chatBackend({
        message: withProductBrief(content, product),
        history,
        product_context: product
          ? {
              product_name: product.product_name,
              category: product.category,
              stage: product.stage,
              target_market: product.target_market,
              channels: product.channels,
              monthly_budget_band: product.monthly_budget_band,
              priorities: product.priorities,
            }
          : null,
      });

      set({ isThinking: false });

      // 1. Mirror backend run as a Task so the chat command leaves a trail.
      const persisted = persistBackendResult({
        title: content.length > 80 ? `${content.slice(0, 77)}…` : content,
        description: content,
        priority: 'medium',
        startedAt,
        response: res,
      });

      // 2. Add chat reply with image references (if any).
      const images = extractImageUrls(res.content);
      get().addChatMessage({
        role: 'assistant',
        agent_id: res.agent_outputs[0]?.agent_id ?? 'supervisor',
        content: images.length > 0
          ? `${res.content}\n\n${images.map((u) => `![görsel](${u})`).join('\n')}`
          : res.content,
        task_id: persisted.taskId,
        thinking: res.thinking ?? undefined,
        tools_used: res.tools_used,
      });

      get().addAuditLog({
        action: 'supervisor.command',
        actor_type: 'agent',
        actor_id: 'hermes',
        actor_name: 'Hermes',
        details: `Chat → ${res.agent_outputs.length} ajan, ${res.tools_used.length} tool, ${persisted.approvalCount} onay, ${(res.confidence * 100).toFixed(0)}% güven`,
      });
    } catch (err) {
      set({ isThinking: false });
      const message = err instanceof Error ? err.message : String(err);
      const systemPrompt =
        'Sen OneProduct Agent OS\'un CEO/Supervisor rolündesin. Türkçe, somut, aksiyona dönük cevap ver. ' +
        (product ? productBrief(product) : '');
      const enrichedUser = withProductBrief(content, product);

      const fallbackErrors: string[] = [];

      // Fallback 1: direct Gemini from browser.
      if (isGeminiConfigured()) {
        const result = await callGemini({ system: systemPrompt, history, user: enrichedUser });
        if (!result.error) {
          get().addChatMessage({
            role: 'assistant',
            agent_id: 'supervisor',
            content: `${result.text}\n\n_(backend offline — tarayıcıdan doğrudan Gemini çağrıldı)_`,
          });
          pushToast({
            kind: 'warn',
            title: 'Backend offline — Gemini fallback aktif',
            body: 'Hermes/OpenClaw devre dışı; cevap doğrudan Gemini\'den alındı.',
          });
          return;
        }
        fallbackErrors.push(`Gemini: ${result.error}`);
      }

      const detail = fallbackErrors.length ? ` Fallback: ${fallbackErrors.join(' | ')}` : '';
      get().addChatMessage({
        role: 'assistant',
        agent_id: 'supervisor',
        content: `⚠️ Backend çağrısı başarısız: ${message}.${detail}`,
      });
      pushToast({
        kind: 'error',
        title: 'Backend çağrısı başarısız',
        body: `${message}${detail}`,
      });
      get().addAuditLog({
        action: 'backend.error',
        actor_type: 'system',
        actor_id: 'backend',
        actor_name: 'Backend',
        details: `${message}${detail}`,
      });
    }
  },

  sendUserMessageStream: async (content: string) => {
    // SSE-streamed counterpart of sendUserMessage. Pushes live progress into
    // `chatProgress` while Hermes runs, then materialises the same chat reply
    // + Task + Audit trail the buffered path produces.
    const state = get();
    state.addChatMessage({ role: 'user', content });
    get().pushCommandHistory(content);

    const product = state.onboardedProduct;
    const history = state.chatMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-10)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    const startedAt = new Date().toISOString();

    set({ isThinking: true, chatProgress: [] });

    const pushProgress = (label: string, e: ChatStreamEvent & { kind: 'progress' }) => {
      const agent_id = (e as Record<string, unknown>).agent_id as string | undefined;
      const tool_id = (e as Record<string, unknown>).tool_id as string | undefined;
      const score = (e as Record<string, unknown>).score as number | undefined;
      const reason = (e as Record<string, unknown>).reason as string | undefined;
      const confidence = (e as Record<string, unknown>).confidence as number | undefined;
      const cost_usd = (e as Record<string, unknown>).cost_usd as number | undefined;
      set((s) => {
        // Dedup: a server retry / reconnect can resend the same event.
        // Drop if the most recent entry has the same (event, agent, tool)
        // tuple within the last 500ms.
        const last = s.chatProgress[s.chatProgress.length - 1];
        const isDuplicate =
          last &&
          last.event === e.event &&
          last.agent_id === agent_id &&
          last.tool_id === tool_id &&
          Date.now() - last.ts < 500;
        if (isDuplicate) return {} as Partial<typeof s>;
        return {
          chatProgress: [
            ...s.chatProgress,
            { event: e.event, agent_id, tool_id, ts: Date.now(), label, score, reason, confidence, cost_usd },
          ].slice(-25),
        };
      });
    };

    try {
      const iterator = await streamChatBackend({
        message: withProductBrief(content, product),
        history,
        product_context: product
          ? {
              product_name: product.product_name,
              category: product.category,
              stage: product.stage,
              target_market: product.target_market,
              channels: product.channels,
              monthly_budget_band: product.monthly_budget_band,
              priorities: product.priorities,
            }
          : null,
      });

      let finalRes: ChatBackendResponse | null = null;
      for await (const ev of iterator) {
        if (ev.kind === 'progress') {
          const label = formatProgressLabel(ev);
          if (label) pushProgress(label, ev);
        } else if (ev.kind === 'message') {
          finalRes = ev.payload;
        } else if (ev.kind === 'error') {
          throw new Error(ev.error);
        }
      }

      set({ isThinking: false });

      if (!finalRes) {
        throw new Error('Stream sona erdi ama final yanıt alınamadı.');
      }

      const persisted = persistBackendResult({
        title: content.length > 80 ? `${content.slice(0, 77)}…` : content,
        description: content,
        priority: 'medium',
        startedAt,
        response: finalRes,
      });

      const images = extractImageUrls(finalRes.content);
      get().addChatMessage({
        role: 'assistant',
        agent_id: finalRes.agent_outputs[0]?.agent_id ?? 'supervisor',
        content: images.length > 0
          ? `${finalRes.content}\n\n${images.map((u) => `![görsel](${u})`).join('\n')}`
          : finalRes.content,
        task_id: persisted.taskId,
        thinking: finalRes.thinking ?? undefined,
        tools_used: finalRes.tools_used,
      });
      get().addAuditLog({
        action: 'supervisor.command.stream',
        actor_type: 'agent',
        actor_id: 'hermes',
        actor_name: 'Hermes',
        details: `Stream → ${finalRes.agent_outputs.length} ajan, ${finalRes.tools_used.length} tool, ${(finalRes.confidence * 100).toFixed(0)}% güven`,
      });
    } catch (err) {
      set({ isThinking: false });
      const raw = err instanceof Error ? err.message : String(err);
      const isOffline = /Failed to fetch|NetworkError|ECONNREFUSED|TypeError/i.test(raw);
      const friendly = isOffline
        ? `Backend çevrimdışı (${BASE_URL}) — demo modu devam ediyor.`
        : `Canlı akış kesildi: ${raw}`;
      get().addChatMessage({
        role: 'assistant',
        agent_id: 'supervisor',
        content: `⚠️ ${friendly} Düz mod ile tekrar deneniyor…`,
      });
      pushToast({
        kind: 'warn',
        title: isOffline ? 'Backend çevrimdışı' : 'SSE bağlantısı koptu',
        body: isOffline
          ? 'Sunucuya ulaşılamıyor — yanıt buffered/Gemini fallback ile sağlanacak.'
          : `${raw} — buffered path ile devam ediliyor.`,
      });
      // Fall back to the buffered path so the user still gets a reply.
      await get().sendUserMessage(content);
    }
  },

  // Audit Logs
  auditLogs: seedAuditLogs,
  addAuditLog: (log) => {
    const newLog: AuditLog = {
      id: `log_${uuidv4().slice(0, 8)}`,
      action: log.action || 'unknown',
      actor_type: log.actor_type || 'system',
      actor_id: log.actor_id || 'system',
      actor_name: log.actor_name || 'Sistem',
      details: log.details || '',
      metadata: log.metadata || {},
      timestamp: new Date().toISOString(),
    };
    // Retention: keep the most recent 1000 entries to cap in-memory growth.
    // Anything beyond that is dropped on insert — audit page truncates the
    // visible window anyway.
    set((s) => ({ auditLogs: [newLog, ...s.auditLogs].slice(0, 1000) }));
  },
  clearAuditLogs: () => set({ auditLogs: [] }),

  // Integrations
  integrations: seedIntegrations,

  // OneProduct — Onboarding (no product onboarded by default)
  onboardingComplete: false,
  onboardingStep: 1,
  onboardingDraft: {},
  onboardedProduct: seedOnboardedProduct,
  setOnboardingStep: (step) => set({ onboardingStep: step }),
  updateOnboardingDraft: (patch) => set((s) => ({ onboardingDraft: { ...s.onboardingDraft, ...patch } })),
  resetOnboardingDraft: () => set({ onboardingDraft: {}, onboardingStep: 1 }),
  hydrateFromBackend: async () => {
    // E2E tests run against a real backend that accumulates products as
    // each test onboards a new one. Auto-restoring those into the next test
    // breaks the onboarding-wizard assumption (fresh state). Detect Playwright
    // via the `webdriver` flag and skip hydration there.
    if (typeof navigator !== 'undefined' && (navigator as any).webdriver) {
      return;
    }
    try {
      const productsRes = await fetch(`${BASE_URL}/api/v1/products`, { signal: AbortSignal.timeout(4000) });
      if (!productsRes.ok) return;
      const list: any[] = await productsRes.json();
      if (!Array.isArray(list) || list.length === 0) return;
      const products: OnboardedProduct[] = list.map((p) => ({
        product_name: p.product_name,
        product_description: p.product_description || '',
        category: p.category || 'Genel',
        reference_url: p.reference_url || '',
        image_url: p.image_url || '📦',
        stage: p.stage || 'idea',
        target_market: p.target_market || 'TR',
        channels: p.channels || ['Shopify'],
        monthly_budget_band: p.monthly_budget_band || '0-5k',
        priorities: p.priorities || ['fast_sales'],
        health_score: 42,
        onboarded_at: p.onboarded_at || new Date().toISOString(),
      }));
      const active = list.find((p) => p.is_active) || list[0];
      const activeProduct = products.find((p) => p.product_name === active.product_name) || products[0];
      set((s) => ({
        products,
        onboardedProduct: activeProduct,
        // Keep the in-memory dashboard if it's already populated for the same
        // product (preserves demo-fixture state across hydration races).
        dashboard: s.dashboard && s.onboardedProduct?.product_name === activeProduct.product_name
          ? s.dashboard
          : makeDashboardForProduct(activeProduct),
        onboardingComplete: true,
        currentPage: s.currentPage === 'onboarding' ? 'dashboard' : s.currentPage,
      }));
      // Pull the latest snapshot for the active product. If the rollup table
      // has a row, it replaces the in-memory dashboard with the persisted one
      // (which carries `source` + `measured_at` for the Telemetry layer).
      try {
        const snapRes = await fetch(`${BASE_URL}/api/v1/dashboard/snapshot?product=${encodeURIComponent(activeProduct.product_name)}`, {
          signal: AbortSignal.timeout(4000),
        });
        if (snapRes.ok) {
          const data = await snapRes.json();
          const snap = data?.snapshot;
          if (snap) {
            set({
              dashboard: {
                today_sales: snap.today_sales || 0,
                today_orders: snap.today_orders || 0,
                today_roas: snap.today_roas || 0,
                avg_order_value: snap.avg_order_value || 0,
                conversion_rate: snap.conversion_rate || 0,
                active_campaigns: 0,
                pending_approvals: 0,
                active_tasks: 0,
                critical_alerts: [],
                recent_tasks: [],
                agent_activity: [],
                sales_trend: snap.sales_trend || [],
                orders_trend: snap.orders_trend || [],
                roas_trend: snap.roas_trend || [],
                channel_performance: snap.channel_performance || [],
                _isDemo: snap.source === 'demo',
                _measured_at: snap.measured_at,
              } as any,
            });
          }
        }
      } catch {
        /* no snapshot endpoint or no rows yet */
      }
      get().addAuditLog({
        action: 'app.hydrated',
        actor_type: 'system', actor_id: 'frontend', actor_name: 'Frontend',
        details: `${products.length} ürün backend'den yüklendi · aktif: ${activeProduct.product_name}`,
      });
    } catch {
      /* backend offline — keep whatever state we already have */
    }
  },
  startNewProductOnboarding: () => {
    set({
      onboardingDraft: {},
      onboardingStep: 1,
      currentPage: 'onboarding',
    });
    get().addAuditLog({
      action: 'onboarding.new_product_started',
      actor_type: 'user', actor_id: 'user_1', actor_name: 'Kullanıcı',
      details: 'Yeni ürün ekleme akışı başlatıldı',
    });
  },
  resetTransientState: () => {
    set({
      chatMessages: [],
      chatProgress: [],
      auditLogs: [],
      tasks: [],
      approvals: [],
    });
    pushToast({ kind: 'info', title: 'Sayfa sıfırlandı', body: 'Sohbet, görev, onay ve log geçmişi temizlendi. Ürünler ve marka kimliği korundu.' });
  },
  completeOnboarding: () => {
    const d = get().onboardingDraft;
    const product: OnboardedProduct = {
      product_name: d.product_name || 'Yeni Ürün',
      product_description: d.product_description || '',
      category: d.category || 'Genel',
      reference_url: d.reference_url || '',
      image_url: d.image_url || '📦',
      stage: d.stage || 'idea',
      target_market: d.target_market || 'TR',
      channels: d.channels || ['Shopify'],
      monthly_budget_band: d.monthly_budget_band || '0-5k',
      priorities: d.priorities || ['fast_sales'],
      health_score: 42,
      onboarded_at: new Date().toISOString(),
    };
    set((s) => {
      const isNewProduct = !s.products.some((p) => p.product_name === product.product_name);
      // Preserve existing dashboard demo data when re-running onboarding for the
      // active product so users don't lose the populated metrics they were
      // looking at. Only rebuild when a genuinely new product is added.
      const nextDashboard =
        !isNewProduct && s.dashboard ? s.dashboard : makeDashboardForProduct(product);
      return {
        onboardedProduct: product,
        onboardingComplete: true,
        currentPage: 'dashboard',
        dashboard: nextDashboard,
        brandIdentity: null,
        brandIdentityError: null,
        productEconomics: null,
        productEconomicsError: null,
        products: isNewProduct ? [...s.products, product] : s.products,
      };
    });
    get().addAuditLog({
      action: 'onboarding.completed',
      actor_type: 'user', actor_id: 'user_1', actor_name: 'Kullanıcı',
      details: `Ürün onboard edildi: ${product.product_name}`,
    });
    // Best-effort persistence — the backend products registry survives reloads
    // and is the seed for per-product telemetry in Phase 3.
    fetch(`${BASE_URL}/api/v1/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
    get().addChatMessage({
      role: 'assistant',
      agent_id: 'supervisor',
      content: `**${product.product_name}** onboard edildi. Pazar araştırması, marka kimliği ve fiyatlama ön analizi şimdi başlatılıyor — sonuçlar **Görevler** sayfasına düşecek.`,
      thinking: 'Onboarding sonrası ön analiz görevi Hermes\'e gönderildi.',
    });
    // Auto-dispatch a real Hermes task. persistBackendResult will materialize
    // the result into Tasks + Approvals + Audit so the user sees real output.
    const onboardMessage = [
      `Yeni ürün onboard edildi: ${product.product_name} (${product.category}).`,
      product.product_description ? `Açıklama: ${product.product_description}` : '',
      `Aşama: ${product.stage}, Pazar: ${product.target_market}, Kanallar: ${product.channels.join(', ')}.`,
      `Aylık bütçe bandı: ${product.monthly_budget_band}. Öncelikler: ${product.priorities.join(', ')}.`,
      '',
      'Lütfen şunları yap:',
      '1) Pazar büyüklüğü ve niş skoru analizi.',
      '2) 3 marka ismi + slogan + hedef persona önerisi.',
      '3) Önerilen fiyat aralığı ve marj projeksiyonu.',
    ].filter(Boolean).join('\n');
    get().addTask({
      title: `${product.product_name} — ön analiz`,
      description: onboardMessage,
      priority: 'high',
    });
    // Kick off brand identity generation in parallel so the Brand page lands
    // populated instead of showing placeholder gray swatches.
    void get().regenerateBrandIdentity?.();
  },
  resetOnboarding: () => set({
    onboardingComplete: false,
    onboardingStep: 1,
    onboardingDraft: {},
    currentPage: 'onboarding',
    brandIdentity: null,
    brandIdentityError: null,
    productEconomics: null,
    productEconomicsError: null,
  }),

  // Brand Identity (agent-generated)
  brandIdentity: null,
  brandIdentityLoading: false,
  brandIdentityError: null,
  regenerateBrandIdentity: async () => {
    const state = get();
    const product = state.onboardedProduct;
    if (!product) {
      set({ brandIdentityError: 'Önce bir ürün onboard et.' });
      return;
    }
    set({ brandIdentityLoading: true, brandIdentityError: null });
    const prompt = [
      productBrief(product),
      '',
      `Sen Brand Identity Agent\'sın. Yukarıdaki ürün için yepyeni bir marka kimliği üret.`,
      `Önemli: GranitPro, Stonecook, Çinko gibi tencere/mutfak markalarını ASLA referans alma — bu ürünün gerçek kategorisine göre özgün öneriler ver.`,
      'YALNIZCA aşağıdaki JSON şemasında, başka açıklama olmadan cevap ver. Tüm metinler Türkçe olsun.',
      '',
      '```json',
      '{',
      '  "brand_name": "string (önerilen ana marka adı)",',
      '  "tagline": "string (en güçlü tek slogan)",',
      '  "taglines": ["string (4 alternatif slogan, farklı ton/uzunluk)"],',
      '  "story": "string (3-4 cümlelik marka hikayesi, kuruluş motivasyonu + müşteri vaadi)",',
      '  "positioning": "string (tek cümlelik X için Y sağlayan Z konumlandırması)",',
      '  "mission": "string (markanın bugünkü amacı, 1-2 cümle)",',
      '  "vision": "string (5 yıllık ufuk, 1-2 cümle)",',
      '  "archetype": "string (Jungian arketip: Kahraman|Bilge|Aşık|Maceracı|Yaratıcı|Hükümdar|Sıradan|Şakacı|Bakıcı|Masum|Asi|Sihirbaz)",',
      '  "elevator_pitch": "string (30 saniyelik tanıtım, 2-3 cümle)",',
      '  "usp": "string (rakiplerden ayıran tek cümlelik vaat)",',
      '  "values": [{"name":"string","description":"string (değerin davranışsal karşılığı)"}],',
      '  "differentiators": ["string (rakiplerden ayrışan somut özellikler)"],',
      '  "tone_examples": [{"context":"ürün açıklaması|sosyal medya post|e-posta açılış|destek mesajı|reklam başlığı","example":"string (markanın ağzından örnek cümle)"}],',
      '  "hashtags": ["#string"],',
      '  "keywords": ["string (SEO + reklam için anahtar kelimeler)"],',
      '  "typography": {"heading":"font ailesi","body":"font ailesi","rationale":"neden bu eşleşme"},',
      '  "logo_concepts": [{"name":"string","description":"string (sembol + tipografi yönü)"}],',
      '  "imagery_style": {"mood":"string","do":["string"],"dont":["string"],"references":["string (sahne/kompozisyon örnekleri)"]},',
      '  "competitors": [{"name":"string","positioning":"string","gap":"string (bu markanın doldurduğu boşluk)"}],',
      '  "alternatives": [{"name":"string","score":0,"domain":"string ✓ veya ✗","reasoning":"string"}],',
      '  "palette": [{"role":"Primary|Secondary|Accent|Neutral|Background","hex":"#RRGGBB","label":"string (renge verilen isim)"}],',
      '  "voice": {"traits":["string"],"do":["string"],"dont":["string"]},',
      '  "personas": [{"name":"string","age":"string","goal":"string","objection":"string","channel":"string","emoji":"string"}],',
      '  "social_handles": [{"platform":"Instagram|TikTok|YouTube|Twitter|LinkedIn","handle":"@string","available":true}]',
      '}',
      '```',
      'Minimum sayılar: taglines ≥ 4, values ≥ 4, differentiators ≥ 4, tone_examples ≥ 5, hashtags ≥ 6, keywords ≥ 8, logo_concepts ≥ 3, competitors ≥ 3, alternatives ≥ 4, palette ≥ 5 (Primary + Secondary + Accent + 2 Neutral), voice.traits ≥ 5, voice.do ≥ 4, voice.dont ≥ 4, personas ≥ 3, social_handles ≥ 4. Her metin alanı somut, ürün/kategoriye özgü olsun — jenerik pazarlama klişesi yazma.',
    ].join('\n');

    try {
      // Brand identity expects strict JSON. Phase-4 priority: try the
      // server-side `/api/v1/brand/regenerate-identity` endpoint FIRST so the
      // browser doesn't need `VITE_GEMINI_API_KEY`. Direct Gemini call stays
      // as a last-resort fallback when the backend is unreachable AND the
      // browser still has a key configured (legacy local dev).
      const sources: string[] = [];
      try {
        const serverRes = await fetch(`${BASE_URL}/api/v1/brand/regenerate-identity`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product: {
              product_name: product.product_name,
              product_description: product.product_description || '',
              category: product.category,
              stage: product.stage,
              target_market: product.target_market,
              channels: product.channels,
              monthly_budget_band: product.monthly_budget_band,
              priorities: product.priorities,
            },
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (serverRes.ok) {
          const data = await serverRes.json();
          if (data?.identity) {
            sources.push(JSON.stringify(data.identity));
          }
        } else {
          const body = await serverRes.text();
          get().addAuditLog({
            action: 'brand_identity.server_failed',
            actor_type: 'system', actor_id: 'backend', actor_name: 'Backend',
            details: `HTTP ${serverRes.status}: ${body.slice(0, 200)}`,
          });
        }
      } catch (err: any) {
        get().addAuditLog({
          action: 'brand_identity.server_unreachable',
          actor_type: 'system', actor_id: 'backend', actor_name: 'Backend',
          details: err?.message || String(err),
        });
      }
      // Legacy fallback — only used if backend didn't deliver AND a browser
      // key is still configured. New deployments should not need this path.
      if (sources.length === 0 && isGeminiConfigured()) {
        const direct = await callGemini({
          system: 'Sen Brand Identity Agent\'sın. Yalnızca geçerli JSON üret, başka metin/yorum yazma.',
          history: [],
          user: prompt,
          json: true,
          maxOutputTokens: 8192,
        });
        if (direct.text) sources.push(direct.text);
        if (direct.error) {
          get().addAuditLog({
            action: 'brand_identity.gemini_direct_failed',
            actor_type: 'system', actor_id: 'frontend', actor_name: 'Frontend',
            details: direct.error,
          });
        }
      }
      // Fallback to the Hermes pipeline if direct call had nothing usable.
      let res: any = { content: '', agent_outputs: [] };
      let fallback_used = false;
      if (sources.length === 0) {
        const out = await chatWithFallback(
          {
            message: prompt,
            history: [],
            product_context: {
              product_name: product.product_name,
              category: product.category,
              stage: product.stage,
              target_market: product.target_market,
              channels: product.channels,
              monthly_budget_band: product.monthly_budget_band,
              priorities: product.priorities,
            },
          },
          isGeminiConfigured()
            ? async (system, user) => callGemini({ system, history: [], user, json: true, maxOutputTokens: 8192 })
            : undefined,
        );
        res = out.response;
        fallback_used = out.fallback_used;
        sources.push(res.content, ...res.agent_outputs.map((a: any) => a.content || a.summary));
      }
      if (fallback_used) {
        set({ fallbackActive: true, backendStatus: 'offline' });
        get().addAuditLog({
          action: 'fallback.used',
          actor_type: 'system', actor_id: 'frontend', actor_name: 'Frontend',
          details: 'Backend kapalı — Gemini fallback kullanıldı',
          metadata: { fallback_used: true },
        });
      }
      let parsed: BrandIdentity | null = null;
      for (const src of sources) {
        const obj = extractJson<Partial<BrandIdentity>>(src || '');
        if (obj && typeof obj.brand_name === 'string') {
          parsed = {
            brand_name: obj.brand_name,
            tagline: obj.tagline || '',
            story: obj.story || '',
            positioning: obj.positioning || '',
            mission: obj.mission || '',
            vision: obj.vision || '',
            archetype: obj.archetype || '',
            elevator_pitch: obj.elevator_pitch || '',
            usp: obj.usp || '',
            values: Array.isArray(obj.values) ? obj.values : [],
            differentiators: Array.isArray(obj.differentiators) ? obj.differentiators : [],
            taglines: Array.isArray(obj.taglines) ? obj.taglines : [],
            tone_examples: Array.isArray(obj.tone_examples) ? obj.tone_examples : [],
            hashtags: Array.isArray(obj.hashtags) ? obj.hashtags : [],
            keywords: Array.isArray(obj.keywords) ? obj.keywords : [],
            typography: obj.typography || undefined,
            logo_concepts: Array.isArray(obj.logo_concepts) ? obj.logo_concepts : [],
            imagery_style: obj.imagery_style || undefined,
            competitors: Array.isArray(obj.competitors) ? obj.competitors : [],
            alternatives: Array.isArray(obj.alternatives) ? obj.alternatives : [],
            palette: Array.isArray(obj.palette) ? obj.palette : [],
            voice: obj.voice || { traits: [], do: [], dont: [] },
            personas: Array.isArray(obj.personas) ? obj.personas : [],
            social_handles: Array.isArray(obj.social_handles) ? obj.social_handles : [],
            generated_at: new Date().toISOString(),
          };
          break;
        }
      }
      if (!parsed) {
        const failedAgents = res.agent_outputs.filter((a: any) => a.status === 'failed');
        const errorSnippet = failedAgents[0]?.content || failedAgents[0]?.summary || '';
        const rawSnippet = (sources.find(s => s && s.length > 0) || '').slice(0, 240);
        let userMessage: string;
        if (/api key/i.test(errorSnippet) || /API key not valid/i.test(res.content || '')) {
          userMessage =
            'Backend Gemini API anahtarını geçersiz görüyor. ' +
            'Backend\'i durdurup PowerShell\'de `Remove-Item Env:GEMINI_API_KEY` çalıştırdıktan sonra ' +
            'yeniden başlatman gerekiyor — yoksa .env.local\'daki geçerli anahtar yerine ' +
            'eski sistem env anahtarı kullanılıyor.';
        } else if (errorSnippet) {
          userMessage = `Ajan başarısız oldu: ${errorSnippet.slice(0, 240)}`;
        } else if (rawSnippet) {
          userMessage = `JSON parse edilemedi. Ham yanıt: "${rawSnippet}". "Yeniden Üret" tekrar denenebilir.`;
        } else {
          userMessage = 'Ajan JSON döndürmedi. "Yeniden Üret" tekrar denenebilir.';
        }
        set({
          brandIdentityLoading: false,
          brandIdentityError: userMessage,
        });
        get().addAuditLog({
          action: 'brand_identity.parse_failed',
          actor_type: 'system', actor_id: 'frontend', actor_name: 'Frontend',
          details: `JSON parse edilemedi — kaynak sayısı ${sources.length}, ilk içerik uzunluğu ${sources[0]?.length ?? 0}`,
        });
        return;
      }
      set({ brandIdentity: parsed, brandIdentityLoading: false, brandIdentityError: null });
      get().addAuditLog({
        action: 'brand_identity.generated',
        actor_type: 'agent', actor_id: 'brand_identity_agent', actor_name: 'Brand Identity Agent',
        details: `Marka kimliği üretildi: ${parsed.brand_name}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ brandIdentityLoading: false, brandIdentityError: message });
      get().addAuditLog({
        action: 'brand_identity.error',
        actor_type: 'system', actor_id: 'backend', actor_name: 'Backend',
        details: message,
      });
      pushToast({ kind: 'error', title: 'Marka kimliği üretilemedi', body: message });
    }
  },

  // Product Economics (agent-generated)
  productEconomics: null,
  productEconomicsLoading: false,
  productEconomicsError: null,
  setProductEconomics: (econ) => set({ productEconomics: econ }),
  regenerateProductEconomics: async () => {
    const state = get();
    const product = state.onboardedProduct;
    if (!product) {
      set({ productEconomicsError: 'Önce bir ürün onboard et.' });
      return;
    }
    set({ productEconomicsLoading: true, productEconomicsError: null });
    const channels = product.channels.length ? product.channels.join(', ') : 'Shopify';
    const prompt = [
      productBrief(product),
      '',
      `Sen Pricing & Finance Agent\'sın. Yukarıdaki ürün için gerçekçi fiyat & finans tahmini hazırla.`,
      `Tüm satırlar yalnızca bu ürünün varyantlarına/SKU'larına ait olsun — başka kategoriden ürün UYDURMA.`,
      `Kanallar: ${channels}.`,
      'YALNIZCA aşağıdaki JSON şemasında cevap ver. Para birimleri TL (₺), sayılar plain number olsun.',
      '',
      '```json',
      '{',
      '  "rows": [{"title":"string (ürün/SKU adı)","marketplace":"string","price":0,"cost":0,"sales_30d":0}],',
      '  "channel_stats": [{"channel":"Meta Ads|Google Ads|TikTok Ads|Email","spent":0,"revenue":0}],',
      '  "ltv_per_customer": 0,',
      '  "total_customers": 0,',
      '  "suggestions": [{"priority":"high|medium|low","text":"string"}]',
      '}',
      '```',
      'rows en az 3, channel_stats en az 3, suggestions en az 3 öğe içersin.',
    ].join('\n');

    try {
      const { response: res, fallback_used } = await chatWithFallback(
        {
          message: prompt,
          history: [],
          product_context: {
            product_name: product.product_name,
            category: product.category,
            stage: product.stage,
            target_market: product.target_market,
            channels: product.channels,
            monthly_budget_band: product.monthly_budget_band,
            priorities: product.priorities,
          },
        },
        isGeminiConfigured()
          ? async (system, user) => callGemini({ system, history: [], user })
          : undefined,
      );
      if (fallback_used) {
        set({ fallbackActive: true, backendStatus: 'offline' });
        get().addAuditLog({
          action: 'fallback.used',
          actor_type: 'system', actor_id: 'frontend', actor_name: 'Frontend',
          details: 'Backend kapalı — Gemini fallback kullanıldı',
          metadata: { fallback_used: true },
        });
      }
      const sources = [res.content, ...res.agent_outputs.map((a) => a.content || a.summary)];
      let parsed: ProductEconomicsSnapshot | null = null;
      for (const src of sources) {
        const obj = extractJson<Partial<ProductEconomicsSnapshot>>(src || '');
        if (obj && Array.isArray(obj.rows) && obj.rows.length > 0) {
          parsed = {
            rows: obj.rows,
            channel_stats: Array.isArray(obj.channel_stats) ? obj.channel_stats : [],
            ltv_per_customer: typeof obj.ltv_per_customer === 'number' ? obj.ltv_per_customer : 0,
            total_customers: typeof obj.total_customers === 'number' ? obj.total_customers : 0,
            suggestions: Array.isArray(obj.suggestions) ? obj.suggestions : [],
            generated_at: new Date().toISOString(),
          };
          break;
        }
      }
      if (!parsed) {
        const failedAgents = res.agent_outputs.filter((a) => a.status === 'failed');
        const errorSnippet = failedAgents[0]?.content || failedAgents[0]?.summary || '';
        let userMessage: string;
        if (/api key/i.test(errorSnippet) || /API key not valid/i.test(res.content)) {
          userMessage =
            'Backend Gemini API anahtarını geçersiz görüyor. ' +
            'Backend\'i durdurup PowerShell\'de `Remove-Item Env:GEMINI_API_KEY` çalıştırdıktan sonra yeniden başlat.';
        } else if (errorSnippet) {
          userMessage = `Ajan başarısız oldu: ${errorSnippet.slice(0, 240)}`;
        } else {
          userMessage = 'Ajan JSON döndürmedi. Tekrar dene.';
        }
        set({ productEconomicsLoading: false, productEconomicsError: userMessage });
        return;
      }
      set({ productEconomics: parsed, productEconomicsLoading: false, productEconomicsError: null });
      get().addAuditLog({
        action: 'product_economics.generated',
        actor_type: 'agent', actor_id: 'pricing_finance_agent', actor_name: 'Pricing & Finance Agent',
        details: `${parsed.rows.length} satır ekonomi üretildi`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ productEconomicsLoading: false, productEconomicsError: message });
      pushToast({ kind: 'error', title: 'Ürün ekonomisi üretilemedi', body: message });
    }
  },

  reviews: seedReviews,
  respondToReview: (id, response) => {
    set((s) => ({ reviews: s.reviews.map((r) => r.id === id ? { ...r, responded: true, draft_response: response } : r) }));
    get().addAuditLog({ action: 'review.responded', actor_type: 'user', actor_id: 'user_1', actor_name: 'Kullanıcı', details: `Yorum #${id} yanıtlandı` });
  },

  influencers: seedInfluencers,
  updateInfluencerStatus: (id, status) => {
    set((s) => ({ influencers: s.influencers.map((i) => i.id === id ? { ...i, contact_status: status } : i) }));
  },

  experiments: seedExperiments,
  launchExperiment: (id) => {
    set((s) => ({ experiments: s.experiments.map((e) => e.id === id ? { ...e, status: 'running' as const, started_at: new Date().toISOString() } : e) }));
    get().addAuditLog({ action: 'experiment.launched', actor_type: 'user', actor_id: 'user_1', actor_name: 'Kullanıcı', details: `Deney #${id} başlatıldı` });
  },

  emailFlows: seedEmailFlows,
  toggleEmailFlow: (id) => {
    set((s) => ({ emailFlows: s.emailFlows.map((f) => f.id === id ? { ...f, status: f.status === 'active' ? 'paused' as const : 'active' as const } : f) }));
  },
  publishEmailFlow: (id) => {
    set((s) => ({ emailFlows: s.emailFlows.map((f) => f.id === id ? { ...f, status: 'active' as const } : f) }));
    const flow = get().emailFlows.find((f) => f.id === id);
    get().addAuditLog({ action: 'flow.published', actor_type: 'user', actor_id: 'user_1', actor_name: 'Kullanıcı', details: `${flow?.name} yayına alındı` });
  },

  fetchIntegrations: async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/integrations`, {
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return;
      const items = await res.json();
      if (!Array.isArray(items)) return;
      // Map backend → frontend Integration shape (icon, id, platform, status,
      // store_name, last_sync are 1:1; we surface `mode` + `notes` too).
      const normalized = items.map((i: any) => ({
        id: i.id,
        platform: i.platform,
        icon: i.icon,
        store_name: i.store_name || '',
        status: i.status as 'connected' | 'disconnected' | 'error',
        last_sync: i.last_sync,
        mode: i.mode,
        notes: i.notes,
      }));
      set({ integrations: normalized as any });
    } catch {
      // Backend offline — leave whatever seed integrations are in place.
    }
  },

  syncIntegration: async (id) => {
    const int = get().integrations.find((i) => i.id === id);
    if (!int) return;
    // Try the real backend sync endpoint. On failure we mark the integration
    // as `error` instead of silently flipping it to `connected` like the old
    // optimistic stub did.
    try {
      const res = await fetch(`${BASE_URL}/api/v1/integrations/${id}/sync`, {
        method: 'POST',
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      set((s) => ({
        integrations: s.integrations.map((i) =>
          i.id === id ? { ...i, status: 'connected' as const, last_sync: new Date().toISOString() } : i,
        ),
      }));
      get().addAuditLog({ action: 'integration.synced', actor_type: 'user', actor_id: 'user_1', actor_name: 'Kullanıcı', details: `${int.platform} senkronize edildi (backend)` });
      pushToast({ kind: 'success', title: 'Senkron tamam', body: `${int.platform} güncel.` });
    } catch (err: any) {
      set((s) => ({
        integrations: s.integrations.map((i) =>
          i.id === id ? { ...i, status: 'error' as const, last_sync: i.last_sync } : i,
        ),
      }));
      get().addAuditLog({ action: 'integration.sync_failed', actor_type: 'system', actor_id: 'backend', actor_name: 'Backend', details: `${int.platform}: ${err?.message || err}` });
      pushToast({ kind: 'warn', title: 'Senkron başarısız', body: `${int.platform}: ${err?.message || err}` });
    }
  },
  connectIntegration: async (platform, icon) => {
    if (get().integrations.some((i) => i.platform === platform)) {
      pushToast({ kind: 'info', title: 'Zaten ekli', body: `${platform} bağlı kanallar listesinde.` });
      return;
    }
    // Hit the backend connect endpoint. A real implementation returns an OAuth
    // URL (or marks the integration as `disconnected/pending_auth`). When the
    // endpoint is missing we record a clearly-labeled local stub instead of
    // pretending the connection succeeded.
    try {
      const res = await fetch(`${BASE_URL}/api/v1/integrations/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.auth_url) {
        window.open(data.auth_url, '_blank', 'noopener');
        pushToast({ kind: 'info', title: 'OAuth penceresi açıldı', body: `${platform} bağlantısını tamamlamak için yeni sekmeyi takip et.` });
      }
      const newInt: Integration = {
        id: data?.id || `int_${uuidv4().slice(0, 8)}`,
        platform,
        store_name: data?.store_name || `${platform}`,
        status: (data?.status as any) || 'disconnected',
        last_sync: data?.last_sync || null,
        icon,
      };
      set((s) => ({ integrations: [...s.integrations, newInt] }));
      get().addAuditLog({ action: 'integration.connect_requested', actor_type: 'user', actor_id: 'user_1', actor_name: 'Kullanıcı', details: `${platform} bağlantısı talep edildi (status=${newInt.status})` });
    } catch (err: any) {
      // Local-only stub: mark the integration as `disconnected` so the UI
      // shows the pending state honestly instead of a fake "Bağlı" badge.
      const newInt: Integration = {
        id: `int_local_${uuidv4().slice(0, 8)}`,
        platform,
        store_name: `${platform} (yerel taslak)`,
        status: 'disconnected',
        last_sync: null,
        icon,
      };
      set((s) => ({ integrations: [...s.integrations, newInt] }));
      get().addAuditLog({ action: 'integration.connect_stub', actor_type: 'system', actor_id: 'frontend', actor_name: 'Frontend', details: `${platform} backend yok — yerel taslak eklendi (${err?.message || err})` });
      pushToast({ kind: 'warn', title: 'Backend bağlantı endpoint\'i yok', body: `${platform} yerel taslak olarak eklendi — gerçek bağlantı için OAuth yapılandırılmalı.` });
    }
  },

  quickAsk: (content) => {
    set({ currentPage: 'chat' });
    get().sendUserMessage(content);
  },

  // Supervisor command bus — executes recognized intents and returns a
  // human-readable acknowledgement (or null when the action isn't applicable).
  executeSupervisorAction: (intent, params) => {
    const s = get();
    const audit = (details: string) =>
      s.addAuditLog({
        action: `supervisor.${intent}`,
        actor_type: 'agent',
        actor_id: 'supervisor',
        actor_name: 'Supervisor',
        details,
      });

    switch (intent) {
      case 'navigate': {
        const page = params?.page;
        if (!page) return null;
        s.setCurrentPage(page);
        audit(`Sayfa açıldı: ${page}`);
        return `✅ **${page}** sayfasına geçildi.`;
      }
      case 'approve_all': {
        const pending = s.approvals.filter((a) => a.status === 'pending');
        if (pending.length === 0) return 'Bekleyen onay yok.';
        for (const a of pending) s.approveItem(a.id, 'Supervisor tarafından toplu onaylandı');
        audit(`${pending.length} onay toplu onaylandı`);
        return `✅ ${pending.length} bekleyen onay onaylandı.`;
      }
      case 'reject_all': {
        const pending = s.approvals.filter((a) => a.status === 'pending');
        if (pending.length === 0) return 'Bekleyen onay yok.';
        for (const a of pending) s.rejectItem(a.id, 'Supervisor tarafından toplu reddedildi');
        audit(`${pending.length} onay toplu reddedildi`);
        return `🚫 ${pending.length} bekleyen onay reddedildi.`;
      }
      case 'regenerate_brand': {
        void s.regenerateBrandIdentity();
        s.setCurrentPage('brand');
        audit('Marka kimliği yeniden üretiliyor');
        return '🎨 Marka kimliği yeniden üretiliyor — **Marka** sayfasında sonucu göreceksin.';
      }
      case 'regenerate_pricing': {
        void s.regenerateProductEconomics();
        s.setCurrentPage('pricing');
        audit('Fiyat & finans analizi yeniden üretiliyor');
        return '💰 Fiyat & finans analizi yeniden üretiliyor — **Fiyat & Finans** sayfasında sonucu göreceksin.';
      }
      case 'sync_all_integrations': {
        const all = s.integrations;
        if (all.length === 0) return 'Bağlı entegrasyon yok.';
        for (const i of all) s.syncIntegration(i.id);
        audit(`${all.length} entegrasyon senkronize edildi`);
        return `🔄 ${all.length} entegrasyon senkronize edildi.`;
      }
      case 'sync_integration': {
        const needle = (params?.platform || '').toLowerCase();
        const target = s.integrations.find((i) => i.platform.toLowerCase().includes(needle));
        if (!target) return `⚠️ "${params?.platform}" adında bir entegrasyon bulunamadı.`;
        s.syncIntegration(target.id);
        audit(`${target.platform} senkronize edildi`);
        return `🔄 **${target.platform}** senkronize edildi.`;
      }
      case 'publish_all_flows': {
        const paused = s.emailFlows.filter((f) => f.status !== 'active');
        if (paused.length === 0) return 'Tüm e-posta akışları zaten aktif.';
        for (const f of paused) s.publishEmailFlow(f.id);
        audit(`${paused.length} email akışı yayına alındı`);
        return `📧 ${paused.length} e-posta akışı yayına alındı.`;
      }
      case 'launch_all_experiments': {
        const draft = s.experiments.filter((e) => e.status !== 'running');
        if (draft.length === 0) return 'Çalıştırılacak deney yok.';
        for (const e of draft) s.launchExperiment(e.id);
        s.setCurrentPage('growth');
        audit(`${draft.length} deney başlatıldı`);
        return `🧪 ${draft.length} deney başlatıldı — **Büyüme** sayfasında sonuçları görebilirsin.`;
      }
      case 'launch_experiment': {
        const kw = (params?.keyword || '').toLowerCase();
        const target = s.experiments.find(
          (e) => e.hypothesis?.toLowerCase().includes(kw) || e.area?.toLowerCase().includes(kw),
        );
        if (!target) return `⚠️ "${params?.keyword}" ile eşleşen deney bulunamadı.`;
        if (target.status === 'running') return `ℹ️ Bu deney zaten çalışıyor.`;
        s.launchExperiment(target.id);
        s.setCurrentPage('growth');
        audit(`Deney başlatıldı: ${target.hypothesis.slice(0, 60)}`);
        return `🧪 Deney başlatıldı: _${target.hypothesis.slice(0, 80)}_`;
      }
      case 'approve_one': {
        const kw = (params?.keyword || '').toLowerCase();
        const target = s.approvals.find(
          (a) => a.status === 'pending' && (a.action.toLowerCase().includes(kw) || a.description.toLowerCase().includes(kw)),
        );
        if (!target) return `⚠️ "${params?.keyword}" ile eşleşen bekleyen onay bulunamadı.`;
        s.approveItem(target.id, 'Supervisor komutuyla onaylandı');
        audit(`Tek onay: ${target.action}`);
        return `✅ Onay verildi: _${target.action}_`;
      }
      case 'draft_review_responses': {
        // Navigate to reviews page + mark drafts as needing response
        s.setCurrentPage('reviews');
        const unanswered = s.reviews.filter((r) => !r.responded);
        audit(`${unanswered.length} yorum için yanıt taslağı istendi`);
        return `💬 **Yorumlar** sayfasına geçildi — ${unanswered.length} yanıtsız yorum var. Yanıt taslakları hazırlamak için her yoruma tıklayabilirsin.`;
      }
      case 'contact_influencers': {
        s.setCurrentPage('influencers');
        const candidates = s.influencers.filter((i) => i.contact_status === 'discovered');
        audit(`${candidates.length} influencer'a ulaşmak istendi`);
        return `🎤 **Influencers** sayfasına geçildi — ${candidates.length} kişiyle henüz iletişime geçilmedi.`;
      }
      case 'reset_all': {
        s.resetAll();
        return '♻️ Tüm sistem verileri sıfırlandı.';
      }
      case 'toggle_debug': {
        s.toggleDebugMode();
        return `🐛 Debug modu: **${get().debugMode ? 'açık' : 'kapalı'}**`;
      }
      default:
        return null;
    }
  },

  // Floating supervisor dock — visible on every page via Layout.
  supervisorDockOpen: false,
  toggleSupervisorDock: () => set((s) => ({ supervisorDockOpen: !s.supervisorDockOpen })),
  setSupervisorDockOpen: (open) => set({ supervisorDockOpen: open }),

  // Debug mode
  debugMode: false,
  toggleDebugMode: () => set((s) => ({ debugMode: !s.debugMode })),

  // ─── Backend health ────────────────────────────────────────────────────────
  backendStatus: 'unknown',
  backendStatusCheckedAt: null,
  fallbackActive: false,
  setBackendStatus: (status, fallback) => set({
    backendStatus: status,
    backendStatusCheckedAt: new Date().toISOString(),
    ...(typeof fallback === 'boolean' ? { fallbackActive: fallback } : {}),
  }),
  pingBackend: async () => {
    const ok = await backendReachable();
    set({
      backendStatus: ok ? 'online' : 'offline',
      backendStatusCheckedAt: new Date().toISOString(),
      // Clear fallback marker once backend is healthy again.
      ...(ok ? { fallbackActive: false } : {}),
    });
  },

  // ─── Multi-product switcher ────────────────────────────────────────────────
  // We treat `onboardedProduct` as the active product and keep a list of all
  // onboarded products in `products`. The first onboarding seeds the list.
  products: seedOnboardedProduct ? [seedOnboardedProduct] : [],
  switchToProduct: (productName) => {
    const target = get().products.find((p) => p.product_name === productName);
    if (!target) return;
    // Drop selection so the detail page doesn't keep rendering the previous
    // product's task (#18). Tasks themselves are kept in history; only the
    // currently-selected pointer is cleared.
    set({
      onboardedProduct: target,
      dashboard: makeDashboardForProduct(target),
      brandIdentity: null,
      productEconomics: null,
      selectedTaskId: null,
    });
    // Tell the backend which product is now active. Best-effort — if the
    // endpoint or product isn't there yet we still keep local state.
    fetch(`${BASE_URL}/api/v1/products/${encodeURIComponent(productName)}/activate`, {
      method: 'POST',
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
    get().addAuditLog({
      action: 'product.switched',
      actor_type: 'user', actor_id: 'user_1', actor_name: 'Kullanıcı',
      details: `Aktif ürün değiştirildi: ${target.product_name}`,
    });
  },
  addProductToWorkspace: (product) => {
    set((s) => ({
      products: s.products.some((p) => p.product_name === product.product_name)
        ? s.products
        : [...s.products, product],
    }));
  },
  removeProduct: async (productName) => {
    const state = get();
    const remaining = state.products.filter((p) => p.product_name !== productName);
    const wasActive = state.onboardedProduct?.product_name === productName;
    const nextActive = wasActive ? (remaining[0] || null) : state.onboardedProduct;
    set({
      products: remaining,
      onboardedProduct: nextActive,
      dashboard: nextActive ? makeDashboardForProduct(nextActive) : null,
      brandIdentity: wasActive ? null : state.brandIdentity,
      productEconomics: wasActive ? null : state.productEconomics,
    });
    state.addAuditLog({
      action: 'product.removed',
      actor_type: 'user', actor_id: 'user_1', actor_name: 'Kullanıcı',
      details: `Ürün silindi: ${productName}`,
    });
    pushToast({
      kind: 'success',
      title: 'Ürün silindi',
      body: nextActive
        ? `${productName} kaldırıldı · aktif: ${nextActive.product_name}`
        : `${productName} kaldırıldı · workspace boş`,
    });
    try {
      await fetch(`${BASE_URL}/api/v1/products/${encodeURIComponent(productName)}`, {
        method: 'DELETE',
        signal: AbortSignal.timeout(4000),
      });
      if (wasActive && nextActive) {
        await fetch(`${BASE_URL}/api/v1/products/${encodeURIComponent(nextActive.product_name)}/activate`, {
          method: 'POST',
          signal: AbortSignal.timeout(3000),
        });
      }
    } catch {
      // Backend may be offline — local state is already updated.
    }
  },

  // ─── Demo fixtures ─────────────────────────────────────────────────────────
  // Loads believable mock numbers into Dashboard, Analytics and Approvals so
  // the UI is evaluable when the backend is offline or no real data is flowing.
  loadDemoFixtures: () => {
    const product = get().onboardedProduct;
    if (!product) return;
    const today = new Date();
    // Use the same deterministic dashboard generator that runs after onboarding
    // — guarantees today_sales / sales_trend / channel_performance all line up.
    const base = makeDemoDashboardForProduct(product);
    set({
      dashboard: {
        ...base,
        critical_alerts: [
          { id: 'alrt_demo_1', type: 'stock', severity: 'warning', title: 'Düşük stok uyarısı', description: `${product.product_name} ana SKU stok < 14 gün`, agent_id: 'inventory_forecast_agent', created_at: today.toISOString() },
          { id: 'alrt_demo_2', type: 'performance', severity: 'info', title: 'ROAS artışı', description: 'Meta Ads kampanyası dün +18% ROAS', agent_id: 'paid_media_agent', created_at: today.toISOString() },
        ],
        _isDemo: true,
      },
    });
    // Persist the demo snapshot so a page reload (Phase-3 hydration) restores
    // these numbers instead of re-deriving them from scratch.
    fetch(`${BASE_URL}/api/v1/dashboard/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product: product.product_name,
        today_sales: base.today_sales,
        today_orders: base.today_orders,
        today_roas: base.today_roas,
        conversion_rate: base.conversion_rate,
        avg_order_value: base.avg_order_value,
        sales_trend: base.sales_trend,
        orders_trend: base.orders_trend,
        roas_trend: base.roas_trend,
        channel_performance: base.channel_performance,
        source: 'demo',
      }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
    // Demo approvals so the approvals page has something to review.
    const demoApprovals: Approval[] = [
      {
        id: `appr_demo_${uuidv4().slice(0, 6)}`,
        task_id: 'demo_task_pricing',
        agent_id: 'pricing_finance_agent',
        action: 'Fiyat değişikliği: 199₺ → 219₺',
        description: `${product.product_name} ana SKU için %10 fiyat artışı önerisi.`,
        params: { sku: 'main', old_price: 199, new_price: 219 },
        risk_level: 'medium',
        expected_impact: 'Bekleneni: marj +4 puan, dönüşüm -%1.2',
        status: 'pending',
        reviewer_note: null,
        created_at: today.toISOString(),
        resolved_at: null,
      },
      {
        id: `appr_demo_${uuidv4().slice(0, 6)}`,
        task_id: 'demo_task_ads',
        agent_id: 'paid_media_agent',
        action: 'Meta Ads bütçe artışı: 250₺/gün → 400₺/gün',
        description: 'Son 7 gün ROAS 3.8x — bütçe artışı önerildi.',
        params: { campaign: 'evergreen_1', from: 250, to: 400 },
        risk_level: 'low',
        expected_impact: 'Bekleneni: günlük gelir +60%, ROAS hedefi 3.2x',
        status: 'pending',
        reviewer_note: null,
        created_at: today.toISOString(),
        resolved_at: null,
      },
      {
        id: `appr_demo_${uuidv4().slice(0, 6)}`,
        task_id: 'demo_task_reorder',
        agent_id: 'inventory_forecast_agent',
        action: `Reorder: ${product.product_name} ana SKU`,
        description: 'Tükenmeye 12 gün — 400 adet reorder önerildi.',
        params: { sku: 'main', qty: 400 },
        risk_level: 'high',
        expected_impact: 'Stok-out riski 0\'a inecek, lead time 21 gün.',
        status: 'pending',
        reviewer_note: null,
        created_at: today.toISOString(),
        resolved_at: null,
      },
    ];
    set((s) => ({ approvals: [...demoApprovals, ...s.approvals] }));
    get().addAuditLog({
      action: 'demo.fixtures_loaded',
      actor_type: 'user', actor_id: 'user_1', actor_name: 'Kullanıcı',
      details: 'Demo veriler yüklendi (dashboard + onaylar)',
    });
  },

  // ─── Task retry ────────────────────────────────────────────────────────────
  // Re-dispatches the original task description to Hermes. The new run is
  // materialized as a fresh task (so iteration history is preserved).
  retryTask: (taskId) => {
    const task = get().tasks.find((t) => t.task_id === taskId);
    if (!task) return;
    get().addAuditLog({
      action: 'task.retry',
      actor_type: 'user', actor_id: 'user_1', actor_name: 'Kullanıcı',
      details: `Görev yeniden çalıştırıldı: ${task.title}`,
      metadata: { source_task_id: taskId },
    });
    get().addTask({
      title: `${task.title} (yeniden)`,
      description: task.description,
      priority: task.priority,
    });
  },
}), {
  name: 'oneproduct-onboarding',
  storage: createJSONStorage(() => localStorage),
  partialize: (s) => ({
    onboardingStep: s.onboardingStep,
    onboardingComplete: s.onboardingComplete,
    onboardedProduct: s.onboardedProduct,
    onboardingDraft: s.onboardingDraft,
  }),
  version: 1,
}));

// Bind the helper to the store after creation. This lets `addTask` and
// `sendUserMessage` share one materialization path: backend run → Task + Approvals + Audit.
_persistImpl = ({ title, description, priority, startedAt, response }: PersistArgs) => {
  const taskId = `task_${uuidv4().slice(0, 8)}`;
  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - new Date(startedAt).getTime();
  const primary = response.agent_outputs[0];

  const toolsCalled = response.agent_outputs.flatMap((a) =>
    (a.tools_called || []).map((tc) => ({
      id: `tcl_${uuidv4().slice(0, 8)}`,
      tool_id: tc.tool_id,
      agent_id: tc.agent_id,
      task_id: taskId,
      input: {},
      output: {},
      duration_ms: tc.duration_ms,
      status: tc.status as import('@/types').ToolCallStatus,
      cost_usd: tc.cost_usd,
      timestamp: completedAt,
    })),
  );
  const findings = response.agent_outputs.flatMap((a) => a.findings || []).slice(0, 12);
  const recommended = response.agent_outputs.flatMap((a) => a.recommended_actions || []).map((r) => ({
    action: r.action,
    params: r.params,
    requires_approval: r.requires_approval,
    risk_level: (ALLOWED_RISK.has(r.risk_level) ? r.risk_level : 'medium') as 'low' | 'medium' | 'high' | 'critical',
    expected_impact: r.expected_impact,
  }));

  // Carry the active product into the task's goal/constraints so the detail
  // view doesn't show empty "Hedef" / "Kısıt tanımlanmamış" right after the
  // onboarding finishes (#23).
  const activeProduct = useStore.getState().onboardedProduct;
  const productGoal = activeProduct
    ? `${activeProduct.product_name} (${activeProduct.category}, ${activeProduct.stage}) için: ${description || title}`
    : description || title;
  const productConstraints: string[] = activeProduct
    ? [
        `Hedef pazar: ${activeProduct.target_market}`,
        `Kanallar: ${(activeProduct.channels || []).join(', ') || '—'}`,
        `Bütçe: ${activeProduct.monthly_budget_band || '—'}`,
        `Öncelikler: ${(activeProduct.priorities || []).join(', ') || '—'}`,
      ]
    : [];

  const newTask: Task = {
    task_id: taskId,
    parent_task_id: null,
    title,
    description,
    goal: productGoal,
    status: (primary?.status === 'failed' ? 'failed' : 'completed') as Task['status'],
    priority,
    assigned_agent_id: primary?.agent_id ?? null,
    context: activeProduct ? { product_name: activeProduct.product_name } : {},
    constraints: productConstraints,
    required_capabilities: [],
    output_schema: {},
    max_iterations: 5,
    deadline: null,
    approval_required: recommended.some((r) => r.requires_approval),
    confidence: response.confidence,
    iterations_used: primary?.iterations_used ?? 1,
    sub_tasks: [],
    tools_called: toolsCalled,
    messages: [],
    created_at: startedAt,
    updated_at: completedAt,
    completed_at: completedAt,
    result: {
      agent_id: primary?.agent_id ?? 'supervisor',
      task_id: taskId,
      status: (primary?.status ?? 'completed') as 'completed' | 'failed' | 'escalated',
      confidence: response.confidence,
      iterations_used: primary?.iterations_used ?? 1,
      tools_called: toolsCalled.map((tc) => ({
        tool_id: tc.tool_id,
        duration_ms: tc.duration_ms,
        status: tc.status,
        cost_usd: tc.cost_usd,
      })),
      summary: response.content || primary?.summary || '',
      findings,
      recommended_actions: recommended,
      artifacts: [],
      next_step: primary?.next_step ?? null,
      metadata: {
        started_at: startedAt,
        completed_at: completedAt,
        total_duration_ms: durationMs,
        total_tool_cost_usd: toolsCalled.reduce((acc, tc) => acc + tc.cost_usd, 0),
      },
    },
  };

  const newApprovals: Approval[] = recommended
    .filter((r) => r.requires_approval)
    .map((r) => ({
      id: `appr_${uuidv4().slice(0, 8)}`,
      task_id: taskId,
      agent_id: primary?.agent_id ?? 'supervisor',
      action: r.action,
      description: r.expected_impact || r.action,
      params: r.params,
      risk_level: r.risk_level,
      expected_impact: r.expected_impact,
      status: 'pending',
      reviewer_note: null,
      created_at: completedAt,
      resolved_at: null,
    }));

  // Freeze the SSE progress trace under this task id so the Graph page can
  // replay the DAG later — chatProgress itself will be cleared by the next
  // user prompt.
  const progressSnapshot = useStore.getState().chatProgress;

  useStore.setState((s) => ({
    tasks: [newTask, ...s.tasks],
    approvals: [...newApprovals, ...s.approvals],
    taskProgressSnapshots: progressSnapshot && progressSnapshot.length
      ? { ...s.taskProgressSnapshots, [taskId]: progressSnapshot }
      : s.taskProgressSnapshots,
    llmDegraded: !!(response as any).llm_degraded,
    llmDegradedReason: (response as any).llm_degraded_reason ?? null,
  }));

  const audit = useStore.getState().addAuditLog;
  audit({
    action: 'task.materialized',
    actor_type: 'agent',
    actor_id: primary?.agent_id ?? 'hermes',
    actor_name: primary?.agent_id ?? 'Hermes',
    details: `"${title}" → ${response.agent_outputs.length} ajan, ${toolsCalled.length} tool, ${newApprovals.length} onay`,
  });
  for (const ap of newApprovals) {
    audit({
      action: 'approval.queued',
      actor_type: 'agent',
      actor_id: ap.agent_id,
      actor_name: ap.agent_id,
      details: `Onay sırada: ${ap.action} (${ap.risk_level})`,
    });
  }

  return { taskId, approvalCount: newApprovals.length };
};
