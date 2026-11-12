import Link from "next/link";
import { requireStudent } from "@/lib/views";
import { signOut } from "../actions";
import { AppShell } from "../app-shell";
import { ClassroomCard } from "../classroom-card";
import { GmailCard } from "../gmail-card";

export const metadata = { title: "Settings · Campus Hub" };

// Connections, courses and account (Stage 6). The weekly reconnect happens here;
// other sections show a banner pointing here when it's due.
export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const student = await requireStudent();
  const { supabase, user, classroomStatus, gmailStatus } = student;
  const { classroom: message, gmail: gmailMessage } = await searchParams;

  // How many emails the Gmail check has looked at, and what it decided.
  const count = async (status?: string) => {
    let query = supabase.from("message_queue").select("message_id", { count: "exact", head: true }).eq("source", "gmail");
    if (status) query = query.eq("status", status);
    return (await query).count ?? 0;
  };
  const gmailCounts = gmailStatus?.last_synced_at
    ? { checked: await count(), waiting: await count("waiting"), skipped: await count("skipped") }
    : null;

  return (
    <AppShell title="Settings" classroomStatus={classroomStatus} gmailStatus={gmailStatus} attention={null}>
      <ClassroomCard status={classroomStatus} message={typeof message === "string" ? message : undefined} />
      <GmailCard status={gmailStatus} counts={gmailCounts} message={typeof gmailMessage === "string" ? gmailMessage : undefined} />
      <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <p className="font-medium text-zinc-900 dark:text-zinc-100">Your account</p>
        <p className="text-zinc-600 dark:text-zinc-400">Signed in as {String(user.email ?? "")}</p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/privacy"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Privacy and delete my data
          </Link>
          <form action={signOut}>
            <button className="rounded-lg border border-zinc-300 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">
              Sign out
            </button>
          </form>
        </div>
      </section>
    </AppShell>
  );
}
