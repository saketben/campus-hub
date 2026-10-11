# Current stage plan

Only the stage we're working on lives here. When it's done, its outcomes move to
the session and decision logs in CLAUDE.md, and this file is replaced by the next
stage's plan.

## Stage 5: Gmail (and Classroom announcements)

**Status:** DRAFT (2026-10-12). Saket agreed to Gmail next and to choosing the AI
model by an accuracy test, keeping the pilot free if possible. The step list
below still needs his approval before building starts.

**Goal:** deadlines, events and placement items hidden in emails and Classroom
announcements appear on their own, each linked back to the original, with
low-confidence ones shown as "Possible deadline: confirm?" and a one-tap
confirm/dismiss.

**Not in this stage:** the timetable and course outlines (Stage 4, later), the
sections/calendar views (Stage 6).

### Principles for this stage

- **Missing a real deadline is the worst failure** (trust rules). One-off emails
  sent to a few students (e.g. shortlists) matter as much as batch-wide ones.
- **Free for the pilot if the test allows it.** Two candidates: Claude Haiku 5.5
  (Anthropic's one-time new-account credit, no card added, so it can't charge) and
  a Groq-hosted open model (free tier, zero data retention switched on). Google
  Gemini's free tier is ruled out: its terms say free-tier content may be read by
  human reviewers and used to improve Google's products, and not to submit
  personal information.
- **Store extracted items, never email bodies.** Bodies are read in memory, sent
  to the AI, and discarded.
- **Identical emails are read once** (same email in many inboxes); every unique
  email is always read. Nothing is skipped just to save cost.
- **Students are told plainly** on "Connect Gmail" that an AI service reads their
  emails to find deadlines and that only the extracted items are stored.

### Steps

- [ ] **1. Measure real email volume** (Claude writes a throwaway script, Saket
      signs in). Read-only: emails per day and top senders over the last 30 days,
      counts only, nothing stored. Turns the cost estimate into real numbers and
      sizes the noise filter.
- [ ] **2. Set up both AI providers for free** (Saket, guided). Anthropic Console:
      claim the new-account credit, don't add a card. Groq: free account, switch on
      zero data retention. Keys go in `.env.local` only, never in chat or Git.
- [ ] **3. Build the labelled test set** (Claude prepares, Saket labels). A local,
      Git-ignored file of ~100 recent emails (plus some Classroom announcements),
      chosen to include one-off ones like shortlists. Saket marks, for each, the
      real deadlines/events (or "none"). Stays on his laptop.
- [ ] **4. Run the accuracy test.** Same instructions to both models. Score:
      deadlines missed (most important), false alarms, wrong dates/times, and cost
      per email. Write the results to `feasibility/` (no email content).
- [ ] **5. Choose the model** (Saket). Record the decision and the numbers in the
      decision log; update CLAUDE.md's tech stack if Groq wins.
- [ ] **6. Connect Gmail + sync** (Claude). Separate read-only Gmail permission;
      fetch new emails since the last check; skip obvious noise (job portals,
      newsletters, Classroom's own notification emails); read identical emails once.
      Classroom announcements join the same path (adds the announcements permission,
      so students reconnect Classroom once).
- [ ] **7. AI reading → items** (Claude). Each email becomes zero or more items
      (type, title, date/time in IST, confidence, link back to the email). Low
      confidence shows as "Possible deadline: confirm?". A daily per-student cap
      stops runaway cost.
- [ ] **8. Confirm / dismiss** (Claude). One or two taps on the home list.
- [ ] **9. Test end to end** on phone and laptop; wrap up (logs, tick Stage 5).

Each step ends with a commit.

### Reminders

- After 2026-10-16: check the 7-day test-mode expiry. The Classroom card should
  switch to "Reconnect Classroom" (the same will apply to Gmail).
- When Term VI's elective list is published, swap it into `lib/term-courses.ts`.
