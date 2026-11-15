-- ==============================================================================
-- MON TCFCA — NETTOYAGE & CONFIGURATION DU COMPTE ADMINISTRATEUR
-- ==============================================================================

DELETE FROM auth.users WHERE email = 'moralessedesouza@gmail.com';
DELETE FROM public.profiles WHERE email = 'moralessedesouza@gmail.com';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nom, prenom, role, bloque, examen_blanc_actif)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'De Souza'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Morales'),
    CASE 
      WHEN NEW.email = 'moralessedesouza@gmail.com' THEN 'admin'::public.user_role
      ELSE COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'etudiant'::public.user_role)
    END,
    false,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nom = COALESCE(EXCLUDED.nom, public.profiles.nom),
    prenom = COALESCE(EXCLUDED.prenom, public.profiles.prenom),
    role = EXCLUDED.role,
    bloque = false,
    examen_blanc_actif = true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;
