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
  await admin.from("sync_status").delete().eq("user_id", userId).eq("source", "classroom");
  await admin.from("google_tokens").delete().eq("user_id", userId);

  redirect("/?classroom=disconnected");
}
