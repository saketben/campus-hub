import Link from "next/link";
import type { ReactNode } from "react";
import { Nav } from "./nav";
import { SyncStatus } from "./sync-status";

type Status = { last_synced_at: string | null } | null;

// The frame around every signed-in section (Stage 6): title, "Last updated"
// (which also checks Classroom and Gmail when a page opens), the section tabs, and
// a banner when something in Settings needs the student (e.g. the weekly reconnect).
export function AppShell({
  title,
  classroomStatus,
  gmailStatus,
  attention,
  children,
}: {
  title: string;
  classroomStatus: Status;
  gmailStatus: Status;
  attention: string | null;
  children: ReactNode;
}) {
  const sources = [...(classroomStatus ? ["classroom" as const] : []), ...(gmailStatus ? ["gmail" as const] : [])];
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-4 pb-24 pt-6 sm:pb-16 sm:pt-12">
      <header className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-semibold">{title}</h1>
          <span className="text-sm font-medium text-zinc-500">Campus Hub</span>
        </div>
        {sources.length > 0 && (
          <SyncStatus lastSyncedAt={classroomStatus?.last_synced_at ?? gmailStatus?.last_synced_at ?? null} sources={sources} />
        )}
        <Nav alert={Boolean(attention)} />
      </header>
      {attention && (
        <Link
          href="/settings"
          className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {attention} <span className="font-medium underline">Open Settings</span>
        </Link>
      )}
      {children}
      <footer className="mt-auto pt-4 text-xs text-zinc-500">
        <Link href="/privacy" className="underline">
          Privacy and your data
        </Link>
      </footer>
    </main>
  );
}
