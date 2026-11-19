-- Table and sequence privileges for service_role, stated explicitly.
--
-- Older Supabase projects, and the local stack, give the API roles every
-- privilege on new objects in `public` by default. Projects created now give
-- them only TRUNCATE, REFERENCES, TRIGGER and MAINTAIN on tables and nothing on
-- sequences (seen on the project created 2026-11-18). The earlier migrations
-- already grant anon and authenticated exactly what they may do, but relied on
-- the old default for service_role, so on a new project the server could not
-- read or write any table ("permission denied for table profiles").
--
-- service_role is the server-only role (src/lib/supabase/admin.ts) that already
-- bypasses RLS; this restores what it has on the local stack and changes
-- nothing for anon or authenticated. On a project that still has the old
-- defaults, every statement here is a no-op.

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Tables and sequences made by later migrations (run as postgres) get the same.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
