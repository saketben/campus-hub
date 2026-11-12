-- Stage 6, step 6a: each student's view choices (filter chips, List/Calendar).
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- Filter chips and the List/Calendar switch, saved per student so they follow
-- them between phone and laptop. Clubs are hidden by default (Saket, 2026-10-27).
-- Students read their own row; only the server writes (it checks who is signed in).
create table public.student_settings (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  hidden_categories  text[] not null default '{clubs}',
  view               text not null default 'list' check (view in ('list', 'calendar')),
  updated_at         timestamptz not null default now()
);

alter table public.student_settings enable row level security;

create policy "Students can read their own settings"
  on public.student_settings for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.student_settings from anon;
grant select on public.student_settings to authenticated;
