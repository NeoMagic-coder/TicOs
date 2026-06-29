import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "./env";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminClient: SupabaseClient<any> | null = null;

export function createSupabaseAdmin() {
  if (adminClient) return adminClient;

  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing Supabase environment variables");
    }
    adminClient = createClient(
      "https://placeholder.supabase.co",
      "placeholder-key",
      { auth: { persistSession: false } },
    );
    return adminClient;
  }

  adminClient = createClient(url, key, {
    auth: { persistSession: false },
  });
  return adminClient;
}
