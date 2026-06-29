import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/client";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  const { platform } = await params;
  const session = await auth();

  if (!session.userId) {
    return NextResponse.redirect(new URL("/tr/sign-in", req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    const envKey = `${platform.toUpperCase()}_CLIENT_ID`;
    const authUrl = new URL(`https://oauth.example.com/${platform}`);
    authUrl.searchParams.set("client_id", process.env[envKey] ?? "demo");
    authUrl.searchParams.set(
      "redirect_uri",
      `${url.origin}/api/integrations/${platform}`,
    );
    authUrl.searchParams.set("response_type", "code");
    return NextResponse.redirect(authUrl);
  }

  const supabase = createSupabaseAdmin();
  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("user_id", session.userId)
    .limit(1)
    .single();

  if (brand) {
    await supabase.from("integrations").upsert(
      {
        brand_id: brand.id,
        platform,
        credentials: { code, connected_at: new Date().toISOString() },
        is_connected: true,
      },
      { onConflict: "brand_id,platform" },
    );
  }

  return NextResponse.redirect(new URL("/tr/automations", req.url));
}
