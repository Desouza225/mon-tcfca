-- ==============================================================================
-- MON TCFCA — MIGRATION 00043 : CRÉATION DE LA TABLE & DES 4 FICHES D'EXPRESSION ÉCRITE
-- ==============================================================================

-- 1. CRÉATION DE LA TABLE DES FICHES SI ELLE N'EXISTE PAS ENCORE
CREATE TABLE IF NOT EXISTS public.course_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epreuve TEXT NOT NULL,
  niveau TEXT NOT NULL DEFAULT 'B2',
  titre TEXT NOT NULL,
  contenu TEXT NOT NULL,
  fichier_pdf_url TEXT,
  ordre_affichage INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mettre à jour la contrainte d'épreuves pour accepter 'EE' et 'EO'
ALTER TABLE public.course_sheets DROP CONSTRAINT IF EXISTS course_sheets_epreuve_check;
ALTER TABLE public.course_sheets ADD CONSTRAINT course_sheets_epreuve_check
  CHECK (epreuve IN ('CE', 'CO', 'EE', 'EE_tache1', 'EE_tache2', 'EE_tache3', 'EO', 'EO_tache1', 'EO_tache2', 'EO_tache3'));

CREATE INDEX IF NOT EXISTS idx_course_sheets_epreuve ON public.course_sheets(epreuve);
CREATE INDEX IF NOT EXISTS idx_course_sheets_ordre ON public.course_sheets(ordre_affichage);

ALTER TABLE public.course_sheets ENABLE ROW LEVEL SECURITY;

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

-- 2. CRÉATION DE LA TABLE DE SUIVI DE LECTURE
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

-- 3. SUPPRESSION DES ANCIENNES FICHES EE RÉSIDUELLES
DELETE FROM public.course_sheets
WHERE epreuve IN ('EE', 'EE_tache1', 'EE_tache2', 'EE_tache3');

-- 4. INSERTION STRICTEMENT DES 4 FICHES OFFICIELLES EXCLUSIVES
INSERT INTO public.course_sheets (id, epreuve, niveau, titre, ordre_affichage, contenu)
VALUES
(
  'ee000000-0000-0000-0000-000000000001',
  'EE',
  'B2',
  'Expression Écrite — Épreuve Totale & Vue d''ensemble (Méthode Complète)',
  1,
  $CONTENT$# EXPRESSION ÉCRITE — TCF Canada (Épreuve Totale)

> **Objectif officiel** : Savoir écrire en français de façon claire, organisée et argumentée pour décrocher le palier **NCLC 7+** (Entrée Express Canada).

**Durée totale** : 60 minutes pour 3 tâches obligatoires à l'écrit.  
**Ce qu'on évalue** : 3 piliers essentiels — votre niveau de langue, votre organisation et votre capacité d'adaptation à la situation de communication.

---

## Vue d'ensemble : ce qu'on vous demande

À l'épreuve d'expression écrite, on vous demande de :
* **Vous exprimer clairement** sur un sujet donné ;
* **Donner des informations précises** en lien avec le sujet ;
* **Argumenter, décrire, expliquer ou reformuler** ;
* **Écrire un texte cohérent, bien organisé** (attention au vocabulaire, à la grammaire, à la syntaxe) ;
* **Comparer des points de vue** (*uniquement en tâche 3*).

---

## Comment est-on noté ?

Deux examinateurs vous notent séparément. Ils regardent 3 choses :
1. **Votre niveau de langue** → grammaire, syntaxe, vocabulaire varié et précis.
2. **Votre organisation** → un texte fluide, avec des idées bien reliées entre elles.
3. **Votre adaptation** → savoir écrire différemment selon la situation (un ami ≠ un collègue ≠ un inconnu).

---

## Tableau récapitulatif des 3 tâches

* **Tâche 1 (Message)** : **60 à 120 mots** (10 minutes conseillées) — Répondre précisément à une situation de communication en racontant, décrivant ou expliquant.
* **Tâche 2 (Article / Note)** : **120 à 150 mots** (20 minutes conseillées) — Raconter une expérience vécue et exprimer obligatoirement son ressenti.
* **Tâche 3 (Synthèse & Argumentation)** : **120 à 180 mots** (30 minutes conseillées) — Comparer 2 avis opposés (synthèse neutre) puis argumenter son opinion personnelle.

---

## Checklist avant de rendre sa copie

* [ ] Ai-je respecté le nombre de mots demandé (*ni trop peu, ni trop*) ?
* [ ] Ai-je bien identifié le destinataire (*tu/vous, registre adapté*) ?
* [ ] Ai-je une introduction, un développement et une conclusion clairs ?
* [ ] Ai-je utilisé des connecteurs logiques variés (*cependant, par conséquent, d'une part...*) ?
* [ ] Ai-je vérifié mes temps verbaux (*passé composé/imparfait, subjonctif si besoin*) ?
* [ ] **(Tâche 3)** Ai-je bien séparé la synthèse neutre et mon opinion personnelle ?
$CONTENT$
),
(
  'ee000000-0000-0000-0000-000000000002',
  'EE_tache1',
  'B2',
  'Expression Écrite — Tâche 1 : Écrire un message (60 à 120 mots)',
  2,
  $CONTENT$# Expression Écrite — Tâche 1 : Écrire un message

## Repères officiels de l'épreuve
* **Format** : Texte narratif, descriptif ou explicatif (*message personnel, courriel, petite annonce*).
* **Longueur exigée** : **60 à 120 mots** *(cible recommandée : 80 à 100 mots)*.
* **Temps conseillé** : **10 minutes**.
* **Objectif clé** : Écrire à une ou plusieurs personnes précises et raconter, décrire ou expliquer une situation.

---

## Exemple de consigne
> *« Vous avez assisté à une fête d'anniversaire surprise organisée pour un ami commun. Vous avez adoré la soirée et vous écrivez à Julie, qui n'a pas pu venir, pour tout lui raconter. »*

---

## Méthode en 3 questions
1. **À qui j'écris ?** → Un ami : *"tu"*, langage courant. Un inconnu / collègue : *"vous"*, langage plus soutenu.
2. **Qu'est-ce qu'on me demande ?** → Raconter (*passé composé*), décrire (*imparfait*) ou expliquer (*donner des raisons*).
3. **Comment je commence et je termine ?** → Toujours une salutation au début et une formule de politesse à la fin.

---

## La structure à suivre (5 étapes)
1. **Salutation** :
   * *Formel* : `Madame, Monsieur,` / `Monsieur le Directeur,`
   * *Informel* : `Salut Julie,` / `Chère Julie,`
2. **Introduction** : Dites pourquoi vous écrivez :
   * *« Je t'écris pour te raconter la fête d'hier... »*
3. **Corps du message** : Répondez à la consigne : racontez, décrivez, donnez des détails (*quand, où, avec qui*).
4. **Conclusion** : Demandez une réponse ou proposez une action :
   * *« Dis-moi si tu peux venir »*.
5. **Formule de politesse & Signature** :
   * *Cordialement / À bientôt / Bises + votre prénom*.

---

## Trois réflexes à avoir en tâche 1
* **Alternez** Passé Composé (*actions précises*) et Imparfait (*descriptions, habitudes*).
* **Variez vos connecteurs** : *Cependant, Malgré tout, Heureusement, Par la suite*.
* **Évitez les mots trop simples** (*"bien", "beau"*) → préférez *magnifique, impressionnant, enrichissant*.

---

## Exemple de copie modèle (85 mots)

Salut Julie,

Je t'écris pour te raconter la fête d'anniversaire surprise de Thomas hier soir. C'était tout simplement magnifique ! Nous étions une vingtaine d'amis réunis dans un salon très chaleureux. Quand Thomas est entré, il était sans voix tellement la surprise était réussie. Nous avons partagé un délicieux repas et dansé jusqu'au bout de la nuit.

Tu nous as beaucoup manqué ! Fais-moi signe dès que tu es libre pour qu'on se voie.

Bises,  
Alexandre
$CONTENT$
),
(
  'ee000000-0000-0000-0000-000000000003',
  'EE_tache2',
  'B2',
  'Expression Écrite — Tâche 2 : Écrire un article ou une note (120 à 150 mots)',
  3,
  $CONTENT$# Expression Écrite — Tâche 2 : Écrire un article ou une note

## Repères officiels de l'épreuve
* **Format** : Article ou note racontant une expérience et donnant un avis.
* **Longueur exigée** : **120 à 150 mots** *(pénalité immédiate si moins de 120 mots !)*.
* **Temps conseillé** : **20 minutes**.
* **Objectif clé** : Raconter une expérience à plusieurs personnes **ET** partager obligatoirement votre ressenti ou votre opinion.

---

## Exemple de consigne
> *« Vous avez rencontré un client potentiel pour votre entreprise. Vous envoyez une note à votre équipe pour raconter le rendez-vous et donner votre sentiment sur cette future collaboration. »*

---

## Ce qui change par rapport à la tâche 1
* **Le texte est plus long** → il faut plus de détails et plus d'adjectifs précis.
* **On attend obligatoirement votre ressenti** (*joie, surprise, déception...*) : c'est nouveau et **essentiel ici**.
* **Le registre dépend du destinataire** : *"vous"* formel pour une équipe/collègues, *"tu"* pour des proches.

---

## La structure à suivre (4 étapes)
1. **Introduction** : Posez le décor (*où, quand, avec qui*).
2. **Développement** : Racontez les faits dans l'ordre chronologique, avec des adjectifs précis.
3. **Sentiments / impressions** : Dites ce que vous avez ressenti. **Étape indispensable dans cette tâche !**
4. **Conclusion** : Terminez par un bilan ou une recommandation.

---

## Trois réflexes à avoir en tâche 2
* **Alternez** Passé Composé (*actions précises*) et Imparfait (*descriptions, habitudes*).
* **Variez vos connecteurs** : *Cependant, Malgré tout, Heureusement, Par la suite, En premier lieu*.
* **Évitez les mots trop simples** (*"bien", "beau"*) → préférez *stimulant, prometteur, enrichissant, convivial*.

---

## Exemple de copie modèle (135 mots)

Chers collègues,

Je tiens à vous faire un retour sur mon entrevue d'hier matin avec la direction du groupe Horizon. Le rendez-vous s'est déroulé dans une ambiance particulièrement constructive et professionnelle.

Après avoir présenté notre proposition technique, nous avons longuement échangé sur leurs attentes spécifiques en matière de transition numérique. J'ai été agréablement surpris par leur réactivité et leur intérêt marqué pour notre expertise.

Sur le plan personnel, je suis très enthousiaste quant à cette future collaboration. Leurs dirigeants partagent nos valeurs de rigueur et d'innovation, ce qui laisse présager un partenariat solide et fructueux à long terme.

Par conséquent, je vous invite à préparer dès maintenant le calendrier de déploiement afin de finaliser l'accord lors de notre prochaine séance de travail vendredi.

Bien cordialement,  
Alexandre
$CONTENT$
),
(
  'ee000000-0000-0000-0000-000000000004',
  'EE_tache3',
  'B2',
  'Expression Écrite — Tâche 3 : Comparer deux points de vue et donner son avis (120 à 180 mots)',
  4,
  $CONTENT$# Expression Écrite — Tâche 3 : Comparer deux points de vue et donner son avis

## Repères officiels de l'épreuve
* **Format** : Synthèse comparative neutre suivie d'une prise de position personnelle argumentée.
* **Longueur exigée** : **120 à 180 mots** *(40-60 mots pour la comparaison + 80-120 mots pour votre opinion)*.
* **Temps conseillé** : **30 minutes**.
* **Objectif clé** : Résumer deux opinions puis donner un avis personnel argumenté sur un sujet de société.

> **Sujets de société possibles** : la santé, les loisirs, le monde professionnel, l'environnement, la consommation, les inégalités, l'éducation, le télétravail...

---

## La tâche en 2 parties bien distinctes

### Partie 1 — Synthèse (40 à 60 mots)
* Reformulez les 2 opinions, **SANS donner votre avis**.
* ⚠️ **Interdit d'utiliser "je" ou "moi" ici. Restez neutre.**
* Expressions utiles : *« Selon le premier document... »*, *« Tandis que le second souligne... »*, *« D'une part... d'autre part... »*.

### Partie 2 — Votre opinion (80 à 120 mots)
* Donnez clairement votre avis (*« Personnellement, je pense que... »*).
* Développez **2 arguments solides**, chacun avec un exemple concret.
* Terminez par une phrase de conclusion nette.

---

## Les 3 règles d'or de la tâche 3
1. **Ne recopiez jamais une phrase des documents sources** → reformulez toujours avec vos propres mots.
2. **Ne résumez pas document 1 puis document 2 séparément** → comparez-les, mettez leurs idées face à face.
3. **Donnez toujours un exemple concret pour chaque argument** (*vos expériences personnelles suffisent, pas besoin de statistiques*).

---

## Attention au calibrage !
* Moins de 120 mots au total = note fortement pénalisée.
* Une synthèse trop longue par rapport à l'opinion = déséquilibre pénalisé.
* Utilisez des connecteurs variés : *Certes, Néanmoins, Par conséquent, D'une part / D'autre part, En revanche*.

---

## Exemple de copie modèle (150 mots)

Alors que le premier document fait l'éloge du télétravail en mettant en avant le gain de temps et l'autonomie des salariés, le second insiste sur les risques d'isolement social et la difficulté à déconnecter.

Pour ma part, j'estime que le travail à distance constitue une avancée majeure pour la qualité de vie, à condition qu'il soit encadré avec rigueur. En premier lieu, la réduction des trajets quotidiens diminue considérablement le stress et la fatigue ; dans mon expérience personnelle, cela m'a permis d'augmenter significativement ma concentration.

Néanmoins, le maintien d'un lien physique reste indispensable pour préserver la cohésion d'équipe et éviter le sentiment de solitude chez les nouveaux collaborateurs.

En définitive, une formule hybride de deux à trois jours par semaine me semble être le compromis le plus équilibré et durable.
$CONTENT$
),
(
  'ee000000-0000-0000-0000-000000000005',
  'EE',
  'B2',
  'Connecteurs Logiques — Les mots de liaison indispensables pour structurer vos écrits',
  5,
  $CONTENT$# Connecteurs Logiques — Structurer et fluidifier vos productions

Au TCF Canada, les examinateurs évaluent directement votre capacité à relier vos idées avec fluidité et précision (critère déterminant : **Cohérence & Organisation textuelle**). L'emploi judicieux de connecteurs variés est indispensable pour atteindre les paliers **B2, C1 et C2 (NCLC 7+)**.

---

## 1. Introduire le sujet et poser les bases

Utilisez ces formules pour débuter votre texte ou ouvrir un paragraphe :
* **En premier lieu / Tout d'abord** : Pose la première pierre de votre réflexion.
* **Il convient tout d'abord de souligner que...** : Formule soutenue idéale pour la tâche 3.
* **D'emblée / Dès l'abord** : Attire immédiatement l'attention du lecteur sur le point de départ.

---

## 2. Ajouter et enrichir des arguments

Évitez de répéter *"et"* ou *"aussi"* :
* **De plus / En outre** : Ajoute un argument de même nature avec élégance.
* **Par ailleurs** : Introduit un nouvel angle de vue complémentaire.
* **Non seulement (...) mais encore (...)** : Formule percutante valorisée par les évaluateurs.
* **D'autant plus que...** : Renforce la portée d'un argument précédent.

---

## 3. Exprimer l'opposition et la concession (Essentiel Tâche 3)

La tâche 3 exige de comparer deux opinions divergentes puis d'argumenter :
* **Cependant / Néanmoins / Toutefois** : Marquent une opposition nette et formelle.
* **En revanche / Au contraire** : Contrastent deux réalités opposées.
* **Alors que / Tandis que** : Idéaux pour la synthèse (*« Alors que le premier document préconise..., le second insiste sur... »*).
* **Certes (...) mais (...)** : Concession très efficace pour nuancer son propos.
* **Bien que (+ subjonctif)** : *« Bien que cette mesure soit séduisante, elle comporte des limites. »*
* **Malgré (+ nom)** : *« Malgré les investissements consentis, les résultats tardent à venir. »*

---

## 4. Expliquer la cause et justifier

Démontrez la solidité de votre raisonnement :
* **En effet** : Développe et confirme ce qui vient d'être énoncé.
* **Dans la mesure où / Étant donné que** : Établissent un lien causal évident et posé.
* **Puisque** : Rappelle une cause déjà connue de tous.
* **En raison de / Du fait de (+ nom)** : Causes neutres ou formelles.

---

## 5. Conclure et déduire avec force

Terminez vos écrits par une formule d'aboutissement :
* **Par conséquent / De ce fait** : Indiquent le résultat logique.
* **En définitive / Tout compte fait** : Récapitulent l'ensemble de l'argumentaire.
* **Ainsi** : Synthétise en ouvrant une perspective.
* **Pour conclure / En guise de conclusion** : Signalent la fin du développement.

---

## Les pièges à bannir au TCF

* ⚠️ **Bannir le langage oralisé** : Évitez formellement *du coup*, *en fait*, *bref*, *au final*.
* ⚠️ **Ne pas surcharger artificiellement** : Un connecteur par phrase alourdit le texte. Placez-en un en amorce de paragraphe et un ou deux à l'intérieur pour articuler les idées.
* ⚠️ **Attention au mode verbal** : Rappelez-vous que *bien que* exige impérativement le **subjonctif** !
$CONTENT$
),
(
  'ee000000-0000-0000-0000-000000000006',
  'EE',
  'B2',
  'Expressions Utiles — Formules clés pour introduire, argumenter, nuancer et conclure',
  6,
  $CONTENT$# Expressions Utiles — La boîte à outils du candidat TCF

Pour éviter le syndrome de la page blanche et gagner un temps précieux lors de l'examen, mémorisez ces expressions idiomatiques classées par situation de communication.

---

## 1. Formules pour la Tâche 1 (Message, courriel, note)

### Salutations adaptées
* **Registre formel (collègues, responsable, commerçant)** :
  * `Madame, Monsieur,`
  * `Chère Madame Tremblay,` / `Monsieur le Directeur,`
* **Registre amical (proches, amis)** :
  * `Salut Thomas,` / `Chère Julie,`

### Entrées en matière efficaces
* *« Je me permets de vous écrire afin de vous informer de... »* (formel)
* *« J'espère que tu vas bien. Je t'écris pour te raconter... »* (amical)
* *« Faisant suite à notre conversation d'hier matin, je tiens à vous préciser que... »*

### Prises de congé & Formules de politesse
* *« N'hésite pas à me faire signe dès que tu auras un moment libre ! »* (amical)
* *« Dans l'attente de votre réponse, je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées. »* (très formel)
* *« Bien cordialement, »* / *« Sincères salutations, »* (professionnel courant)

---

## 2. Formules pour la Tâche 2 (Raconter et exprimer un ressenti)

La tâche 2 exige obligatoirement de partager vos **impressions, sentiments ou avis personnels** sur l'expérience vécue :

### Planter le décor
* *« Il y a quelques semaines, j'ai eu l'heureuse opportunité de participer à... »*
* *« Lors de mon récent séjour à Montréal, j'ai découvert... »*

### Exprimer un ressenti fort (Indispensable pour la note maximale)
* *« J'ai été profondément impressionné(e) par la convivialité de l'accueil. »*
* *« Ce qui m'a le plus marqué(e), c'est la rigueur et l'enthousiasme de l'équipe. »*
* *« À mon grand soulagement, tout s'est déroulé dans des conditions idéales. »*
* *« J'en conserve un souvenir particulièrement enrichissant et inspirant. »*

### Recommander et conseiller
* *« Si vous en avez l'occasion, je vous encourage vivement à tenter cette expérience. »*
* *« C'est une démarche que je ne peux que recommander sans la moindre hésitation. »*

---

## 3. Formules pour la Tâche 3 (Synthèse et Argumentation)

### Présenter la problématique
* *« De nos jours, la question de (...) est au cœur des débats sociétaux. »*
* *« Cette thématique suscite de nombreuses controverses et partage l'opinion publique. »*

### Reformuler les avis opposés (Partie 1 — Synthèse neutre, zéro "je")
* *« Selon le premier intervenant, (...) constitue un progrès incontestable. »*
* *« À l'opposé, le second document alerte quant aux dérives potentielles de ce phénomène. »*
* *« D'une part, on met en avant les avantages économiques ; d'autre part, on dénonce les risques sociaux. »*

### Exprimer son opinion personnelle (Partie 2 — Argumentation)
* *« Pour ma part, je suis fermement convaincu(e) que... »*
* *« À mes yeux, il est primordial de considérer que... »*
* *« J'estime pour ma part que la priorité doit être accordée à... »*

### Nuancer avec subtilité (Signe du niveau C1/C2)
* *« Il n'en demeure pas moins que... »*
* *« Certes, cet aspect est louable, néanmoins il serait imprudent d'ignorer... »*
$CONTENT$
),
(
  'ee000000-0000-0000-0000-000000000007',
  'EE',
  'B2',
  'Passé composé et Imparfait — Raconter des faits et décrire le cadre sans faute de temps',
  7,
  $CONTENT$# Passé composé et Imparfait — L'art de raconter au passé

L'alternance entre le **Passé Composé** et l'**Imparfait** est le socle grammatical indispensable pour réussir la **Tâche 1** et surtout la **Tâche 2** d'Expression Écrite. C'est l'un des premiers critères scrutés par les examinateurs pour valider le palier **B1-B2**.

---

## 1. L'Imparfait : Le décor, l'état d'esprit et l'habitude

L'imparfait correspond à la **caméra en plan large** qui filme l'arrière-plan sans événement soudain :
* **Une description de cadre ou météo** : *« Le soleil brillait et la salle était comble. »*
* **Un état physique, psychologique ou émotionnel** : *« J'étais très enthousiaste, mais mes collègues semblaient fatigués. »*
* **Une action continue en arrière-plan** : *« Je marchais dans les couloirs lorsque... »*
* **Une habitude ou répétition passée** : *« À l'époque, nous organisions une réunion tous les lundis. »*

---

## 2. Le Passé Composé : L'action précise, ponctuelle et achevée

Le passé composé correspond au **zoom de la caméra** sur un événement qui se produit et fait progresser l'histoire :
* **Un événement ponctuel à un moment précis** : *« Hier à 10 heures, la direction a signé l'accord. »*
* **Une suite chronologique d'actions** : *« Je suis arrivé au bureau, j'ai allumé mon ordinateur et j'ai constaté l'incident. »*
* **Une interruption d'une action en cours** : *« Nous discutions tranquillement (Imparfait) quand l'alarme a retenti (Passé composé). »*

---

## 3. Les repères temporels déclencheurs

* **Ils appellent naturellement l'Imparfait** :
  * *D'habitude, autrefois, à cette époque, chaque jour, toujours, pendant que, souvent.*
* **Ils appellent naturellement le Passé Composé** :
  * *Soudain, tout à coup, immédiatement, ce jour-là, enfin, ensuite, à cet instant précis.*

---

## 4. Exemple comparatif commenté

Examinez ce paragraphe type pour la Tâche 2 :

> *« Lorsque nous **sommes arrivés** (Passé composé : action ponctuelle) sur le site, une foule immense **attendait** devant les portes (Imparfait : décor en cours). L'ambiance **était** électrique (Imparfait : atmosphère). Tout à coup, l'organisateur **a pris** le micro et **a annoncé** l'ouverture officielle (Passé composé : rupture et actions successives). »*

---

## Astuce en or pour le TCF

Avant de rédiger une phrase au passé, posez-vous une seule question :
* Est-ce une action qui arrive et avance l'histoire ? → **Passé Composé**.
* Est-ce une description, une météo ou une émotion qui dure ? → **Imparfait**.
$CONTENT$
),
(
  'ee000000-0000-0000-0000-000000000008',
  'EE',
  'B2',
  'Les Accords Essentiels — Sujet-verbe, adjectifs et participe passé sans hésitation',
  8,
  $CONTENT$# Les Accords Essentiels — Éliminer les fautes qui coûtent cher

Les erreurs d'accord font partie des **fautes éliminatoires** qui empêchent d'atteindre le palier NCLC 7+. Voici les 3 règles maîtresses et la méthode de relecture infaillible.

---

## 1. L'accord Sujet - Verbe (Les pièges fréquents)

### Le sujet éloigné ou inversé
Ne vous laissez pas tromper par les mots intercalés entre le sujet et le verbe :
* *« La liste des participants sélectionnés **a été** publiée. »* *(Le sujet est "la liste", singulier, et non "les participants" !)*
* *« De cette politique **découlent** plusieurs avantages. »* *(Sujet inversé : "plusieurs avantages", pluriel).*

### Les pronoms pièges
* **"Qui" s'accorde avec son antécédent** :
  * *« C'est moi qui **ai** rédigé le rapport. »* *(et non "qui a")*
  * *« Ce sont eux qui **ont** pris l'initiative. »*
* **"Tout le monde"** : Toujours au **singulier** en français ! *(« Tout le monde est d'accord »).*
* **"Chacun / Chacune"** : Toujours au **singulier** *(« Chacun des membres doit participer »).*

---

## 2. L'accord des Adjectifs Qualificatifs

L'adjectif s'accorde en **genre** (masculin/féminin) et en **nombre** (singulier/pluriel) avec le nom auquel il se rapporte :
* Une initiative **innovante** et des projets **stimulants**.
* **Deux noms de genres différents** : Le masculin pluriel l'emporte toujours.
  * *« Une expérience et un accueil **remarquables** »*.
* **Adjectifs de couleur composés** : Restent invariables !
  * *« Des vestes **bleu marine** »*, *« Des yeux **vert clair** »*.

---

## 3. L'accord du Participe Passé (Les 3 cas concrets)

### Cas 1 : Avec l'auxiliaire ÊTRE
S'accorde **toujours avec le sujet** :
* *« Elle est **arrivée** à l'heure. »*
* *« Ils sont **devenus** indispensables. »*

### Cas 2 : Avec l'auxiliaire AVOIR
Ne s'accorde **jamais avec le sujet**. Il s'accorde avec le **Complément d'Objet Direct (COD)** uniquement si ce COD est placé **AVANT** le verbe :
* *« J'ai **rencontré** ces clients hier. »* *(Le COD "ces clients" est placé après → pas d'accord).*
* *« Les clients que j'ai **rencontrés** hier. »* *(Le COD "que" renvoie à "les clients", placé avant → accord masculin pluriel !)*
* *« Cette opportunité, je l'ai **saisie** sans hésiter. »* *(Le pronom "l'" renvoie à "cette opportunité", féminin placé avant → accord avec "e").*

### Cas 3 : Les verbes pronominaux
Posez-vous la question du COD :
* *« Elle s'est **présentée** au directeur. »* *(Elle a présenté qui ? Elle-même → accord).*
* *« Ils se sont **parlé** pendant une heure. »* *(Parler À qui ? COI → invariable !).*

---

## Protocole de relecture en 60 secondes chrono

Consacrez toujours la dernière minute de votre épreuve à cette vérification méthodique :
1. Pointez du doigt chaque verbe et identifiez son véritable sujet.
2. Pour chaque participe passé avec *avoir*, demandez-vous : y a-t-il un "que", "les", "la" placé avant ?
3. Vérifiez la présence du "e" du féminin et du "s" du pluriel sur tous vos adjectifs.
$CONTENT$
)
ON CONFLICT (id) DO UPDATE SET
  epreuve = EXCLUDED.epreuve,
  niveau = EXCLUDED.niveau,
  titre = EXCLUDED.titre,
  ordre_affichage = EXCLUDED.ordre_affichage,
  contenu = EXCLUDED.contenu;
