begin;

-- ============================================================================
-- SERVICE_ROLE FUNCTION GRANTS VOOR PROFILE-UPDATES
--
-- De contentmanager-RBAC trigger roept bij iedere UPDATE op public.profiles
-- de helpers is_current_user_manager() en is_current_user_admin() aan.
--
-- service_role heeft bewust server-side UPDATE-rechten op public.profiles
-- voor testdataherstel, cleanup en vertrouwde backendtaken. Daarom moet deze
-- rol ook beide door de trigger aangeroepen functies mogen uitvoeren.
--
-- Er worden geen rechten voor public, anon of andere rollen uitgebreid.
-- ============================================================================

grant execute
on function public.is_current_user_manager()
to service_role;

grant execute
on function public.is_current_user_admin()
to service_role;

commit;
