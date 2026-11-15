-- ==============================================================================
-- Migration 00049: Purge définitive et protection stricte contre les doublons
-- (Compréhension Orale et Compréhension Écrite)
-- ==============================================================================

-- 1. CORRECTION DE LA CLÉ ÉTRANGÈRE SUR reponses_qcm (ON DELETE CASCADE)
-- Empêche l'erreur 23503 (violation de contrainte foreign key) lors de la suppression de questions doublons.
ALTER TABLE public.reponses_qcm 
  DROP CONSTRAINT IF EXISTS reponses_qcm_question_id_fkey;

ALTER TABLE public.reponses_qcm 
  ADD CONSTRAINT reponses_qcm_question_id_fkey 
  FOREIGN KEY (question_id) 
  REFERENCES public.questions(id) 
  ON DELETE CASCADE;


-- 2. REDIRECTION DES RÉPONSES D'ÉLÈVES VERS L'ID CANONIQUE
-- Préserve l'historique de chaque candidat en rattachant ses réponses à la question qui sera conservée.

-- A. Doublons basés sur le nom de fichier audio (Compréhension Orale)
WITH ranked_audio AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY epreuve, lower(regexp_replace(audio_url, '^.*/', ''))
           ORDER BY (reference IS NOT NULL) DESC, created_at ASC, id ASC
         ) as canonical_id,
         ROW_NUMBER() OVER (
           PARTITION BY epreuve, lower(regexp_replace(audio_url, '^.*/', ''))
           ORDER BY (reference IS NOT NULL) DESC, created_at ASC, id ASC
         ) as rn
  FROM public.questions
  WHERE audio_url IS NOT NULL 
    AND TRIM(audio_url) != ''
    AND audio_url NOT LIKE '%sample%'
    AND audio_url NOT LIKE '%test%'
)
UPDATE public.reponses_qcm r
SET question_id = ra.canonical_id
FROM ranked_audio ra
WHERE r.question_id = ra.id
  AND ra.rn > 1;

-- B. Doublons basés sur le nom de fichier image (Compréhension Écrite)
WITH ranked_image AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY epreuve, lower(regexp_replace(image_url, '^.*/', ''))
           ORDER BY (reference IS NOT NULL) DESC, created_at ASC, id ASC
         ) as canonical_id,
         ROW_NUMBER() OVER (
           PARTITION BY epreuve, lower(regexp_replace(image_url, '^.*/', ''))
           ORDER BY (reference IS NOT NULL) DESC, created_at ASC, id ASC
         ) as rn
  FROM public.questions
  WHERE image_url IS NOT NULL 
    AND TRIM(image_url) != ''
    AND image_url NOT LIKE '%sample%'
    AND image_url NOT LIKE '%test%'
    AND image_url NOT LIKE '%placeholder%'
)
UPDATE public.reponses_qcm r
SET question_id = ri.canonical_id
FROM ranked_image ri
WHERE r.question_id = ri.id
  AND ri.rn > 1;

-- C. Doublons basés sur la référence (ex: CE_T01_Q01, CO_T01_Q01)
WITH ranked_ref AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY epreuve, lower(trim(reference))
           ORDER BY created_at ASC, id ASC
         ) as canonical_id,
         ROW_NUMBER() OVER (
           PARTITION BY epreuve, lower(trim(reference))
           ORDER BY created_at ASC, id ASC
         ) as rn
  FROM public.questions
  WHERE reference IS NOT NULL 
    AND TRIM(reference) != ''
)
UPDATE public.reponses_qcm r
SET question_id = rf.canonical_id
FROM ranked_ref rf
WHERE r.question_id = rf.id
  AND rf.rn > 1;

-- D. Doublons basés sur le texte exact et les propositions de réponses
WITH ranked_text AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY epreuve, trim(texte), choix::text
           ORDER BY (reference IS NOT NULL) DESC, created_at ASC, id ASC
         ) as canonical_id,
         ROW_NUMBER() OVER (
           PARTITION BY epreuve, trim(texte), choix::text
           ORDER BY (reference IS NOT NULL) DESC, created_at ASC, id ASC
         ) as rn
  FROM public.questions
  WHERE texte IS NOT NULL 
    AND TRIM(texte) != ''
)
UPDATE public.reponses_qcm r
SET question_id = rt.canonical_id
FROM ranked_text rt
WHERE r.question_id = rt.id
  AND rt.rn > 1;


-- 3. SUPPRESSION PROPRE ET DÉFINITIVE DES QUESTIONS EN DOUBLON

-- A. Suppression des doublons audio (garder le premier avec référence ou plus ancien)
DELETE FROM public.questions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY epreuve, lower(regexp_replace(audio_url, '^.*/', ''))
             ORDER BY (reference IS NOT NULL) DESC, created_at ASC, id ASC
           ) as rn
    FROM public.questions
    WHERE audio_url IS NOT NULL 
      AND TRIM(audio_url) != ''
      AND audio_url NOT LIKE '%sample%'
      AND audio_url NOT LIKE '%test%'
  ) sub
  WHERE rn > 1
);

-- B. Suppression des doublons image (garder le premier avec référence ou plus ancien)
DELETE FROM public.questions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY epreuve, lower(regexp_replace(image_url, '^.*/', ''))
             ORDER BY (reference IS NOT NULL) DESC, created_at ASC, id ASC
           ) as rn
    FROM public.questions
    WHERE image_url IS NOT NULL 
      AND TRIM(image_url) != ''
      AND image_url NOT LIKE '%sample%'
      AND image_url NOT LIKE '%test%'
      AND image_url NOT LIKE '%placeholder%'
  ) sub
  WHERE rn > 1
);

-- C. Suppression des doublons de référence exacte
DELETE FROM public.questions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY epreuve, lower(trim(reference))
             ORDER BY created_at ASC, id ASC
           ) as rn
    FROM public.questions
    WHERE reference IS NOT NULL 
      AND TRIM(reference) != ''
  ) sub
  WHERE rn > 1
);

-- D. Suppression des doublons de texte exact et choix exacts
DELETE FROM public.questions
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY epreuve, trim(texte), choix::text
             ORDER BY (reference IS NOT NULL) DESC, created_at ASC, id ASC
           ) as rn
    FROM public.questions
    WHERE texte IS NOT NULL 
      AND TRIM(texte) != ''
  ) sub
  WHERE rn > 1
);


-- 4. CRÉATION DES CONTRAINTES D'UNICITÉ PHYSIQUES

-- Index unique sur le nom de fichier audio (Compréhension Orale)
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_unique_audio_filename
ON public.questions (epreuve, (lower(regexp_replace(audio_url, '^.*/', ''))))
WHERE audio_url IS NOT NULL 
  AND TRIM(audio_url) != ''
  AND audio_url NOT LIKE '%sample%'
  AND audio_url NOT LIKE '%test%';

-- Index unique sur le nom de fichier image (Compréhension Écrite)
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_unique_image_filename
ON public.questions (epreuve, (lower(regexp_replace(image_url, '^.*/', ''))))
WHERE image_url IS NOT NULL 
  AND TRIM(image_url) != ''
  AND image_url NOT LIKE '%sample%'
  AND image_url NOT LIKE '%test%'
  AND image_url NOT LIKE '%placeholder%';

-- Index unique sur la référence canonique
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_unique_reference_clean
ON public.questions (epreuve, (lower(trim(reference))))
WHERE reference IS NOT NULL 
  AND TRIM(reference) != '';
