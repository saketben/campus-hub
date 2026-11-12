import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NEEDS_ANNOUNCEMENTS } from "@/lib/classroom";
import { categoryOf, type Category } from "@/lib/categories";
import { collegeDomainOf } from "@/lib/gmail";

// What every section page needs (Stage 6): who's signed in, the connections, the
// student's view choices, and their items with a category each. The sections are
// all views over the same items (architecture rule), so they share this loader.

export type Item = {
  id: string;
  source: string;
  source_id: string | null;
  type: string;
  title: string;
  course_name: string | null;
  sender: string | null;
  due_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  posted_at: string | null;
  details: string | null;
  link: string | null;
  status: string;
  category: Category;
};

export type Settings = { hidden: Category[]; view: "list" | "calendar" };
export const DEFAULT_SETTINGS: Settings = { hidden: ["clubs"], view: "list" };

export async function loadStudent() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;
  if (!user) return { supabase, user: null, classroomStatus: null, gmailStatus: null, attention: null };

  // Row-level security means these only ever return the signed-in student's own rows.
  const [{ data: classroomStatus }, { data: gmailStatus }] = await Promise.all([
    supabase.from("sync_status").select("state, last_synced_at, last_error, courses_confirmed_at").eq("source", "classroom").maybeSingle(),
    supabase.from("sync_status").select("state, last_synced_at").eq("source", "gmail").maybeSingle(),
  ]);

  // What needs the student on the Settings page (shown as a banner elsewhere).
  const attention =
    classroomStatus && classroomStatus.state !== "connected"
      ? "Classroom needs reconnecting (Google asks every 7 days)."
      : classroomStatus?.last_error === NEEDS_ANNOUNCEMENTS
        ? "Reconnect Classroom once so course announcements can be read."
        : gmailStatus && gmailStatus.state !== "connected"
          ? "Gmail needs reconnecting (Google asks every 7 days)."
          : classroomStatus && !classroomStatus.courses_confirmed_at
            ? "Check which courses you're taking this term."
            : null;

  return { supabase, user, classroomStatus, gmailStatus, attention };
}

// For pages other than Home: signed-out visitors go to the sign-in page.
export async function requireStudent() {
  const student = await loadStudent();
  if (!student.user) redirect("/");
  return student;
}

type Student = Awaited<ReturnType<typeof loadStudent>>;

export async function loadSettings(supabase: Student["supabase"]): Promise<Settings> {
  // No row yet (or the table isn't there yet): the defaults.
  const { data } = await supabase.from("student_settings").select("hidden_categories, view").maybeSingle();
  return data ? { hidden: data.hidden_categories as Category[], view: data.view as Settings["view"] } : DEFAULT_SETTINGS;
}

export async function loadItems(student: Student): Promise<Item[]> {
  if (!student.user) return [];
  const { data } = await student.supabase
    .from("items")
    .select("id, source, source_id, type, title, course_name, sender, due_at, ends_at, all_day, posted_at, details, link, status");
  const collegeDomain = collegeDomainOf(String(student.user.email ?? "")) ?? undefined;
  return (data ?? []).map((item) => ({ ...item, category: categoryOf(item, collegeDomain) }) as Item);
}

// How far the AI has got with the student's emails and announcements.
export async function loadReading(supabase: Student["supabase"]) {
  const count = async (statuses: string[]) =>
    (await supabase.from("message_queue").select("message_id", { count: "exact", head: true }).in("status", statuses)).count ?? 0;
  const [done, total] = await Promise.all([count(["read", "failed"]), count(["waiting", "read", "failed"])]);
  return { done, total };
}
