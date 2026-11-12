-- TASKS.md 4.5: Supabase pg_cron + pg_net call POST /api/cron/tick every 15
-- minutes (AGENTS.md §4). Vercel Cron is not used on purpose.
--
-- Neither the app's address nor CRON_SECRET may live in this file, which is in
-- the repository. They are read from Supabase Vault when the job runs, so the
-- job can be created before they exist and starts working as soon as they do:
--
--   select vault.create_secret('https://<the production address>', 'satupersen_app_url');
--   select vault.create_secret('<the same value as CRON_SECRET in Vercel>', 'satupersen_cron_secret');
--
-- Until both are set the job fails loudly (see cron.job_run_details) instead of
-- calling anything.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- A schema the API does not expose, so no browser can call the function that
-- reads the secret.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.call_cron_tick()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  app_url text;
  cron_secret text;
begin
  select decrypted_secret into app_url
  from vault.decrypted_secrets
  where name = 'satupersen_app_url';

  select decrypted_secret into cron_secret
  from vault.decrypted_secrets
  where name = 'satupersen_cron_secret';

  if app_url is null or cron_secret is null then
    raise exception 'cron_tick_not_configured';
  end if;

  return net.http_post(
    url := rtrim(app_url, '/') || '/api/cron/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret
    ),
    body := '{}'::jsonb,
    -- Matches maxDuration of the route: a tick that needs longer is cut off, not left hanging.
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function private.call_cron_tick() from public, anon, authenticated;

-- Scheduling under the same name again replaces the job, so this file can be
-- applied more than once without creating a second job.
select cron.schedule('satupersen-tick', '*/15 * * * *', 'select private.call_cron_tick()');
