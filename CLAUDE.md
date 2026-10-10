# Project: Campus deadline & schedule hub (working name, TBD)

## Who I am
I'm Saket, an MBA student at IIM Tiruchirappalli and the product owner of this project.
I'm new to coding. Explain what you did in simple terms after each change, and ask
before making big structural decisions. I test everything in the browser myself.

## The product
A website that automatically gathers everything a student has to do or attend, and
shows it in one place, without the student typing anything in.

**Core bet:** value comes from items appearing on their own. Every feature is judged
against that. If Google Tasks or Notion already does it well, we don't build it.

**Users:** IIM Trichy students first (pilot of 20–30, max 100 under Google test mode).
Designed so it could later work for any student, and eventually for work tools.

## Sources (built in this order)
1. **Google Classroom:** assignments, pre-reads (materials), announcements. Assignment
   due dates are structured, so no AI is needed for assignments and materials.
   Announcements hide deadlines in plain text, so they go through the same AI
   extraction as emails (built in Stage 5). Due times arrive in UTC: show IST.
2. **Timetable:** the batch schedule sheet. Status: the file is view-only with download
   restricted. Waiting on the academic office for a proper feed (published CSV, service
   account access, or a native Google Sheet). **Do not scrape, screenshot, or otherwise
   work around the restriction.** Each student picks their electives and groups, and we
   show only their classes.
   **Course outlines** (Saket provides the PDFs once per term) give each session's
   case, readings, and guest lectures; the timetable turns session numbers into
   dates. Show the outline as the baseline ("per course outline") and a professor's
   Classroom update as the override ("updated by professor"). Store only the
   extracted sessions, never the PDFs (they contain faculty contact details).
3. **Gmail:** messy text, so AI extraction turns emails into items. Hardest source.
   Classroom also emails notifications, so remove duplicates across sources.
4. **Voice input:** later, only for adding or correcting items.

WhatsApp is out of scope (no usable API for personal accounts).

## Tech stack
- **Next.js** website, hosted on **Vercel**
- **Supabase** for the database and Google sign-in
- **Google Cloud project** for OAuth (Classroom + Gmail scopes), in test mode for now
- **Anthropic API** for extracting items from emails
- **GitHub** for code storage; commit after every working step

## Architecture (keep it this way)
- A background **sync job** fetches new data from each source on a schedule.
- Everything is stored as one kind of record, an **item**:
  source, type, title, date/time, confidence, link back to the original, status
  (confirmed / needs review / dismissed).
- Types: class, assignment, pre-read, guest lecture, placement activity,
  placement deadline, other.
- The website only **reads** items. Home summary, sections, and calendar are all views
  over the same items table. The calendar category checkboxes are filters on type.
- Each student **picks their current courses** from their own Classroom course list
  (recently active ones pre-ticked, with search). Only picked courses are synced, and
  the same choice will drive the timetable. Items carry the course name, so a
  per-subject view is just a filter.
- **Planned sections (Stage 6, Saket's layout):** Home (summary of upcoming
  deadlines), Classroom, Gmail, Timetable, Subjects (pick a course, see everything
  for it). Every section gets a list/calendar toggle, so deadlines can be seen on a
  calendar from anywhere. Whether to also have one all-in-one Calendar section is
  decided when we build Stage 6.

## Trust rules (the most important design principle)
AI extraction will never be 100% accurate, and one missed deadline loses a user.
- Never imply the list is complete.
- Low-confidence items show as "Possible deadline: confirm?" rather than being hidden.
- Prefer showing too many possible items over missing a real one.
- Correcting or dismissing an item must take one or two taps.
- Always link back to the original email or Classroom post.

## Privacy and security
- Request the minimum Google scopes needed, read-only.
- Store extracted items, not full email bodies.
- Keep access tokens secure; never put secrets in code or commit them to GitHub.
- A student can disconnect and delete all their data.

## Build stages
Each stage ends working, tested, and committed.
- [x] **0. Setup:** accounts, empty project running locally
      (Anthropic API key postponed to Stage 5)
- [x] **1. Feasibility checks:** throwaway scripts: sign in with a Trichy ID, fetch
      Classroom assignments, fetch the last 20 emails. Record exactly what works and
      what is blocked. (All passed: see feasibility/RESULTS.md)
- [x] **2. Skeleton:** Google sign-in, database, empty home page, deployed online
      (live at https://campushub-iimt.vercel.app)
- [ ] **3. Classroom:** course picker + sync job + simple home list (assignments and
      materials with short previews; announcements wait for the Stage 5 AI step)
- [ ] **4. Timetable + course outlines:** parser + elective/group picker + "my
      classes tomorrow" + session pre-reads from course outlines (depends on the
      academic office)
- [ ] **5. Gmail:** sync + AI extraction (emails and Classroom announcements) +
      confirm/dismiss. Measure accuracy against ~100 hand-labelled emails before
      shipping.
- [ ] **6. Views:** sections (Home, Classroom, Gmail, Timetable, Subjects), each with
      a list/calendar toggle and category filters; group far-off items as "Later
      this term"
- [ ] **7. Voice:** dictate to add or correct items (only if time allows)

## How we work
- **Read PLAN.md at the start of every session.** It holds the current stage's
  step-by-step plan and which steps are done.
- One small task per request. Plan first for anything touching several files.
- Never leave work half-finished at the end of a session.
- Commit after every working step with a clear message.
- Keep the UI simple; no features beyond the current stage unless I ask.
- Mobile-first, responsive design. Every screen must work on a phone (around 390px wide)
  and on a laptop. Test both before marking a step done.

## Session log
Update at the end of every session: what was finished, what's next.

- 2026-10-05, session 1: **Stage 0 done.** Node.js 24 + Git set up; Next.js 16 app
  `campus-hub` (TypeScript, Tailwind, App Router) runs locally via `npm run dev`;
  code on GitHub (saketben/campus-hub, private). Accounts: Vercel (team saketben),
  Supabase (org saketben, no project yet, created in Stage 2), Google Cloud project
  `campus-hub` (personal Gmail, 2-step on, no APIs or consent screen yet).
  **Next:** Stage 1 feasibility checks: set up the OAuth consent screen (External,
  test mode, read-only Classroom + Gmail scopes), then sign in with a Trichy ID, fetch
  Classroom assignments, fetch the last 20 emails. Also ask IT about an Internal
  project (see decision log).
- 2026-10-08, session 2: **Stage 1 in progress.** Done: Classroom + Gmail APIs enabled;
  consent screen set up (`Campus Hub (test)`, External, test mode); test users = Trichy
  ID + personal Gmail; 5 read-only scopes added (classroom courses, coursework.me,
  courseworkmaterials, announcements; gmail.readonly). Created `feasibility/secrets/`
  (ignored by Git) for keys and tokens.
  **Next:** create a "Desktop app" OAuth client named `feasibility-scripts`, download
  its JSON and save it as `feasibility/secrets/client_secret.json`. Then write the 3
  test scripts (sign in, list Classroom assignments, list last 20 emails: sender,
  subject, date only), run them with the Trichy ID, and record results.
- 2026-10-09, session 3: **Stage 1 done.** OAuth client `feasibility-scripts`
  (Desktop app) created; scripts in `feasibility/` (`npm run signin|classroom|gmail`).
  Trichy ID signed in and all checks passed; results in feasibility/RESULTS.md.
  Classroom announcements moved to the Stage 5 AI step.
  **Next:** Stage 2 skeleton (Supabase project, Google sign-in on the website, empty
  home page, deploy to Vercel). After 2026-10-16, run `npm run classroom` in
  `feasibility/` to confirm the 7-day test-mode expiry.
- 2026-10-10, session 4: **Stage 2 done.** Supabase project `campus-hub` (Mumbai);
  Google sign-in via Google's own button (Google Identity Services +
  `signInWithIdToken`), name + email only; email/password sign-up off; `items` table
  with row-level security (`supabase/migrations/`); live on Vercel at
  https://campushub-iimt.vercel.app (old campus-hub-mu-two address redirects).
  Tested sign-in/out on phone and laptop. Website settings: `.env.local` locally,
  Vercel Environment Variables online. Google client `campus-hub-website`
  allows localhost + the live address as JavaScript origins.
  **Next:** approve the Stage 3 plan in PLAN.md (draft), then build
  "Connect Classroom". After 2026-10-16, run `npm run classroom` in `feasibility/`
  to confirm the 7-day test-mode expiry.
- 2026-10-10, session 5: **Stage 3 in progress (steps 1–6 of 9 done, see PLAN.md).**
  Supabase Cron confirmed on the free plan. New tables: `google_tokens` (locked,
  AES-encrypted refresh token), `sync_status`, `student_courses`; items gained
  `course_name`, `posted_at`, `details`. Server-only secrets in `.env.local` + Vercel
  (GOOGLE_CLIENT_SECRET, SUPABASE_SECRET_KEY, TOKEN_ENCRYPTION_KEY, CRON_SECRET).
  "Connect Classroom" works (3 read-only permissions; Stage 1's Gmail grant removed
  via a clean slate). Sync (`lib/classroom.ts`) saves upcoming/undated assignments
  and 14-day pre-reads with previews from ticked courses only. Course picker at
  `/courses`, pre-ticked from the Term V list (`lib/term-courses.ts`).
  **Next:** step 7, show items on the home page (IST, previews, links back, "Last
  updated", sync on open). Then step 8 (Supabase Cron every 30 min) and step 9
  (full test incl. disconnect, phone + laptop). Saket will provide the Term VI
  list when published, and all course outlines (one folder) at Stage 4. After
  2026-10-16, check the 7-day expiry using the website's Classroom connection
  (the Stage 1 script's access was removed).

## Decision log
One line per decision, cut, or surprise, with the date and the reason.
This becomes interview material, so keep it honest.

- 2026-09-28: Chose Gmail + Classroom + timetable; dropped WhatsApp (no API).
- 2026-09-28: Classroom before Gmail: structured data builds user trust first.
- 2026-09-28: Timetable blocked by download restriction; asking the academic office
  for a feed instead of working around it.
- 2026-10-05: Google Cloud project owned by personal Gmail for now (External, test
  mode). Surprise: External apps that aren't verified are capped at 100 users for good,
  test-mode access expires every 7 days, and Gmail verification needs a paid yearly
  audit. An "Internal" project in IIM Trichy's Google organization removes all three,
  but needs IT to host it and approve Gmail access. Asking IT in parallel; switching
  later only means a new client ID.
- 2026-10-05: Google Cloud now requires 2-step verification on the owner account.
- 2026-10-05: Postponed the Anthropic API key to Stage 5: it costs money (billed
  separately from a Claude subscription) and nothing before Stage 5 uses it.
- 2026-10-09: Stage 1 result: a Trichy ID can grant all 5 read-only permissions,
  Gmail included, to our unverified test app; IIM's settings blocked nothing.
  Details in feasibility/RESULTS.md.
- 2026-10-09: Surprise: Classroom isn't fully structured. Announcements carry
  deadlines in plain text (pre-reads by session date, guest lecture times), so they
  need AI extraction like emails. Also, 23 "active" courses incl. old terms: filter
  by recent activity. Due times come in UTC (18:29 UTC = 23:59 IST).
- 2026-10-09: Classroom announcements move to the Stage 5 AI step; Stage 3 covers
  only assignments and materials, so it stays simple and free of AI cost.
- 2026-10-09: Website sign-in asks only for name + email; Classroom and Gmail access
  are separate "Connect" steps (Stage 3, Stage 5). Minimum permissions, less scary
  first screen, and basic sign-in is exempt from the 7-day test-mode expiry.
  Supabase region: Mumbai. Added PLAN.md for the current stage's steps.
- 2026-10-09: Surprise: Supabase's standard Google sign-in shows "Sign in to
  <random>.supabase.co" on Google's screen, which looks like phishing. Switched to
  Google's own sign-in button (free) so the screen names our site. Later, if the
  project scales: own domain (~₹500–1,000/yr) + Google brand verification to show
  "Campus Hub" and a logo. Rejected a Supabase custom domain (~$35/month).
  Also turned off email/password sign-up: Google is the only way in.
- 2026-10-10: Renamed the live address to campushub-iimt.vercel.app (free): Vercel's
  auto-name "campus-hub-mu-two" looked odd on Google's sign-in screen. Own domain
  still planned if the project scales.
- 2026-10-10: Stage 3 sync: background job every 30 min (Supabase Cron, free; Vercel's
  free scheduler only runs once a day) plus a check every time a student opens the
  site, so new posts show within seconds when anyone is looking.
- 2026-10-10: Surprise: Google has no "assignments without grades" permission; the
  coursework permission says "course work and grades". Saket didn't want grades.
  Chose to request it but never call the submissions endpoint (where grades live)
  and say so on the Connect screen. The alternative was no assignments at all.
- 2026-10-10: Saket's idea: course outlines as a source. Sample (MDT) is text, not a
  scan, with a consistent "Session Number / Topics / Case / Readings" template;
  includes guest lectures; has no dates, so it pairs with the timetable (Stage 4).
  Outline = baseline, professor's Classroom update = override, both labelled.
- 2026-10-10: First real sync showed the "skip courses inactive for 60 days" guess
  was wrong (a finished course, BADM, still showed). Saket's fix: students tick
  their current courses (recent ones pre-ticked). No age limit on assignments in
  ticked courses, so term-long projects stay visible. Pre-reads also get a short
  preview (first lines + attachment names), since the useful part ("Case: …") is
  inside the post, not in its title.
- 2026-10-10: Saket's section layout for Stage 6: Home, Classroom, Gmail, Timetable,
  Subjects, with a calendar toggle in every section instead of only one Calendar
  page (a combined Calendar section: decide in Stage 6).
- 2026-10-10: Pre-ticking by "recent posts" got 2 of Saket's 5 courses wrong (ticked
  last term's MDT; missed ADPM, which only posts announcements). Saket supplied the
  official Term V elective list; matching Classroom names to it got 5 of 5. The list
  is swapped each term (code, title, area only; no faculty details).
