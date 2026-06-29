import type { AgentId } from "@/types/database";

export type AgentDefinition = {
  id: AgentId;
  role: string;
  name: string;
  nameTr: string;
  description: string;
  descriptionTr: string;
  avatar: string;
  color: string;
  systemPrompt: string;
};

export const AGENTS: Record<AgentId, AgentDefinition> = {
  ticos: {
    id: "ticos",
    role: "orchestrator",
    name: "TicOS",
    nameTr: "TicOS",
    description: "Chief AI manager orchestrating your marketing team",
    descriptionTr: "Pazarlama ekibinizi yöneten baş AI yönetici",
    avatar: "/avatars/ticos.svg",
    color: "#7C3AED",
    systemPrompt: `You are TicOS, the chief AI marketing manager for Ticosclaw.
You coordinate a team of specialists: Social Media, Blog/SEO, Sales, and Email experts.
You speak warmly and professionally in the user's language.
You summarize daily work, route tasks to specialists, and help the user approve content.
Always be concise, action-oriented, and reference the user's brand voice when available.`,
  },
  social: {
    id: "social",
    role: "social_media",
    name: "Social Media Expert",
    nameTr: "Sosyal Medya Uzmanı",
    description: "content, captions, hashtags",
    descriptionTr: "içerikler, açıklamalar, hashtag'ler",
    avatar: "/avatars/social.svg",
    color: "#EC4899",
    systemPrompt: `You are a Social Media Marketing Expert on the Ticosclaw AI team.
You create engaging social media content, captions, and hashtag strategies for Instagram, Facebook, and LinkedIn.
Match the brand voice. Be creative, platform-aware, and concise.`,
  },
  blog: {
    id: "blog",
    role: "blog_seo",
    name: "Blog & SEO Expert",
    nameTr: "Blog ve SEO Uzmanı",
    description: "articles, keywords, rankings",
    descriptionTr: "makaleler, anahtar kelimeler, sıralamalar",
    avatar: "/avatars/blog.svg",
    color: "#3B82F6",
    systemPrompt: `You are a Blog and SEO Expert on the Ticosclaw AI team.
You write SEO-optimized articles, suggest keywords, and improve search rankings.
Match the brand voice. Structure content with clear headings and meta descriptions.`,
  },
  sales: {
    id: "sales",
    role: "sales",
    name: "Sales Expert",
    nameTr: "Satış Uzmanı",
    description: "listings, descriptions, conversions",
    descriptionTr: "listeler, açıklamalar, dönüşümler",
    avatar: "/avatars/sales.svg",
    color: "#F59E0B",
    systemPrompt: `You are a Sales Marketing Expert on the Ticosclaw AI team.
You create product listings, persuasive descriptions, and conversion-focused copy.
Match the brand voice. Focus on benefits and clear CTAs.`,
  },
  email: {
    id: "email",
    role: "email",
    name: "Email Expert",
    nameTr: "E-posta Uzmanı",
    description: "newsletters, campaigns, flows",
    descriptionTr: "bültenler, kampanyalar, akışlar",
    avatar: "/avatars/email.svg",
    color: "#10B981",
    systemPrompt: `You are an Email Marketing Expert on the Ticosclaw AI team.
You write newsletters, email campaigns, and automated flows.
Match the brand voice. Use compelling subject lines and clear structure.`,
  },
};

export const DEFAULT_AGENTS = Object.values(AGENTS).filter((a) => a.id !== "ticos");

export async function seedTeamMembers(
  supabase: ReturnType<typeof import("@/lib/supabase/client").createSupabaseAdmin>,
  brandId: string,
) {
  const members = DEFAULT_AGENTS.map((agent) => ({
    brand_id: brandId,
    role: agent.role,
    system_prompt: agent.systemPrompt,
    avatar_url: agent.avatar,
  }));

  const { data: existing } = await supabase
    .from("team_members")
    .select("id")
    .eq("brand_id", brandId)
    .limit(1);

  if (!existing?.length) {
    await supabase.from("team_members").insert(members);
  }
}

export function buildSystemPrompt(
  agentId: AgentId,
  context: {
    brandVoice?: Record<string, unknown>;
    goals?: Array<{ title: string; current_value?: number | null; target_value?: number | null }>;
    pendingContent?: Array<{ title: string; status: string }>;
    integrations?: Array<{ platform: string; is_connected: boolean }>;
    locale?: string;
  },
): string {
  const agent = AGENTS[agentId];
  const parts = [agent.systemPrompt];

  if (context.locale === "tr") {
    parts.push("Respond in Turkish.");
  } else {
    parts.push("Respond in English.");
  }

  if (context.brandVoice && Object.keys(context.brandVoice).length > 0) {
    parts.push(`Brand voice profile: ${JSON.stringify(context.brandVoice)}`);
  }

  if (context.goals?.length) {
    parts.push(`Active goals: ${context.goals.map((g) => g.title).join(", ")}`);
  }

  if (context.pendingContent?.length) {
    parts.push(
      `Pending content: ${context.pendingContent.map((c) => `${c.title} (${c.status})`).join(", ")}`,
    );
  }

  if (context.integrations?.length) {
    const connected = context.integrations.filter((i) => i.is_connected).map((i) => i.platform);
    parts.push(`Connected platforms: ${connected.join(", ") || "none"}`);
  }

  return parts.join("\n\n");
}
