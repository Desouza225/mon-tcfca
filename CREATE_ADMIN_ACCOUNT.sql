-- ==============================================================================
-- MON TCFCA — NETTOYAGE & CONFIGURATION DU COMPTE ADMINISTRATEUR
-- À exécuter dans : Supabase Dashboard > SQL Editor > New Query > Run
-- ==============================================================================

-- 1. Supprimer l'ancienne entrée corrompue pour moralessedesouza@gmail.com
DELETE FROM auth.users WHERE email = 'moralessedesouza@gmail.com';
DELETE FROM public.profiles WHERE email = 'moralessedesouza@gmail.com';

-- 2. Mettre à jour le déclencheur sécurisé (ne JAMAIS faire confiance à raw_user_meta_data->>'role')
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
    COALESCE(NEW.raw_user_meta_data->>'nom', ''),
    COALESCE(NEW.raw_user_meta_data->>'prenom', ''),
    'etudiant'::public.user_role,
    false,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Assurer que le déclencheur est actif sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Permissions d'accès (révoquer anon pour protéger les données personnelles)
REVOKE ALL ON TABLE public.profiles FROM anon;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

-- ==============================================================================
-- INSTRUCTIONS APRÈS EXÉCUTION DE CE SCRIPT :
-- 1. Créez le compte dans Supabase Dashboard > Authentication > Users avec un mot de passe fort.
-- 2. Promouvez ensuite le profil en administrateur via SQL Editor :
--    UPDATE public.profiles SET role = 'admin', examen_blanc_actif = true WHERE email = 'moralessedesouza@gmail.com';
-- ==============================================================================
