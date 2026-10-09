import { createBrowserClient } from "@supabase/ssr";

// Supabase client for code that runs in the browser (e.g. the Google sign-in button).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
