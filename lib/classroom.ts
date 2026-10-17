import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { GoogleTokenError, getAccessToken } from "@/lib/google";
import { isCurrentTermCourse } from "@/lib/term-courses";

// Fetches a student's Classroom assignments and pre-reads and saves them as items.
// Only reads course lists, assignments and materials. It never calls the
// "studentSubmissions" part of the API, which is where grades live (decision D5).

const API = "https://classroom.googleapis.com/v1";
const DAY = 24 * 60 * 60 * 1000;
const RECENT_MATERIAL_DAYS = 14; // pre-reads posted in the last two weeks
const MIN_SECONDS_BETWEEN_SYNCS = 60; // at most once a minute per student (D1)
const PREVIEW_CHARS = 200;
const COURSES_AT_A_TIME = 6;

// Runs `task` on every entry, at most `limit` at a time, keeping the original order.
async function inBatches<T, R>(list: T[], limit: number, task: (entry: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < list.length; i += limit) {
    results.push(...(await Promise.all(list.slice(i, i + limit).map(task))));
  }
  return results;
}

type Course = { id: string; name: string };
type DueDate = { year: number; month: number; day: number };
type Attachment = {
  driveFile?: { driveFile?: { title?: string } };
  link?: { title?: string; url?: string };
  youtubeVideo?: { title?: string };
  form?: { title?: string };
};
type Post = {
  id: string;
  title: string;
  description?: string;
  materials?: Attachment[];
  alternateLink: string;
  creationTime: string;
  updateTime: string;
};
type CourseWork = Post & { dueDate?: DueDate; dueTime?: { hours?: number; minutes?: number } };

// Short preview: the first lines of the post plus the names of attached files.
function preview(post: Post): string | null {
  const text = (post.description ?? "").replace(/\s+/g, " ").trim();
  const short = text.length > PREVIEW_CHARS ? `${text.slice(0, PREVIEW_CHARS).trimEnd()}…` : text;
  const files = (post.materials ?? [])
    .map((m) => m.driveFile?.driveFile?.title ?? m.link?.title ?? m.link?.url ?? m.youtubeVideo?.title ?? m.form?.title)
    .filter(Boolean);
  const parts = [short, files.length ? `Attached: ${files.join(", ")}` : ""].filter(Boolean);
  return parts.length ? parts.join("\n") : null;
}

async function getAll<T>(token: string, path: string, key: string): Promise<T[]> {
  const results: T[] = [];
  let pageToken = "";
  do {
    const url = `${API}${path}${path.includes("?") ? "&" : "?"}pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Classroom ${path} -> HTTP ${res.status}`);
    const body = await res.json();
    results.push(...((body[key] ?? []) as T[]));
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return results;
}

// Classroom gives due dates and times in UTC. With no time, we treat it as due by
// 23:59 IST that day and flag it as "all day" so the page shows only the date.
function dueAt(work: CourseWork): { due_at: string | null; all_day: boolean } {
  if (!work.dueDate) return { due_at: null, all_day: false };
  const { year, month, day } = work.dueDate;
  if (!work.dueTime) return { due_at: new Date(Date.UTC(year, month - 1, day, 18, 29)).toISOString(), all_day: true };
  const { hours = 0, minutes = 0 } = work.dueTime;
  return { due_at: new Date(Date.UTC(year, month - 1, day, hours, minutes)).toISOString(), all_day: false };
}

export type SyncResult = "synced" | "skipped" | "not_connected" | "needs_reconnect" | "failed";

export async function syncClassroom(userId: string, { force = false } = {}): Promise<SyncResult> {
  const admin = createAdminClient();

  const { data: tokenRow } = await admin
    .from("google_tokens")
    .select("refresh_token_encrypted")
    .eq("user_id", userId)
    .eq("source", "classroom")
    .maybeSingle();
  const { data: status } = await admin
    .from("sync_status")
    .select("last_attempt_at, courses_confirmed_at")
    .eq("user_id", userId)
    .eq("source", "classroom")
    .maybeSingle();
  if (!tokenRow || !status) return "not_connected";

  const now = new Date();
  if (!force && status.last_attempt_at && now.getTime() - Date.parse(status.last_attempt_at) < MIN_SECONDS_BETWEEN_SYNCS * 1000) {
    return "skipped";
  }
  const setStatus = (fields: Record<string, unknown>) =>
    admin.from("sync_status").update(fields).eq("user_id", userId).eq("source", "classroom");
  await setStatus({ last_attempt_at: now.toISOString() });

  let token: string;
  try {
    token = await getAccessToken(decrypt(tokenRow.refresh_token_encrypted));
  } catch (e) {
    const expired = e instanceof GoogleTokenError && e.needsReconnect;
    await setStatus({ state: expired ? "needs_reconnect" : "connected", last_error: String(e) });
    return expired ? "needs_reconnect" : "failed";
  }

  try {
    const courses = await getAll<Course>(token, "/courses?studentId=me&courseStates=ACTIVE", "courses");
    const { data: known } = await admin
      .from("student_courses")
      .select("course_id, selected, last_activity_at")
      .eq("user_id", userId);
    const knownById = new Map((known ?? []).map((c) => [c.course_id as string, c]));

    // Which courses are ticked. Until the student has confirmed their picks, we guess
    // from this term's official course list; after that their choice wins, and only
    // courses new to us get a guess.
    const ticked = (course: Course) => {
      const guess = isCurrentTermCourse(course.name);
      return status.courses_confirmed_at ? ((knownById.get(course.id)?.selected as boolean | undefined) ?? guess) : guess;
    };

    // Only ticked courses are fetched, several at a time; unticked ones keep the
    // "last post" date we already had. This is what keeps Save and Connect quick.
    const fetched = await inBatches(courses.filter(ticked), COURSES_AT_A_TIME, async (course) => {
      const [work, materials] = await Promise.all([
        getAll<CourseWork>(token, `/courses/${course.id}/courseWork`, "courseWork"),
        getAll<Post>(token, `/courses/${course.id}/courseWorkMaterials`, "courseWorkMaterial"),
      ]);
      return { course, work, materials };
    });
    const fetchedById = new Map(fetched.map((f) => [f.course.id, f]));

    const courseRows = courses.map((course) => {
      const f = fetchedById.get(course.id);
      const lastActivity = f ? Math.max(0, ...[...f.work, ...f.materials].map((x) => Date.parse(x.updateTime))) : 0;
      return {
        user_id: userId,
        course_id: course.id,
        course_name: course.name,
        selected: Boolean(f),
        last_activity_at: lastActivity
          ? new Date(lastActivity).toISOString()
          : (knownById.get(course.id)?.last_activity_at ?? null),
      };
    });

    const items: ({ source_id: string } & Record<string, unknown>)[] = [];
    for (const { course, work, materials } of fetched) {
      for (const w of work) {
        const due = dueAt(w);
        // Upcoming assignments, plus ones with no due date (shown, not hidden: trust rule).
        if (due.due_at && Date.parse(due.due_at) < now.getTime()) continue;
        items.push({
          source_id: `coursework:${w.id}`,
          type: "assignment",
          title: w.title,
          ...due,
          details: preview(w),
          posted_at: w.creationTime,
          link: w.alternateLink,
          course_name: course.name,
        });
      }

      for (const m of materials) {
        if (now.getTime() - Date.parse(m.creationTime) > RECENT_MATERIAL_DAYS * DAY) continue;
        items.push({
          source_id: `material:${m.id}`,
          type: "pre_read",
          title: m.title,
          due_at: null,
          all_day: false,
          details: preview(m),
          posted_at: m.creationTime,
          link: m.alternateLink,
          course_name: course.name,
        });
      }
    }

    // Save the course list for the picker, and forget courses that left Classroom.
    if (courseRows.length > 0) {
      const { error } = await admin.from("student_courses").upsert(courseRows, { onConflict: "user_id,course_id" });
      if (error) throw new Error(`Saving courses: ${error.message}`);
    }
    const current = courses.map((c) => `"${c.id}"`).join(",");
    let gone = admin.from("student_courses").delete().eq("user_id", userId);
    if (current) gone = gone.not("course_id", "in", `(${current})`);
    await gone;

    const rows = items.map((item) => ({
      ...item,
      user_id: userId,
      source: "classroom",
      confidence: 1,
      status: "confirmed",
      updated_at: now.toISOString(),
    }));
    if (rows.length > 0) {
      const { error } = await admin.from("items").upsert(rows, { onConflict: "user_id,source,source_id" });
      if (error) throw new Error(`Saving items: ${error.message}`);
    }

    // Remove items that are no longer current (deleted in Classroom, past due, or old).
    // Everything above succeeded, so the fetched list is complete and this is safe.
    const keep = rows.map((r) => `"${r.source_id}"`).join(",");
    let stale = admin.from("items").delete().eq("user_id", userId).eq("source", "classroom");
    if (keep) stale = stale.not("source_id", "in", `(${keep})`);
    const { error: deleteError } = await stale;
    if (deleteError) throw new Error(`Removing old items: ${deleteError.message}`);

    await setStatus({ state: "connected", last_synced_at: now.toISOString(), last_error: null });
    return "synced";
  } catch (e) {
    await setStatus({ last_error: String(e) });
    return "failed";
  }
}
