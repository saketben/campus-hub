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
  recent materials as pre-reads. Only courses the student ticked (updated
  2026-10-10; replaces "skip courses with no activity in ~60 days").
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
- [x] **5. Sync** (Claude). Fetch recent courses, assignments (no submissions)
      and materials; save as items with no duplicates; remove items deleted in
      Classroom; mark "needs reconnect" when Google says access expired.
      Result: 6 items for Saket; it showed the 60-day "active course" guess is
      wrong (finished BADM still appeared), which led to step 6.
- [x] **6. Course picker** (Claude; Saket runs SQL). Done: pre-ticks come from the
      official Term V list in `lib/term-courses.ts` (swap it each term); ticked
      courses listed first. Tested by Saket on laptop. "Which of these are your
      current courses?" with search and checkboxes, recently active courses
      pre-ticked; changeable any time. Only ticked courses are synced, with no age
      limit on their assignments (term-long projects stay visible). Replaces the
      60-day rule in D3. Also save a short preview for each item (first lines of
      the post + attachment names).
- [x] **7. Home page list** (Claude). Due soon / no due date / recent pre-reads,
      with previews, times in IST, link back to each Classroom post, "Last
      updated", sync on open with "Updating…". Test at phone and laptop width.
- [x] **8. Background job** (Claude + Saket). A protected sync address on our
      site; Supabase Cron calls it every 30 minutes with a secret stored in Vault.
      Confirmed: the first automatic run (03:00 IST, 11 Oct) refreshed Saket's list.
      If it ever stops, check in SQL: `select * from cron.job_run_details order by
      start_time desc limit 5;` and `select status_code, content from
      net._http_response order by created desc limit 5;`
- [ ] **9. Test end to end** on phone and laptop with the Trichy ID, including
      disconnecting; then wrap up (logs, tick Stage 3, next plan).

Each step ends with a commit.
