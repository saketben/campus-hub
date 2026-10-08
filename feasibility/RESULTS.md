# Stage 1 feasibility results

Tested 2026-10-09 with one IIM Trichy student account (@iimtrichy.ac.in), using
the `campus-hub` Google Cloud project (personal Gmail owner, External, test mode).

## Summary: nothing is blocked

| Check | Result |
|---|---|
| Sign in with a Trichy ID on an unverified External test app | ✅ Works. IIM's Google admin settings did not block it. |
| All 5 read-only permissions granted | ✅ Yes (see note on the assignments permission name) |
| Classroom: list courses | ✅ 23 "active" courses |
| Classroom: assignments with due dates | ✅ Works |
| Classroom: materials (pre-reads) | ✅ Works |
| Classroom: announcements | ✅ Works |
| Gmail: read last 20 emails (date, sender, subject) | ✅ Works |

## Findings that affect the design

**Classroom**
- **Old courses are still "active".** 23 courses came back, going back to Term I
  (2025). Teachers rarely archive courses, so the app must filter by recent
  activity or due date, not by "active" status alone.
- **Due times are in UTC.** "18:29 UTC" is 23:59 IST, the usual deadline.
  Convert to Indian time before showing anything.
- **Some assignments have no due date** (e.g. "Case write-up", "podcast").
  Show them as "no due date set", don't hide them.
- **Announcements hide deadlines in plain text**, e.g. pre-reads for a given
  session date, or a guest lecture at 9 am. Classroom is not fully
  "structured": announcements need the same AI extraction as emails.
- **Google reports the assignments permission under an older name**
  (`classroom.student-submissions.me.readonly` instead of
  `classroom.coursework.me.readonly`). It is the same permission.

**Gmail**
- Roughly 4 kinds of mail in a typical 20: placement notices (staff and an
  automated sender), academic office / committees, Classroom notification
  emails, and marketing (job portals, newsletters).
- **Marketing is a large share**, so filtering by sender before the AI step
  saves cost and reduces false "possible deadlines".
- **Classroom notification emails duplicate Classroom items**
  (sender `no-reply@classroom.google.com`): skip them, as planned.
- Date headers mix time zones (+0530, +0000, -0700): normalise to IST.

## Still unknown

- **The 7-day expiry in test mode:** Google's docs say test-user access expires
  7 days after consent. Re-run `npm run classroom` after 2026-10-16 to confirm
  that it fails and needs a fresh sign-in.
- **Other students' accounts:** only one account was tested. IIM's settings
  apply to everyone, so this is likely to hold, but the first pilot sign-ins will
  confirm it.

## How to re-run

From this folder: `npm run signin`, then `npm run classroom` and `npm run gmail`.
Keys and the sign-in token live in `secrets/` (ignored by Git).
