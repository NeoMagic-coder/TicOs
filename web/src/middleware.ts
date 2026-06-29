import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

const isPublicRoute = createRouteMatcher([
  "/",
  "/:locale/sign-in(.*)",
  "/:locale/sign-up(.*)",
]);

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function mergeCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value);
  });
  return target;
}

function isApiRoute(request: NextRequest) {
  const { pathname } = request.nextUrl;
  return pathname.startsWith("/api") || pathname.startsWith("/trpc");
}

async function withSupabaseAndIntl(request: NextRequest) {
  const supabaseResponse = isSupabaseConfigured()
    ? await updateSession(request)
    : undefined;

  // API/tRPC routes must not get a locale prefix from next-intl, otherwise
  // requests are redirected (307) to /tr/api/... which has no handler (404).
  if (isApiRoute(request)) {
    return supabaseResponse ?? NextResponse.next({ request });
  }

  const intlResponse = intlMiddleware(request);

  if (supabaseResponse) {
    return mergeCookies(supabaseResponse, intlResponse);
  }

  return intlResponse;
}

export default clerkEnabled
  ? clerkMiddleware(async (auth, request) => {
      if (!isPublicRoute(request)) {
        const { protect } = await auth();
        await protect();
      }
      return withSupabaseAndIntl(request);
    })
  : async (request: NextRequest) => withSupabaseAndIntl(request);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
