-- Stage 5, step 6a: room for Gmail, a reading queue, and shared AI answers.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- 1. One Google key per student PER SOURCE, so the Classroom and Gmail
--    connections never overwrite or remove each other. The existing key is
--    the Classroom one.
alter table public.google_tokens
  add column source text not null default 'classroom'
    check (source in ('classroom', 'gmail'));
alter table public.google_tokens alter column source drop default;
alter table public.google_tokens drop constraint google_tokens_pkey;
alter table public.google_tokens add primary key (user_id, source);

-- Where the last check stopped (for Gmail: the newest email already queued),
-- so each sync fetches only what's new.
alter table public.sync_status add column checked_until timestamptz;

-- 2. The reading queue. One row per email or Classroom announcement that came
--    in, with what the noise filter decided. NO email text or subject is stored:
--    the text is fetched from Gmail/Classroom only when the AI reads it, then
--    thrown away. The sender is kept for skip counts and a future one-tap
--    "never read this sender".
create table public.message_queue (
  user_id      uuid not null references auth.users (id) on delete cascade,
  source       text not null check (source in ('gmail', 'classroom')),
  message_id   text not null,      -- Gmail message id / Classroom announcement id
  thread_id    text,               -- Gmail conversation, so replies can update an item
  course_id    text,               -- Classroom course, to fetch the announcement again
  sender       text,               -- email address only
  received_at  timestamptz not null,
  link         text,               -- link back to the original
  status       text not null default 'waiting'
                 check (status in ('waiting', 'read', 'skipped', 'failed')),
  skip_reason  text,               -- e.g. 'bulk sender', 'portal receipt'
  fingerprint  text,               -- set once read: which shared answer it used
  attempts     int not null default 0,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  primary key (user_id, source, message_id)
);

-- The AI reads the newest waiting messages first.
create index message_queue_waiting_idx on public.message_queue (status, received_at desc);

-- Students can see their own queue (for counts like "95 to read, 45 skipped");
-- only the server writes it.
alter table public.message_queue enable row level security;

create policy "Students can read their own queue"
  on public.message_queue for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.message_queue from anon;
grant select on public.message_queue to authenticated;

-- 3. Shared AI answers. A fingerprint (SHA-256 hash) of a message's sender,
--    subject and text -> the items the AI found in it. The same batch-wide
--    email in 25 inboxes is read once. A hash can't be turned back into the
--    text. Locked like google_tokens: no policies, so only the server can read it.
create table public.message_answers (
  fingerprint  text primary key,
  items        jsonb not null,     -- what the AI found (may be an empty list)
  model        text not null,      -- which AI read it
  created_at   timestamptz not null default now()
);

alter table public.message_answers enable row level security;
revoke all on public.message_answers from anon, authenticated;
