import "server-only";

// The 3 read-only Classroom permissions (decision D5).
export const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
];

// Google sometimes reports coursework.me.readonly under its older name
// (found in Stage 1), so treat the two as the same permission.
const SCOPE_ALIASES: Record<string, string> = {
  "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly":
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
};

export function missingClassroomScopes(granted: string[]) {
  const normalized = granted.map((s) => SCOPE_ALIASES[s] ?? s);
  return CLASSROOM_SCOPES.filter((s) => !normalized.includes(s));
}

export function classroomCallbackUrl(origin: string) {
  return `${origin}/api/classroom/callback`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
  error?: string;
};

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...params,
    }),
  });
  const body = (await res.json()) as TokenResponse;
  if (!res.ok) throw new GoogleTokenError(body.error ?? `HTTP ${res.status}`);
  return body;
}

export class GoogleTokenError extends Error {
  // "invalid_grant" means the student's access expired or was removed: they must reconnect.
  get needsReconnect() {
    return this.message === "invalid_grant";
  }
}

export function exchangeCode(code: string, redirectUri: string) {
  return tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
}

export async function getAccessToken(refreshToken: string) {
  const { access_token } = await tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token" });
  return access_token;
}

export async function revokeToken(token: string) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
}

// The id_token comes straight from Google over HTTPS in the token response,
// so reading the email from it without re-verifying the signature is safe here.
export function emailFromIdToken(idToken: string | undefined) {
  if (!idToken) return null;
  const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
  return typeof payload.email === "string" ? payload.email : null;
}
