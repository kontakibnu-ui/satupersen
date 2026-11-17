-- Ruang baca (PRD.md READ-1 to READ-10), approved by the user on 2026-11-17.
--
-- Books are files in a private Storage bucket plus one row each in
-- public.books. Users read their own rows and files and may only move their
-- reading position; everything else (the row itself, the quota bookkeeping,
-- uploads and deletes of files) goes through server code with the service role
-- (src/lib/supabase/admin.ts). Grants are explicit, as
-- 20261028230000_restrict_client_writes.sql asks of every later migration.

-- profiles ----------------------------------------------------------------
-- How many books the account has ever finished uploading (READ-2). It only goes
-- up, so deleting a book never frees the free plan's slot. Users can only update
-- name, timezone, and consented_at on profiles, so this column stays server side.
alter table public.profiles
  add column books_created integer not null default 0
    check (books_created >= 0);

-- books -------------------------------------------------------------------
create table public.books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120 and btrim(title) <> ''),
  format text not null check (format in ('pdf', 'epub', 'docx', 'txt')),
  -- 50 MB per file (src/lib/books/rules.ts MAX_BOOK_BYTES).
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  storage_path text not null unique,
  -- uploading: a one-time upload permission was handed out; ready: the server
  -- checked the stored file and the book counts.
  status text not null default 'uploading' check (status in ('uploading', 'ready')),
  -- The reader's own position: foliate-js's location marker and how far in.
  location text check (location is null or char_length(location) <= 2000),
  progress numeric(5, 4) check (progress is null or (progress >= 0 and progress <= 1)),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  opened_at timestamptz,
  check (storage_path = user_id::text || '/' || id::text)
);

create index books_user_created_idx on public.books (user_id, created_at);

alter table public.books enable row level security;

revoke all on public.books from anon, authenticated;
grant select on public.books to authenticated;
grant update (location, progress, opened_at) on public.books to authenticated;

create policy books_owner_select on public.books
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Only a finished upload has a position worth saving.
create policy books_owner_update on public.books
  for update to authenticated
  using (user_id = (select auth.uid()) and status = 'ready')
  with check (user_id = (select auth.uid()) and status = 'ready');

-- Starts an upload (READ-2): checks the plan under a per user lock and inserts
-- the row the one-time upload permission is made for. Returns the new id, or
-- raises book_limit_reached (free: one book ever, counting uploads in flight)
-- or book_storage_full (premium: 2 GB across every book, in flight included).
-- The same numbers live in src/config/plans.ts; plans.test.ts checks both.
create function public.start_book_upload(
  p_user uuid,
  p_title text,
  p_format text,
  p_size bigint
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  owner_plan text;
  created_count integer;
  in_flight integer;
  used_bytes bigint;
  new_id uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(hashtextextended('book:' || p_user::text, 0));

  select plan, books_created
    into owner_plan, created_count
  from public.profiles
  where id = p_user;

  if owner_plan is distinct from 'premium' then
    select count(*) into in_flight
    from public.books
    where user_id = p_user and status = 'uploading';

    if coalesce(created_count, 0) + in_flight >= 1 then
      raise exception 'book_limit_reached';
    end if;
  else
    select coalesce(sum(size_bytes), 0) into used_bytes
    from public.books
    where user_id = p_user;

    if used_bytes + p_size > 2147483648 then
      raise exception 'book_storage_full';
    end if;
  end if;

  insert into public.books (id, user_id, title, format, size_bytes, storage_path, status)
  values (new_id, p_user, p_title, p_format, p_size, p_user::text || '/' || new_id::text, 'uploading');

  return new_id;
end;
$$;

revoke all on function public.start_book_upload(uuid, text, text, bigint) from public, anon, authenticated;
grant execute on function public.start_book_upload(uuid, text, text, bigint) to service_role;

-- Finishes an upload once the server has read the stored file's real size.
-- Returns 'ready', or why not: 'not_found', 'too_large' (over 50 MB),
-- 'storage_full' (premium over 2 GB), 'limit' (free slot already used). On
-- anything but 'ready' the server deletes the file and the row.
create function public.finish_book_upload(
  p_user uuid,
  p_book uuid,
  p_size bigint
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  owner_plan text;
  created_count integer;
  other_bytes bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('book:' || p_user::text, 0));

  perform 1
  from public.books
  where id = p_book and user_id = p_user and status = 'uploading';

  if not found then
    return 'not_found';
  end if;

  if p_size < 1 or p_size > 52428800 then
    return 'too_large';
  end if;

  select plan, books_created
    into owner_plan, created_count
  from public.profiles
  where id = p_user;

  if owner_plan is distinct from 'premium' then
    if coalesce(created_count, 0) >= 1 then
      return 'limit';
    end if;
  else
    select coalesce(sum(size_bytes), 0) into other_bytes
    from public.books
    where user_id = p_user and id <> p_book;

    if other_bytes + p_size > 2147483648 then
      return 'storage_full';
    end if;
  end if;

  update public.books
  set status = 'ready', size_bytes = p_size, ready_at = now()
  where id = p_book;

  update public.profiles
  set books_created = books_created + 1
  where id = p_user;

  return 'ready';
end;
$$;

revoke all on function public.finish_book_upload(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.finish_book_upload(uuid, uuid, bigint) to service_role;

-- Storage -----------------------------------------------------------------
-- Private bucket, 50 MB per file, only the four accepted types (READ-1).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'books',
  'books',
  false,
  52428800,
  array[
    'application/pdf',
    'application/epub+zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- A user reads only the files in their own folder (<user_id>/<book_id>). There
-- is no insert, update, or delete policy: uploads use a one-time permission the
-- server creates, and deletes go through the service role (READ-8).
create policy books_files_owner_read on storage.objects
  for select to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = (select auth.uid())::text);
