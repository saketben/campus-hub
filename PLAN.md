# Current stage plan

Only the stage we're working on lives here. When it's done, its outcomes move to
the session and decision logs in CLAUDE.md, and this file is replaced by the next
stage's plan. (Stage 5's full plan is in Git history, commit 7198e1a.)

## Stage 6: Views (sections, calendar, category filters)

**Status:** all 7 suggestions approved by Saket 2026-11-12. 6a–6e built and live
2026-11-12; waiting for Saket to run the 6a SQL file and check phone + laptop.

**Goal:** a student opens the site and sees what matters first (placements,
then today and this week), can switch any section to a calendar, and can hide
categories they don't care about (clubs off by default) without losing anything.

**Not in this stage:** the timetable itself (Stage 4, waiting on the academic
office), voice (Stage 7).

### Decisions for Saket (Claude's suggestion in bold)

1. **Navigation:** **bottom tab bar on phones, top tabs on laptops**, with Home,
   Classroom, Gmail, Subjects, Settings. Timetable gets its tab when Stage 4
   arrives (an empty "coming soon" tab would look broken).
2. **Settings page:** **the Connect/Reconnect cards, "Change courses", privacy and
   Delete all my data move to Settings**; Home shows a banner only when something
   needs reconnecting (weekly).
3. **Calendar:** **a month grid with dots; tap a day to see its items below**.
   The List/Calendar switch sits at the top of every section and is remembered.
   **No separate Calendar section** (the switch makes it unnecessary).
4. **Category filters:** **chips at the top of every section** (Placements ·
   Courses · Competitions · Clubs · Other), shared by all sections, **saved per
   student** so they follow you between phone and laptop. Clubs off by default.
   "12 club items hidden" line under the chips.
5. **Home order:** **"Placements, next 7 days" pinned and highlighted on top**,
   then Today, This week, "Later this term" (folded), No date given, Couldn't
   read, Recent pre-reads.
6. **Unstop:** **Unstop items show only for competitions the student registered
   for**, learnt from Unstop's "registration confirmed" emails; the rest are
   hidden (never deleted), with a "show" link.
7. **Sections:** Classroom = items from Classroom; Gmail = items from emails;
   Subjects = pick a course, see everything for it (Classroom + emails that name
   it). All are the same list with a different filter.

### Steps (each ends with a commit; Saket checks phone + laptop at 6c and 6f)

- [x] **6a. Categories in the data.** Use `lib/categories.ts` on every item;
      a small table for each student's filter choices (Saket runs one SQL file).
- [x] **6b. Unstop rule.** Read Unstop's registration confirmations (noise filter
      change), remember registered competitions, hide other Unstop items.
- [x] **6c. Navigation + Settings page.** Bottom/top tabs; move the cards to
      Settings; reconnect banner on Home.
- [x] **6d. Home order + filter chips.** Pinned placements, Today / This week /
      Later this term, chips with "N hidden".
- [x] **6e. Sections + calendar.** Classroom, Gmail, Subjects; List/Calendar switch
      in each (month grid, tap a day).
- [ ] **6f. Test** on the live site, phone + laptop; update CLAUDE.md + this file.

### Notes from building (2026-11-12)

- **6a:** categories are worked out when a page loads (`lib/views.ts` +
  `lib/categories.ts`), not stored, so a rule fix applies to every item at once.
  Only the filter choices are stored (`student_settings`). Until the SQL is run,
  everyone sees the defaults and tapping a chip doesn't save.
- **6b, simpler than planned:** Saket's inbox shows Unstop's competition updates
  come from `updates@unstop.events` / `.email` and `emails.unstop.com` (sent to
  registered participants), and marketing from `unstop.news`. So: updates are always
  read, marketing never (even with a personal-sounding subject), and no
  "registered competitions" table is needed. **To confirm with Saket:** did he
  register for Reliance T.U.P XII? (Its updates reached him too.) If not, updates
  also go to followers and the table is needed after all.
- **6c:** connect/disconnect results now land on Settings; old `/?classroom=…`
  links redirect there. A first-time student still sees the connect cards on Home.
- **6e Subjects:** a course shows its Classroom items plus emails whose title names
  it (full name, or short name like MMM, ISDC, B2B from the term's elective list).
