# Current stage plan

Only the stage we're working on lives here. When it's done, its outcomes move to
the session and decision logs in CLAUDE.md, and this file is replaced by the next
stage's plan.

## Stage 5: Gmail (and Classroom announcements)

**Status:** approved by Saket (2026-10-12). In progress. Saket will choose the AI
model himself (step 5) and tell Claude.

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

- [x] **1. Measure real email volume** (Claude writes a throwaway script, Saket
      signs in). Read-only: emails per day and top senders over the last 30 days,
      counts only, nothing stored. Turns the cost estimate into real numbers and
      sizes the noise filter.
      Result (`feasibility/RESULTS-email-volume.md`): ~16 emails/day, of which
      ~10–11 need the AI (iimtrichy.ac.in + the edtex.in placement portal); ~1/3
      is noise skippable by sender. Haiku 5.5 ≈ $0.23 per student per month.
      **Open question:** shortlists often arrive as attachments; reading
      attachments is not in this stage's plan yet (decide later).
- [x] **2. Set up both AI providers for free** (Saket, guided). Anthropic Console:
      claim the new-account credit, don't add a card. Groq: free account, switch on
      zero data retention. Keys go in `.env.local` only, never in chat or Git.
      Result: Groq key works (`GROQ_API_KEY`), Zero Data Retention on. Anthropic
      account exists but has **no free credit** ($0.00; credits are prepaid from $5,
      expire after 1 year), so nothing bought and no key yet. **Decision: test Groq
      first; buy $5 of Anthropic credit to test Claude Haiku 5.5 only if Groq misses
      real deadlines.** Groq free limits per model (Saket's console): 1,000
      requests/day, 8,000 tokens/minute, **200,000 tokens/day** (≈ 64 email reads a
      day, ~5 students per model). Models: gpt-oss-120b, gpt-oss-20b (production);
      qwen3.8-27b is preview-only, so excluded. Paid prices per 1M tokens (Groq docs):
      gpt-oss-20b $0.075/$0.30, gpt-oss-120b $0.15/$0.60; Haiku 5.5 $0.10/$0.50.
- [x] **3. Build the labelled test set** (Claude prepares, Saket labels).
      Done 2026-10-16: 100 items labelled, cross-checked by Claude, corrections
      approved and applied (original kept as `labels.original.json`). 46 items with
      something to act on (54 entries, 48 dated), 54 "Nothing here". Open: whether
      "check your marks, report corrections by …" emails (#32, #59, #64) count. A local,
      Git-ignored file of ~100 recent emails (plus some Classroom announcements),
      chosen to include one-off ones like shortlists. Saket marks, for each, the
      real deadlines/events (or "none"). Stays on his laptop.
- [x] **4. Run the accuracy test.** (Done 2026-10-17; results under step 5.) Same instructions to each model (gpt-oss-20b
      and gpt-oss-120b on Groq first; Haiku 5.5 only if needed). Score: deadlines
      missed (most important), false alarms, wrong dates/times, and cost per email.
      Also test Saket's **subject filter**: free rules for automated mails (e.g. the
      placement portal's "you have applied" confirmations) plus a quick AI look at
      sender + subject only, reading the full email whenever unsure. Use it only if
      it skips **zero** real deadlines in the test set (it would save ~30% of cost).
      The test spreads over 2 days to fit Groq's 200K tokens/day. Write the results
      to `feasibility/` (no email content).
- [x] **5. Choose the model** (Saket). **Chosen 2026-10-16: Groq
      `openai/gpt-oss-120b`** (results in `feasibility/RESULTS-accuracy.md`).
      Instructions tightened (now in `lib/ai-reader/prompt.ts`, the one copy used
      by the app and the tests). **Round 2 done 2026-10-17** (see
      `feasibility/RESULTS-accuracy.md`): found every real item after review
      (57/57, Axis Bank miss fixed), over-splitting halved (27 → 13), college
      "nothing here" false alarms unchanged (14). Keeping these instructions.
      Subject filter tested 2026-10-17 (`feasibility/9-subject-filter.mjs`):
      neither part skipped a real item; the free rule (portal "Application
      Submitted" receipts) saves 7% of tokens for nothing; the quick AI look costs
      more than it saves (≈ 29.9K spent vs ≈ 18.1K saved). **Decided (Saket):
      free rule only**, built in step 6.
      **Switching to Claude Haiku later:** add `ANTHROPIC_API_KEY` (after buying
      credit), run the same test with `... 6-run-test.mts anthropic claude-haiku-5-5
      --tag check`, compare, then set `AI_PROVIDER=anthropic` in `.env.local` and
      Vercel. Record the decision and the numbers in the
      decision log; update CLAUDE.md's tech stack if Groq wins.
- [ ] **6. Connect Gmail + sync** (Claude). Separate read-only Gmail permission;
      fetch new emails since the last check; skip obvious noise (job portals,
      newsletters, Classroom's own notification emails); read identical emails once.
      Classroom announcements join the same path (adds the announcements permission,
      so students reconnect Classroom once).
- [ ] **7. AI reading → items** (Claude). Each email becomes zero or more items
      (type, title, date/time in IST, **end time when given** (Saket: PPTs and
      lectures often say "1:45 PM – 3:00 PM"; needs a new `ends_at` column),
      confidence, link back to the email). Review the "other" items from labelling
      (Saket tags them `[exam]`, `[form]`, …) to decide on new item types.
      Found while labelling (Saket):
      - **Replies that change a deadline** (same Gmail thread) must **update** the
        existing item, not add a second one; read the newest reply, not old quoted
        text below it.
      - **Group-specific slots** ("Gr.1 2:15 pm, Gr.2 4:00 pm"): until students pick
        their group (Stage 4 picker), show every slot with its group in the title;
        afterwards, only theirs.
      - **One event = one item** (a guest lecture in a course's slot is a
        guest_lecture, not also a class). Low
      confidence shows as "Possible deadline: confirm?". A daily per-student cap
      stops runaway cost.
- [ ] **8. Confirm / dismiss** (Claude). One or two taps on the home list.
- [ ] **9. Test end to end** on phone and laptop; wrap up (logs, tick Stage 5).

Each step ends with a commit.

### Reminders

- **Saket's idea (2026-10-16): use both free Groq models.** Each has its own
  200K-tokens/day allowance. Classroom announcements (short, simple; ~20% of AI
  reads) could go to gpt-oss-20b, and 20b could be a backup when 120b's allowance is
  used up. **Checked 2026-10-17** (`feasibility/RESULTS-accuracy.md`): on the
  round 2 instructions 20b found all 12 announcement items (as 120b did), but
  still broke (invalid JSON) on the 3-deadline email. Free capacity ≈ 8 → ≈ 11
  students. **Decided (Saket):** announcements go to 20b, re-read by 120b if
  20b's answer is broken or its allowance is used up; emails stay on 120b. Built
  into `lib/ai-reader/index.ts` (setting `AI_ANNOUNCEMENT_MODEL`).

- **When Stage 5 ends: remind Saket to start a new Claude session** (this one's
  context is nearly full). Make sure CLAUDE.md and PLAN.md are fully up to date
  first, so the new session can continue from them alone.
- Noise filter for step 6 (decided 2026-10-16, see CLAUDE.md decision log): always
  read the college domain + placement portals; skip Classroom notifications; skip
  other senders marked bulk; read other senders writing personally; plus a small
  built-in marketing-sender list and a one-tap "never read this sender".

- After ~05:40 IST on 2026-10-17 (7 days after Classroom was connected at 05:37 IST
  on 10 Oct): check the test-mode expiry. Expect `sync_status.state` to become
  `needs_reconnect` and the Classroom card to show "Reconnect Classroom"; then
  reconnect and confirm items come back. Same will apply to Gmail. (Checked
  2026-10-16 00:49 IST and 2026-10-17 02:35 IST: still connected.)
  **Confirmed 2026-10-17 21:32 IST:** last good sync 05:30 IST, then Google
  answered `invalid_grant` and `sync_status.state` became `needs_reconnect`, as
  expected. Saket reconnected on the live site the same evening; items came back.
- When Term VI's elective list is published, swap it into `lib/term-courses.ts`.
