# Current stage plan

Only the stage we're working on lives here. When it's done, its outcomes move to
the session and decision logs in CLAUDE.md, and this file is replaced by the next
stage's plan.

## Stage 2: Skeleton

**Status:** approved by Saket, plan and D1–D3 (2026-10-09). In progress.

**Goal:** a student opens the website on their phone or laptop, signs in with
their Trichy ID, and sees an empty home page with their name. The site is online
(on Vercel), and the database has an empty `items` table that only the owner of
each item can read.

**Not in this stage:** Classroom or Gmail data, sync jobs, a calendar, or
"disconnect and delete my data". Those come in later stages.

### Decisions

- **D1. Sign-in asks only for name and email, not Classroom or Gmail.**
  Students grant Classroom access in a separate "Connect Classroom" step in
  Stage 3, and Gmail access in Stage 5. Reasons: request the minimum permissions
  (CLAUDE.md privacy rule); a scary Gmail request on day one costs trust; and
  Google's 7-day test-mode expiry does not apply to name-and-email sign-in, so
  students stay signed in even when the Classroom connection needs renewing.
- **D2. Supabase project region: Mumbai (South Asia).** Closest to Trichy, so
  pages load faster.
- **D3. The database layout is saved as a SQL file in the repo**
  (`supabase/migrations/`) and run by pasting it into Supabase's SQL editor.
  It keeps a record of every database change in GitHub without extra tools.

### Steps

- [x] **1. Create the Supabase project** (Saket, in the Supabase dashboard).
      Name `campus-hub`, region Mumbai, free plan. Keep the database password in a
      password manager.
- [x] **2. Set up Google sign-in** (Saket, guided). In Google Cloud, create a
      "Web application" OAuth client whose redirect address is Supabase's
      callback URL. In Supabase, turn on the Google provider and paste in that
      client's ID and secret.
- [x] **3. Connect the website to Supabase** (Claude). Install Supabase's
      packages; put the project URL and publishable key in `.env.local`
      (ignored by Git).
- [x] **4. Sign-in, sign-out and an empty home page** (Claude). Signed out:
      a "Sign in with Google" button. Signed in: "Hi, <name>", an empty state
      that doesn't claim the list is complete, and a sign-out button. Check the
      Next.js 16 docs in `node_modules/next/dist/docs/` first (see AGENTS.md).
      Test at phone width (~390px) and laptop width.
      Changed during the step: uses Google's own sign-in button (Google Identity
      Services + Supabase `signInWithIdToken`) so Google's screen names our site,
      not supabase.co. The site's address must be listed under the Google
      client's "Authorized JavaScript origins". Google client ID is in
      `.env.local` as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Email sign-up is off in
      Supabase.
- [x] **5. Create the `items` table** (Claude writes the SQL, Saket runs it).
      Fields from CLAUDE.md: source, type, title, date/time, confidence, link,
      status, plus owner and timestamps. Row-level security: each student can
      only read their own items.
      Done: `supabase/migrations/20261009120000_create_items.sql` (adds
      `source_id` to avoid duplicates and `all_day` for date-only items).
      Checked: not-signed-in visitors are refused. Reading as a signed-in
      student gets tested in Stage 3, when there are rows.
- [ ] **6. Put it online** (Saket, guided, on Vercel). Import the GitHub repo, add
      the three settings from `.env.local`, then add the live address to the
      Google client's "Authorized JavaScript origins". Test sign-in on the live
      site on a phone and a laptop.
- [ ] **7. Wrap up** (Claude). Update the logs in CLAUDE.md, tick Stage 2, and
      replace this file with the Stage 3 plan.

Each step ends with a commit.

### Known quirk (solved)

Supabase's normal Google sign-in made Google's screen say "Sign in to
<random>.supabase.co", which looks like phishing. Solved in step 4 by using
Google's own button: the screen now names our site. Showing the name "Campus Hub"
and a logo needs our own domain plus Google brand verification (Option B, later).
