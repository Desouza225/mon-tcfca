-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION : 00045_seed_outils_grammaire_sheets.sql
-- Description : Fiches de cours et outils transversaux avec sélecteurs dédiés
-- (Connecteurs Logiques, Expressions Utiles, Passé Composé & Imparfait, Accords Essentiels)
-- ZÉRO BARRE VERTICALE - Mise en page épurée et typage distinct des épreuves.
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

-- 1. Nettoyage des anciens identifiants résiduels rattachés par erreur à l'Expression Écrite
DELETE FROM public.course_sheets 
WHERE id IN (
  'ee000000-0000-0000-0000-000000000005',
  'ee000000-0000-0000-0000-000000000006',
  'ee000000-0000-0000-0000-000000000007',
  'ee000000-0000-0000-0000-000000000008'
);

-- 2. Insertion / Mise à jour des 4 fiches de cours indépendantes
INSERT INTO public.course_sheets (id, epreuve, niveau, titre, ordre_affichage, contenu)
VALUES
(
  'og000000-0000-0000-0000-000000000001',
  'OUTILS_CONNECTEURS',
  'B2',
  'Connecteurs Logiques — Les mots de liaison indispensables pour structurer vos écrits',
  9,
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
* ⚠️ **Attention au mode verbal** : Rappelez-vous que *bien que* exige impérativement le **subjonctif** !$CONTENT$
),
(
  'og000000-0000-0000-0000-000000000002',
  'OUTILS_EXPRESSIONS',
  'B2',
  'Expressions Utiles — Formules clés pour introduire, argumenter, nuancer et conclure',
  10,
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
* *« Certes, cet aspect est louable, néanmoins il serait imprudent d'ignorer... »*$CONTENT$
),
(
  'og000000-0000-0000-0000-000000000003',
  'OUTILS_TEMPS',
  'B2',
  'Passé composé et Imparfait — Raconter des faits et décrire le cadre sans faute de temps',
  11,
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
* Est-ce une description, une météo ou une émotion qui dure ? → **Imparfait**.$CONTENT$
),
(
  'og000000-0000-0000-0000-000000000004',
  'OUTILS_ACCORDS',
  'B2',
  'Les Accords Essentiels — Sujet-verbe, adjectifs et participe passé sans hésitation',
  12,
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
3. Vérifiez la présence du "e" du féminin et du "s" du pluriel sur tous vos adjectifs.$CONTENT$
)
ON CONFLICT (id) DO UPDATE SET
  epreuve = EXCLUDED.epreuve,
  niveau = EXCLUDED.niveau,
  titre = EXCLUDED.titre,
  ordre_affichage = EXCLUDED.ordre_affichage,
  contenu = EXCLUDED.contenu,
  updated_at = NOW();

-- 3. Mise à jour de l'ordre d'affichage des fiches d'Expression Orale (5 à 8)
UPDATE public.course_sheets SET ordre_affichage = 5 WHERE id = 'e0000000-0000-0000-0000-000000000001';
UPDATE public.course_sheets SET ordre_affichage = 6 WHERE id = 'e0000000-0000-0000-0000-000000000002';
UPDATE public.course_sheets SET ordre_affichage = 7 WHERE id = 'e0000000-0000-0000-0000-000000000003';
UPDATE public.course_sheets SET ordre_affichage = 8 WHERE id = 'e0000000-0000-0000-0000-000000000004';
