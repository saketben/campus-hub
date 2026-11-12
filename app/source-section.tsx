import { loadItems, loadSettings, requireStudent } from "@/lib/views";
import { AppShell } from "./app-shell";
import { ItemsView } from "./items-list";

// The Classroom and Gmail sections: the same list, only items from that source.
export async function SourceSection({ source, title }: { source: "classroom" | "gmail"; title: string }) {
  const student = await requireStudent();
  const status = source === "classroom" ? student.classroomStatus : student.gmailStatus;
  // For "in 3 days" labels. Rendered once per request on the server, so reading the clock is fine.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const [items, settings] = await Promise.all([loadItems(student), loadSettings(student.supabase)]);
  return (
    <AppShell
      title={title}
      classroomStatus={student.classroomStatus}
      gmailStatus={student.gmailStatus}
      attention={student.attention}
    >
      {status ? (
        <ItemsView
          items={items.filter((i) => i.source === source)}
          settings={settings}
          now={now}
          empty={`Nothing found yet in ${title}.`}
        />
      ) : (
        <p className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {title} isn&apos;t connected. You can connect it in Settings.
        </p>
      )}
    </AppShell>
  );
}
