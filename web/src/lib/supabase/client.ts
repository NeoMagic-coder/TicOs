export { createSupabaseAdmin } from "./admin";
export { createClient as createSupabaseBrowserClient } from "./browser";
export { createClient as createSupabaseServerClient } from "./server";
export { isSupabaseConfigured } from "./env";

import { createClient as createBrowserClient } from "./browser";

/** @deprecated Use createSupabaseBrowserClient from @/lib/supabase/browser */
export function createSupabaseClient() {
  return createBrowserClient();
}
