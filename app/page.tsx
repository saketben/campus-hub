import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { ClassroomCard } from "./classroom-card";
import { GoogleSignIn } from "./google-sign-in";

export default async function Home({ searchParams }: PageProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const { classroom: message } = await searchParams;

  // Row-level security means this only ever returns the signed-in student's own row.
  const { data: classroomStatus } = user
    ? await supabase.from("sync_status").select("state, last_synced_at").eq("source", "classroom").maybeSingle()
    : { data: null };

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
          <ClassroomCard status={classroomStatus} message={typeof message === "string" ? message : undefined} />
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
