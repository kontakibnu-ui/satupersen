-- "Isi dari screenshot" on the Uang screen (PRD.md EXP-7), approved by the user
-- on 2026-11-16. The picture is read on the phone and is never uploaded; only
-- the model call that fills the form is metered like every other AI call
-- (PRD.md §8, SUB-4). No other table changes: the screenshot text is not
-- stored, and an entry made from it is an ordinary row of `expenses`.
alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage
  add constraint ai_usage_feature_check check (feature in ('daily', 'chat', 'report', 'study', 'receipt'));
