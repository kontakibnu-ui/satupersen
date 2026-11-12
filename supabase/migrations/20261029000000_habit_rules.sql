-- HABIT-1: a habit is archived, never deleted. HABIT-3: a free account has at
-- most 3 active habits, checked where it cannot be skipped.
--
-- The limit lives in the database, not only in the server action, because the
-- browser holds the anon key and a signed in user can call PostgREST directly
-- (PRD.md §7 "Klien tidak dipercaya"; the same gap was closed for plan and
-- scores in 20261028230000_restrict_client_writes.sql).

-- Archive, not delete: removing a habit would erase its logs and its streak.
-- Account deletion still cascades, because it runs as the service role.
revoke delete on public.habits from authenticated;

-- A user edits only what the Kebiasaan screen offers.
revoke update on public.habits from authenticated;
grant update (name, identity, archived_at) on public.habits to authenticated;

create function public.enforce_habit_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_plan text;
  active_count integer;
begin
  -- An archived habit takes no slot.
  if new.archived_at is not null then
    return new;
  end if;

  -- Two requests at once must not both see room for the last slot.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select plan into owner_plan from public.profiles where id = new.user_id;

  if owner_plan = 'premium' then
    return new;
  end if;

  select count(*) into active_count
  from public.habits
  where user_id = new.user_id
    and archived_at is null
    and id <> new.id;

  if active_count >= 3 then
    raise exception 'habit_limit_reached';
  end if;

  return new;
end;
$$;

-- `update of archived_at` runs the check when a habit is brought back from the
-- archive, and stays out of the way of a plain rename. A user whose premium
-- ended keeps the habits they already have (SUB-3).
create trigger habits_enforce_limit
  before insert or update of archived_at on public.habits
  for each row execute function public.enforce_habit_limit();
