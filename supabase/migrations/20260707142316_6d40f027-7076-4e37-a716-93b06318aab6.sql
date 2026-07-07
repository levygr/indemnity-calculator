
-- =========================
-- ORGANISATIONS
-- =========================
CREATE TABLE public.organisations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nom text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organisations TO authenticated;
GRANT ALL ON public.organisations TO service_role;
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- =========================
-- ORGANISATION_MEMBRES
-- =========================
CREATE TABLE public.organisation_membres (
  organisation_id uuid NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin','avocat','assistant')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organisation_membres TO authenticated;
GRANT ALL ON public.organisation_membres TO service_role;
ALTER TABLE public.organisation_membres ENABLE ROW LEVEL SECURITY;

-- =========================
-- Security-definer helpers to avoid RLS recursion
-- =========================
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organisation_membres
    WHERE organisation_id = _org AND user_id = _user
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _user uuid, _roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organisation_membres
    WHERE organisation_id = _org AND user_id = _user AND role = ANY(_roles)
  );
$$;

-- =========================
-- POLICIES: organisations
-- =========================
CREATE POLICY "Members can view their organisations"
ON public.organisations FOR SELECT TO authenticated
USING (public.is_org_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create organisations"
ON public.organisations FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update their organisation"
ON public.organisations FOR UPDATE TO authenticated
USING (public.has_org_role(id, auth.uid(), ARRAY['admin']))
WITH CHECK (public.has_org_role(id, auth.uid(), ARRAY['admin']));

CREATE POLICY "Admins can delete their organisation"
ON public.organisations FOR DELETE TO authenticated
USING (public.has_org_role(id, auth.uid(), ARRAY['admin']));

-- =========================
-- POLICIES: organisation_membres
-- =========================
CREATE POLICY "Members can view co-members"
ON public.organisation_membres FOR SELECT TO authenticated
USING (public.is_org_member(organisation_id, auth.uid()));

-- Special case: allow inserting the very first membership row (admin bootstrap)
-- when the organisation currently has no members, or by an existing admin.
CREATE POLICY "Admins add members; bootstrap first admin"
ON public.organisation_membres FOR INSERT TO authenticated
WITH CHECK (
  public.has_org_role(organisation_id, auth.uid(), ARRAY['admin'])
  OR (
    user_id = auth.uid()
    AND role = 'admin'
    AND NOT EXISTS (
      SELECT 1 FROM public.organisation_membres m
      WHERE m.organisation_id = organisation_membres.organisation_id
    )
  )
);

CREATE POLICY "Admins update memberships"
ON public.organisation_membres FOR UPDATE TO authenticated
USING (public.has_org_role(organisation_id, auth.uid(), ARRAY['admin']))
WITH CHECK (public.has_org_role(organisation_id, auth.uid(), ARRAY['admin']));

CREATE POLICY "Admins remove members"
ON public.organisation_membres FOR DELETE TO authenticated
USING (public.has_org_role(organisation_id, auth.uid(), ARRAY['admin']));

-- =========================
-- DOSSIERS: add organisation_id + revise RLS
-- =========================
ALTER TABLE public.dossiers
  ADD COLUMN organisation_id uuid REFERENCES public.organisations(id) ON DELETE SET NULL;

CREATE INDEX idx_dossiers_organisation_id ON public.dossiers(organisation_id);

DROP POLICY IF EXISTS "Users manage their own dossiers" ON public.dossiers;

CREATE POLICY "View own or org dossiers"
ON public.dossiers FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR (organisation_id IS NOT NULL AND public.is_org_member(organisation_id, auth.uid()))
);

CREATE POLICY "Insert own dossiers"
ON public.dossiers FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (organisation_id IS NULL OR public.is_org_member(organisation_id, auth.uid()))
);

CREATE POLICY "Update own or org dossiers"
ON public.dossiers FOR UPDATE TO authenticated
USING (
  auth.uid() = user_id
  OR (organisation_id IS NOT NULL AND public.is_org_member(organisation_id, auth.uid()))
)
WITH CHECK (
  auth.uid() = user_id
  OR (organisation_id IS NOT NULL AND public.is_org_member(organisation_id, auth.uid()))
);

CREATE POLICY "Delete own or org admin/avocat dossiers"
ON public.dossiers FOR DELETE TO authenticated
USING (
  auth.uid() = user_id
  OR (organisation_id IS NOT NULL AND public.has_org_role(organisation_id, auth.uid(), ARRAY['admin','avocat']))
);

-- =========================
-- DOSSIER_SNAPSHOTS: revise RLS on same logic
-- =========================
DROP POLICY IF EXISTS "Users create snapshots for their own dossiers" ON public.dossier_snapshots;
DROP POLICY IF EXISTS "Users delete snapshots of their own dossiers" ON public.dossier_snapshots;
DROP POLICY IF EXISTS "Users view snapshots of their own dossiers" ON public.dossier_snapshots;

CREATE POLICY "View snapshots of accessible dossiers"
ON public.dossier_snapshots FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.dossiers d
    WHERE d.id = dossier_snapshots.dossier_id
      AND (
        d.user_id = auth.uid()
        OR (d.organisation_id IS NOT NULL AND public.is_org_member(d.organisation_id, auth.uid()))
      )
  )
);

CREATE POLICY "Insert snapshots of accessible dossiers"
ON public.dossier_snapshots FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.dossiers d
    WHERE d.id = dossier_snapshots.dossier_id
      AND (
        d.user_id = auth.uid()
        OR (d.organisation_id IS NOT NULL AND public.is_org_member(d.organisation_id, auth.uid()))
      )
  )
);

CREATE POLICY "Delete snapshots of accessible dossiers"
ON public.dossier_snapshots FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.dossiers d
    WHERE d.id = dossier_snapshots.dossier_id
      AND (
        d.user_id = auth.uid()
        OR (d.organisation_id IS NOT NULL AND public.has_org_role(d.organisation_id, auth.uid(), ARRAY['admin','avocat']))
      )
  )
);

-- =========================
-- DOSSIER_EVENTS (journal)
-- =========================
CREATE TABLE public.dossier_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dossier_events_dossier_id ON public.dossier_events(dossier_id, created_at DESC);

GRANT SELECT ON public.dossier_events TO authenticated;
GRANT ALL ON public.dossier_events TO service_role;
ALTER TABLE public.dossier_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View events of accessible dossiers"
ON public.dossier_events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.dossiers d
    WHERE d.id = dossier_events.dossier_id
      AND (
        d.user_id = auth.uid()
        OR (d.organisation_id IS NOT NULL AND public.is_org_member(d.organisation_id, auth.uid()))
      )
  )
);
-- No INSERT policy: writes go through service_role in server functions only.
