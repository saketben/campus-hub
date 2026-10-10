import { disconnectClassroom } from "./actions";

type Status = { state: "connected" | "needs_reconnect"; last_synced_at: string | null } | null;

const MESSAGES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  connected: { text: "Classroom connected.", tone: "ok" },
  disconnected: { text: "Classroom disconnected. We deleted your Classroom items and asked Google to cancel our access.", tone: "ok" },
  cancelled: { text: "You cancelled on Google's screen. Nothing was connected.", tone: "warn" },
  missing: { text: "Some permissions were unticked on Google's screen. Please connect again and allow all three.", tone: "warn" },
  error: { text: "Connecting didn't work. Please try again.", tone: "warn" },
};

const buttonClass =
  "inline-flex h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-5 font-medium text-white hover:bg-zinc-700 sm:w-auto dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

// What the student sees about Classroom: connect, reconnect, or connected (+ disconnect).
export function ClassroomCard({ status, message }: { status: Status; message?: string }) {
  const note = message ? MESSAGES[message] : undefined;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      {note && (
        <p
          className={`rounded-lg p-3 text-sm ${
            note.tone === "ok"
              ? "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-200"
              : "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          }`}
        >
          {note.text}
        </p>
      )}

      {!status && (
        <>
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Connect Google Classroom</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Your assignments and pre-reads will then appear here on their own.
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            <li>Read-only: Campus Hub can never post, submit or change anything.</li>
            <li>
              Google&apos;s screen says &ldquo;course work <strong>and grades</strong>&rdquo;. That&apos;s
              Google&apos;s wording for assignments. Campus Hub never reads or stores your grades.
            </li>
            <li>
              Google will warn that the app isn&apos;t verified yet. It&apos;s a pilot; choose
              &ldquo;Continue&rdquo; to go ahead.
            </li>
          </ul>
          <a href="/api/classroom/connect" className={buttonClass}>
            Connect Classroom
          </a>
        </>
      )}

      {status?.state === "needs_reconnect" && (
        <>
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Classroom needs reconnecting</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Google ended our access (during the pilot this happens every 7 days). Until you reconnect,
              new assignments won&apos;t appear here.
            </p>
          </div>
          <a href="/api/classroom/connect" className={buttonClass}>
            Reconnect Classroom
          </a>
        </>
      )}

      {status?.state === "connected" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Classroom connected.</span>{" "}
            {!status.last_synced_at && "Your items will appear once the first update runs."}
          </p>
          <form action={disconnectClassroom}>
            <button className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Disconnect
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
