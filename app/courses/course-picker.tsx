"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

type Course = { course_id: string; course_name: string; selected: boolean; last_activity_at: string | null };

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
      {pending ? "Saving and updating…" : "Save my courses"}
    </button>
  );
}

// Search box + a checkbox per course. Hidden (filtered-out) courses keep their
// ticks, because every checkbox stays in the form; search only hides rows.
export function CoursePicker({ courses, action }: { courses: Course[]; action: (formData: FormData) => Promise<void> }) {
  const [query, setQuery] = useState("");
  const [ticked, setTicked] = useState(() => new Set(courses.filter((c) => c.selected).map((c) => c.course_id)));
  const q = query.trim().toLowerCase();

  const toggle = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

      <ul className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {courses.map((c) => (
          <li key={c.course_id} hidden={q !== "" && !c.course_name.toLowerCase().includes(q)}>
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
        ))}
      </ul>

      <SaveButton />
    </form>
  );
}
