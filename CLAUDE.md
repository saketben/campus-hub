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
1. **Google Classroom:** assignments, pre-reads (materials), announcements. Due dates are
   structured, so no AI is needed here.
2. **Timetable:** the batch schedule sheet. Status: the file is view-only with download
   restricted. Waiting on the academic office for a proper feed (published CSV, service
   account access, or a native Google Sheet). **Do not scrape, screenshot, or otherwise
   work around the restriction.** Each student picks their electives and groups, and we
   show only their classes.
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
- [ ] **1. Feasibility checks:** throwaway scripts: sign in with a Trichy ID, fetch
      Classroom assignments, fetch the last 20 emails. Record exactly what works and
      what is blocked.
- [ ] **2. Skeleton:** Google sign-in, database, empty home page, deployed online
- [ ] **3. Classroom:** sync job + Classroom section
- [ ] **4. Timetable:** parser + elective/group picker + "my classes tomorrow"
      (depends on the academic office)
- [ ] **5. Gmail:** sync + AI extraction + confirm/dismiss. Measure accuracy against
      ~100 hand-labelled emails before shipping.
- [ ] **6. Views:** home summary, calendar with category filters
- [ ] **7. Voice:** dictate to add or correct items (only if time allows)

## How we work
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
