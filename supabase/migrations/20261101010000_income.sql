-- Income next to expenses (PRD.md EXP-5), so the Uang screen can show money in,
-- money out, and what is left, and compare months.
--
-- The table keeps its name `expenses`: renaming it would touch the export, the
-- account deletion, the report reader, and every policy for no gain. Each row is
-- now an entry of money, and `type` says which way it went. Rows that exist
-- before this migration are expenses, which is what the default gives them.
--
-- Grants and policies of the table are unchanged: the owner policy and the
-- table-level grants already cover a new column.
alter table public.expenses
  add column type text not null default 'expense'
  check (type in ('expense', 'income'));

-- The month screen and the score read a user's entries by day, filtered by type.
create index expenses_user_type_date_idx on public.expenses (user_id, type, date);
