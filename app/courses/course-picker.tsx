"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

type Course = {
  course_id: string;
  course_name: string;
  selected: boolean;
  last_activity_at: string | null;
  this_term: boolean; // matches this term's official course list
};

function lastPost(iso: string | null) {
  if (!iso) return "No posts yet";
  const date = new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
  return `Last post ${date}`;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="h-11 w-full rounded-lg bg-zinc-900 px-5 font-medium text-white hover:bg-zinc-700 disabled:opacity-60 sm:w-auto dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      {pending ? "Saving…" : "Save my courses"}
    </button>
  );
}

// This term's courses (and anything already ticked) on top; earlier terms' courses
// tucked into a collapsed section. Every checkbox always stays in the form, so
// hiding a row (collapsed or filtered by search) never loses a tick.
export function CoursePicker({
  courses,
  termName,
  action,
}: {
  courses: Course[];
  termName: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [showOthers, setShowOthers] = useState(false);
  const [ticked, setTicked] = useState(() => new Set(courses.filter((c) => c.selected).map((c) => c.course_id)));
  const q = query.trim().toLowerCase();

  const main = courses.filter((c) => c.this_term || c.selected);
  const others = courses.filter((c) => !c.this_term && !c.selected);

  const toggle = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rows = (list: Course[], visible: boolean) =>
    list.map((c) => (
      <li key={c.course_id} hidden={!visible || (q !== "" && !c.course_name.toLowerCase().includes(q))}>
        <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
          <input
            type="checkbox"
            name="course"
            value={c.course_id}
            checked={ticked.has(c.course_id)}
            onChange={() => toggle(c.course_id)}
            className="h-5 w-5 shrink-0"
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{c.course_name}</span>
            <span className="text-xs text-zinc-500">{lastPost(c.last_activity_at)}</span>
          </span>
        </label>
      </li>
    ));

  const listClass =
    "flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800";

  return (
    <form action={action} className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search courses"
        className="h-11 rounded-lg border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
      />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{ticked.size} ticked</p>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">This term ({termName})</h2>
        {main.length > 0 ? (
          <ul className={listClass}>{rows(main, true)}</ul>
        ) : (
          <p className="text-sm text-zinc-500">None of your Classroom courses match this term&apos;s list.</p>
        )}
      </section>

      {others.length > 0 && (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowOthers((v) => !v)}
            aria-expanded={showOthers || q !== ""}
            className="self-start text-sm font-medium text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {showOthers ? "Hide" : "Show"} courses from earlier terms ({others.length})
          </button>
          {/* Searching also looks through earlier terms' courses. */}
          <ul className={listClass} hidden={!showOthers && q === ""}>
            {rows(others, showOthers || q !== "")}
          </ul>
        </section>
      )}

      <SaveButton />
    </form>
  );
}
