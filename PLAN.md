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
- [x] **6. Connect Gmail + sync** (Claude; done 2026-10-24). Separate read-only Gmail permission;
      fetch new emails since the last check; skip obvious noise (job portals,
      newsletters, Classroom's own notification emails); read identical emails once.
      Classroom announcements join the same path (adds the announcements permission,
      so students reconnect Classroom once).
      **Draft plan (2026-10-17, awaiting Saket's approval).** Ends with emails
      fetched, filtered and waiting for the AI; step 7 turns them into items.
      - [x] **6a. Database** (done 2026-10-17,
        `supabase/migrations/20261017120000_gmail_queue.sql`; the queue stores
        no subject either, only ids, sender and time; Classroom sync re-tested
        live after the change):
        - `google_tokens` holds one key per student **per source** (Classroom,
          Gmail), so connecting or disconnecting one never touches the other.
        - New **reading queue**: one row per email or announcement to read (its
          Gmail/Classroom id, sender, subject, received time, status: waiting /
          read / skipped + why). **No email text**: the text is fetched from Gmail
          only at the moment the AI reads it, then thrown away.
        - New **shared answers table**: a fingerprint (hash) of each message's
          text → the items the AI found in it. A batch-wide email arriving in 25
          inboxes is read once; the other 24 reuse the answer. A hash can't be
          turned back into the text.
      - **6b. "Connect Gmail" card** on the home page, next to Classroom: asks
        for `gmail.readonly` only; says plainly that an AI service reads emails to
        find deadlines and only the found items are stored; shows "Reconnect" after
        the 7-day expiry; **Disconnect** deletes the key, the queue rows and all
        Gmail items. To check while testing: Google may treat Gmail and Classroom
        as one grant, so removing one could remove both; if so, Disconnect will
        only delete our stored key instead of revoking it at Google.
        **Built and tested 2026-10-21** (Saket, live site): connect, disconnect
        and reconnect work; Classroom items unaffected. **Confirmed: Google treats
        both as one grant.** Disconnecting Gmail (revoke at Google) also ended
        Classroom; the site flagged Classroom "needs reconnecting" as designed.
        Connecting either one leaves the other's key working (checked both keys
        after reconnecting). **Decided (Saket):** disconnecting one deletes our key
        and its items without cancelling at Google, so the other keeps working;
        Google is asked to cancel only when the last connection is disconnected.
      - **6c built 2026-10-21** (`lib/gmail.ts`, `/api/gmail/sync`, background job
        now runs Classroom + Gmail). First run on Saket's inbox (7–21 Oct): 295
        emails checked in 26 s; **185 to read** (132 IIM, 42 edtex.in, 11 outside
        senders writing personally), skipped 39 Classroom notifications, 34 Unstop,
        26 other bulk senders, 11 portal receipts. A second run added no
        duplicates (1.3 s). 185 reads ≈ 315K tokens, so the first read-through
        will take ~2 days of free allowance (expected; the queue handles it).
        Saket checked the recruitment-looking skipped senders (jobs2web.com,
        mercer.com, sc.com, hiring.talentsjobs.in): accidental subscriptions,
        nothing important. **Added 2026-10-24:** subject safety net for outside
        senders (see decision log; 3 of 126 marketing emails rescued in 30 days;
        2 queued emails moved to "to read"), and Gmail's 403 "rate limit" now
        waits and retries instead of failing the sync.
      - **6c. Fetch + filter** (`lib/gmail.ts`), run by the existing 30-minute
        background job and when the site is opened: list emails since the last
        check (first connect: the **last 14 days**), read only their headers, then
        apply the agreed noise filter: always read the student's college domain
        and placement portals; skip Classroom's notification emails; skip the
        portal's "Application Submitted" receipts (free rule); skip other senders
        marked as bulk, plus a small built-in marketing list (e.g. Unstop); read
        other senders writing personally. Everything kept goes into the queue.
      - [x] **6d done 2026-10-24.** Saket reconnected via the one-time prompt;
        21 announcements (last 14 days) queued from all 5 ticked courses, incl.
        ADPM (4). Announcements now also count as course activity for pre-ticking.
        Original plan: **Classroom announcements** join the queue: add the announcements
        permission to Connect Classroom (students reconnect once, which the weekly
        expiry forces anyway), fetch announcements from ticked courses.
      - [x] **6e done 2026-10-24** (Saket, live, phone + laptop): Disconnect Gmail kept Classroom connected (both keys verified after), reconnecting Gmail rebuilt the queue (309 emails, 201 to read, no duplicates). Original plan: **Test**: connect Gmail on the live site, check the queue counts
        ("checked 140 emails, 95 to read, 45 skipped") against the inbox; card
        works on phone + laptop; disconnect removes everything.
      **Why a queue:** Groq's free allowance is 200K tokens per model per day. The
      first 14 days of one inbox (~150 reads ≈ 250K tokens) don't fit in one day,
      and several students connecting on the same day would collide. With a queue
      the newest emails are read first, the rest as allowance returns, and nothing
      is lost if the allowance runs out mid-sync. Each background run also reads
      only as many as fit in its time limit.
- [ ] **7. AI reading → items** (Claude). **Reading order (Saket, 2026-10-24,
      campus first):** campus + placement-portal emails first (newest first), then
      Classroom announcements, then outside senders only with leftover allowance;
      outside items are still shown. Each email becomes zero or more items
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
