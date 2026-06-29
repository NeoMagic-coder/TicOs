import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../init";
import type { VoiceProfile } from "@/types/database";
import { DEFAULT_AGENTS, seedTeamMembers } from "@/lib/ai/agents";
import { analyzeBrandFromUrl } from "@/lib/ai/brand-analyzer";
import { PLAN_LIMITS } from "@/lib/billing/plans";

async function getOrCreateUser(
  supabase: ReturnType<typeof import("@/lib/supabase/client").createSupabaseAdmin>,
  userId: string,
  email: string,
  name?: string | null,
) {
  const { data: existing } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("users")
    .insert({ id: userId, email, name: name ?? null })
    .select()
    .single();

  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  return data;
}

async function ensureUser(
  supabase: ReturnType<typeof import("@/lib/supabase/client").createSupabaseAdmin>,
  userId: string,
  email?: string | null,
  name?: string | null,
) {
  // Idempotent: guarantees a users row exists before any FK-dependent insert.
  const { error } = await supabase.from("users").upsert(
    {
      id: userId,
      email: email ?? `${userId}@placeholder.local`,
      name: name ?? null,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (error) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  }
}

async function getUserBrand(
  supabase: ReturnType<typeof import("@/lib/supabase/client").createSupabaseAdmin>,
  userId: string,
  brandId: string,
) {
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Marka bulunamadı" });
  }
  return data;
}

async function getOrCreateBrand(
  supabase: ReturnType<typeof import("@/lib/supabase/client").createSupabaseAdmin>,
  userId: string,
  email?: string | null,
  name?: string | null,
) {
  const { data: existing } = await supabase
    .from("brands")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (existing) return existing;

  await ensureUser(supabase, userId, email, name);

  const { data, error } = await supabase
    .from("brands")
    .insert({ user_id: userId })
    .select()
    .single();

  if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
  return data;
}

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const { data } = await ctx.supabase
      .from("users")
      .select("*")
      .eq("id", ctx.userId)
      .single();
    return data;
  }),

  sync: protectedProcedure
    .input(z.object({ email: z.string(), name: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return getOrCreateUser(ctx.supabase, ctx.userId, input.email, input.name);
    }),

  deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
    const { error } = await ctx.supabase.from("users").delete().eq("id", ctx.userId);
    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return { success: true };
  }),
});

export const brandRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await ensureUser(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);
    const { data, error } = await ctx.supabase
      .from("brands")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: true });

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data ?? [];
  }),

  get: protectedProcedure
    .input(z.object({ brandId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      if (input.brandId) {
        return getUserBrand(ctx.supabase, ctx.userId, input.brandId);
      }
      return getOrCreateBrand(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);
    }),

  create: protectedProcedure.mutation(async ({ ctx }) => {
    await ensureUser(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);
    const { data, error } = await ctx.supabase
      .from("brands")
      .insert({ user_id: ctx.userId })
      .select()
      .single();

    if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
    return data;
  }),

  delete: protectedProcedure
    .input(z.object({ brandId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await getUserBrand(ctx.supabase, ctx.userId, input.brandId);
      const { error } = await ctx.supabase.from("brands").delete().eq("id", input.brandId);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),

  analyze: protectedProcedure
    .input(
      z.object({
        url: z.string().url(),
        brandId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const brand = input.brandId
        ? await getUserBrand(ctx.supabase, ctx.userId, input.brandId)
        : await getOrCreateBrand(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);
      const profile = await analyzeBrandFromUrl(input.url);

      const { data, error } = await ctx.supabase
        .from("brands")
        .update({
          url: input.url,
          name: new URL(input.url).hostname.replace("www.", ""),
          voice_profile: profile,
        })
        .eq("id", brand.id)
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      await seedTeamMembers(ctx.supabase, brand.id);

      await ctx.supabase.from("content_ideas").insert({
        brand_id: brand.id,
        title: "İlk içerik fikriniz hazır",
        status: "pending_approval",
        platforms: ["instagram", "linkedin"],
        content: {
          idea: "Markanızın değer önerisini vurgulayan bir tanıtım gönderisi",
          caption: profile.summary,
        },
      });

      return data;
    }),

  update: protectedProcedure
    .input(
      z.object({
        brandId: z.string().uuid(),
        voice_profile: z.custom<VoiceProfile>(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await getUserBrand(ctx.supabase, ctx.userId, input.brandId);
      const { data, error } = await ctx.supabase
        .from("brands")
        .update({ voice_profile: input.voice_profile })
        .eq("id", input.brandId)
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),
});

export const teamRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const brand = await getOrCreateBrand(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);
    const { data } = await ctx.supabase
      .from("team_members")
      .select("*")
      .eq("brand_id", brand.id);

    if (!data?.length) {
      await seedTeamMembers(ctx.supabase, brand.id);
      const { data: seeded } = await ctx.supabase
        .from("team_members")
        .select("*")
        .eq("brand_id", brand.id);
      return seeded ?? DEFAULT_AGENTS;
    }

    return data;
  }),
});

export const contentRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const brand = await getOrCreateBrand(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);
    const { data } = await ctx.supabase
      .from("content_ideas")
      .select("*")
      .eq("brand_id", brand.id)
      .order("scheduled_at", { ascending: true });
    return data ?? [];
  }),

  approve: protectedProcedure
    .input(z.object({ id: z.string().uuid(), action: z.enum(["approve", "expand", "publish"]) }))
    .mutation(async ({ ctx, input }) => {
      const statusMap = {
        approve: "approved",
        expand: "expanded",
        publish: "scheduled",
      } as const;

      const { data, error } = await ctx.supabase
        .from("content_ideas")
        .update({ status: statusMap[input.action] })
        .eq("id", input.id)
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        platforms: z.array(z.string()),
        scheduled_at: z.string().optional(),
        content: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const brand = await getOrCreateBrand(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);
      const { data, error } = await ctx.supabase
        .from("content_ideas")
        .insert({
          brand_id: brand.id,
          title: input.title,
          platforms: input.platforms,
          scheduled_at: input.scheduled_at ?? null,
          content: input.content ?? {},
          status: "pending_approval",
        })
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),
});

export const goalsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const brand = await getOrCreateBrand(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);
    const { data } = await ctx.supabase
      .from("goals")
      .select("*")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false });
    return data ?? [];
  }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        target_value: z.number().optional(),
        unit: z.string().optional(),
        deadline: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const brand = await getOrCreateBrand(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);
      const { data, error } = await ctx.supabase
        .from("goals")
        .insert({ brand_id: brand.id, ...input })
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),
});

export const integrationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const brand = await getOrCreateBrand(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);
    const { data } = await ctx.supabase
      .from("integrations")
      .select("*")
      .eq("brand_id", brand.id);
    return data ?? [];
  }),

  connect: protectedProcedure
    .input(z.object({ platform: z.string(), credentials: z.record(z.string(), z.unknown()).optional() }))
    .mutation(async ({ ctx, input }) => {
      const brand = await getOrCreateBrand(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);
      const { data, error } = await ctx.supabase
        .from("integrations")
        .upsert(
          {
            brand_id: brand.id,
            platform: input.platform,
            credentials: input.credentials ?? {},
            is_connected: true,
          },
          { onConflict: "brand_id,platform" },
        )
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return data;
    }),

  disconnect: protectedProcedure
    .input(z.object({ platform: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const brand = await getOrCreateBrand(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);
      const { error } = await ctx.supabase
        .from("integrations")
        .update({ is_connected: false, credentials: {} })
        .eq("brand_id", brand.id)
        .eq("platform", input.platform);

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });
      return { success: true };
    }),
});

export const imagesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const brand = await getOrCreateBrand(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);
    const { data } = await ctx.supabase
      .from("generated_images")
      .select("*")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false });
    return data ?? [];
  }),

  generate: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(3),
        size: z.string().default("1024x1024"),
        count: z.number().min(1).max(4).default(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.supabase.from("users").select("plan").eq("id", ctx.userId).single();
      const plan = (user.data?.plan ?? "trial") as keyof typeof PLAN_LIMITS;
      const limit = PLAN_LIMITS[plan].imagesPerDay;

      const { data: usage } = await ctx.supabase
        .from("usage_limits")
        .select("*")
        .eq("user_id", ctx.userId)
        .eq("feature", "image_generation")
        .single();

      if (usage && usage.used_count >= limit) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Daily image generation limit reached",
        });
      }

      const { generateImages } = await import("@/lib/ai/image-generator");
      const urls = await generateImages(input.prompt, input.size, input.count);
      const brand = await getOrCreateBrand(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);

      const { data, error } = await ctx.supabase
        .from("generated_images")
        .insert({ brand_id: brand.id, prompt: input.prompt, image_urls: urls })
        .select()
        .single();

      if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      await ctx.supabase.from("usage_limits").upsert(
        {
          user_id: ctx.userId,
          feature: "image_generation",
          used_count: (usage?.used_count ?? 0) + 1,
          limit_count: limit,
        },
        { onConflict: "user_id,feature" },
      );

      return data;
    }),

  remaining: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.supabase.from("users").select("plan").eq("id", ctx.userId).single();
    const plan = (user.data?.plan ?? "trial") as keyof typeof PLAN_LIMITS;
    const limit = PLAN_LIMITS[plan].imagesPerDay;

    const { data: usage } = await ctx.supabase
      .from("usage_limits")
      .select("*")
      .eq("user_id", ctx.userId)
      .eq("feature", "image_generation")
      .single();

    return { remaining: limit - (usage?.used_count ?? 0), limit };
  }),
});

export const automationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const brand = await getOrCreateBrand(ctx.supabase, ctx.userId, ctx.userEmail, ctx.userName);
    const { data } = await ctx.supabase
      .from("automations")
      .select("*")
      .eq("brand_id", brand.id);
    return data ?? [];
  }),
});

export const conversationsRouter = router({
  get: protectedProcedure
    .input(z.object({ agentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { data } = await ctx.supabase
        .from("conversations")
        .select("*")
        .eq("user_id", ctx.userId)
        .eq("agent_id", input.agentId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      return data;
    }),
});

export const appRouter = router({
  user: userRouter,
  brand: brandRouter,
  team: teamRouter,
  content: contentRouter,
  goals: goalsRouter,
  integrations: integrationsRouter,
  images: imagesRouter,
  automations: automationsRouter,
  conversations: conversationsRouter,
});

export type AppRouter = typeof appRouter;
