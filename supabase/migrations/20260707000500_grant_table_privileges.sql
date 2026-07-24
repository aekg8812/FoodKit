-- Root cause: supabase CLI 2.x defaults to NOT auto-exposing new tables
-- (auto_expose_new_tables is unset in config.toml). Tables created by the postgres
-- role in migrations are not automatically granted to Data API roles.
-- BYPASSRLS on service_role bypasses RLS checks only — table-level GRANT is a
-- separate mechanism and must also be satisfied.

-- ============================================================
-- Existing tables: explicit GRANT
-- (ALTER DEFAULT PRIVILEGES does not retroact to already-created tables)
-- ============================================================

grant select, insert, update         on public.users                to authenticated;
grant select, insert                 on public.group_members         to authenticated;
grant select, insert, update         on public.groups                to authenticated;
grant select, insert, update         on public.restaurants           to authenticated;
grant select, insert                 on public.restaurant_accesses   to authenticated;
grant select, insert, update, delete on public.reviews               to authenticated;
grant select, insert, update         on public.user_value_profiles   to authenticated;
grant select                         on public.value_questions        to authenticated;
grant select                         on public.value_options          to authenticated;
grant select, insert, update         on public.user_value_answers    to authenticated;

-- service_role: grant ALL so BYPASSRLS is effective for admin/edge-function operations.
grant all on public.users                to service_role;
grant all on public.group_members         to service_role;
grant all on public.groups                to service_role;
grant all on public.restaurants           to service_role;
grant all on public.restaurant_accesses   to service_role;
grant all on public.reviews               to service_role;
grant all on public.user_value_profiles   to service_role;
grant all on public.value_questions        to service_role;
grant all on public.value_options          to service_role;
grant all on public.user_value_answers    to service_role;

-- anon: no DML granted. MVP requires authentication for all operations.
-- The signup/login flow goes through the auth schema; public tables are never
-- accessed by the anon role.

-- ============================================================
-- Future tables: ALTER DEFAULT PRIVILEGES
-- Migrations run as the postgres role in both local (supabase CLI) and
-- production (supabase db push). FOR ROLE postgres ensures these defaults apply
-- to tables created by future migrations in both environments.
-- ============================================================

alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;

alter default privileges for role postgres in schema public
  grant all on tables to service_role;
