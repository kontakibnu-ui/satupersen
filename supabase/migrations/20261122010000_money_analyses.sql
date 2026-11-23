-- "Analisa uang" (PRD.md EXP-10), approved by the user on 2026-11-22: the AI's
-- reading of one month of money, kept so the screen shows it again without a
-- new model call. One row per user per month, written only by the server (the
-- service role) after the plan, the daily refresh limit, and the model output
-- are checked; the user can only read their own rows. Deleted with the account.
create table public.money_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null check (date_trunc('month', month)::date = month),
  paragraphs jsonb not null check (
    jsonb_typeof(paragraphs) = 'array' and jsonb_array_length(paragraphs) between 1 and 3
  ),
  next_month text not null check (char_length(next_month) between 1 and 180),
  -- The last day the analysis read: today for a running month, the month's end otherwise.
  through_date date not null,
  -- The user's local day when it was written; one refresh per local day (EXP-10).
  generated_on date not null,
  model text not null check (char_length(model) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

alter table public.money_analyses enable row level security;

revoke all on public.money_analyses from anon, authenticated;
grant select on public.money_analyses to authenticated;
grant select, insert, update, delete on public.money_analyses to service_role;

create policy money_analyses_owner_select on public.money_analyses
  for select to authenticated
  using (user_id = (select auth.uid()));
