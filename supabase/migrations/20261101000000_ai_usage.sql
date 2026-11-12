-- PRD.md §8: every AI call is metered with the token counts OpenRouter reports,
-- so the monthly soft cap per plan can be checked on the server and the cost of
-- a plan can be measured instead of guessed.
--
-- One row per HTTP call to the model, including a retry after unusable output,
-- because each attempt is billed. Only counts and the model name are stored:
-- never the prompt or the answer (AGENTS.md §6).
--
-- Written only by server code with the service role (src/lib/ai/usage.ts).
-- Users read their own rows, which is what the Paket screen shows.

create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('daily', 'chat', 'report')),
  model text not null,
  prompt_tokens integer not null check (prompt_tokens >= 0),
  completion_tokens integer not null check (completion_tokens >= 0),
  -- USD as reported by OpenRouter; null when the provider did not report it.
  cost_usd numeric(12, 8) check (cost_usd >= 0),
  created_at timestamptz not null default now()
);

create index ai_usage_user_created_idx on public.ai_usage (user_id, created_at);

alter table public.ai_usage enable row level security;

revoke all on public.ai_usage from anon;
revoke insert, update, delete, truncate on public.ai_usage from authenticated;
grant select on public.ai_usage to authenticated;

create policy ai_usage_owner_select on public.ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()));

-- The monthly total, summed in the database instead of shipping every row.
-- security invoker: with a user's session row level security still applies, so
-- passing someone else's id only ever sums to 0.
create or replace function public.ai_tokens_since(p_user uuid, p_since timestamptz)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(prompt_tokens + completion_tokens), 0)::bigint
  from public.ai_usage
  where user_id = p_user
    and created_at >= p_since;
$$;

revoke all on function public.ai_tokens_since(uuid, timestamptz) from public, anon;
grant execute on function public.ai_tokens_since(uuid, timestamptz) to authenticated, service_role;
