CREATE OR REPLACE FUNCTION public.create_organisation(_nom text)
RETURNS TABLE(id uuid, nom text, created_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _org_id uuid;
  _created timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM public.organisation_membres WHERE user_id = _uid) THEN
    RAISE EXCEPTION 'Vous appartenez déjà à un cabinet';
  END IF;
  INSERT INTO public.organisations (nom) VALUES (_nom)
    RETURNING organisations.id, organisations.created_at INTO _org_id, _created;
  INSERT INTO public.organisation_membres (organisation_id, user_id, role)
    VALUES (_org_id, _uid, 'admin');
  RETURN QUERY SELECT _org_id, _nom, _created;
END;
$$;

REVOKE ALL ON FUNCTION public.create_organisation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_organisation(text) TO authenticated;