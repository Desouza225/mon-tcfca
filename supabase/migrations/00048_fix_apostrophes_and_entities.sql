-- ==============================================================================
-- Migration 00048: Nettoyage des entités HTML dans les tables questions et taches
-- Remplace notamment &#8217; par l'apostrophe standard (')
-- ==============================================================================

-- 1. Nettoyage de la table questions
UPDATE public.questions
SET
  texte = REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(texte, '&#8217;', ''''),
            '&#8216;', ''''
          ),
          '&#8230;', '…'
        ),
        '&#160;', ' '
      ),
      '&rsquo;', ''''
    ),
    '&lsquo;', ''''
  )
WHERE texte IS NOT NULL AND (
  texte LIKE '%&#8217;%' OR
  texte LIKE '%&#8216;%' OR
  texte LIKE '%&#8230;%' OR
  texte LIKE '%&#160;%' OR
  texte LIKE '%&rsquo;%' OR
  texte LIKE '%&lsquo;%'
);

UPDATE public.questions
SET
  explication = REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(explication, '&#8217;', ''''),
            '&#8216;', ''''
          ),
          '&#8230;', '…'
        ),
        '&#160;', ' '
      ),
      '&rsquo;', ''''
    ),
    '&lsquo;', ''''
  )
WHERE explication IS NOT NULL AND (
  explication LIKE '%&#8217;%' OR
  explication LIKE '%&#8216;%' OR
  explication LIKE '%&#8230;%' OR
  explication LIKE '%&#160;%' OR
  explication LIKE '%&rsquo;%' OR
  explication LIKE '%&lsquo;%'
);

UPDATE public.questions
SET
  choix = REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(choix::text, '&#8217;', ''''),
            '&#8216;', ''''
          ),
          '&#8230;', '…'
        ),
        '&#160;', ' '
      ),
      '&rsquo;', ''''
    ),
    '&lsquo;', ''''
  )::jsonb
WHERE choix IS NOT NULL AND (
  choix::text LIKE '%&#8217;%' OR
  choix::text LIKE '%&#8216;%' OR
  choix::text LIKE '%&#8230;%' OR
  choix::text LIKE '%&#160;%' OR
  choix::text LIKE '%&rsquo;%' OR
  choix::text LIKE '%&lsquo;%'
);

-- 2. Nettoyage de la table taches
UPDATE public.taches
SET
  consigne = REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(consigne, '&#8217;', ''''),
            '&#8216;', ''''
          ),
          '&#8230;', '…'
        ),
        '&#160;', ' '
      ),
      '&rsquo;', ''''
    ),
    '&lsquo;', ''''
  )
WHERE consigne IS NOT NULL AND (
  consigne LIKE '%&#8217;%' OR
  consigne LIKE '%&#8216;%' OR
  consigne LIKE '%&#8230;%' OR
  consigne LIKE '%&#160;%' OR
  consigne LIKE '%&rsquo;%' OR
  consigne LIKE '%&lsquo;%'
);
