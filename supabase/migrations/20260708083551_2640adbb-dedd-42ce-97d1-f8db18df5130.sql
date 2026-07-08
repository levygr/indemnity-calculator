
-- ============ Rôle applicatif ============
CREATE TABLE IF NOT EXISTS public.app_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('platform_admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.app_roles TO authenticated;
GRANT ALL ON public.app_roles TO service_role;
ALTER TABLE public.app_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated can read app_roles" ON public.app_roles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.app_roles WHERE user_id = _user AND role = 'platform_admin')
$$;

CREATE OR REPLACE FUNCTION public.can_edit_referentiels(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.is_platform_admin(_user)
    OR EXISTS (SELECT 1 FROM public.organisation_membres WHERE user_id = _user AND role = 'admin')
$$;

-- Attribution initiale à rigel@vousrendreplusfort.fr s'il existe
INSERT INTO public.app_roles (user_id, role)
SELECT id, 'platform_admin' FROM auth.users
WHERE lower(email) = 'rigel@vousrendreplusfort.fr'
ON CONFLICT DO NOTHING;

-- ============ Référentiels ============
CREATE TABLE public.referentiels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  libelle text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('monolithique','incremental')),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referentiels TO authenticated;
GRANT ALL ON public.referentiels TO service_role;
ALTER TABLE public.referentiels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read referentiels" ON public.referentiels FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage referentiels" ON public.referentiels FOR ALL TO authenticated
  USING (public.can_edit_referentiels(auth.uid()))
  WITH CHECK (public.can_edit_referentiels(auth.uid()));
CREATE TRIGGER update_referentiels_updated_at BEFORE UPDATE ON public.referentiels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Éditions ============
CREATE TABLE public.editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referentiel_id uuid NOT NULL REFERENCES public.referentiels(id) ON DELETE CASCADE,
  libelle text NOT NULL,
  source text,
  statut text NOT NULL CHECK (statut IN ('brouillon','actif','archive')) DEFAULT 'brouillon',
  activated_at timestamptz,
  activated_by uuid REFERENCES auth.users(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_per_referentiel ON public.editions(referentiel_id) WHERE statut = 'actif';
CREATE INDEX editions_referentiel_idx ON public.editions(referentiel_id);
GRANT SELECT ON public.editions TO authenticated;
GRANT ALL ON public.editions TO service_role;
ALTER TABLE public.editions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read editions" ON public.editions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage editions" ON public.editions FOR ALL TO authenticated
  USING (public.can_edit_referentiels(auth.uid()))
  WITH CHECK (public.can_edit_referentiels(auth.uid()));
CREATE TRIGGER update_editions_updated_at BEFORE UPDATE ON public.editions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Valeurs ============
CREATE TABLE public.valeurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.editions(id) ON DELETE CASCADE,
  cle jsonb NOT NULL,
  valeur jsonb NOT NULL,
  commentaire text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX valeurs_edition_idx ON public.valeurs(edition_id);
CREATE INDEX valeurs_cle_idx ON public.valeurs USING gin (cle);
GRANT SELECT ON public.valeurs TO authenticated;
GRANT ALL ON public.valeurs TO service_role;
ALTER TABLE public.valeurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read valeurs" ON public.valeurs FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage valeurs" ON public.valeurs FOR ALL TO authenticated
  USING (public.can_edit_referentiels(auth.uid()))
  WITH CHECK (public.can_edit_referentiels(auth.uid()));
CREATE TRIGGER update_valeurs_updated_at BEFORE UPDATE ON public.valeurs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Dossier <-> édition ============
CREATE TABLE public.dossier_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  referentiel_id uuid NOT NULL REFERENCES public.referentiels(id) ON DELETE CASCADE,
  edition_id uuid NOT NULL REFERENCES public.editions(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dossier_id, referentiel_id)
);
CREATE INDEX dossier_editions_dossier_idx ON public.dossier_editions(dossier_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dossier_editions TO authenticated;
GRANT ALL ON public.dossier_editions TO service_role;
ALTER TABLE public.dossier_editions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members access dossier_editions" ON public.dossier_editions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dossiers d
    WHERE d.id = dossier_editions.dossier_id
      AND public.is_org_member(d.organisation_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.dossiers d
    WHERE d.id = dossier_editions.dossier_id
      AND public.is_org_member(d.organisation_id, auth.uid())
  ));
CREATE TRIGGER update_dossier_editions_updated_at BEFORE UPDATE ON public.dossier_editions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Journal d'audit ============
CREATE TABLE public.journal_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid REFERENCES public.editions(id) ON DELETE SET NULL,
  referentiel_id uuid REFERENCES public.referentiels(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX journal_audit_edition_idx ON public.journal_audit(edition_id);
CREATE INDEX journal_audit_created_at_idx ON public.journal_audit(created_at DESC);
GRANT SELECT, INSERT ON public.journal_audit TO authenticated;
GRANT ALL ON public.journal_audit TO service_role;
ALTER TABLE public.journal_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read journal" ON public.journal_audit FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins write journal" ON public.journal_audit FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_referentiels(auth.uid()) AND user_id = auth.uid());
