# Current stage plan

Only the stage we're working on lives here. When it's done, its outcomes move to
the session and decision logs in CLAUDE.md, and this file is replaced by the next
stage's plan.

## Stage 3: Classroom

**Status:** approved by Saket, D1–D5 (2026-10-10). In progress.

**Goal:** a signed-in student taps "Connect Classroom" once, and their upcoming
assignments and pre-reads (materials) appear on the home page on their own,
each with a link back to Classroom, and stay up to date without them doing
anything.

**Not in this stage:** Classroom announcements (Stage 5 AI step), Gmail, course
outlines (Stage 4), the calendar view, confirm/dismiss buttons.

### Decisions (approved)

- **D1. Freshness.** The site checks Classroom every time a student opens it (at
  most once a minute per student), showing the saved list instantly and
  "Updating…" meanwhile. A background job runs every 30 minutes via Supabase
  Cron (available on the free plan; Vercel's free scheduler only runs once a
  day). Instant push alerts from Google: maybe later, not now.
- **D2. Safe storage.** Each student's Google refresh token goes in a locked
  table the website can never read (no read policy), encrypted with a key kept
  only in Vercel's settings. Only server code using the Supabase secret key
  touches it.
- **D3. What to show.** Assignments due in the future or with no due date;
  recent materials as pre-reads. Skip courses with no activity in ~60 days.
  Store times in UTC, show IST; date-only items show as "due <date>".
- **D4. Expiry (every 7 days in test mode).** A clear "Reconnect Classroom"
  message, and "Last updated <time>" always visible, so the list never looks
  complete when it isn't.
- **D5. Permissions.** Only 3 read-only Classroom permissions: courses, own
  coursework, materials. Google words the coursework one as "course work and
  grades": we never call the submissions endpoint (where grades live) and say
  so on the Connect screen.

### Steps

- [x] **1. Verify scheduler limits and agree D1–D5.**
- [x] **2. Database: connection tables** (Claude writes SQL, Saket runs it).
      `google_tokens` (locked: encrypted refresh token, granted permissions) and
      `classroom_status` (student can read their own: connected, last updated,
      needs reconnect).
- [x] **3. Settings for the server** (Saket, guided). In Google Cloud: add a new
      client secret to `campus-hub-website` and two redirect addresses
      (localhost + live). From Supabase: the secret key. Plus a generated
      encryption key. All server-only (no `NEXT_PUBLIC_`), in `.env.local` and
      Vercel, never in code or chat.
- [x] **4. "Connect Classroom" flow** (Claude). Button → Google's permission
      screen (3 permissions) → back to our site → check what was granted → store
      the token. Explain the "grades" wording and the unverified-app warning on
      the button screen.
- [ ] **5. Sync** (Claude). Fetch recent courses, assignments (no submissions)
      and materials; save as items with no duplicates; remove items deleted in
      Classroom; mark "needs reconnect" when Google says access expired.
- [ ] **6. Home page list** (Claude). Due soon / no due date / recent pre-reads,
      times in IST, link back to each Classroom post, "Last updated", sync on
      open with "Updating…". Test at phone and laptop width.
- [ ] **7. Background job** (Claude + Saket). A protected sync address on our
      site; Supabase Cron calls it every 30 minutes with a secret stored in Vault.
- [ ] **8. Test end to end** on phone and laptop with the Trichy ID, including
      disconnecting; then wrap up (logs, tick Stage 3, next plan).

Each step ends with a commit.
