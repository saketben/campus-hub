# Stage 5, step 1: email volume (one IIM Trichy student)

Measured 2026-10-12 with `4-email-volume.mjs` (read-only Gmail, envelopes only:
sender, recipients, labels, size; no email text). Last 30 days, Saket's Trichy ID.

| | Count |
|---|---|
| Emails received | 477 (15.9 per day) |
| From iimtrichy.ac.in (faculty, academic office, committees, placement cell) | 269 (56%) |
| From edtex.in (automated placement portal) | 35 |
| From classroom.google.com (Classroom's own notifications) | 33 |
| From Unstop (unstop.news, unstop.events: job-portal marketing) | 75 |
| Other marketing (OpenAI, Canva, Grammarly, Airtable, DataCamp, …) | ~60 |
| Addressed to the student by name in To/Cc | 181 (38%) |
| Via a group list or Bcc | 296 (62%) |
| Gmail categories | Forums 54%, Updates 32%, Promotions 8%, Primary 5% |
| Average email size | ~960 KB (mostly attachments and formatting) |

## What it means for Stage 5

- **The AI needs to read ~10–11 emails per student per day:** iimtrichy.ac.in and
  the placement portal. Classroom notifications (already synced) and marketing
  (~1/3 of the inbox) can be skipped by sender, without AI.
- **Cost estimate, revised:** ~11 emails + ~3 Classroom announcements a day ≈ 420
  AI reads per student per month. Claude Haiku 5.5 (list price 2026-10-06):
  ≈ $0.23 per student per month before reading shared emails once. Groq free tier:
  ~14 requests per student per day, so a ~1,000/day cap (third-party figure) fits
  roughly 70 students.
- **Most mail comes through group lists (62%)**, so reading identical emails once
  should save a lot; the exact share needs more than one inbox to measure.
- **Attachments are common** (~1 MB average). Shortlists often sit inside a PDF or
  spreadsheet. The planned AI reads email text only, so an email like "shortlist
  attached" becomes an item linking to the email, but whether the student's name is
  on the list isn't checked. Reading attachments: an open question for later.
- **Gmail's own categories don't separate signal from noise**: important IIM mail
  lands in Forums and Updates, so filter by sender, not by Gmail category.
