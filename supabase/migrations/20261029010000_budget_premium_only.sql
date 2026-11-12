-- EXP-4 and SUB-1: a monthly budget is a premium feature, so a budget row is
-- written only by server code that has checked the plan (src/lib/supabase/admin.ts).
--
-- With the init grants a free user could insert a budget through PostgREST with
-- their own token and unlock the finance part of the score. Users still read
-- their own budget.
revoke insert, update, delete on public.budgets from authenticated;

drop policy budgets_owner on public.budgets;

create policy budgets_owner_select on public.budgets
  for select to authenticated
  using (user_id = (select auth.uid()));
