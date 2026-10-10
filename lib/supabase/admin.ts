import "server-only";
import { createClient } from "@supabase/supabase-js";

// Server-only Supabase client using the secret key. It bypasses row-level
// security, so it can read the locked google_tokens table and write items.
// Never import this from code that runs in the browser.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
