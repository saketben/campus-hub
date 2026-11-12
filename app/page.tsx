import { redirect } from "next/navigation";
import { loadItems, loadReading, loadSettings, loadStudent } from "@/lib/views";
import { AppShell } from "./app-shell";
import { ClassroomCard } from "./classroom-card";
import { GmailCard } from "./gmail-card";
import { GoogleSignIn } from "./google-sign-in";
import { ItemsView } from "./items-list";

export default async function Home({ searchParams }: PageProps<"/">) {
  const student = await loadStudent();
  const { user, supabase, classroomStatus, gmailStatus } = student;
  const params = await searchParams;
  // Links from before Stage 6 (connect/disconnect results) now belong to Settings.
  if (user && (params.classroom || params.gmail)) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    redirect(`/settings?${query}`);
  }

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8 sm:py-16">
        <h1 className="text-xl font-semibold">Campus Hub</h1>
        {params.deleted === "1" && (
          <p className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            All your data has been deleted and our access at Google cancelled.
          </p>
        )}
        <p className="text-zinc-600 dark:text-zinc-400">
          Your assignments, pre-reads and deadlines in one place, gathered automatically.
        </p>
        <GoogleSignIn />
        <footer className="mt-auto pt-4 text-xs text-zinc-500">
          <a href="/privacy" className="underline">
            Privacy and your data
          </a>
        </footer>
      </main>
    );
  }

  const name = String(user.user_metadata?.full_name ?? user.email ?? "");
  // First visit: nothing connected yet, so the connect cards are the page.
  if (!classroomStatus && !gmailStatus) {
    return (
      <AppShell title={`Hi, ${name}`} classroomStatus={null} gmailStatus={null} attention={null}>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Connect Google Classroom and Gmail, and your deadlines will start appearing here on their own.
        </p>
        <ClassroomCard status={null} />
        <GmailCard status={null} counts={null} />
      </AppShell>
    );
  }

  // For "in 3 days" labels. This page renders once per request on the server, so reading the clock is fine.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const [items, settings, reading, { data: watched }] = await Promise.all([
    loadItems(student),
    loadSettings(supabase),
    loadReading(supabase),
    classroomStatus
      ? supabase.from("student_courses").select("course_name").eq("selected", true).order("course_name")
      : Promise.resolve({ data: null }),
  ]);
  const waiting = reading.total - reading.done;

  return (
    <AppShell title={`Hi, ${name}`} classroomStatus={classroomStatus} gmailStatus={gmailStatus} attention={student.attention}>
      <ItemsView
        items={items}
        settings={settings}
        now={now}
        pinPlacements
        empty="Nothing found yet in your ticked courses or emails."
        header={
          <div className="flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            {watched && (
              <p>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">Watching:</span>{" "}
                {watched.length > 0 ? watched.map((c) => c.course_name).join(", ") : "no courses ticked yet"}
              </p>
            )}
            {reading.total > 0 && (
              <p>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">Read so far:</span> {reading.done} of{" "}
                {reading.total} emails and announcements.
                {waiting > 0 &&
                  ` The other ${waiting} will be read ${waiting > 100 ? "over the next few days" : waiting > 40 ? "over the next day or two" : "within the next few hours"}; newest campus mail first.`}
              </p>
            )}
          </div>
        }
      />
    </AppShell>
  );
}
