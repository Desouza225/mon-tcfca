-- ==============================================================================
-- EDUDESK-TCF — SCRIPT DE CRÉATION DE LA BASE DE DONNÉES COMPLÈTE
-- À exécuter dans : Supabase Dashboard > SQL Editor > New Query > Run
-- ==============================================================================

-- 1. Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- -----------------------------------------------------------------------------
-- MIGRATION: 00001_create_core_schema.sql
-- -----------------------------------------------------------------------------

-- Enum types
CREATE TYPE public.user_role AS ENUM ('super_admin', 'admin', 'professeur', 'etudiant');
CREATE TYPE public.epreuve_type AS ENUM ('comprehension_oral', 'comprehension_ecrit', 'expression_ecrite', 'expression_orale');
CREATE TYPE public.niveau_cecrl AS ENUM ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
CREATE TYPE public.mode_examen AS ENUM ('entrainement', 'examen_blanc');
CREATE TYPE public.statut_correction AS ENUM ('en_attente', 'en_cours', 'corrige');
CREATE TYPE public.statut_abonnement AS ENUM ('actif', 'expire', 'annule');
CREATE TYPE public.plan_abonnement AS ENUM ('basic', 'premium');
CREATE TYPE public.statut_paiement AS ENUM ('en_attente', 'confirme', 'echoue', 'rembourse');
CREATE TYPE public.methode_paiement AS ENUM ('cinetpay', 'stripe');

-- Profiles table (synced with auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  nom text,
  prenom text,
  role public.user_role NOT NULL DEFAULT 'etudiant',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Questions bank
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epreuve public.epreuve_type NOT NULL,
  niveau public.niveau_cecrl,
  texte text,
  audio_url text,
  image_url text,
  choix jsonb, -- array of {id, texte}
  bonne_reponse text,
  explication text,
  ordre integer DEFAULT 0,
  actif boolean NOT NULL DEFAULT true,
  cree_par uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Tâches expression écrite/orale (consignes)
CREATE TABLE public.taches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  epreuve public.epreuve_type NOT NULL,
  numero_tache integer NOT NULL, -- 1, 2, 3 for écrite; 1, 3 for orale
  consigne text NOT NULL,
  duree_secondes integer, -- only for orale
  actif boolean NOT NULL DEFAULT true,
  cree_par uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.taches ENABLE ROW LEVEL SECURITY;

-- Attributions professeur-étudiant
CREATE TABLE public.attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professeur_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  etudiant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attribue_par uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (etudiant_id)
);

ALTER TABLE public.attributions ENABLE ROW LEVEL SECURITY;

-- Abonnements
CREATE TABLE public.abonnements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etudiant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan public.plan_abonnement NOT NULL,
  statut public.statut_abonnement NOT NULL DEFAULT 'actif',
  date_debut timestamptz NOT NULL DEFAULT now(),
  date_fin timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.abonnements ENABLE ROW LEVEL SECURITY;

-- Paiements
CREATE TABLE public.paiements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etudiant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  abonnement_id uuid REFERENCES public.abonnements(id),
  montant numeric(10,2) NOT NULL,
  devise text NOT NULL DEFAULT 'XOF',
  methode public.methode_paiement NOT NULL,
  statut public.statut_paiement NOT NULL DEFAULT 'en_attente',
  transaction_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.paiements ENABLE ROW LEVEL SECURITY;

-- Sessions d'examen (entraînement ou examen blanc)
CREATE TABLE public.sessions_examen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etudiant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode public.mode_examen NOT NULL,
  epreuve_actuelle public.epreuve_type,
  statut text NOT NULL DEFAULT 'en_cours', -- en_cours, termine, abandonne
  score_oral integer,
  score_ecrit integer,
  score_expression_ecrite integer,
  score_expression_orale integer,
  score_global integer,
  niveau_cecrl public.niveau_cecrl,
  correction_complete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  termine_at timestamptz
);

ALTER TABLE public.sessions_examen ENABLE ROW LEVEL SECURITY;

-- Réponses QCM
CREATE TABLE public.reponses_qcm (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions_examen(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id),
  reponse_choisie text,
  est_correcte boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reponses_qcm ENABLE ROW LEVEL SECURITY;

-- Productions expression (écrite et orale)
CREATE TABLE public.productions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions_examen(id) ON DELETE CASCADE,
  etudiant_id uuid NOT NULL REFERENCES public.profiles(id),
  epreuve public.epreuve_type NOT NULL,
  numero_tache integer NOT NULL,
  contenu_texte text,
  audio_url text,
  statut_correction public.statut_correction NOT NULL DEFAULT 'en_attente',
  professeur_id uuid REFERENCES public.profiles(id),
  score integer,
  commentaire text,
  grille_notation jsonb,
  corrige_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;

-- Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titre text NOT NULL,
  message text NOT NULL,
  lue boolean NOT NULL DEFAULT false,
  lien text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Trigger: sync new user to profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    NEW.id,
    NEW.email,
    'etudiant'::public.user_role
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_abonnements_updated_at BEFORE UPDATE ON public.abonnements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_paiements_updated_at BEFORE UPDATE ON public.paiements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- MIGRATION: 00002_create_rls_policies.sql
-- -----------------------------------------------------------------------------

-- Helper function for role checks (SECURITY DEFINER to prevent recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(uid uuid)
RETURNS public.user_role
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_super(uid uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT role IN ('admin', 'super_admin') FROM public.profiles WHERE id = uid;
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(uid uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT role = 'super_admin' FROM public.profiles WHERE id = uid;
$$;

-- Profiles RLS
CREATE POLICY "Super admin full access profiles" ON public.profiles
  FOR ALL TO authenticated USING (is_super_admin(auth.uid()));

CREATE POLICY "Admin full access profiles" ON public.profiles
  FOR ALL TO authenticated USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM get_user_role(auth.uid()));

-- Questions RLS
CREATE POLICY "Admin can manage questions" ON public.questions
  FOR ALL TO authenticated USING (is_admin_or_super(auth.uid()));

CREATE POLICY "All authenticated can read questions" ON public.questions
  FOR SELECT TO authenticated USING (actif = true);

-- Tâches RLS
CREATE POLICY "Admin can manage taches" ON public.taches
  FOR ALL TO authenticated USING (is_admin_or_super(auth.uid()));

CREATE POLICY "All authenticated can read taches" ON public.taches
  FOR SELECT TO authenticated USING (actif = true);

-- Attributions RLS
CREATE POLICY "Admin can manage attributions" ON public.attributions
  FOR ALL TO authenticated USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Professeur can view own attributions" ON public.attributions
  FOR SELECT TO authenticated USING (professeur_id = auth.uid());

CREATE POLICY "Etudiant can view own attribution" ON public.attributions
  FOR SELECT TO authenticated USING (etudiant_id = auth.uid());

-- Abonnements RLS
CREATE POLICY "Admin can manage abonnements" ON public.abonnements
  FOR ALL TO authenticated USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Student can view own abonnement" ON public.abonnements
  FOR SELECT TO authenticated USING (etudiant_id = auth.uid());

-- Paiements RLS
CREATE POLICY "Admin can manage paiements" ON public.paiements
  FOR ALL TO authenticated USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Student can view own paiements" ON public.paiements
  FOR SELECT TO authenticated USING (etudiant_id = auth.uid());

CREATE POLICY "Student can insert paiement" ON public.paiements
  FOR INSERT TO authenticated WITH CHECK (etudiant_id = auth.uid());

-- Sessions examen RLS
CREATE POLICY "Admin can view all sessions" ON public.sessions_examen
  FOR SELECT TO authenticated USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Student can manage own sessions" ON public.sessions_examen
  FOR ALL TO authenticated USING (etudiant_id = auth.uid());

CREATE POLICY "Professeur can view sessions of attributed students" ON public.sessions_examen
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.attributions a
      WHERE a.professeur_id = auth.uid() AND a.etudiant_id = sessions_examen.etudiant_id
    )
  );

-- Réponses QCM RLS
CREATE POLICY "Student can manage own reponses" ON public.reponses_qcm
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sessions_examen s WHERE s.id = session_id AND s.etudiant_id = auth.uid())
  );

CREATE POLICY "Admin can view all reponses" ON public.reponses_qcm
  FOR SELECT TO authenticated USING (is_admin_or_super(auth.uid()));

CREATE POLICY "Professeur can view reponses of attributed students" ON public.reponses_qcm
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.sessions_examen s
      JOIN public.attributions a ON a.etudiant_id = s.etudiant_id
      WHERE s.id = session_id AND a.professeur_id = auth.uid()
    )
  );

-- Productions RLS
CREATE POLICY "Student can manage own productions" ON public.productions
  FOR ALL TO authenticated USING (etudiant_id = auth.uid());

CREATE POLICY "Professeur can view and correct attributed student productions" ON public.productions
  FOR ALL TO authenticated USING (professeur_id = auth.uid());

CREATE POLICY "Admin can view all productions" ON public.productions
  FOR SELECT TO authenticated USING (is_admin_or_super(auth.uid()));

-- Notifications RLS
CREATE POLICY "User can view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (utilisateur_id = auth.uid());

CREATE POLICY "User can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (utilisateur_id = auth.uid());

CREATE POLICY "Admin can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (is_admin_or_super(auth.uid()));

CREATE POLICY "Service can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);


-- -----------------------------------------------------------------------------
-- MIGRATION: 00004_restrict_admin_role_management.sql
-- -----------------------------------------------------------------------------
-- Supprimer la policy trop permissive "Admin full access profiles"
DROP POLICY "Admin full access profiles" ON public.profiles;

-- Fonction helper : vérifier qu'un profil cible est gérable par un admin simple
CREATE OR REPLACE FUNCTION can_admin_manage_profile(target_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  -- Admin simple peut gérer uniquement les professeurs et étudiants
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = target_id
      AND role IN ('professeur', 'etudiant')
  );
$$;

-- Politique SELECT : admin voit professeurs et étudiants seulement
CREATE POLICY "Admin select non-privileged profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    AND (
      is_super_admin(auth.uid())
      OR role IN ('professeur', 'etudiant')
    )
  );

-- Politique INSERT : admin crée uniquement professeur/étudiant, super_admin crée aussi admin
CREATE POLICY "Admin insert profiles by role"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_or_super(auth.uid())
    AND (
      is_super_admin(auth.uid())
        AND role IN ('admin', 'professeur', 'etudiant')
      OR
      (NOT is_super_admin(auth.uid()))
        AND role IN ('professeur', 'etudiant')
    )
  );

-- Politique UPDATE : admin modifie uniquement professeur/étudiant et ne peut pas changer le rôle en admin
CREATE POLICY "Admin update profiles by role"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    AND (
      is_super_admin(auth.uid())
        AND role IN ('admin', 'professeur', 'etudiant')
      OR
      (NOT is_super_admin(auth.uid()))
        AND role IN ('professeur', 'etudiant')
    )
  )
  WITH CHECK (
    is_admin_or_super(auth.uid())
    AND (
      is_super_admin(auth.uid())
        AND role IN ('admin', 'professeur', 'etudiant')
      OR
      (NOT is_super_admin(auth.uid()))
        AND role IN ('professeur', 'etudiant')
    )
  );

-- Politique DELETE : admin supprime uniquement professeur/étudiant
CREATE POLICY "Admin delete profiles by role"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (
    is_admin_or_super(auth.uid())
    AND (
      is_super_admin(auth.uid())
        AND role IN ('admin', 'professeur', 'etudiant')
      OR
      (NOT is_super_admin(auth.uid()))
        AND role IN ('professeur', 'etudiant')
    )
  );

-- -----------------------------------------------------------------------------
-- MIGRATION: 00005_create_question_media_buckets.sql
-- -----------------------------------------------------------------------------
-- Bucket pour les images des questions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'question-images',
  'question-images',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
);

-- Bucket pour les fichiers audio des questions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'question-audio',
  'question-audio',
  true,
  31457280,  -- 30 MB
  ARRAY['audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/aac','audio/x-m4a']
);

-- -----------------------------------------------------------------------------
-- MIGRATION: 00006_storage_policies_question_media.sql
-- -----------------------------------------------------------------------------
-- ====================================================
-- Policies Storage : question-images
-- ====================================================

-- Lecture publique (les étudiants voient les images pendant l'examen)
CREATE POLICY "Images questions : lecture publique"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'question-images');

-- Upload : admins et super_admin seulement
CREATE POLICY "Images questions : upload admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'question-images'
    AND is_admin_or_super(auth.uid())
  );

-- Mise à jour : admins et super_admin seulement
CREATE POLICY "Images questions : update admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'question-images'
    AND is_admin_or_super(auth.uid())
  );

-- Suppression : admins et super_admin seulement
CREATE POLICY "Images questions : delete admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'question-images'
    AND is_admin_or_super(auth.uid())
  );

-- ====================================================
-- Policies Storage : question-audio
-- ====================================================

-- Lecture publique (les étudiants écoutent l'audio pendant l'examen)
CREATE POLICY "Audio questions : lecture publique"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'question-audio');

-- Upload : admins et super_admin seulement
CREATE POLICY "Audio questions : upload admin"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'question-audio'
    AND is_admin_or_super(auth.uid())
  );

-- Mise à jour : admins et super_admin seulement
CREATE POLICY "Audio questions : update admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'question-audio'
    AND is_admin_or_super(auth.uid())
  );

-- Suppression : admins et super_admin seulement
CREATE POLICY "Audio questions : delete admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'question-audio'
    AND is_admin_or_super(auth.uid())
  );

-- -----------------------------------------------------------------------------
-- MIGRATION: 00007_add_examen_blanc_actif_to_profiles.sql
-- -----------------------------------------------------------------------------

-- Ajouter la colonne examen_blanc_actif sur profiles
ALTER TABLE profiles ADD COLUMN examen_blanc_actif boolean NOT NULL DEFAULT false;

-- Politique RLS : les admins/profs/super_admins peuvent modifier examen_blanc_actif
-- (les policies existantes sur profiles couvrent déjà la lecture/écriture admin)
-- On crée une fonction helper pour vérifier si l'utilisateur peut gérer les étudiants
CREATE OR REPLACE FUNCTION can_manage_examen_blanc(target_etudiant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin', 'professeur')
  );
$$;


-- -----------------------------------------------------------------------------
-- MIGRATION: 00008_fix_profiles_rls_attribution_visibility.sql
-- -----------------------------------------------------------------------------

-- Fonction helper : un professeur peut-il lire ce profil étudiant ?
CREATE OR REPLACE FUNCTION can_prof_view_student(student_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM attributions
    WHERE professeur_id = auth.uid()
      AND etudiant_id = student_id
  );
$$;

-- Politique : professeur peut lire les profils de ses étudiants attribués
CREATE POLICY "Professeur peut voir ses etudiants attribues"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (can_prof_view_student(id));

-- Politique : étudiant peut lire le profil de son professeur attribué
CREATE POLICY "Etudiant peut voir son professeur attribue"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM attributions
      WHERE etudiant_id = auth.uid()
        AND professeur_id = profiles.id
    )
  );


-- -----------------------------------------------------------------------------
-- MIGRATION: 00009_prof_can_toggle_examen_blanc_attributed.sql
-- -----------------------------------------------------------------------------

-- Fonction helper : un professeur peut-il modifier ce profil étudiant ?
CREATE OR REPLACE FUNCTION can_prof_update_student(student_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM attributions
    WHERE professeur_id = auth.uid()
      AND etudiant_id = student_id
  );
$$;

-- Politique UPDATE : professeur peut basculer examen_blanc_actif de ses étudiants attribués
CREATE POLICY "Professeur peut modifier examen_blanc de ses etudiants"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    can_prof_update_student(id)
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'professeur'
    )
  )
  WITH CHECK (
    can_prof_update_student(id)
    AND EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'professeur'
    )
  );


-- -----------------------------------------------------------------------------
-- MIGRATION: 00010_fix_prof_rls_no_recursion.sql
-- -----------------------------------------------------------------------------

-- Fonction qui vérifie le rôle sans récursion (lit directement auth.jwt())
CREATE OR REPLACE FUNCTION is_role_professeur()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND raw_user_meta_data->>'role' = 'professeur'
  );
$$;

-- Fonction fiable basée sur la table profiles mais avec SECURITY DEFINER (bypass RLS)
CREATE OR REPLACE FUNCTION get_own_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Supprimer l'ancienne politique récursive
DROP POLICY IF EXISTS "Professeur peut modifier examen_blanc de ses etudiants" ON public.profiles;

-- Recréer sans récursion : USING utilise get_own_role() (SECURITY DEFINER) au lieu d'une sous-requête sur profiles
CREATE POLICY "Professeur peut modifier examen_blanc de ses etudiants"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    get_own_role() = 'professeur'
    AND can_prof_update_student(id)
  )
  WITH CHECK (
    get_own_role() = 'professeur'
    AND can_prof_update_student(id)
  );


-- -----------------------------------------------------------------------------
-- MIGRATION: 00011_create_productions_audio_bucket.sql
-- -----------------------------------------------------------------------------

-- Créer le bucket productions-audio (public pour faciliter la lecture par le professeur)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'productions-audio',
  'productions-audio',
  true,
  52428800, -- 50 MB
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/aac', 'audio/x-m4a']
);

-- Politique : un étudiant peut uploader dans son propre dossier (audio/<user_id>/...)
CREATE POLICY "Etudiant peut uploader son audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'productions-audio'
  AND (storage.foldername(name))[1] = 'audio'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Politique : lecture publique (bucket public, mais on ajoute quand même une policy explicite)
CREATE POLICY "Lecture publique productions-audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'productions-audio');

-- Politique : l'étudiant peut mettre à jour/remplacer son propre audio
CREATE POLICY "Etudiant peut remplacer son audio"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'productions-audio'
  AND (storage.foldername(name))[2] = auth.uid()::text
);


-- -----------------------------------------------------------------------------
-- MIGRATION: 00012_prof_can_update_sessions_examen.sql
-- -----------------------------------------------------------------------------

-- Fonction helper : le professeur peut-il mettre à jour cette session ?
CREATE OR REPLACE FUNCTION can_prof_update_session(session_etudiant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM attributions
    WHERE professeur_id = auth.uid()
      AND etudiant_id = session_etudiant_id
  );
$$;

-- Politique UPDATE : professeur peut écrire les scores de ses étudiants attribués
CREATE POLICY "Professeur peut mettre a jour les sessions de ses etudiants"
  ON public.sessions_examen
  FOR UPDATE
  TO authenticated
  USING (
    get_own_role() = 'professeur'
    AND can_prof_update_session(etudiant_id)
  )
  WITH CHECK (
    get_own_role() = 'professeur'
    AND can_prof_update_session(etudiant_id)
  );

-- Politique UPDATE admin (s'il manquait)
CREATE POLICY "Admin peut mettre a jour toutes les sessions"
  ON public.sessions_examen
  FOR UPDATE
  TO authenticated
  USING (is_admin_or_super(auth.uid()))
  WITH CHECK (is_admin_or_super(auth.uid()));


-- -----------------------------------------------------------------------------
-- MIGRATION: 00013_fix_fk_cascades_and_last_active_at.sql
-- -----------------------------------------------------------------------------

-- ─── 1. Corriger les FK NO ACTION ────────────────────────────────────────────

-- productions.etudiant_id → CASCADE (supprimer les productions de l'étudiant)
ALTER TABLE productions DROP CONSTRAINT IF EXISTS productions_etudiant_id_fkey;
ALTER TABLE productions ADD CONSTRAINT productions_etudiant_id_fkey
  FOREIGN KEY (etudiant_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- productions.professeur_id → SET NULL (garder les productions corrigées)
ALTER TABLE productions DROP CONSTRAINT IF EXISTS productions_professeur_id_fkey;
ALTER TABLE productions ADD CONSTRAINT productions_professeur_id_fkey
  FOREIGN KEY (professeur_id) REFERENCES profiles(id) ON DELETE SET NULL;

-- attributions.attribue_par → SET NULL
ALTER TABLE attributions DROP CONSTRAINT IF EXISTS attributions_attribue_par_fkey;
ALTER TABLE attributions ADD CONSTRAINT attributions_attribue_par_fkey
  FOREIGN KEY (attribue_par) REFERENCES profiles(id) ON DELETE SET NULL;

-- questions.cree_par → SET NULL (garder les questions dans la banque)
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_cree_par_fkey;
ALTER TABLE questions ADD CONSTRAINT questions_cree_par_fkey
  FOREIGN KEY (cree_par) REFERENCES profiles(id) ON DELETE SET NULL;

-- taches.cree_par → SET NULL (garder les tâches)
ALTER TABLE taches DROP CONSTRAINT IF EXISTS taches_cree_par_fkey;
ALTER TABLE taches ADD CONSTRAINT taches_cree_par_fkey
  FOREIGN KEY (cree_par) REFERENCES profiles(id) ON DELETE SET NULL;

-- ─── 2. Colonne last_active_at sur profiles ───────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz DEFAULT now();

-- Initialiser last_active_at à partir de auth.users.last_sign_in_at
UPDATE profiles p
SET last_active_at = COALESCE(u.last_sign_in_at, u.created_at)
FROM auth.users u
WHERE u.id = p.id;

-- ─── 3. Trigger : mettre à jour last_active_at à chaque connexion ─────────────
CREATE OR REPLACE FUNCTION sync_last_active_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE public.profiles
    SET last_active_at = NEW.last_sign_in_at
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_last_active_at ON auth.users;
CREATE TRIGGER trg_sync_last_active_at
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_last_active_at();


-- -----------------------------------------------------------------------------
-- MIGRATION: 00014_create_cleanup_function_and_audit.sql
-- -----------------------------------------------------------------------------

-- ─── 1. Table d'audit des suppressions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_suppressions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  profil_id         uuid        NOT NULL,
  role              text        NOT NULL,
  email             text,
  prenom            text,
  nom               text,
  raison            text        NOT NULL,
  created_at_profil timestamptz,
  last_active_at    timestamptz,
  supprime_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_suppressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin peut lire audit suppressions"
  ON audit_suppressions FOR SELECT TO authenticated
  USING (is_admin_or_super(auth.uid()));

-- ─── 2. Fonction principale de nettoyage ─────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_expired_profiles()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile     RECORD;
  v_deleted_ids uuid[] := '{}';
  v_count       int    := 0;
  v_raison      text;
  v_result      jsonb;
BEGIN
  FOR v_profile IN
    SELECT
      p.id,
      p.role,
      p.email,
      p.prenom,
      p.nom,
      p.created_at,
      p.last_active_at,
      CASE
        WHEN p.role = 'etudiant' AND p.created_at < now() - INTERVAL '1 year'
          THEN 'expiration_1_an'
        WHEN p.role = 'etudiant'
          AND COALESCE(p.last_active_at, p.created_at) < now() - INTERVAL '5 months'
          THEN 'inactivite_etudiant'
        WHEN p.role = 'professeur'
          AND COALESCE(p.last_active_at, p.created_at) < now() - INTERVAL '3 months'
          THEN 'inactivite_professeur'
      END AS raison
    FROM profiles p
    WHERE p.role IN ('etudiant', 'professeur')
      AND (
        (p.role = 'etudiant' AND p.created_at < now() - INTERVAL '1 year')
        OR (p.role = 'etudiant'
            AND COALESCE(p.last_active_at, p.created_at) < now() - INTERVAL '5 months')
        OR (p.role = 'professeur'
            AND COALESCE(p.last_active_at, p.created_at) < now() - INTERVAL '3 months')
      )
  LOOP
    -- Journaliser avant suppression
    INSERT INTO audit_suppressions (
      profil_id, role, email, prenom, nom, raison,
      created_at_profil, last_active_at
    ) VALUES (
      v_profile.id, v_profile.role, v_profile.email,
      v_profile.prenom, v_profile.nom, v_profile.raison,
      v_profile.created_at, v_profile.last_active_at
    );

    -- Supprimer le profil (CASCADE vers toutes les tables liées)
    DELETE FROM profiles WHERE id = v_profile.id;

    -- Supprimer le compte auth
    DELETE FROM auth.users WHERE id = v_profile.id;

    v_deleted_ids := array_append(v_deleted_ids, v_profile.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'deleted_count', v_count,
    'deleted_ids',   to_jsonb(v_deleted_ids),
    'executed_at',   now()
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- MIGRATION: 00015_add_bloque_column_to_profiles.sql
-- -----------------------------------------------------------------------------

-- ─── 1. Colonne bloque ────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bloque boolean NOT NULL DEFAULT false;

-- ─── 2. Fonction helper pour l'enforcement côté app ──────────────────────────
-- Retourne true si le profil courant est bloqué (utilisé dans les guards)
CREATE OR REPLACE FUNCTION is_profile_bloque(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(bloque, false) FROM profiles WHERE id = p_id;
$$;

-- ─── 3. La politique UPDATE professeur couvre déjà le champ bloque
-- "Professeur peut modifier examen_blanc de ses etudiants" s'applique à tous les champs
-- pour les étudiants attribués → OK, pas de nouvelle politique nécessaire.
-- Admin UPDATE policy couvre professeur+étudiant → OK.
-- Super admin ALL policy → OK.


-- -----------------------------------------------------------------------------
-- MIGRATION: 00016_add_current_session_token.sql
-- -----------------------------------------------------------------------------

-- Token de session unique : une seule connexion active par utilisateur
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_session_token uuid;

-- Index pour les lookups de validation rapide
CREATE INDEX IF NOT EXISTS idx_profiles_session_token
  ON profiles(current_session_token)
  WHERE current_session_token IS NOT NULL;

-- Politique SELECT : l'utilisateur peut lire son propre current_session_token
-- (déjà couvert par "Users view own profile")
-- Politique UPDATE : l'utilisateur peut mettre à jour son propre token
-- (déjà couvert par "Users update own profile")


-- -----------------------------------------------------------------------------
-- MIGRATION: 00017_fix_correction_complete_expression_only.sql
-- -----------------------------------------------------------------------------

-- Corriger les sessions existantes où correction_complete est resté false
-- alors que toutes les productions d'expression (EE/EO) sont corrigées.
-- Cela corrige le bug causé par les productions QCM (sans professeur_id)
-- qui restaient en statut 'en_attente' sans jamais être marquées 'corrige'.
UPDATE sessions_examen se
SET correction_complete = true
WHERE se.correction_complete = false
  AND se.statut = 'termine'
  -- La session doit avoir au moins une production d'expression
  AND EXISTS (
    SELECT 1 FROM productions p
    WHERE p.session_id = se.id
      AND p.epreuve IN ('expression_ecrite', 'expression_orale')
  )
  -- Aucune production d'expression ne doit être encore en attente
  AND NOT EXISTS (
    SELECT 1 FROM productions p
    WHERE p.session_id = se.id
      AND p.epreuve IN ('expression_ecrite', 'expression_orale')
      AND p.statut_correction != 'corrige'
  );


-- -----------------------------------------------------------------------------
-- MIGRATION: 00018_cleanup_expired_profiles_dry_run.sql
-- -----------------------------------------------------------------------------
-- Correction 5 — Ajouter le mode dry_run à cleanup_expired_profiles
-- dry_run = true → SELECT seulement, aucun DELETE ni INSERT dans audit_suppressions
-- dry_run = false → comportement actuel (DELETE + audit) — valeur par défaut
CREATE OR REPLACE FUNCTION public.cleanup_expired_profiles(dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile     RECORD;
  v_deleted_ids uuid[] := '{}';
  v_count       int    := 0;
  v_result      jsonb;
BEGIN
  FOR v_profile IN
    SELECT
      p.id,
      p.role,
      p.email,
      p.prenom,
      p.nom,
      p.created_at,
      p.last_active_at,
      CASE
        WHEN p.role = 'etudiant' AND p.created_at < now() - INTERVAL '1 year'
          THEN 'expiration_1_an'
        WHEN p.role = 'etudiant'
          AND COALESCE(p.last_active_at, p.created_at) < now() - INTERVAL '5 months'
          THEN 'inactivite_etudiant'
        WHEN p.role = 'professeur'
          AND COALESCE(p.last_active_at, p.created_at) < now() - INTERVAL '3 months'
          THEN 'inactivite_professeur'
      END AS raison
    FROM profiles p
    WHERE p.role IN ('etudiant', 'professeur')
      AND (
        (p.role = 'etudiant' AND p.created_at < now() - INTERVAL '1 year')
        OR (p.role = 'etudiant'
            AND COALESCE(p.last_active_at, p.created_at) < now() - INTERVAL '5 months')
        OR (p.role = 'professeur'
            AND COALESCE(p.last_active_at, p.created_at) < now() - INTERVAL '3 months')
      )
  LOOP
    IF dry_run THEN
      -- Mode simulation : on collecte uniquement, aucune modification
      v_deleted_ids := array_append(v_deleted_ids, v_profile.id);
      v_count := v_count + 1;
    ELSE
      -- Mode réel : journaliser puis supprimer
      INSERT INTO audit_suppressions (
        profil_id, role, email, prenom, nom, raison,
        created_at_profil, last_active_at
      ) VALUES (
        v_profile.id, v_profile.role, v_profile.email,
        v_profile.prenom, v_profile.nom, v_profile.raison,
        v_profile.created_at, v_profile.last_active_at
      );

      DELETE FROM profiles WHERE id = v_profile.id;
      DELETE FROM auth.users WHERE id = v_profile.id;

      v_deleted_ids := array_append(v_deleted_ids, v_profile.id);
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'deleted_count', v_count,
    'deleted_ids',   to_jsonb(v_deleted_ids),
    'executed_at',   now(),
    'dry_run',       dry_run
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- MIGRATION: 00019_add_cree_par_to_profiles_cascade_block.sql
-- -----------------------------------------------------------------------------

-- Ajouter cree_par sur profiles : l'admin qui a créé cet utilisateur
-- Nécessaire pour le blocage en cascade : si l'admin est bloqué,
-- tous les utilisateurs qu'il a créés (étudiants, professeurs) sont aussi bloqués.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cree_par uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Fonction helper pour vérifier si un profil est bloqué directement OU par son admin créateur
CREATE OR REPLACE FUNCTION is_access_blocked(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = p_id
    AND (
      -- L'utilisateur lui-même est bloqué
      p.bloque = true
      OR
      -- Ou son admin créateur est bloqué
      EXISTS (
        SELECT 1 FROM profiles admin_p
        WHERE admin_p.id = p.cree_par
        AND admin_p.bloque = true
      )
    )
  );
$$;


-- -----------------------------------------------------------------------------
-- MIGRATION: 00020_add_pending_productions_count_function.sql
-- -----------------------------------------------------------------------------

-- Fonction RPC : compte les productions en attente de correction
-- pour un étudiant, une épreuve et le mode entraînement.
-- Utilisée par le frontend pour bloquer l'accès si ≥ 2 en attente.
CREATE OR REPLACE FUNCTION count_pending_expression_entrainement(
  p_etudiant_id uuid,
  p_epreuve text
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM productions pr
  JOIN sessions_examen se ON se.id = pr.session_id
  WHERE pr.etudiant_id = p_etudiant_id
    AND pr.epreuve = p_epreuve::epreuve_type
    AND pr.statut_correction <> 'corrige'
    AND se.mode = 'entrainement';
$$;

-- Accorder l'exécution aux utilisateurs authentifiés
GRANT EXECUTE ON FUNCTION count_pending_expression_entrainement(uuid, text) TO authenticated;


-- -----------------------------------------------------------------------------
-- MIGRATION: 00021_fix_count_pending_by_session_not_production.sql
-- -----------------------------------------------------------------------------

-- Correction : compter les SESSIONS distinctes en attente, pas les productions individuelles.
-- Une session expression_orale avec 2 tâches = 1 épreuve soumise, pas 2.
-- La limite de 2 s'applique à 2 soumissions (sessions), indépendamment pour chaque épreuve.
CREATE OR REPLACE FUNCTION count_pending_expression_entrainement(
  p_etudiant_id uuid,
  p_epreuve text
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(DISTINCT pr.session_id)::integer
  FROM productions pr
  JOIN sessions_examen se ON se.id = pr.session_id
  WHERE pr.etudiant_id = p_etudiant_id
    AND pr.epreuve = p_epreuve::epreuve_type
    AND pr.statut_correction <> 'corrige'
    AND se.mode = 'entrainement';
$$;


-- -----------------------------------------------------------------------------
-- MIGRATION: 00022_add_statut_refuse_and_raison_refus.sql
-- -----------------------------------------------------------------------------

-- Ajouter la valeur 'refuse' au type enum statut_correction
ALTER TYPE statut_correction ADD VALUE IF NOT EXISTS 'refuse';

-- Ajouter la colonne raison_refus sur les productions
ALTER TABLE productions ADD COLUMN IF NOT EXISTS raison_refus text DEFAULT NULL;


-- -----------------------------------------------------------------------------
-- MIGRATION: 00023_fix_count_pending_exclude_refuse.sql
-- -----------------------------------------------------------------------------

-- Correction : une production refusée ne compte PAS comme "en attente" de correction.
-- L'étudiant doit pouvoir en soumettre une nouvelle immédiatement après un refus.
CREATE OR REPLACE FUNCTION count_pending_expression_entrainement(
  p_etudiant_id uuid,
  p_epreuve text
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COUNT(DISTINCT pr.session_id)::integer
  FROM productions pr
  JOIN sessions_examen se ON se.id = pr.session_id
  WHERE pr.etudiant_id = p_etudiant_id
    AND pr.epreuve = p_epreuve::epreuve_type
    AND pr.statut_correction = 'en_attente'
    AND se.mode = 'entrainement';
$$;


-- -----------------------------------------------------------------------------
-- MIGRATION: 00024_add_duree_expression_ecrite.sql
-- -----------------------------------------------------------------------------
-- Durée passée par l'étudiant sur l'épreuve d'expression écrite (en secondes)
ALTER TABLE sessions_examen
  ADD COLUMN duree_expression_ecrite integer DEFAULT NULL;


-- -----------------------------------------------------------------------------
-- MIGRATION: 00025_add_tache_column_to_questions.sql
-- -----------------------------------------------------------------------------
ALTER TABLE questions ADD COLUMN IF NOT EXISTS tache text;

-- -----------------------------------------------------------------------------
-- MIGRATION: 99002_seed_taches.sql
-- -----------------------------------------------------------------------------
-- Seed: taches (5 rows) — généré automatiquement

INSERT INTO taches (id, epreuve, numero_tache, consigne, duree_secondes, actif, cree_par, created_at) VALUES
('a4e293f7-e536-4a32-9142-c9cfd5ba4963','expression_ecrite'::epreuve_type,1,'Rédigez un courriel à un ami pour lui présenter votre nouveau logement au Canada. Décrivez le quartier, les transports disponibles et ce que vous appréciez dans votre nouvel environnement. (Environ 60-80 mots)',NULL,true,NULL,'2026-06-01T15:54:30.86005+00:00'),
('5443e33a-a96d-4589-8a67-ad177cb0e5cc','expression_ecrite'::epreuve_type,2,'Vous souhaitez vous inscrire à un club de sport dans votre ville. Rédigez un courriel au responsable pour vous présenter, expliquer vos motivations et demander des informations sur les modalités d''inscription. (Environ 80-100 mots)',NULL,true,NULL,'2026-06-01T15:54:30.86005+00:00'),
('1104e370-d24f-41a4-8060-26bb19620d1b','expression_ecrite'::epreuve_type,3,'Vous avez lu un article sur les avantages et inconvénients du télétravail. Rédigez un texte dans lequel vous donnez votre opinion sur ce sujet en vous appuyant sur des exemples concrets. (Environ 120-150 mots)',NULL,true,NULL,'2026-06-01T15:54:30.86005+00:00'),
('4aa1f87a-33bf-4166-b951-af18927a8b73','expression_orale'::epreuve_type,1,'Parlez de votre expérience dans l''apprentissage du français. Quelles méthodes utilisez-vous ? Quelles sont vos difficultés et vos succès ? Donnez des exemples précis de votre parcours.',120,true,NULL,'2026-06-01T15:54:30.86005+00:00'),
('46f929d7-8a14-4620-9c3a-9266bb9ef2bb','expression_orale'::epreuve_type,3,'Vous devez présenter les avantages et les inconvénients de vivre dans une grande ville au Canada (comme Montréal ou Toronto) par rapport à une ville moyenne. Développez votre argumentation en donnant des exemples concrets tirés de la réalité canadienne ou de votre expérience personnelle.',270,true,NULL,'2026-06-01T15:54:30.86005+00:00');

