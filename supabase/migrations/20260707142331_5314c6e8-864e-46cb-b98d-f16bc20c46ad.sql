
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, text[]) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated users can create organisations" ON public.organisations;
CREATE POLICY "Authenticated users can create organisations"
ON public.organisations FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
