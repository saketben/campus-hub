import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt } from "@/lib/crypto";
import { syncClassroom } from "@/lib/classroom";
import { classroomCallbackUrl, emailFromIdToken, exchangeCode, missingClassroomScopes } from "@/lib/google";

// Step 2 of connecting: Google sends the student back here with a one-time code.
// We swap it for a long-lived key, check the permissions, and lock the key away.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;
  const done = (result: string) => {
    const response = NextResponse.redirect(`${origin}/?classroom=${result}`);
    response.cookies.delete({ name: "classroom_oauth_state", path: "/api/classroom" });
    return response;
  };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.redirect(`${origin}/`);

  if (params.get("error")) return done("cancelled");
  const code = params.get("code");
  const state = request.cookies.get("classroom_oauth_state")?.value;
  if (!code || !state || params.get("state") !== state) return done("error");

  let tokens;
  try {
    tokens = await exchangeCode(code, classroomCallbackUrl(origin));
  } catch {
    return done("error");
  }

  // Google lets students untick permissions; we need all three to show anything useful.
  if (missingClassroomScopes(tokens.scope.split(" ")).length > 0) return done("missing");
  if (!tokens.refresh_token) return done("error");

  const admin = createAdminClient();
  const { error: tokenError } = await admin.from("google_tokens").upsert({
    user_id: userId,
    source: "classroom",
    google_email: emailFromIdToken(tokens.id_token) ?? "unknown",
    refresh_token_encrypted: encrypt(tokens.refresh_token),
    scopes: tokens.scope.split(" "),
    updated_at: new Date().toISOString(),
  });
  const { error: statusError } = await admin
    .from("sync_status")
    .upsert({ user_id: userId, source: "classroom", state: "connected", last_error: null });
  if (tokenError || statusError) return done("error");

  // Fetch their items straight away, so the list is ready when they land on the page.
  await syncClassroom(userId, { force: true });
  return done("connected");
}
