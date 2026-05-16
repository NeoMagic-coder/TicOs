// ═══════════════════════════════════════════════════════════
// E-Commerce Agent Office — Core Type Definitions
// ═══════════════════════════════════════════════════════════

// ─── Agent Types ───
export type AgentStatus = 'active' | 'busy' | 'idle' | 'offline';

export interface AgentSpec {
  agent_id: string;
  name: string;
  role: string;
  goal: string;
  personality: string;
  icon: string;
  color: string;
  allowed_tools: string[];
  allowed_tool_categories: string[];
  max_concurrent_tasks: number;
  max_iterations_per_task: number;
  escalation_threshold: number;
  sop_document_ids: string[];
  can_delegate_to: string[];
  approval_authority: string[];
  active: boolean;
  status: AgentStatus;
  stats: AgentStats;
}

export interface AgentStats {
  tasks_completed_today: number;
  tasks_total: number;
  success_rate: number;
  avg_confidence: number;
  tools_used_today: number;
  avg_duration_ms: number;
  last_task_at: string;
}

// ─── Task Types ───
export type TaskStatus =
  | 'created'
  | 'triaged'
  | 'assigned'
  | 'in_progress'
  | 'waiting_tool_result'
  | 'waiting_human_approval'
  | 'completed'
  | 'failed'
  | 'escalated';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Task {
  task_id: string;
  parent_task_id: string | null;
  title: string;
  description: string;
  goal: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_agent_id: string | null;
  context: Record<string, unknown>;
  constraints: string[];
  required_capabilities: string[];
  output_schema: Record<string, unknown>;
  max_iterations: number;
  deadline: string | null;
  approval_required: boolean;
  confidence: number | null;
  iterations_used: number;
  sub_tasks: Task[];
  tools_called: ToolCallLog[];
  messages: TaskMessage[];
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  result: AgentOutput | null;
}

export interface TaskMessage {
  id: string;
  task_id: string;
  from_agent_id: string;
  to_agent_id: string;
  type: 'request' | 'response' | 'escalation' | 'info';
  content: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ─── Tool Types ───
export type ToolMode = 'mock' | 'live';
export type ToolCallStatus = 'success' | 'failure' | 'timeout' | 'fallback_used';

export interface ToolManifest {
  tool_id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  provider: string;
  auth_required: boolean;
  rate_limit: { requests_per_minute: number };
  timeout_ms: number;
  retry: { max_attempts: number; backoff: string };
  fallback_tool_id: string | null;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  allowed_agents: string[];
  requires_approval: boolean;
  cost_estimate: { per_call_usd: number };
  mode: ToolMode;
  tags: string[];
  stats: ToolStats;
}

export interface ToolStats {
  total_calls: number;
  success_rate: number;
  avg_duration_ms: number;
  total_cost_usd: number;
  last_called_at: string | null;
}

export interface ToolCallLog {
  id: string;
  tool_id: string;
  agent_id: string;
  task_id: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  duration_ms: number;
  status: ToolCallStatus;
  cost_usd: number;
  timestamp: string;
}

// ─── Agent Output ───
export interface AgentOutput {
  agent_id: string;
  task_id: string;
  status: 'completed' | 'failed' | 'escalated';
  confidence: number;
  iterations_used: number;
  tools_called: { tool_id: string; duration_ms: number; status: string; cost_usd: number }[];
  summary: string;
  findings: string[];
  recommended_actions: RecommendedAction[];
  artifacts: Artifact[];
  next_step: string | null;
  metadata: {
    started_at: string;
    completed_at: string;
    total_duration_ms: number;
    total_tool_cost_usd: number;
  };
}

export interface RecommendedAction {
  action: string;
  params: Record<string, unknown>;
  requires_approval: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  expected_impact: string;
}

export interface Artifact {
  type: 'table' | 'chart' | 'text' | 'list' | 'json';
  title: string;
  data: unknown;
}

// ─── Approval Types ───
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'modified';

export interface Approval {
  id: string;
  task_id: string;
  agent_id: string;
  action: string;
  description: string;
  params: Record<string, unknown>;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  expected_impact: string;
  status: ApprovalStatus;
  reviewer_note: string | null;
  created_at: string;
  resolved_at: string | null;
}

// ─── Knowledge Types ───
export interface KnowledgeDocument {
  id: string;
  title: string;
  type: 'pdf' | 'md' | 'txt' | 'url' | 'sop';
  category: string;
  tags: string[];
  content_preview: string;
  chunks_count: number;
  uploaded_at: string;
  updated_at: string;
}

// ─── Chat Types ───
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent_id?: string;
  task_id?: string;
  thinking?: string;
  tools_used?: string[];
  timestamp: string;
}

// ─── Dashboard Types ───
export interface DashboardSummary {
  today_sales: number;
  today_orders: number;
  today_roas: number;
  avg_order_value: number;
  conversion_rate: number;
  active_campaigns: number;
  pending_approvals: number;
  active_tasks: number;
  critical_alerts: Alert[];
  recent_tasks: Task[];
  agent_activity: AgentActivity[];
  sales_trend: { date: string; value: number }[];
  channel_performance: { channel: string; sales: number; orders: number }[];
}

export interface Alert {
  id: string;
  type: 'stock' | 'price' | 'compliance' | 'performance' | 'support';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  agent_id: string;
  created_at: string;
}

export interface AgentActivity {
  agent_id: string;
  agent_name: string;
  tasks_completed: number;
  last_active: string;
}

// ─── Integration Types ───
export interface Integration {
  id: string;
  platform: string;
  store_name: string;
  status: 'connected' | 'disconnected' | 'error';
  last_sync: string | null;
  icon: string;
}

// ─── Audit Log Types ───
export interface AuditLog {
  id: string;
  action: string;
  actor_type: 'agent' | 'user' | 'system';
  actor_id: string;
  actor_name: string;
  details: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

// ─── OneProduct Onboarding ───
export type OnboardingStage = 'idea' | 'product_no_store' | 'store_growing' | 'marketplace_opt';

export interface OnboardedProduct {
  product_name: string;
  product_description: string;
  category: string;
  reference_url: string;
  image_url: string;
  stage: OnboardingStage;
  target_market: 'TR' | 'GLOBAL' | 'BOTH';
  channels: string[];
  monthly_budget_band: '0-5k' | '5k-25k' | '25k-100k' | '100k+';
  priorities: string[];
  health_score: number;
  onboarded_at: string;
}

// ─── Brand Identity (agent-generated) ───
export interface BrandIdentity {
  brand_name: string;
  tagline: string;
  story: string;
  positioning: string;
  alternatives: { name: string; score: number; domain: string; reasoning: string }[];
  palette: { role: string; hex: string; label: string }[];
  voice: { traits: string[]; do: string[]; dont: string[] };
  personas: { name: string; age: string; goal: string; objection: string; channel: string; emoji: string }[];
  social_handles: { platform: string; handle: string; available: boolean }[];
  generated_at: string;
}

// ─── Product Economics (agent-generated pricing/finance snapshot) ───
export interface ProductEconomicsRow {
  title: string;
  marketplace: string;
  price: number;
  cost: number;
  sales_30d: number;
}

export interface ProductEconomicsSnapshot {
  rows: ProductEconomicsRow[];
  channel_stats: { channel: string; spent: number; revenue: number }[];
  ltv_per_customer: number;
  total_customers: number;
  suggestions: { priority: 'high' | 'medium' | 'low'; text: string }[];
  generated_at: string;
}

// ─── Reviews ───
export interface ProductReview {
  id: string;
  channel: string;
  rating: number;
  title: string;
  body: string;
  author: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  responded: boolean;
  draft_response: string | null;
  created_at: string;
}

// ─── Influencers ───
export interface Influencer {
  id: string;
  handle: string;
  name: string;
  platform: 'instagram' | 'tiktok' | 'youtube' | 'twitter';
  tier: 'nano' | 'micro' | 'macro';
  followers: number;
  engagement_rate: number;
  niche: string;
  estimated_cost: number;
  contact_status: 'discovered' | 'contacted' | 'negotiating' | 'collab' | 'rejected';
  avatar: string;
}

// ─── Growth Experiments ───
export interface GrowthExperiment {
  id: string;
  hypothesis: string;
  metric: string;
  area: 'pricing' | 'listing' | 'ads' | 'email' | 'ux' | 'bundle';
  status: 'idea' | 'running' | 'won' | 'lost' | 'inconclusive';
  uplift_pct: number | null;
  confidence: number;
  owner_agent_id: string;
  started_at: string | null;
  ended_at: string | null;
}

// ─── Email Flows ───
export interface EmailFlow {
  id: string;
  name: string;
  trigger: 'welcome' | 'abandoned_cart' | 'post_purchase' | 'winback' | 'birthday';
  steps_count: number;
  status: 'active' | 'draft' | 'paused';
  open_rate: number;
  click_rate: number;
  revenue_30d: number;
  recipients_30d: number;
}

// ─── Analytics Types ───
export interface AnalyticsData {
  sales_summary: {
    total_revenue: number;
    total_orders: number;
    avg_order_value: number;
    conversion_rate: number;
    return_rate: number;
  };
  product_performance: {
    product_id: string;
    name: string;
    revenue: number;
    units_sold: number;
    views: number;
    conversion: number;
    margin: number;
  }[];
  channel_performance: {
    channel: string;
    revenue: number;
    orders: number;
    roas: number;
    cac: number;
  }[];
  daily_trend: { date: string; revenue: number; orders: number }[];
}
