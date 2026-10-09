import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for pages, server actions and route handlers.
// The signed-in session lives in cookies, so the server can see who is signed in.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Pages can't set cookies. That's fine: proxy.ts refreshes the session instead.
          }
        },
      },
    },
  );
}
