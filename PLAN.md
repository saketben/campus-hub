# Current stage plan

Only the stage we're working on lives here. When it's done, its outcomes move to
the session and decision logs in CLAUDE.md, and this file is replaced by the next
stage's plan.

## Next stage: to be chosen

**Status:** DRAFT, waiting for Saket's decision (2026-10-11). Don't build until
the choice below is made and a step list is approved.

Stage 3 (Classroom) is done; see the session and decision logs in CLAUDE.md.

### The choice

CLAUDE.md's order is Stage 4 (Timetable + course outlines) then Stage 5 (Gmail).
Stage 4 depends on the academic office providing a timetable feed (published CSV,
service account access, or a native Google Sheet). We must not work around the
download restriction.

- **Option A: Stage 4 now**, only if the timetable feed has arrived. Course
  outlines (Saket has them, one folder) give session-by-session pre-reads and
  guest lectures; the timetable turns session numbers into dates.
- **Option B: Stage 5 (Gmail) now**, if the timetable is still blocked. Needs the
  Anthropic API key (costs money; estimate cost from real email volume first),
  the Gmail read-only permission as a separate "Connect Gmail" step, AI
  extraction for emails and Classroom announcements, confirm/dismiss, and an
  accuracy check on ~100 hand-labelled emails before shipping.
- **Option C: course outlines only, without dates.** Show "Session N: case,
  readings" per course. Lower value without dates; probably better folded into
  Option A.

### Questions for Saket

1. Has the academic office replied about a timetable feed?
2. Has IT replied about an "Internal" Google Cloud project?
3. If Option B: what's an acceptable monthly AI budget for the pilot?

### Reminders

- After 2026-10-16: check the 7-day test-mode expiry. The Classroom card should
  switch to "Reconnect Classroom", and reconnecting should bring items back.
- When Term VI's elective list is published, swap it into `lib/term-courses.ts`.
