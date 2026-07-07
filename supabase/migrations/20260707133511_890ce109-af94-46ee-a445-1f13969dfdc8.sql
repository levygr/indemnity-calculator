CREATE TABLE public.dossier_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom text NOT NULL,
  data jsonb NOT NULL,
  synthese jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX dossier_snapshots_dossier_id_idx ON public.dossier_snapshots(dossier_id);
CREATE INDEX dossier_snapshots_user_id_idx ON public.dossier_snapshots(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dossier_snapshots TO authenticated;
GRANT ALL ON public.dossier_snapshots TO service_role;

ALTER TABLE public.dossier_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view snapshots of their own dossiers"
  ON public.dossier_snapshots FOR SELECT
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.dossiers d
      WHERE d.id = dossier_snapshots.dossier_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users create snapshots for their own dossiers"
  ON public.dossier_snapshots FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.dossiers d
      WHERE d.id = dossier_snapshots.dossier_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "Users delete snapshots of their own dossiers"
  ON public.dossier_snapshots FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.dossiers d
      WHERE d.id = dossier_snapshots.dossier_id AND d.user_id = auth.uid()
    )
  );