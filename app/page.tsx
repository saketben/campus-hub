import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { GoogleSignIn } from "./google-sign-in";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8 sm:py-16">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Campus Hub</h1>
        {user && (
          <form action={signOut}>
            <button className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900">
              Sign out
            </button>
          </form>
        )}
      </header>

      {user ? (
        <section className="flex flex-col gap-4">
          <p className="text-lg">Hi, {user.user_metadata?.full_name ?? user.email}</p>
          <div className="rounded-xl border border-zinc-200 p-6 text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Nothing here yet</p>
            <p className="mt-2 text-sm">
              Your Classroom assignments and pre-reads will appear here once you connect Classroom.
              That&apos;s coming soon.
            </p>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <p className="text-zinc-600 dark:text-zinc-400">
            Your assignments, pre-reads and deadlines in one place, gathered automatically.
          </p>
          <GoogleSignIn />
        </section>
      )}
    </main>
  );
}
