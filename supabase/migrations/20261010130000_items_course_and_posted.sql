-- Stage 3: two extra details per item, so the list makes sense.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

alter table public.items
  add column course_name text,        -- e.g. "MDPW 2026"; "Session 10" alone is meaningless
  add column posted_at   timestamptz; -- when it was posted in the original source
