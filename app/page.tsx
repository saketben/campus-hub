import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { ClassroomCard } from "./classroom-card";
import { GoogleSignIn } from "./google-sign-in";
import { ItemsList } from "./items-list";
import { SyncStatus } from "./sync-status";

export default async function Home({ searchParams }: PageProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const { classroom: message } = await searchParams;
  // For "in 3 days" labels. This page renders once per request on the server, so reading the clock is fine.
  // eslint-disable-next-line react-hooks/purity
  const requestTime = Date.now();

  // Row-level security means this only ever returns the signed-in student's own row.
  const { data: classroomStatus } = user
    ? await supabase.from("sync_status").select("state, last_synced_at, courses_confirmed_at").eq("source", "classroom").maybeSingle()
    : { data: null };

  // Items from ticked courses; dismissed ones are hidden (dismissing arrives in Stage 5).
  const { data: items } = classroomStatus
    ? await supabase
        .from("items")
        .select("id, type, title, course_name, due_at, all_day, posted_at, details, link")
        .eq("source", "classroom")
        .neq("status", "dismissed")
    : { data: null };

  // The ticked courses, shown as "Watching: …" so students can see what's covered.
  const { data: watched } = classroomStatus
    ? await supabase.from("student_courses").select("course_name").eq("selected", true).order("course_name")
    : { data: null };

  // The Classroom card goes first when it needs the student's attention, last otherwise.
  const needsAttention =
    !classroomStatus || classroomStatus.state !== "connected" || !classroomStatus.courses_confirmed_at;
  const card = (
    <ClassroomCard status={classroomStatus} message={typeof message === "string" ? message : undefined} />
  );

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
          <div className="flex flex-col gap-1">
            <p className="text-lg">Hi, {user.user_metadata?.full_name ?? user.email}</p>
            {classroomStatus && <SyncStatus lastSyncedAt={classroomStatus.last_synced_at} />}
          </div>
          {needsAttention && card}
          {classroomStatus && <ItemsList items={items ?? []} watching={(watched ?? []).map((c) => c.course_name)} now={requestTime} />}
          {!needsAttention && card}
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
