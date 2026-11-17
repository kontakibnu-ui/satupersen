-- Belajar writes that touch several rows go through one function each, so they
-- land together or not at all (PRD.md LEARN-2 to LEARN-4).
--
-- Found on 2026-11-15 while testing with the real model under load: the five
-- review feedbacks were written as five separate updates, one of them failed,
-- and the session was left half checked. The review schedule and the first
-- check of a material had the same shape. Each function below runs in one
-- transaction; the values themselves (the schedule from
-- src/lib/study/schedule.ts, the validated model output) still come from
-- server code. Callable only with the service role.

-- The first check of a material (questions wanted) or a later one (feedback
-- only). p_questions: [{ position, prompt, answer, kind, step, due_date }].
create function public.store_study_explanation_check(
  p_user uuid,
  p_material uuid,
  p_feedback jsonb,
  p_questions jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.study_materials
  set feedback = p_feedback
  where id = p_material and user_id = p_user;

  if not found then
    raise exception 'study_material_missing';
  end if;

  if p_questions is null or jsonb_array_length(p_questions) = 0 then
    return;
  end if;

  -- Replace, never add: a retry must not leave two sets of questions.
  delete from public.study_questions
  where material_id = p_material and user_id = p_user;

  insert into public.study_questions (material_id, user_id, position, prompt, answer, kind, step, due_date)
  select p_material, p_user, q.position, q.prompt, q.answer, q.kind, q.step, q.due_date
  from jsonb_to_recordset(p_questions)
    as q(position smallint, prompt text, answer text, kind text, step smallint, due_date date);

  update public.study_materials
  set status = 'active', activated_at = now()
  where id = p_material and user_id = p_user;
end;
$$;

revoke all on function public.store_study_explanation_check(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.store_study_explanation_check(uuid, uuid, jsonb, jsonb) to service_role;

-- One review session: the answers and ratings, and each question moved to the
-- step and date the server computed. p_items: [{ question_id, answer, rating,
-- step, due_date }]. A second submit of the same day hits the unique key on
-- (question_id, reviewed_on) and changes nothing.
create function public.save_study_review(
  p_user uuid,
  p_material uuid,
  p_day date,
  p_items jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  moved integer;
begin
  insert into public.study_reviews (user_id, material_id, question_id, reviewed_on, answer, rating)
  select p_user, p_material, i.question_id, p_day, i.answer, i.rating
  from jsonb_to_recordset(p_items)
    as i(question_id uuid, answer text, rating text, step smallint, due_date date);

  update public.study_questions q
  set step = i.step, due_date = i.due_date
  from jsonb_to_recordset(p_items)
    as i(question_id uuid, answer text, rating text, step smallint, due_date date)
  where q.id = i.question_id and q.user_id = p_user and q.material_id = p_material;

  get diagnostics moved = row_count;

  if moved <> jsonb_array_length(p_items) then
    raise exception 'study_question_missing';
  end if;
end;
$$;

revoke all on function public.save_study_review(uuid, uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.save_study_review(uuid, uuid, date, jsonb) to service_role;

-- The AI's feedback on a session. p_items: [{ id, feedback }].
create function public.store_study_review_feedback(p_user uuid, p_items jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  updated integer;
begin
  update public.study_reviews r
  set feedback = i.feedback
  from jsonb_to_recordset(p_items) as i(id bigint, feedback text)
  where r.id = i.id and r.user_id = p_user;

  get diagnostics updated = row_count;

  if updated <> jsonb_array_length(p_items) then
    raise exception 'study_review_missing';
  end if;
end;
$$;

revoke all on function public.store_study_review_feedback(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.store_study_review_feedback(uuid, jsonb) to service_role;
