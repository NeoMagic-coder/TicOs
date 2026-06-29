import { auth } from "@clerk/nextjs/server";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createSupabaseAdmin } from "@/lib/supabase/client";
import { buildSystemPrompt } from "@/lib/ai/agents";
import type { AgentId, Database } from "@/types/database";

type BrandRow = Database["public"]["Tables"]["brands"]["Row"];

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, agentId = "ticos", locale = "tr" } = await req.json();

  const supabase = createSupabaseAdmin();

  const { data: brandData } = await supabase
    .from("brands")
    .select("*")
    .eq("user_id", session.userId)
    .limit(1)
    .maybeSingle();

  const brand = brandData as BrandRow | null;
  const brandId = brand?.id;

  const { data: goals } = brandId
    ? await supabase.from("goals").select("*").eq("brand_id", brandId)
    : { data: [] };

  const { data: pendingContent } = brandId
    ? await supabase
        .from("content_ideas")
        .select("title, status")
        .eq("brand_id", brandId)
        .eq("status", "pending_approval")
    : { data: [] };

  const { data: integrations } = brandId
    ? await supabase.from("integrations").select("platform, is_connected").eq("brand_id", brandId)
    : { data: [] };

  const system = buildSystemPrompt(agentId as AgentId, {
    brandVoice: (brand?.voice_profile as Record<string, unknown>) ?? {},
    goals: goals ?? [],
    pendingContent: pendingContent ?? [],
    integrations: integrations ?? [],
    locale,
  });

  const result = streamText({
    model: openai("gpt-4o"),
    system,
    messages,
    onFinish: async ({ text }) => {
      const allMessages = [
        ...messages,
        { role: "assistant" as const, content: text },
      ];

      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", session.userId!)
        .eq("agent_id", agentId)
        .limit(1)
        .single();

      if (existing) {
        await supabase
          .from("conversations")
          .update({ messages: allMessages, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else {
        await supabase.from("conversations").insert({
          user_id: session.userId!,
          agent_id: agentId,
          messages: allMessages,
        });
      }
    },
  });

  return result.toTextStreamResponse();
}
