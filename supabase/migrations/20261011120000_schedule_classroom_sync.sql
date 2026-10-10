-- Stage 3: refresh every connected student's Classroom items every 30 minutes (D1).
-- Before running: add the CRON_SECRET from .env.local to Supabase Vault under the
-- name "cron_secret" (Integrations -> Vault -> Add new secret). The password is
-- read from the Vault at run time, so it never appears in this file or in Git.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'classroom-sync',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://campushub-iimt.vercel.app/api/cron/sync',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);
