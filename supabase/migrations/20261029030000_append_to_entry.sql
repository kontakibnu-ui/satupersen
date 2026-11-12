-- PRD.md §6: every WhatsApp message is added to the diary of that day, separated
-- by a blank line.
--
-- Two messages can arrive at the same moment, and reading the text, joining, and
-- writing it back would let one overwrite the other. Doing it in one statement
-- makes the database join them in order. The 5000 character rule (DIARY-3) is
-- checked in the same statement, so a long chat can never push the text over it:
-- the message is then left out and the function says so.
--
-- Only server code calls this (with the service role). A browser has no way in.

create or replace function public.append_to_entry(p_user uuid, p_date date, p_text text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  appended boolean;
begin
  insert into public.entries as e (user_id, date, content)
  values (p_user, p_date, p_text)
  on conflict (user_id, date) do update
    set content = case
      when e.content = '' then excluded.content
      else e.content || E'\n\n' || excluded.content
    end
    where char_length(
      case
        when e.content = '' then excluded.content
        else e.content || E'\n\n' || excluded.content
      end
    ) <= 5000
  returning true into appended;

  return coalesce(appended, false);
end;
$$;

revoke all on function public.append_to_entry(uuid, date, text) from public, anon, authenticated;
grant execute on function public.append_to_entry(uuid, date, text) to service_role;
