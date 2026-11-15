-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION : 00046_seed_deroulement_tcf_canada.sql
-- Description : Fiche maîtresse sur le Déroulement du TCF Canada (IRCC / Entrée Express)
-- ZÉRO BARRE VERTICALE - Mise en page épurée, durées, barème et conseils clés.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.course_sheets (
  id TEXT PRIMARY KEY,
  epreuve TEXT NOT NULL,
  niveau TEXT DEFAULT 'B2',
  titre TEXT NOT NULL,
  contenu TEXT NOT NULL,
  fichier_pdf_url TEXT,
  ordre_affichage INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.course_sheets ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'course_sheets' AND policyname = 'Allow public read access on course_sheets'
  ) THEN
    CREATE POLICY "Allow public read access on course_sheets"
      ON public.course_sheets FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

-- Insertion / Mise à jour de la fiche maîtresse sur le déroulement du TCF Canada
INSERT INTO public.course_sheets (id, epreuve, niveau, titre, ordre_affichage, contenu)
VALUES
(
  'tcf-canada-deroulement-officiel',
  'DEROULEMENT_TCF',
  'B2',
  'Déroulement du TCF Canada — Guide Complet des 4 Épreuves, Durées & Barème',
  0,
  $CONTENT$# Déroulement du TCF Canada — Guide Officiel et Stratégie Globale

> **Objectif officiel IRCC (Immigration Canada)** : Évaluer avec précision votre niveau de français sur les 4 compétences clés pour valider le palier **NCLC 7+** (Niveau de Compétence Linguistique Canadien 7 ou plus, équivalent B2 avancé), seuil qui octroie jusqu'à **50 points bonus** dans le système Entrée Express.
> 
> * **Durée totale de l'examen** : **2 heures et 47 minutes** (hors pauses et consignes).
> * **Nombre d'épreuves obligatoires** : **4 épreuves** (Compréhension Orale, Compréhension Écrite, Expression Écrite, Expression Orale).
> * **Organisme certificateur** : **France Éducation International (FEI)** pour le compte du gouvernement du Canada.
> * **Validité de l'attestation** : **2 ans** à compter de la date d'émission.

---

## 1. Vue d'ensemble des 4 Épreuves

Le TCF Canada évalue les 4 compétences dans un cadre rigoureux et standardisé :

* **1. Compréhension Orale (CO)** :
  * Durée : **35 minutes**
  * Format : **39 questions** à choix multiples (QCM à 4 propositions, une seule réponse correcte).
  * Modalité : Enregistrements audio authentiques diffusés au casque ou sur haut-parleurs.
  * Règle capitale : **Une seule et unique écoute** par document sonore !
  * Notation : Barème de 0 à 699 points (*Seuil cible NCLC 7 : 458 points*).

* **2. Compréhension Écrite (CE)** :
  * Durée : **60 minutes (1 heure)**
  * Format : **39 questions** à choix multiples (QCM sur textes courts, moyens et longs).
  * Modalité : Documents de la vie quotidienne, annonces, articles de presse et textes d'analyse.
  * Règle capitale : Gestion du temps libre sur l'ensemble des 39 questions (environ 1 min 30 par question).
  * Notation : Barème de 0 à 699 points (*Seuil cible NCLC 7 : 453 points*).

* **3. Expression Écrite (EE)** :
  * Durée : **60 minutes (1 heure)**
  * Format : **3 tâches obligatoires** de longueur et complexité croissantes (sur ordinateur ou papier selon le centre) :
    * Tâche 1 (Message / Courriel court) : 60 à 120 mots.
    * Tâche 2 (Récit d'expérience et impressions) : 120 à 150 mots.
    * Tâche 3 (Comparaison de points de vue et prise de position) : 120 à 180 mots.
  * Notation : Barème de 0 à 20 points évalué par une double correction anonyme (*Seuil cible NCLC 7 : 14/20 ou niveau B2 validé*).

* **4. Expression Orale (EO)** :
  * Durée : **12 minutes** d'entretien individuel face à un examinateur certifié (dont 2 minutes de préparation pour la tâche 2).
  * Format : **3 tâches obligatoires** :
    * Tâche 1 (Entretien dirigé sans préparation) : 2 à 3 minutes (se présenter, famille, travail, projets).
    * Tâche 2 (Interagir pour obtenir des informations) : 3 min 30 avec 2 min de préparation (poser des questions ciblées).
    * Tâche 3 (Exprimer un point de vue sans préparation) : 4 min 30 (monologue argumenté puis débat).
  * Notation : Barème de 0 à 20 points avec double évaluation (examinateur présent + écoute de l'enregistrement à FEI).

---

## 2. Le système de correspondance NCLC (Canada)

Le TCF Canada convertit vos scores en Niveaux de Compétence Linguistique Canadiens (NCLC) :

* **NCLC 4 (A2)** : Débutant autonome.
* **NCLC 5 - 6 (B1)** : Utilisateur intermédiaire (seuil fréquent pour certains programmes provinciaux ou métiers semi-qualifiés).
* **NCLC 7 (B2 / 453-458 pts ou 14/20)** : Le seuil d'or pour l'Entrée Express. Il déclenche le maximum de points pour le facteur linguistique et active les points bonus de transférabilité des compétences.
* **NCLC 8 - 9 (C1)** : Utilisateur autonome et expérimenté.
* **NCLC 10+ (C2)** : Maîtrise parfaite de la langue française.

---

## 3. Les 5 règles d'or pour réussir votre TCF Canada

1. **Ne laissez jamais de case vide en QCM (CO et CE)** :
   * Au TCF, il n'y a **aucune pénalité pour mauvaise réponse**. Si vous hésitez, procédez par élimination et cochez toujours une réponse.
2. **Respectez scrupuleusement le nombre de mots en Expression Écrite** :
   * Descendre en dessous du seuil minimal entraîne une pénalité automatique de score. Rédigez dans la fourchette exacte demandée.
3. **Mémorisez des connecteurs logiques variés** :
   * La cohérence et la fluidité textuelle pèsent lourdement dans la grille d'évaluation des examinateurs.
4. **Adoptez le registre adéquat à l'oral** :
   * Sachez alterner instantanément entre le tutoiement amical et le vouvoiement professionnel selon la consigne de la Tâche 2.
5. **Gérez le stress par la préparation active** :
   * Entraînez-vous en conditions réelles avec chronomètre sur la plateforme Mon TCFCA pour automatiser vos réflexes le jour de l'examen.$CONTENT$
)
ON CONFLICT (id) DO UPDATE SET
  epreuve = EXCLUDED.epreuve,
  niveau = EXCLUDED.niveau,
  titre = EXCLUDED.titre,
  ordre_affichage = EXCLUDED.ordre_affichage,
  contenu = EXCLUDED.contenu,
  updated_at = NOW();
