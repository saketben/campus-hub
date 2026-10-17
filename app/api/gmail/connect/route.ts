import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GMAIL_SCOPES, gmailCallbackUrl } from "@/lib/google";

// Step 1 of connecting Gmail: send the signed-in student to Google's permission screen.
// Same as Connect Classroom, but asks only for read-only Gmail.
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
    redirect_uri: gmailCallbackUrl(origin),
    response_type: "code",
    // "openid email" (already shared at sign-in) tells us which account was connected.
    scope: ["openid", "email", ...GMAIL_SCOPES].join(" "),
    access_type: "offline", // gives a long-lived key so we can sync in the background
    prompt: "consent",
    login_hint: data.claims.email ?? "",
    state,
  }).toString();

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    maxAge: 600,
    path: "/api/gmail",
  });
  return response;
}
