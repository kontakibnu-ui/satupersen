-- Belajar (PRD.md LEARN-1 to LEARN-9) and the per user rate limit (RATE-1 to
-- RATE-3), both approved by the user on 2026-11-15.
--
-- Supabase gives anon and authenticated every privilege on a new table by
-- default, so each table below states its grants explicitly, as
-- 20261028230000_restrict_client_writes.sql asks of every later migration.
-- Rows the user may not shape themselves (AI feedback, questions, the review
-- schedule, quota bookkeeping) are written only with the service role from
-- server code (src/lib/supabase/admin.ts).

-- profiles ----------------------------------------------------------------
-- How many materials the account has ever made (LEARN-5). It only goes up, so
-- deleting a material never frees a slot on the free plan. Users already have
-- update rights on name, timezone, and consented_at only, so this column stays
-- server side; the insert trigger below is what raises it.
alter table public.profiles
  add column study_materials_created integer not null default 0
    check (study_materials_created >= 0);

-- ai_usage ----------------------------------------------------------------
-- Belajar calls are metered like every other AI call (PRD.md §8, SUB-4).
alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage
  add constraint ai_usage_feature_check check (feature in ('daily', 'chat', 'report', 'study'));

-- study_materials ---------------------------------------------------------
create table public.study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) <= 120 and btrim(title) <> ''),
  source text not null check (char_length(source) <= 5000 and btrim(source) <> ''),
  -- The user's latest "Jelaskan dengan kata sendiri" and the AI's answer to it.
  explanation text check (explanation is null or char_length(explanation) <= 3000),
  feedback jsonb,
  -- draft: saved, never checked; active: questions exist and reviews run.
  status text not null default 'draft' check (status in ('draft', 'active')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  updated_at timestamptz not null default now()
);

create index study_materials_user_created_idx on public.study_materials (user_id, created_at);

alter table public.study_materials enable row level security;

revoke all on public.study_materials from anon, authenticated;
grant select, delete on public.study_materials to authenticated;
grant insert (user_id, title, source) on public.study_materials to authenticated;
grant update (title, source) on public.study_materials to authenticated;

create policy study_materials_owner_select on public.study_materials
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy study_materials_owner_insert on public.study_materials
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy study_materials_owner_update on public.study_materials
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy study_materials_owner_delete on public.study_materials
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- LEARN-5: a free account makes at most 1 material, ever. Checked here, where
-- a browser calling PostgREST with its own token cannot skip it, the same way
-- 20261029000000_habit_rules.sql guards the habit limit. src/config/plans.ts
-- holds the same number and plans.test.ts checks that both agree.
create function public.enforce_study_material_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_plan text;
  created_count integer;
begin
  -- Two requests at once must not both see room for the last slot.
  perform pg_advisory_xact_lock(hashtextextended('study_material:' || new.user_id::text, 0));

  select plan, study_materials_created
    into owner_plan, created_count
  from public.profiles
  where id = new.user_id;

  if owner_plan is distinct from 'premium' and coalesce(created_count, 0) >= 1 then
    raise exception 'study_material_limit_reached';
  end if;

  update public.profiles
  set study_materials_created = study_materials_created + 1
  where id = new.user_id;

  -- Whatever a caller sends, a new material starts as an unchecked draft.
  new.status := 'draft';
  new.explanation := null;
  new.feedback := null;
  new.activated_at := null;

  return new;
end;
$$;

create trigger study_materials_enforce_limit
  before insert on public.study_materials
  for each row execute function public.enforce_study_material_limit();

-- LEARN-2: the questions are made from the material, so once it is active its
-- text is fixed. Otherwise one material could be rewritten into a new one.
create function public.guard_study_material_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'active' and new.source is distinct from old.source then
    raise exception 'study_source_locked';
  end if;

  new.updated_at := now();

  return new;
end;
$$;

create trigger study_materials_guard_update
  before update on public.study_materials
  for each row execute function public.guard_study_material_update();

-- study_questions (server) ------------------------------------------------
-- Written by the server from validated model output; the schedule columns
-- change only through the server action that stores a review (LEARN-3).
create table public.study_questions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.study_materials (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position smallint not null check (position between 1 and 5),
  prompt text not null check (char_length(prompt) between 1 and 400),
  answer text not null check (char_length(answer) between 1 and 1200),
  kind text not null check (kind in ('recall', 'elaboration')),
  -- Index into the review gaps of src/lib/study/schedule.ts; 5 means finished.
  step smallint not null default 0 check (step between 0 and 5),
  -- Null once the question is finished.
  due_date date,
  created_at timestamptz not null default now(),
  unique (material_id, position)
);

create index study_questions_user_due_idx on public.study_questions (user_id, due_date);

alter table public.study_questions enable row level security;

revoke all on public.study_questions from anon, authenticated;
grant select on public.study_questions to authenticated;

create policy study_questions_owner_select on public.study_questions
  for select to authenticated
  using (user_id = (select auth.uid()));

-- study_reviews (server) --------------------------------------------------
-- One row per question per local day. The unique key makes a double submit
-- harmless instead of moving the schedule twice.
create table public.study_reviews (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  material_id uuid not null references public.study_materials (id) on delete cascade,
  question_id uuid not null references public.study_questions (id) on delete cascade,
  reviewed_on date not null,
  answer text not null default '' check (char_length(answer) <= 1000),
  rating text not null check (rating in ('forgot', 'unsure', 'remembered')),
  feedback text check (feedback is null or char_length(feedback) <= 1200),
  created_at timestamptz not null default now(),
  unique (question_id, reviewed_on)
);

create index study_reviews_material_day_idx on public.study_reviews (material_id, reviewed_on);
create index study_reviews_user_idx on public.study_reviews (user_id);

alter table public.study_reviews enable row level security;

revoke all on public.study_reviews from anon, authenticated;
grant select on public.study_reviews to authenticated;

create policy study_reviews_owner_select on public.study_reviews
  for select to authenticated
  using (user_id = (select auth.uid()));

-- study_checks (server) ---------------------------------------------------
-- One row per successful AI check, the count behind LEARN-5. The material link
-- is cleared rather than cascaded on delete, so removing a material never gives
-- back the checks already used that day.
create table public.study_checks (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  material_id uuid references public.study_materials (id) on delete set null,
  date date not null,
  kind text not null check (kind in ('explanation', 'review')),
  created_at timestamptz not null default now()
);

create index study_checks_user_date_idx on public.study_checks (user_id, date);
create index study_checks_material_date_idx on public.study_checks (material_id, date);

alter table public.study_checks enable row level security;

revoke all on public.study_checks from anon, authenticated;
grant select on public.study_checks to authenticated;

create policy study_checks_owner_select on public.study_checks
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Takes one check from the quota before the model is called, under a per user
-- lock, so two requests at once cannot both pass the last free check. Returns
-- the new row's id, or null when the quota is used up. A failed model call
-- deletes its row again: failed checks do not count (LEARN-5).
-- p_scope 'account' counts every check of the user that day (free);
-- 'material' counts the checks of one material that day (premium).
create function public.reserve_study_check(
  p_user uuid,
  p_material uuid,
  p_date date,
  p_kind text,
  p_scope text,
  p_limit integer
)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  used integer;
  new_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('study_check:' || p_user::text, 0));

  if p_scope = 'account' then
    select count(*) into used
    from public.study_checks
    where user_id = p_user and date = p_date;
  elsif p_scope = 'material' then
    select count(*) into used
    from public.study_checks
    where user_id = p_user and material_id = p_material and date = p_date;
  else
    raise exception 'unknown study check scope';
  end if;

  if used >= p_limit then
    return null;
  end if;

  insert into public.study_checks (user_id, material_id, date, kind)
  values (p_user, p_material, p_date, p_kind)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.reserve_study_check(uuid, uuid, date, text, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_study_check(uuid, uuid, date, text, text, integer) to service_role;

-- rate_limits (server) ----------------------------------------------------
-- RATE-1: hits per user per bucket in fixed windows. Read and written only
-- through take_rate_limit; users cannot see or touch it.
create table public.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (char_length(bucket) between 1 and 40),
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, bucket, window_start)
);

alter table public.rate_limits enable row level security;

revoke all on public.rate_limits from anon, authenticated;

-- Counts one hit and answers how many seconds to wait: 0 means go ahead. The
-- upsert is a single statement, so instances running at the same time all see
-- the same count. The user's older windows of the bucket are removed on the way,
-- which keeps the table to about one row per active user and bucket.
create function public.take_rate_limit(
  p_user uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  current_window timestamptz;
  hits integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit';
  end if;

  current_window := to_timestamp(
    (floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds)::double precision
  );

  delete from public.rate_limits
  where user_id = p_user and bucket = p_bucket and window_start < current_window;

  insert into public.rate_limits as limits (user_id, bucket, window_start, count)
  values (p_user, p_bucket, current_window, 1)
  on conflict (user_id, bucket, window_start)
    do update set count = limits.count + 1
  returning limits.count into hits;

  if hits > p_limit then
    return greatest(
      1,
      ceil(extract(epoch from (current_window + make_interval(secs => p_window_seconds) - now())))::integer
    );
  end if;

  return 0;
end;
$$;

revoke all on function public.take_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.take_rate_limit(uuid, text, integer, integer) to service_role;
