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

## Next

Tighten the instructions (one item per session's pre-reads, no "Day 2" splits,
"applications open" counts, enforce the feedback-form rule), re-run gpt-oss-120b on
the same 100 items, and test Saket's subject filter.
