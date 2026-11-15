-- ============================================================================
-- Migration 00058: Création du bucket public avatars pour les photos de profil
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

DROP POLICY IF EXISTS "Lecture publique avatars" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateur peut uploader son avatar" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateur peut modifier son avatar" ON storage.objects;
DROP POLICY IF EXISTS "Utilisateur peut supprimer son avatar" ON storage.objects;

CREATE POLICY "Lecture publique avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Utilisateur peut uploader son avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Utilisateur peut modifier son avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Utilisateur peut supprimer son avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Garantir que l'utilisateur authentifié peut mettre à jour son propre profil (dont avatar_url)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Users update own profile'
  ) THEN
    CREATE POLICY "Users update own profile"
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- RPC sécurisée permettant à tout utilisateur authentifié de mettre à jour sa propre photo de profil
CREATE OR REPLACE FUNCTION public.update_own_avatar(p_avatar_url text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié.';
  END IF;

  UPDATE public.profiles
  SET avatar_url = p_avatar_url,
      updated_at = now()
  WHERE id = v_uid;

  RETURN p_avatar_url;
END;
$$;

REVOKE ALL ON FUNCTION public.update_own_avatar(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.update_own_avatar(text) TO authenticated;
