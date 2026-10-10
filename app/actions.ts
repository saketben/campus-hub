"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import { revokeToken } from "@/lib/google";
import { syncClassroom } from "@/lib/classroom";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// Disconnect Classroom: tell Google to cancel our access, then delete the key,
// the sync status and every Classroom item we stored for this student.
export async function disconnectClassroom() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/");

  const admin = createAdminClient();
  const { data: token } = await admin
    .from("google_tokens")
    .select("refresh_token_encrypted")
    .eq("user_id", userId)
    .maybeSingle();
  if (token) {
    try {
      await revokeToken(decrypt(token.refresh_token_encrypted));
    } catch {
      // Already expired or revoked at Google's end: nothing to cancel.
    }
  }

  await admin.from("items").delete().eq("user_id", userId).eq("source", "classroom");
  await admin.from("student_courses").delete().eq("user_id", userId);
  await admin.from("sync_status").delete().eq("user_id", userId).eq("source", "classroom");
  await admin.from("google_tokens").delete().eq("user_id", userId);

  redirect("/?classroom=disconnected");
}

// Save the student's ticked courses, then refresh their items to match.
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
  await admin
    .from("sync_status")
    .update({ courses_confirmed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("source", "classroom");

  await syncClassroom(userId, { force: true });
  redirect("/?classroom=courses");
}
