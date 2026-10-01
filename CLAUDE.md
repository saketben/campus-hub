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
- [ ] **0. Setup:** accounts, empty project running locally
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

## Session log
Update at the end of every session: what was finished, what's next.

- _(empty: first session not started)_

## Decision log
One line per decision, cut, or surprise, with the date and the reason.
This becomes interview material, so keep it honest.

- 2026-09-28: Chose Gmail + Classroom + timetable; dropped WhatsApp (no API).
- 2026-09-28: Classroom before Gmail: structured data builds user trust first.
- 2026-09-28: Timetable blocked by download restriction; asking the academic office
  for a feed instead of working around it.
