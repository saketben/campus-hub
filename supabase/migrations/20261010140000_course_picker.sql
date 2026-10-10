-- Stage 3: the course picker, plus a short preview per item.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- Each student's Classroom courses and whether they ticked them as "current".
-- Only ticked courses are synced. Students read their own rows; only the server
-- writes (it checks who is signed in before saving their picks).
create table public.student_courses (
  user_id           uuid not null references auth.users (id) on delete cascade,
  course_id         text not null,        -- Classroom's id for the course
  course_name       text not null,
  selected          boolean not null,     -- ticked as a current course
  last_activity_at  timestamptz,          -- latest post or change, used to pre-tick
  primary key (user_id, course_id)
);

alter table public.student_courses enable row level security;

create policy "Students can read their own courses"
  on public.student_courses for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.student_courses from anon;
grant select on public.student_courses to authenticated;

-- When the student last reviewed their course picks (empty = not yet).
alter table public.sync_status add column courses_confirmed_at timestamptz;

-- Short preview shown under each item: first lines of the post + attachment names.
alter table public.items add column details text;
