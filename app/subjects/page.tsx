import Link from "next/link";
import { CURRENT_TERM_COURSES } from "@/lib/term-courses";
import { loadItems, loadSettings, requireStudent, type Item } from "@/lib/views";
import { AppShell } from "../app-shell";
import { ItemsView } from "../items-list";

export const metadata = { title: "Subjects · Campus Hub" };

// Short names a course goes by in emails: "MMM_26" → MMM, "ISDC Group 1" → ISDC,
// "Business to Business Marketing" → B2B (from the term's elective list).
function nicknames(courseName: string) {
  const names = new Set<string>();
  const first = courseName.split(/[\s_-]+/)[0];
  if (/^[A-Z][A-Z0-9]{1,}$/.test(first)) names.add(first);
  for (const c of CURRENT_TERM_COURSES) {
    if (courseName.toLowerCase().includes(c.title.toLowerCase()) || names.has(c.code)) names.add(c.code);
  }
  return [...names];
}

// Everything for one course: its Classroom items, plus emails whose title names it.
function forCourse(items: Item[], courseName: string) {
  const short = nicknames(courseName).map((n) => new RegExp(`(^|[^A-Za-z])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z]|$)`));
  const full = courseName.toLowerCase();
  return items.filter(
    (i) => i.course_name === courseName || i.title.toLowerCase().includes(full) || short.some((re) => re.test(i.title)),
  );
}

export default async function SubjectsPage({ searchParams }: PageProps<"/subjects">) {
  const student = await requireStudent();
  const { course } = await searchParams;
  // For "in 3 days" labels. Rendered once per request on the server, so reading the clock is fine.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const [items, settings, { data: courses }] = await Promise.all([
    loadItems(student),
    loadSettings(student.supabase),
    student.supabase.from("student_courses").select("course_id, course_name").eq("selected", true).order("course_name"),
  ]);
  const chosen = courses?.find((c) => c.course_id === course) ?? courses?.[0] ?? null;

  return (
    <AppShell
      title="Subjects"
      classroomStatus={student.classroomStatus}
      gmailStatus={student.gmailStatus}
      attention={student.attention}
    >
      {!courses?.length ? (
        <p className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          No courses ticked yet. Connect Classroom and pick your courses in Settings.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Course">
            {courses.map((c) => (
              <Link
                key={c.course_id}
                href={`/subjects?course=${encodeURIComponent(c.course_id)}`}
                aria-current={c.course_id === chosen?.course_id ? "page" : undefined}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  c.course_id === chosen?.course_id
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                }`}
              >
                {c.course_name}
              </Link>
            ))}
          </div>
          {chosen && (
            <ItemsView
              items={forCourse(items, chosen.course_name)}
              settings={settings}
              now={now}
              empty={`Nothing found yet for ${chosen.course_name}.`}
              header={
                <p className="text-xs text-zinc-500">
                  Classroom posts for this course, plus emails whose title mentions{" "}
                  {[chosen.course_name, ...nicknames(chosen.course_name)].join(" or ")}.
                </p>
              }
            />
          )}
        </>
      )}
    </AppShell>
  );
}
