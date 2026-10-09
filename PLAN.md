# Current stage plan

Only the stage we're working on lives here. When it's done, its outcomes move to
the session and decision logs in CLAUDE.md, and this file is replaced by the next
stage's plan.

## Stage 3: Classroom

**Status:** DRAFT, not yet approved by Saket (2026-10-10). Don't build until the
decisions below are agreed.

**Goal:** a signed-in student taps "Connect Classroom" once, and their upcoming
assignments and pre-reads (materials) appear on the home page on their own,
each with a link back to Classroom, and stay up to date without them doing
anything.

**Not in this stage:** Classroom announcements (Stage 5 AI step), Gmail, the
calendar view, confirm/dismiss buttons.

### Decisions to agree first

- **D1. Where the sync job runs (how often items refresh).** Unverified so far:
  third-party write-ups say Vercel's free plan only runs scheduled jobs once a
  day, and that Supabase's scheduler (pg_cron) may need a paid plan. Check the
  official docs first. Options: (a) Vercel's scheduler if it allows enough runs;
  (b) Supabase's scheduler calling our website; (c) a free external scheduler
  (GitHub Actions or cron-job.org) calling our website with a secret;
  (d) plus a "sync when the student opens the page, if older than ~15 min".
- **D2. Storing the Classroom permission safely.** Connecting gives us a
  long-lived Google "refresh token" per student. Store it in a separate table
  that the website can never read (no row-level-security read policy), only the
  server-side sync job using a server-only Supabase secret key kept in Vercel's
  settings, never in code.
- **D3. Which items to show.** Assignments with a due date in the future or no
  due date; materials posted recently as pre-reads. Skip old courses (no activity
  in ~60 days). Convert UTC to IST; date-only assignments show as "due <date>".
- **D4. When the connection expires** (test mode: every 7 days). Show a clear
  "Reconnect Classroom" message and always show "Last updated <time>", so the
  list never looks complete when it isn't (trust rule).
- **D5. Permissions requested:** only the 3 Classroom read-only ones we need now
  (courses, own coursework, materials). Announcements are added in Stage 5.

### Steps (to be detailed after the decisions)

- [ ] 1. Verify scheduler limits (D1) and agree D1–D5
- [ ] 2. "Connect Classroom" button and Google permission flow on our own site
- [ ] 3. Safe storage for the Classroom connection (D2)
- [ ] 4. Sync job: fetch from Classroom, save as items (no duplicates)
- [ ] 5. Home page: upcoming items with due dates in IST and links back
- [ ] 6. Schedule the sync (D1) + "Last updated" + reconnect message (D4)
- [ ] 7. Test on phone and laptop with the Trichy ID; wrap up
