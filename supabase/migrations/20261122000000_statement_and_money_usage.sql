-- "Dari e-statement" (PRD.md EXP-9) and "Analisa uang" (EXP-10), approved by the
-- user on 2026-11-22. Their model calls are metered like every other AI call
-- (PRD.md §8, SUB-4). The statement text is never stored; entries made from it
-- are ordinary rows of `expenses`. The analysis table comes in its own migration.
alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage
  add constraint ai_usage_feature_check
  check (feature in ('daily', 'chat', 'report', 'study', 'receipt', 'statement', 'money'));
