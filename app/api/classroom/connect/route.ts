import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CLASSROOM_SCOPES, classroomCallbackUrl } from "@/lib/google";

// Step 1 of connecting: send the signed-in student to Google's permission screen.
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return NextResponse.redirect(`${origin}/`);

  // A random value we check when Google sends the student back, so nobody can
  // trick a student's browser into connecting someone else's account.
  const state = randomBytes(16).toString("hex");

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    redirect_uri: classroomCallbackUrl(origin),
    response_type: "code",
    // "openid email" (already shared at sign-in) tells us which account was connected.
    scope: ["openid", "email", ...CLASSROOM_SCOPES].join(" "),
    access_type: "offline", // gives a long-lived key so we can sync in the background
    prompt: "consent",
    login_hint: data.claims.email ?? "",
    state,
  }).toString();

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("classroom_oauth_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/classroom",
  });
  return response;
}
