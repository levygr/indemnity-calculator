
CREATE TABLE public.taux_legal (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debut date NOT NULL,
  fin date NOT NULL,
  taux_particulier numeric NULL,
  taux_autres numeric NULL,
  reference text NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, debut)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.taux_legal TO authenticated;
GRANT ALL ON public.taux_legal TO service_role;

ALTER TABLE public.taux_legal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own taux legal"
  ON public.taux_legal FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_taux_legal_updated_at
  BEFORE UPDATE ON public.taux_legal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
