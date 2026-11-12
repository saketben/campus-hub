import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteMyData } from "../actions";

export const metadata = { title: "Privacy and your data · Campus Hub" };

const heading = "font-semibold text-zinc-900 dark:text-zinc-100";

// What we read, what we keep, and how to leave. Plain words, for pilot students.
export default async function Privacy() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8 text-sm leading-relaxed text-zinc-700 sm:py-16 dark:text-zinc-300">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Privacy and your data</h1>
        <Link href="/" className="rounded-lg px-3 py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900">
          ← Back
        </Link>
      </header>

      <p>
        Campus Hub is a student project at IIM Tiruchirappalli, in a small pilot. It gathers your deadlines from Google
        Classroom and Gmail so you don&apos;t have to type them in. Here is exactly what that involves.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className={heading}>What we read</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Sign-in:</b> your name and email address only.
          </li>
          <li>
            <b>Google Classroom</b> (if you connect it, read-only): the courses you tick, their assignments, materials
            and announcements. We never open your submissions or grades.
          </li>
          <li>
            <b>Gmail</b> (if you connect it, read-only): emails from your college, placement portals and people
            writing to you personally. Marketing and bulk emails from outside senders are skipped without being read.
            We can&apos;t send, change or delete anything in your mailbox.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={heading}>How the AI is used</h2>
        <p>
          To find deadlines in emails and announcements, their text is sent to an AI service (Groq, with zero data
          retention switched on, so Groq doesn&apos;t keep it). The text is read in memory and thrown away straight
          after.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={heading}>What we keep</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>The items found (title, date and time, type, course or sender) with a link back to the original.</li>
          <li>For each email: its sender, time and Gmail id, so it isn&apos;t read twice. Never its subject or text.</li>
          <li>Your ticked courses, and a locked, encrypted key that lets us check Classroom and Gmail for you.</li>
          <li>
            When the same email reaches many students (a batch-wide mail), the items found in it are kept once under a
            scrambled fingerprint, so it isn&apos;t read again for everyone. This copy has no name or email address on
            it.
          </li>
        </ul>
        <p>Your data is stored in Supabase (Mumbai region) and isn&apos;t shared with anyone or used for anything else.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className={heading}>Your choices</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Disconnect</b> Classroom or Gmail on the home page: deletes everything we got from it.
          </li>
          <li>
            <b>Cancel access at Google</b> any time at{" "}
            <a
              href="https://myaccount.google.com/connections"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-700 underline dark:text-blue-400"
            >
              myaccount.google.com/connections ↗
            </a>
            .
          </li>
          <li>
            <b>Delete all my data:</b> below. Removes your account and everything listed above, and cancels our access
            at Google.
          </li>
        </ul>
      </section>

      {signedIn && (
        <section className="flex flex-col gap-3 rounded-xl border border-red-200 p-4 dark:border-red-900">
          <h2 className={heading}>Delete all my data</h2>
          <p>
            This can&apos;t be undone. You can sign in again later, but you&apos;ll start from scratch (connect, pick
            courses, and wait for your emails to be read again).
          </p>
          <form action={deleteMyData} className="flex flex-col gap-3">
            <label className="flex items-start gap-2">
              <input type="checkbox" name="sure" required className="mt-1" />
              <span>I understand that everything will be deleted.</span>
            </label>
            <button className="self-start rounded-lg bg-red-700 px-4 py-2 font-medium text-white hover:bg-red-800">
              Delete all my data
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
