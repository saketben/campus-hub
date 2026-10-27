"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { revokeToken } from "@/lib/google";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

type Source = "classroom" | "gmail";

// Delete one source's key, sync status, queue and every item we stored from it.
// Google treats our Classroom and Gmail permissions as one grant (tested
// 2026-10-21): cancelling one at Google cancels both. So we only ask Google to
// cancel when this is the student's last connection (Saket's decision); until
// then the deleted key is simply gone, and we can no longer use it.
// Returns whether Google was asked to cancel.
async function disconnect(userId: string, source: Source) {
  const admin = createAdminClient();
  const { data: token } = await admin
    .from("google_tokens")
    .select("refresh_token_encrypted")
    .eq("user_id", userId)
    .eq("source", source)
    .maybeSingle();
  const other: Source = source === "classroom" ? "gmail" : "classroom";
  const { data: otherToken } = await admin
    .from("google_tokens")
    .select("user_id")
    .eq("user_id", userId)
    .eq("source", other)
    .maybeSingle();

  const cancelAtGoogle = Boolean(token) && !otherToken;
  if (token && cancelAtGoogle) {
    try {
      await revokeToken(decrypt(token.refresh_token_encrypted));
    } catch {
      // Already expired or revoked at Google's end: nothing to cancel.
    }
  }

  await admin.from("items").delete().eq("user_id", userId).eq("source", source);
  if (source === "classroom") await admin.from("student_courses").delete().eq("user_id", userId);
  await admin.from("sync_status").delete().eq("user_id", userId).eq("source", source);
  await admin.from("message_queue").delete().eq("user_id", userId).eq("source", source);
  await admin.from("google_tokens").delete().eq("user_id", userId).eq("source", source);
  return cancelAtGoogle;
}

async function signedInUserId() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/");
  return userId;
}

export async function disconnectClassroom() {
  const cancelled = await disconnect(await signedInUserId(), "classroom");
  redirect(`/?classroom=${cancelled ? "disconnected" : "disconnected_kept"}`);
}

export async function disconnectGmail() {
  const cancelled = await disconnect(await signedInUserId(), "gmail");
  redirect(`/?gmail=${cancelled ? "disconnected" : "disconnected_kept"}`);
}

// Save the student's ticked courses. Items from unticked courses go straight away;
// items from newly ticked ones are fetched by the home page right after
// ("Updating from Classroom…"), so the Save button never waits on Google.
export async function saveCourses(formData: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/");

  const picked = formData.getAll("course").map(String);
  const admin = createAdminClient();
  await admin.from("student_courses").update({ selected: false }).eq("user_id", userId);
  if (picked.length > 0) {
    await admin.from("student_courses").update({ selected: true }).eq("user_id", userId).in("course_id", picked);
  }
  const { data: unticked } = await admin
    .from("student_courses")
    .select("course_id, course_name")
    .eq("user_id", userId)
    .eq("selected", false);
  const names = (unticked ?? []).map((c) => c.course_name as string);
  if (names.length > 0) {
    // Includes items the AI found in those courses' announcements.
    await admin.from("items").delete().eq("user_id", userId).eq("source", "classroom").in("course_name", names);
    // Their announcements leave the reading queue (ticking again re-queues them,
    // and the shared answers make re-reading free).
    await admin
      .from("message_queue")
      .delete()
      .eq("user_id", userId)
      .eq("source", "classroom")
      .in("course_id", (unticked ?? []).map((c) => c.course_id as string));
  }
  // Clearing last_attempt_at lets the home page's check run immediately,
  // instead of waiting out the once-a-minute limit.
  await admin
    .from("sync_status")
    .update({ courses_confirmed_at: new Date().toISOString(), last_attempt_at: null })
    .eq("user_id", userId)
    .eq("source", "classroom");

  redirect("/?classroom=courses");
}
