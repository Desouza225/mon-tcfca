-- Migration 00057: Ajouter pays et telephone à public.profiles et mettre à jour handle_new_user

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pays TEXT,
  ADD COLUMN IF NOT EXISTS telephone TEXT,
  ADD COLUMN IF NOT EXISTS indicatif_pays TEXT;

-- Mettre à jour la fonction handle_new_user() pour synchroniser pays, telephone et indicatif_pays
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom, role, cree_par, pays, telephone, indicatif_pays)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    'etudiant'::public.user_role,
    CASE
      WHEN NEW.raw_user_meta_data->>'cree_par' IS NOT NULL
           AND NEW.raw_user_meta_data->>'cree_par' <> ''
      THEN (NEW.raw_user_meta_data->>'cree_par')::uuid
      ELSE NULL
    END,
    COALESCE(NEW.raw_user_meta_data->>'pays', 'Côte d''Ivoire'),
    COALESCE(NEW.raw_user_meta_data->>'telephone', ''),
    COALESCE(NEW.raw_user_meta_data->>'indicatif_pays', '+225')
  )
  ON CONFLICT (id) DO UPDATE SET
    nom = COALESCE(NULLIF(EXCLUDED.nom, ''), public.profiles.nom),
    prenom = COALESCE(NULLIF(EXCLUDED.prenom, ''), public.profiles.prenom),
    pays = COALESCE(NULLIF(EXCLUDED.pays, ''), public.profiles.pays),
    telephone = COALESCE(NULLIF(EXCLUDED.telephone, ''), public.profiles.telephone),
    indicatif_pays = COALESCE(NULLIF(EXCLUDED.indicatif_pays, ''), public.profiles.indicatif_pays);

  RETURN NEW;
END;
$$;

