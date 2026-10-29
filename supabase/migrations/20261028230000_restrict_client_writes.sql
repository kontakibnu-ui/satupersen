-- Closes writes that the browser must never make (PRD.md §7 "Klien tidak
-- dipercaya", SUB-1, SUB-2, AI-4, SCORE-1, PRD.md §6 LINK KODE).
--
-- The init migration granted `authenticated` every privilege on every table,
-- and each owner policy covered all commands. Row level security kept users
-- apart, but a signed in user could still call PostgREST directly with their
-- own token and set their own plan to premium, reset their summary quota,
-- write their own score, or mark a WhatsApp number as verified. Verified on the
-- local stack on 2026-10-28 before this migration.
--
-- Policies decide which rows; these grants decide which commands and columns a
-- user may touch at all. Server-owned rows are written with the service role
-- from server code only (src/lib/supabase/admin.ts).
--
-- Every new table added later must state its grants explicitly in its own
-- migration, the same way.

-- profiles ---------------------------------------------------------------
-- The user edits name, time zone, and consent (Akun and onboarding). Plan and
-- premium_until change only through the verified payment webhook (SUB-2). The
-- row itself is created by the handle_new_user trigger and removed with the
-- account, so users never insert or delete it.
revoke insert, update, delete on public.profiles from authenticated;
grant update (name, timezone, consented_at) on public.profiles to authenticated;

-- daily_summaries ---------------------------------------------------------
-- Written only by POST /api/ai/summarize after it checks the quota and computes
-- the score in code. Users read their own rows.
revoke insert, update, delete on public.daily_summaries from authenticated;

drop policy daily_summaries_owner on public.daily_summaries;

create policy daily_summaries_owner_select on public.daily_summaries
  for select to authenticated
  using (user_id = (select auth.uid()));

-- reports ----------------------------------------------------------------
-- Written only by the scheduled tick (REPORT-1, REPORT-2). Users read their own.
revoke insert, update, delete on public.reports from authenticated;

drop policy reports_owner on public.reports;

create policy reports_owner_select on public.reports
  for select to authenticated
  using (user_id = (select auth.uid()));

-- whatsapp_links ---------------------------------------------------------
-- The phone number, its verification, and the last inbound time come only from
-- the webhook handler (LINK KODE). The user may switch reminders and replies
-- on or off and pick the reminder time.
revoke insert, update, delete on public.whatsapp_links from authenticated;
grant update (opted_in, reminder_time) on public.whatsapp_links to authenticated;
