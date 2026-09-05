-- ==============================================================================
-- EDUDESK-TCF — FIX GESTION DES UTILISATEURS & AUTO-CONFIRMATION DES COMPTES
-- À exécuter dans : Supabase Dashboard > SQL Editor > New Query > Run
-- ==============================================================================

-- 1. Trigger amélioré pour synchroniser automatiquement les métadonnées lors de la création d'un utilisateur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_role public.user_role := 'etudiant';
BEGIN
  -- Déterminer le rôle depuis raw_user_meta_data si présent
  IF NEW.raw_user_meta_data IS NOT NULL AND NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
    BEGIN
      v_role := (NEW.raw_user_meta_data->>'role')::public.user_role;
    EXCEPTION WHEN OTHERS THEN
      v_role := 'etudiant'::public.user_role;
    END;
  END IF;

  INSERT INTO public.profiles (id, email, role, nom, prenom)
  VALUES (
    NEW.id,
    NEW.email,
    v_role,
    NEW.raw_user_meta_data->>'nom',
    NEW.raw_user_meta_data->>'prenom'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nom = COALESCE(EXCLUDED.nom, profiles.nom),
    prenom = COALESCE(EXCLUDED.prenom, profiles.prenom),
    role = COALESCE(EXCLUDED.role, profiles.role);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Trigger pour auto-confirmer l'email des nouveaux utilisateurs (évite les blocages SMTP)
CREATE OR REPLACE FUNCTION public.auto_confirm_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirm_email ON auth.users;
CREATE TRIGGER trg_auto_confirm_email
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user_email();

-- Confirmer tous les utilisateurs existants au cas où
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;

-- 3. Fonction RPC sécurisée pour la suppression d'un utilisateur par un Admin / Super Admin
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id UUID;
  caller_role public.user_role;
  target_role public.user_role;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Non authentifié';
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = caller_id;
  IF caller_role IS NULL OR caller_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Accès refusé. Rôle administrateur requis.';
  END IF;

  SELECT role INTO target_role FROM public.profiles WHERE id = target_user_id;
  IF target_role = 'super_admin' THEN
    RAISE EXCEPTION 'Impossible de supprimer un Super Administrateur.';
  END IF;

  IF caller_role = 'admin' AND target_role = 'admin' THEN
    RAISE EXCEPTION 'Un administrateur ne peut pas supprimer un autre administrateur.';
  END IF;

  -- Supprimer directement dans auth.users (cascade FK supprimera profil et données associées)
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;

-- 4. Politiques RLS pour s'assurer que les admins et super_admins ont tous les droits sur profiles
DO $$
BEGIN
  -- S'assurer que le Super Admin a tous les droits
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Super admin full access profiles'
  ) THEN
    CREATE POLICY "Super admin full access profiles" ON public.profiles
      FOR ALL TO authenticated
      USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin');
  END IF;

  -- S'assurer que l'Admin a tous les droits sur les utilisateurs non-admins
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Admin full access non-admin profiles'
  ) THEN
    CREATE POLICY "Admin full access non-admin profiles" ON public.profiles
      FOR ALL TO authenticated
      USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
        AND role NOT IN ('admin', 'super_admin')
      );
  END IF;
END $$;
