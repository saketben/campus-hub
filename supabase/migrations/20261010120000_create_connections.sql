-- Stage 3: where each student's Google connection and sync status live.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- The locked safe. One row per student: the long-lived Google key (refresh token),
-- encrypted by our server before it gets here. Row-level security is on and there
-- are NO policies, so the website can never read it. Only server code using the
-- Supabase secret key (which bypasses these rules) can.
create table public.google_tokens (
  user_id                  uuid primary key references auth.users (id) on delete cascade,
  google_email             text not null,   -- which Google account was connected
  refresh_token_encrypted  text not null,
  scopes                   text[] not null, -- the permissions the student actually granted
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table public.google_tokens enable row level security;
revoke all on public.google_tokens from anon, authenticated;

-- The notice board. One row per student per source (classroom now, gmail later).
-- Students can read only their own rows; only the server writes them.
create table public.sync_status (
  user_id          uuid not null references auth.users (id) on delete cascade,
  source           text not null check (source in ('classroom', 'gmail')),
  state            text not null default 'connected'
                     check (state in ('connected', 'needs_reconnect')),
  last_synced_at   timestamptz,  -- shown as "Last updated <time>"
  last_attempt_at  timestamptz,  -- used to sync at most once a minute
  last_error       text,
  primary key (user_id, source)
);

alter table public.sync_status enable row level security;

create policy "Students can read their own sync status"
  on public.sync_status for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.sync_status from anon;
grant select on public.sync_status to authenticated;
