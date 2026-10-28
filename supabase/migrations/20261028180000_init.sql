-- Satu Persen initial schema. PRD.md §9 defines the twelve tables, and every
-- user data table gets row level security so a row is only ever visible to its
-- owner. Server only tables (subscriptions, whatsapp_link_codes, wa_messages)
-- are written with the service role, so they carry no policy at all, which in
-- Postgres means no access for the anon and authenticated roles.

-- profiles ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  timezone text not null default 'Asia/Jakarta',
  plan text not null default 'free' check (plan in ('free', 'premium')),
  premium_until timestamptz,
  consented_at timestamptz,
  created_at timestamptz not null default now()
);

-- entries ----------------------------------------------------------------
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  content text not null default '' check (char_length(content) <= 5000),
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger entries_touch_updated_at
  before update on public.entries
  for each row execute function public.touch_updated_at();

-- habits -----------------------------------------------------------------
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  identity text check (char_length(identity) <= 200),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

-- habit_logs -------------------------------------------------------------
create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  unique (habit_id, date)
);

-- expenses ---------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  amount integer not null check (amount > 0),
  category text not null check (char_length(category) between 1 and 60),
  note text check (char_length(note) <= 200),
  created_at timestamptz not null default now()
);

create index expenses_user_date_idx on public.expenses (user_id, date);

-- budgets ----------------------------------------------------------------
create table public.budgets (
  user_id uuid not null references auth.users (id) on delete cascade,
  month date not null check (date_trunc('month', month)::date = month),
  amount integer not null check (amount > 0),
  primary key (user_id, month)
);

-- daily_summaries --------------------------------------------------------
create table public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  summary text,
  strengths jsonb,
  improvements jsonb,
  tomorrow_tip text,
  ai_dimension_score smallint check (ai_dimension_score between 0 and 10),
  score smallint check (score between 0 and 100),
  score_dimensions jsonb,
  delta_pct numeric,
  score_reason text,
  risk_flag boolean not null default false,
  model text,
  regen_count smallint not null default 0 check (regen_count >= 0),
  unique (user_id, date)
);

-- reports ----------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('weekly', 'monthly')),
  period_start date not null,
  period_end date not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, type, period_start)
);

-- subscriptions (server only) -------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null,
  provider_ref text not null unique,
  plan text not null check (plan in ('free', 'premium')),
  status text not null,
  current_period_end timestamptz
);

-- whatsapp_links ---------------------------------------------------------
-- phone stores E.164 digits only, exactly as Meta sends them, without "+".
create table public.whatsapp_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  phone text not null unique check (phone ~ '^[0-9]{8,15}$'),
  verified_at timestamptz,
  opted_in boolean not null default false,
  reminder_time time,
  last_inbound_at timestamptz
);

-- whatsapp_link_codes (server only) --------------------------------------
create table public.whatsapp_link_codes (
  code text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null
);

-- wa_messages (server only) ---------------------------------------------
-- Outbound kinds are the fixed set from PRD.md §6; inbound rows keep whatever
-- Meta sent (text, image, voice) so the handler can answer non-text politely.
create table public.wa_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  wa_message_id text not null unique,
  direction text not null check (direction in ('in', 'out')),
  kind text check (
    direction = 'in'
    or kind in ('ai_reply', 'notice', 'crisis', 'summary', 'reminder', 'help')
  ),
  body text,
  created_at timestamptz not null default now()
);

create index wa_messages_user_created_idx on public.wa_messages (user_id, created_at);

-- Row level security -----------------------------------------------------
-- RLS is on for every table. A table without a policy can only be reached with
-- the service role, which is what the three server only tables rely on.

alter table public.profiles enable row level security;
alter table public.entries enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.reports enable row level security;
alter table public.whatsapp_links enable row level security;
alter table public.subscriptions enable row level security;
alter table public.whatsapp_link_codes enable row level security;
alter table public.wa_messages enable row level security;

create policy profiles_owner on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy entries_owner on public.entries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy habits_owner on public.habits
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Also checks that the habit belongs to the same user, so a log cannot be
-- attached to somebody else's habit_id and distort their streak.
create policy habit_logs_owner on public.habit_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.habits h
      where h.id = habit_id
        and h.user_id = (select auth.uid())
    )
  );

create policy expenses_owner on public.expenses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy budgets_owner on public.budgets
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy daily_summaries_owner on public.daily_summaries
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy reports_owner on public.reports
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy whatsapp_links_owner on public.whatsapp_links
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Table privileges -------------------------------------------------------
-- The authenticated role gets access to public tables; row access is then
-- decided by the policies above. anon gets nothing.

revoke all on all tables in schema public from anon;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- AUTH-3: the first login creates the profile row with plan free ---------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
