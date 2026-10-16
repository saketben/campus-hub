# Stage 5, step 4: accuracy test, round 1 (2026-10-16)

100 real items from one IIM Trichy student (75 IIM/placement emails, 10 marketing
emails, 15 Classroom announcements), hand-labelled by Saket and cross-checked by
Claude: 49 contain something to act on (57 entries), 51 contain nothing. Same
instructions for both models (`extract-prompt.mjs`), Groq free tier, reasoning
effort "medium". Scored by `7-score.mjs`, then every difference reviewed by hand.
Email content and per-item reports stay in `secrets/` (not in Git).

| | gpt-oss-120b | gpt-oss-20b |
|---|---|---|
| Real items found (most important) | 96% (55/57); 98% after review (one "miss" was a title mismatch) | 84% (48/57) |
| Placement items found | 94% (15/16) | 100% (16/16) |
| Right date, when found | 100% | 100% |
| Right time, when found | 95% | 97% |
| Answers that failed (invalid JSON after 3 tries) | 0 | 3, all multi-deadline emails (7 items lost) |
| Too large for the free tier (per-minute token cap) | 1 marketing email | 1 marketing email |
| False alarms (all / excluding marketing senders) | 53 / 41 | 45 / 37 |
| Paid cost per email (Groq list price) | ≈ $0.00034 | ≈ $0.00020 |
| Tokens per item (average, incl. reasoning) | ≈ 1,500 | ≈ 1,550 |

## Findings

- **gpt-oss-120b found nearly everything**, including all the emails with several
  dates. Its one real miss: a placement "applications are now open" notice with no
  deadline (Axis Bank).
- **gpt-oss-20b broke on exactly the emails with several deadlines** (invalid JSON
  three times in a row), which is the worst place to fail.
- **Dates are reliable on both** (100% when the item was found), including
  "2 hours from now" and "tomorrow".
- **False alarms are mostly over-splitting**: one item per pre-read document, a
  separate class item next to its pre-read, "Day 1" and "Day 2" of one event. Also
  some rule slips: a mid-course feedback form, duplicate "check marks" items,
  "assignment" guesses for attachment-only MMM posts. Fixable with instructions.
- **Marketing emails caused 8–12 false alarms** and the only too-large message, which
  supports filtering them before the AI (see `8-noise-filter-check.mjs`: with "always
  read the college domain + placement portal; skip other senders marked as bulk",
  the AI reads ~68% of the inbox and every skipped outside email was marketing).
- **Free-tier capacity:** ~1,500 tokens per read and 200,000 tokens per model per
  day ≈ 130 reads/day ≈ 9 students per model.

## Round 2 (2026-10-16 to 17): tightened instructions, gpt-oss-120b only

Same 100 items, instructions now in `lib/ai-reader/prompt.ts` (one item per
session's pre-reads, no "Day 2" splits, "applications open" counts, feedback-form
rule), run through the app's own AI reader (`6-run-test.mts`). Split over two days
by Groq's daily cap.

| | Round 1 | Round 2 |
|---|---|---|
| Real items found (most important) | 98% after review (56/57) | **100% after review (57/57)** |
| Placement items found | 94% (15/16) | **100% (16/16)** |
| Right date, when found | 100% | 100% |
| Right time, when found | 95% (36/38) | 97% (37/38) |
| Extra items inside emails that had real items (over-splitting) | 27 | **13** |
| False alarms in non-marketing "nothing here" emails (41 emails) | 14 items, 30 kept empty | 14 items, 28 kept empty |
| False alarms in marketing emails (filtered before the AI in the app) | 12 | 39 |
| Answers that failed | 0 (+1 too large) | 0 (+1 too large, same marketing email) |
| Paid cost per email | ≈ $0.00034 | ≈ $0.00038 |

- **The one real miss is fixed**: the Axis Bank "applications open" notice is now
  found. The B2B "miss" is the same title mismatch as round 1 (found, named
  differently).
- **Over-splitting halved** (27 → 13 extras alongside real items).
- **"Nothing here" false alarms didn't improve** for college emails (still 14).
  Marketing false alarms tripled (the "applications open counts" rule makes the AI
  treat promotions as opportunities), but the noise filter skips those senders
  before the AI, so they don't reach students.
- Slightly more tokens per email (+12%): the instructions are longer.

## Both free Groq models? (2026-10-17)

Saket's idea: send Classroom announcements (#86–100) to gpt-oss-20b, which has its
own 200K-tokens/day allowance, and keep 120b's allowance for emails. Scored with
`7-score.mjs <run> --only announcement`; 20b also re-run on the round 2 instructions.

| Announcements only (15; 12 real items) | 20b round 1 | 120b round 1 | 20b round 2 | 120b round 2 |
|---|---|---|---|---|
| Real items found | 92% (11/12) | 100% | **100%** | **100%** |
| Right date / time | 100% / 0 of 1 | 100% / 0 of 1 | 100% / 1 of 1 | 100% / 0 of 1 |
| Extra items | 17 | 19 | 9 | 7 |
| Broken answers | 0 | 0 | 0 | 0 |
| Tokens per announcement | ≈ 1,290 | ≈ 1,090 | ≈ 1,520 | ≈ 1,270 |

20b round 2 on all 100 items: 93% (53/57) real items. It still returned invalid
JSON three times on the one email with three deadlines (#16, CFA Ethics Challenge),
losing all three, the same weakness as round 1. Its other "miss" is the B2B title
mismatch.

- **On announcements, 20b round 2 is as good as 120b** (12/12, dates right).
  Announcements are short and usually hold one item, which is where 20b is safe.
- **20b is not safe for emails**: multi-deadline emails break it.
- 20b spends *more* tokens per read (longer reasoning), so the gain comes only from
  its separate allowance. Estimate (≈ 1,700 tokens per 120b read in round 2,
  ≈ 10–11 email reads + ~3 announcements per student per day): 120b alone ≈ 8
  students free; announcements on 20b ≈ 11 students (20b would use ~50K of its
  200K).
- Caveat: only 15 announcements, from 5 courses; a small sample.

## Next

Keep the round 2 instructions. Test Saket's subject filter. Saket to decide on the
two-model split (see PLAN.md reminders).
