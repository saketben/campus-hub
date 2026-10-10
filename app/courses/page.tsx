import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CURRENT_TERM } from "@/lib/term-courses";
import { saveCourses } from "../actions";
import { CoursePicker } from "./course-picker";

export default async function CoursesPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/");

  // Row-level security: only this student's own courses come back.
  // Ticked courses first, then by most recent post. The order is fixed when the
  // page opens, so rows don't jump around while the student ticks and unticks.
  const { data: courses } = await supabase
    .from("student_courses")
    .select("course_id, course_name, selected, last_activity_at")
    .order("selected", { ascending: false })
    .order("last_activity_at", { ascending: false, nullsFirst: false });

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-8 sm:py-16">
      <header className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          ← Back
        </Link>
        <h1 className="text-xl font-semibold">Your current courses</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Tick the courses you&apos;re taking this term. Only these will show up. We&apos;ve pre-ticked the
          ones that match this term&apos;s course list ({CURRENT_TERM}); please check them. You can change this
          any time.
        </p>
      </header>

      {courses && courses.length > 0 ? (
        <CoursePicker courses={courses} action={saveCourses} />
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No courses yet. <Link href="/" className="underline">Connect Classroom</Link> first.
        </p>
      )}
    </main>
  );
}
