import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth, currentUser } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase/client";

export async function createContext() {
  const session = await auth();
  const userId = session.userId;
  const supabase = createSupabaseAdmin();

  let userEmail: string | null = null;
  let userName: string | null = null;
  if (userId) {
    try {
      const user = await currentUser();
      userEmail = user?.primaryEmailAddress?.emailAddress ?? null;
      userName = user?.fullName ?? null;
    } catch {
      // currentUser() may be unavailable; user.sync covers this case.
    }
  }

  return {
    userId,
    userEmail,
    userName,
    supabase,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
    },
  });
});
