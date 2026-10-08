// Check 1: can this Google account sign in and grant our read-only permissions?
import { google } from "googleapis";
import { getAuthClient, describeError, SCOPES } from "./auth.mjs";

const auth = await getAuthClient({ fresh: true });

// Google lets people untick individual permissions, so show exactly what was granted.
// Google reports coursework.me.readonly under its older name, so count that as granted.
const { scopes } = await auth.getTokenInfo(auth.credentials.access_token);
const granted = scopes.map((s) => s.replace("classroom.student-submissions.me.readonly", "classroom.coursework.me.readonly"));
console.log("Permissions Google granted:");
for (const scope of SCOPES) {
  console.log(`  ${granted.includes(scope) ? "YES" : "NO "}  ${scope.replace("https://www.googleapis.com/auth/", "")}`);
}

try {
  const { data } = await google.gmail({ version: "v1", auth }).users.getProfile({ userId: "me" });
  console.log(`\nSigned in as: ${data.emailAddress}`);
} catch (e) {
  console.log(`\nCould not read the account's email address via Gmail: ${describeError(e)}`);
}
