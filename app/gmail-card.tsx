import { disconnectGmail } from "./actions";

type Status = { state: string } | null;
type Counts = { checked: number; waiting: number; skipped: number } | null;

const MESSAGES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  connected: { text: "Gmail connected.", tone: "ok" },
  disconnected: { text: "Gmail disconnected. We deleted your Gmail items and asked Google to cancel our access.", tone: "ok" },
  disconnected_kept: {
    text: "Gmail disconnected. We deleted your Gmail items and our Gmail key, so Campus Hub can no longer read your email. Google still lists Campus Hub in your account because Classroom is connected.",
    tone: "ok",
  },
  cancelled: { text: "You cancelled on Google's screen. Gmail wasn't connected.", tone: "warn" },
  missing: { text: "The Gmail permission was unticked on Google's screen. Please connect again and allow it.", tone: "warn" },
  error: { text: "Connecting Gmail didn't work. Please try again.", tone: "warn" },
};

const buttonClass =
  "inline-flex h-11 w-full items-center justify-center rounded-lg bg-zinc-900 px-5 font-medium text-white hover:bg-zinc-700 sm:w-auto dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

// What the student sees about Gmail: connect, reconnect, or connected (+ disconnect).
export function GmailCard({ status, counts, message }: { status: Status; counts: Counts; message?: string }) {
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
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Connect Gmail</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Deadlines, placement updates and events hidden in your emails will then appear here on their own.
            </p>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
            <li>Read-only: Campus Hub can never send, delete or change an email.</li>
            <li>
              An AI service (Groq) reads emails that may hold deadlines: from your college, placement
              portals, and people writing to you directly. It doesn&apos;t keep them. Campus Hub stores only
              what it finds (title, date, link back), never your emails.
            </li>
            <li>Marketing and newsletter emails are skipped without being read.</li>
            <li>
              Google will warn that the app isn&apos;t verified yet. It&apos;s a pilot; choose
              &ldquo;Continue&rdquo; to go ahead.
            </li>
          </ul>
          <a href="/api/gmail/connect" className={buttonClass}>
            Connect Gmail
          </a>
        </>
      )}

      {status?.state === "needs_reconnect" && (
        <>
          <div>
            <p className="font-medium text-zinc-900 dark:text-zinc-100">Gmail needs reconnecting</p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Google ended our access (during the pilot this happens every 7 days). Until you reconnect,
              deadlines from new emails won&apos;t appear here.
            </p>
          </div>
          <a href="/api/gmail/connect" className={buttonClass}>
            Reconnect Gmail
          </a>
        </>
      )}

      {status?.state === "connected" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">Gmail connected.</span>{" "}
            {counts
              ? `Checked ${counts.checked} emails: ${counts.waiting} to read for deadlines, ${counts.skipped} skipped (notifications, marketing, newsletters). Items from them will start appearing here soon.`
              : "Checking your emails…"}
          </p>
          <form action={disconnectGmail}>
            <button className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Disconnect
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
