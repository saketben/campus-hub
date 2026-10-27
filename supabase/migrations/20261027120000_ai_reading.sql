-- Stage 5, step 7a: room for what the AI reader finds and what each read costs.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

-- 1. Items found in emails and announcements.
alter table public.items
  add column ends_at timestamptz,  -- end time when a range is given ("1:45 PM - 3:00 PM")
  add column sender  text;         -- who the email is from (email address); Stage 6 filters use it too

-- 2. The reading queue.
alter table public.message_queue
  add column reading_since timestamptz,  -- set while a run is reading it, so two runs never read the same message
  add column tokens        int,          -- AI tokens this read cost (0 = reused a shared answer)
  add column model         text;         -- which AI read it

-- The per-student daily cap counts each student's reads since midnight.
create index message_queue_user_read_idx on public.message_queue (user_id, read_at);

-- 3. The 30-minute background job now also lets the AI read for up to ~4½ minutes,
--    so it waits up to 5 minutes for the website to answer (was 1 minute).
--    Same job name, so this replaces the old schedule.
select cron.schedule(
  'classroom-sync',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://campushub-iimt.vercel.app/api/cron/sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 300000
  );
  $$
);
