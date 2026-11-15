-- ==============================================================================
-- MON TCFCA — MIGRATION 00033 : FICHES DE COURS & SYSTÈME D'ABONNEMENTS
-- ==============================================================================

-- 1. TABLE DES FICHES PÉDAGOGIQUES (COURSE SHEETS)
CREATE TABLE IF NOT EXISTS public.course_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epreuve TEXT NOT NULL CHECK (
    epreuve IN ('CE', 'CO', 'EE_tache1', 'EE_tache2', 'EE_tache3', 'EO_tache1', 'EO_tache2', 'EO_tache3')
  ),
  niveau TEXT NOT NULL CHECK (
    niveau IN ('A2', 'B1', 'B2', 'C1', 'C2')
  ),
  titre TEXT NOT NULL,
  contenu TEXT NOT NULL, -- Format Markdown riche
  fichier_pdf_url TEXT,
  ordre_affichage INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour filtres rapides
CREATE INDEX IF NOT EXISTS idx_course_sheets_epreuve ON public.course_sheets(epreuve);
CREATE INDEX IF NOT EXISTS idx_course_sheets_niveau ON public.course_sheets(niveau);
CREATE INDEX IF NOT EXISTS idx_course_sheets_ordre ON public.course_sheets(ordre_affichage);

-- Activer RLS pour course_sheets
ALTER TABLE public.course_sheets ENABLE ROW LEVEL SECURITY;

-- Politiques RLS course_sheets
DROP POLICY IF EXISTS "Tout utilisateur authentifié peut lire les fiches" ON public.course_sheets;
CREATE POLICY "Tout utilisateur authentifié peut lire les fiches"
  ON public.course_sheets FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Les administrateurs peuvent tout faire sur les fiches" ON public.course_sheets;
CREATE POLICY "Les administrateurs peuvent tout faire sur les fiches"
  ON public.course_sheets FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 2. TABLE DU SUIVI DE LECTURE (COURSE SHEET READS)
CREATE TABLE IF NOT EXISTS public.course_sheet_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sheet_id UUID NOT NULL REFERENCES public.course_sheets(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_sheet UNIQUE (user_id, sheet_id)
);

CREATE INDEX IF NOT EXISTS idx_course_sheet_reads_user ON public.course_sheet_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_course_sheet_reads_sheet ON public.course_sheet_reads(sheet_id);

ALTER TABLE public.course_sheet_reads ENABLE ROW LEVEL SECURITY;

-- Politiques RLS course_sheet_reads
DROP POLICY IF EXISTS "L'étudiant peut voir ses propres lectures" ON public.course_sheet_reads;
CREATE POLICY "L'étudiant peut voir ses propres lectures"
  ON public.course_sheet_reads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "L'étudiant peut marquer une fiche comme lue ou non lue" ON public.course_sheet_reads;
CREATE POLICY "L'étudiant peut marquer une fiche comme lue ou non lue"
  ON public.course_sheet_reads FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Les administrateurs peuvent voir toutes les lectures" ON public.course_sheet_reads;
CREATE POLICY "Les administrateurs peuvent voir toutes les lectures"
  ON public.course_sheet_reads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- 3. TABLE DES PLANS D'ABONNEMENT (PLANS)
CREATE TABLE IF NOT EXISTS public.plans (
  id TEXT PRIMARY KEY, -- 'essentiel', 'standard', 'intensif', 'pack_express'
  nom TEXT NOT NULL,
  prix_fcfa INTEGER NOT NULL,
  duree_jours INTEGER NOT NULL,
  quota_ee INTEGER NOT NULL DEFAULT 0,
  quota_eo INTEGER NOT NULL DEFAULT 0,
  quota_examen_blanc INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique des plans" ON public.plans;
CREATE POLICY "Lecture publique des plans"
  ON public.plans FOR SELECT
  USING (true);

-- Pré-remplissage des 4 formules Mon TCFCA
INSERT INTO public.plans (id, nom, prix_fcfa, duree_jours, quota_ee, quota_eo, quota_examen_blanc, description)
VALUES
  ('essentiel', 'Essentiel', 10000, 30, 8, 4, 1, 'Idéal pour s''entraîner régulièrement et valider ses acquis avec 8 corrections écrites et 4 orales.'),
  ('standard', 'Standard', 18000, 30, 20, 12, 2, 'La formule la plus recommandée pour cibler les niveaux B2 et C1 avec un accompagnement complet.'),
  ('intensif', 'Intensif', 28000, 30, 50, 30, 5, 'Préparation maximale pour viser le C2 ou une progression accélérée en 30 jours.'),
  ('pack_express', 'Pack Express', 10000, 14, 20, 12, 2, 'Mêmes quotas et avantages que la formule Standard, concentrés sur 14 jours intensifs.')
ON CONFLICT (id) DO UPDATE SET
  nom = EXCLUDED.nom,
  prix_fcfa = EXCLUDED.prix_fcfa,
  duree_jours = EXCLUDED.duree_jours,
  quota_ee = EXCLUDED.quota_ee,
  quota_eo = EXCLUDED.quota_eo,
  quota_examen_blanc = EXCLUDED.quota_examen_blanc,
  description = EXCLUDED.description;

-- 4. ADAPTATION DE LA TABLE ABONNEMENTS (SANS PERTE DE DONNÉES)
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS plan_id TEXT REFERENCES public.plans(id);
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS provider TEXT; -- 'stripe', 'cinetpay'
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS quota_ee_restant INTEGER DEFAULT 0;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS quota_eo_restant INTEGER DEFAULT 0;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS quota_examen_blanc_restant INTEGER DEFAULT 0;
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.abonnements ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Synchroniser user_id avec etudiant_id si existant
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'abonnements' AND column_name = 'etudiant_id'
  ) THEN
    UPDATE public.abonnements SET user_id = etudiant_id WHERE user_id IS NULL AND etudiant_id IS NOT NULL;
  END IF;
END $$;

-- 5. ADAPTATION DE LA TABLE PAIEMENTS
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.abonnements(id);
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2);
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'XOF';
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS provider_payment_id TEXT;
ALTER TABLE public.paiements ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'en_attente';

-- Synchroniser user_id avec etudiant_id si existant
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements' AND column_name = 'etudiant_id'
  ) THEN
    UPDATE public.paiements SET user_id = etudiant_id WHERE user_id IS NULL AND etudiant_id IS NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements' AND column_name = 'montant'
  ) THEN
    UPDATE public.paiements SET amount = montant WHERE amount IS NULL AND montant IS NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements' AND column_name = 'methode'
  ) THEN
    UPDATE public.paiements SET provider = methode::text WHERE provider IS NULL AND methode IS NOT NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements' AND column_name = 'statut'
  ) THEN
    UPDATE public.paiements SET status = statut::text WHERE status IS NULL AND statut IS NOT NULL;
  END IF;
END $$;

-- 6. DONNÉES INITIALES : FICHES PÉDAGOGIQUES MODÈLES
INSERT INTO public.course_sheets (epreuve, niveau, titre, ordre_affichage, contenu)
VALUES
(
  'CE', 'B2',
  'Stratégies de lecture rapide et repérage des connecteurs logiques en Compréhension Écrite',
  1,
  '# Stratégies de lecture rapide en Compréhension Écrite (CE)

La Compréhension Écrite du TCF Canada comporte **39 questions** réparties sur **60 minutes**. La gestion du temps est le facteur déterminant de votre score.

---

### 1. La structure de l''épreuve
* **Niveau A1 - A2 (Questions 1 à 15)** : Documents très courts (SMS, affiches, menus, courriels simples). Repérage direct d''informations factuelles.
* **Niveau B1 - B2 (Questions 16 à 29)** : Articles de presse, avis consommateurs, textes d''opinion modérés. Analyse des intentions de l''auteur.
* **Niveau C1 - C2 (Questions 30 à 39)** : Textes longs, vocabulaire abstrait, figures de style, implicite et tonalité.

---

### 2. Méthode en 3 étapes
1. **Lire la consigne et la question en premier** : Identifiez les mots-clés de la question avant de plonger dans le texte.
2. **Repérer les connecteurs logiques** :
   * *Opposition / Concession* : Pourtant, cependant, néanmoins, bien que, en dépit de.
   * *Cause / Conséquence* : Étant donné que, de ce fait, par conséquent, ainsi.
   * *Addition* : De surcroît, par ailleurs, en outre.
3. **Éliminer les pièges classiques** :
   * Les distracteurs avec les mêmes mots exacts que le texte (souvent faux au niveau B2-C1).
   * Les généralisations abusives (*toujours*, *jamais*, *tous les citoyens*).

> **Conseil du Coach Mon TCFCA** : Ne passez jamais plus de 1 minute sur les 15 premières questions afin de conserver au moins 35 minutes pour les textes complexes de fin d''épreuve.'
),
(
  'CO', 'B2',
  'Anticipation et repérage des intonations en Compréhension Orale',
  2,
  '# Maîtriser la Compréhension Orale (CO)

L''épreuve de Compréhension Orale comporte **39 questions** en **35 minutes**. Vous n''entendez chaque enregistrement qu''**une seule fois** !

---

### 1. Clés d''écoute active
* **Avant l''écoute (4 secondes)** : Parcourez les 4 propositions pour identifier le champ lexical.
* **Pendant l''écoute** :
  * Notez les modalisateurs : *peut-être, sans doute, il me semble, j''ai l''impression*.
  * Écoutez l''intonation (ironie, désaccord poli, surprise, enthousiasme).
* **Après le signal sonore** : Choisissez votre réponse immédiatement. Ne doutez pas trop longtemps pour ne pas rater le début du document suivant.

---

### 2. Les types de documents sonores
1. **Micro-trottoirs et avis** : Identifier la position de chaque intervenant (pour / contre / neutre).
2. **Messages téléphoniques / Annonces publiques** : Heures, lieux, consignes et motifs de changement.
3. **Chroniques radio et interviews scientifiques** : Synthèse d''arguments et conclusions de l''expert.

> **Astuce du Coach** : Si vous manquez une question, choisissez une réponse au hasard et concentrez-vous immédiatement sur la suivante. Ne laissez jamais un blanc !'
),
(
  'EE_tache1', 'A2',
  'EE Tâche 1 : Rédiger un message court d''information ou de description (60 à 120 mots)',
  3,
  '# Méthodologie EE — Tâche 1 (Message descriptif / informatif)

La Tâche 1 évalue votre capacité à transmettre un message clair à un ou plusieurs destinataires (courriel à un ami, petite annonce, invitation, compte-rendu de séjour).

---

### Exigences officielles
* **Longueur requise** : Entre **60 et 120 mots** (Visez 80 à 100 mots).
* **Respect de la consigne** : Répondre à tous les points demandés (dates, lieux, activités, ressenti).
* **Formules d''appel et de politesse** adaptées au registre (amical ou formel).

---

### Plan type recommandé
1. **Formule d''appel** : *Bonjour Thomas,* ou *Salut Sarah,*
2. **Introduction / Contexte** : *J''espère que tu vas bien. Je t''écris pour te donner des nouvelles de mon emménagement à Montréal...*
3. **Développement (2 à 3 points clés)** :
   * Décrire la situation / le lieu.
   * Partager une expérience ou une impression.
4. **Conclusion & Invitation** : *Fais-moi savoir quand tu es disponible pour qu''on se voie. À très bientôt !*
5. **Signature** : *Amicalement, [Votre Prénom]*

> **Attention au décompte des mots** : Un mot est séparé par un espace ou une apostrophe (ex: *j''ai* = 2 mots, *c''est-à-dire* = 1 ou 4 selon l''évaluation, comptez prudemment).'
),
(
  'EE_tache2', 'B1',
  'EE Tâche 2 : Raconter une expérience et donner ses impressions (120 à 150 mots)',
  4,
  '# Méthodologie EE — Tâche 2 (Récit d''expérience & Impressions)

La Tâche 2 consiste à rédiger un article de blog, une lettre à un journal ou un témoignage partagé sur un forum.

---

### Objectifs d''évaluation
* Raconter des événements passés avec une chronologie fluide (*Passé composé, Imparfait, Plus-que-parfait*).
* Exprimer des sentiments, des réflexions et des jugements personnels.
* Respecter la fourchette de mots : **120 à 150 mots** (pénalité si moins de 120 mots !).

---

### La règle d''or des temps du passé
* **Imparfait** : Description du cadre, météo, état d''esprit, actions continues sans fin précise.
  > *Exemple : La salle était comble et l''ambiance était très chaleureuse.*
* **Passé composé** : Actions ponctuelles, événements précis et successifs.
  > *Exemple : Soudain, l''artiste est monté sur scène et a commencé à jouer.*

---

### Boîte à outils lexicale
* *Pour situer dans le temps* : Au début, peu après, soudainement, au cours de la soirée, finalement.
* *Pour exprimer son impression* : J''ai été particulièrement marqué(e) par, ce qui m''a impressionné(e), à mon grand regret, une expérience enrichissante.'
),
(
  'EE_tache3', 'B2',
  'EE Tâche 3 : Comparer deux points de vue et argumenter sa position (120 à 180 mots)',
  5,
  '# Méthodologie EE — Tâche 3 (Synthèse comparative & Argumentation)

La Tâche 3 est l''épreuve reine pour valider les niveaux B2, C1 et C2. Deux courts extraits d''opinions opposées vous sont présentés sur un sujet de société.

---

### Consigne en deux parties obligatoires
1. **Document A vs Document B** : Synthétiser objectivement les deux opinions présentées dans les documents.
2. **Votre prise de position** : Exprimer votre propre point de vue étayé par des exemples concrets et distincts des documents.

---

### Structure idéale en 3 paragraphes
* **Paragraphe 1 (Synthèse)** : *Alors que le premier document souligne les bénéfices indéniables du télétravail sur l''équilibre de vie, le second met en garde contre les risques d''isolement professionnel.*
* **Paragraphe 2 (Votre thèse & Argument 1)** : *Pour ma part, je considère que la flexibilité horaire favorise une plus grande autonomie, à condition d''instaurer un cadre clair.*
* **Paragraphe 3 (Argument 2 & Nuance)** : *En outre, il convient d''accompagner les managers pour maintenir une cohésion d''équipe solide.*
* **Conclusion courte** : *En définitive, une formule hybride semble être le compromis idéal.*

> **Critère décisif** : Ne recopiez jamais les phrases des documents sources. Reformulez systématiquement !'
),
(
  'EO_tache1', 'A2',
  'EO Tâche 1 : Entretien guidé et présentation personnelle (2 minutes)',
  6,
  '# Méthodologie Expression Orale — Tâche 1

La Tâche 1 dure **2 minutes sans temps de préparation**. C''est une conversation naturelle avec votre examinateur destinée à briser la glace.

---

### Questions fréquentes de l''examinateur
* Présentez-vous (nom, profession, parcours d''études, ville d''origine).
* Pourquoi souhaitez-vous immigrer au Canada ou vous installer au Québec ?
* Quels sont vos loisirs, vos activités du week-end ou votre dernier voyage ?

---

### Conseils clés pour marquer des points d''entrée de jeu
1. **Évitez les réponses télégraphiques** : Développez chaque réponse avec un "parce que", un exemple ou une anecdote.
2. **Soignez la clarté phonétique** : Articulez bien les finales des mots et maintenez un débit posé.
3. **Regardez l''examinateur** et adoptez une posture confiante et souriante.'
),
(
  'EO_tache2', 'B1',
  'EO Tâche 2 : Exercice en interaction — Poser des questions et obtenir des informations (3 min 30)',
  7,
  '# Méthodologie EO — Tâche 2 (Interaction et questions ciblées)

Vous disposez de **2 minutes de préparation**, puis de **3 minutes 30 d''échange** où VOUS menez l''entretien en posant une dizaine de questions à l''examinateur sur une situation donnée (location, inscription sportive, voyage organisé, achat).

---

### Stratégie pendant les 2 minutes de préparation
Rédigez des mots-clés thématiques plutôt que des phrases complètes :
* **Horaires & Dates** : *Quand ? À quelle heure ? Les week-ends ?*
* **Tarifs & Réductions** : *Combien ? Y a-t-il un tarif étudiant ou famille ? Quels modes de paiement ?*
* **Conditions & Inscription** : *Quels documents fournir ? Y a-t-il une caution ?*
* **Services inclus** : *Le matériel est-il fourni ? Le transport est-il compris ?*

---

### Varier les structures interrogatives (Crucial pour B2)
* Inversion du sujet : *Pourriez-vous m''indiquer si... ?*
* Est-ce que : *Est-ce qu''il est possible de... ?*
* Intonation montante : *Vous proposez aussi des cours le soir ?*
* Formules de politesse : *Je souhaiterais savoir si..., Auriez-vous l''amabilité de me préciser...*'
),
(
  'EO_tache3', 'B2',
  'EO Tâche 3 : Expression d''un point de vue argumenté sans préparation (4 min 30)',
  8,
  '# Méthodologie EO — Tâche 3 (Monologue argumentatif & Débat)

La Tâche 3 dure **4 minutes 30 sans préparation**. L''examinateur vous lit une question de société (ex: *L''uniforme à l''école est-il une bonne chose ? L''intelligence artificielle menace-t-elle l''emploi ?*).

---

### Déroulement chronologique
1. **Monologue (environ 2 minutes)** : Vous exposez votre opinion de façon structurée et continue.
2. **Débat avec l''examinateur (environ 2 min 30)** : L''examinateur vous pose des questions de relance pour tester votre capacité à nuancer et défendre votre thèse.

---

### Plan d''attaque immédiat
* **Introduction (20 sec)** : Reformulez le sujet et annoncez votre position générale.
* **Argument 1 + Exemple (45 sec)** : Avantage principal ou constat de départ.
* **Argument 2 + Exemple (45 sec)** : Deuxième aspect (économique, social ou éducatif).
* **Nuance / Concession (30 sec)** : *Il est vrai que certains estiment que..., toutefois...*
* **Conclusion (15 sec)** : Synthèse de votre point de vue.'
)
ON CONFLICT DO NOTHING;
