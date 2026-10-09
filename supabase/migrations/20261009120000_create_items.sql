-- Stage 2: the items table. Every assignment, pre-read, class or deadline is one row.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

create table public.items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,

  source      text not null check (source in ('classroom', 'gmail', 'timetable', 'manual')),
  source_id   text,         -- the item's id in the original source, to avoid duplicates
  type        text not null check (type in (
                'class', 'assignment', 'pre_read', 'guest_lecture',
                'placement_activity', 'placement_deadline', 'other')),
  title       text not null,
  due_at      timestamptz,  -- when it's due or happens; empty means "no date set"
  all_day     boolean not null default false,  -- a date without a time
  confidence  real not null default 1 check (confidence between 0 and 1),
  link        text,         -- link back to the original email or Classroom post
  status      text not null default 'confirmed'
                check (status in ('confirmed', 'needs_review', 'dismissed')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, source, source_id)
);

create index items_user_due_idx on public.items (user_id, due_at);

-- Row-level security: a signed-in student can only see their own items.
-- Nobody can add or change items from the website yet; the sync job (Stage 3)
-- writes with a server-only key, and confirm/dismiss comes in Stage 5.
alter table public.items enable row level security;

create policy "Students can read their own items"
  on public.items for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.items from anon;
grant select on public.items to authenticated;
