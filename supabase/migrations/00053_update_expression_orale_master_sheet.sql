-- ══════════════════════════════════════════════════════════════════════════════
-- MON TCFCA — MIGRATION 00053 : INSERTION / MISE À JOUR DES 4 FICHES OFFICIELLES D'EXPRESSION ORALE (EO)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.course_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 1. INSERTION / MISE À JOUR STRICTEMENT DES 4 FICHES OFFICIELLES D'EXPRESSION ORALE (UUID HEXADÉCIMAUX VALIDES)
INSERT INTO public.course_sheets (id, epreuve, niveau, titre, ordre_affichage, contenu)
VALUES
(
  'e0000000-0000-0000-0000-000000000001'::uuid,
  'EO',
  'B2',
  'Expression Orale — Épreuve Totale & Vue d''ensemble (Méthode Complète)',
  5,
  $CONTENT$# EXPRESSION ORALE — TCF Canada (Épreuve Totale)

> **Objectif officiel** : Savoir s'exprimer à l'oral en français de façon claire, organisée, fluide et argumentée pour viser le palier **NCLC 7+** (Entrée Express Canada).

**Durée totale** : 12 minutes pour 3 tâches obligatoires (dont 2 minutes de préparation, uniquement pour la tâche 2).  
**Ce qu'on évalue** : 3 piliers essentiels — votre niveau de langue, votre capacité à structurer/interagir, et votre capacité d'adaptation à la situation de communication.

---

## Vue d'ensemble : ce qu'on vous demande

À l'épreuve d'expression orale, on vous demande de :
* **Parler de vous**, de votre famille et de votre travail ;
* **Poser des questions bien structurées**, adaptées à un contexte précis de la vie quotidienne ;
* **Argumenter et donner votre opinion** de manière claire, progressive et structurée ;
* **Savoir organiser une présentation orale** spontanée et fluide ;
* **Parler avec aisance et naturel**, tout en restant convaincant(e) et rigoureux(se).

---

## Comment est-on noté ?

Deux examinateurs vous évaluent séparément (l'un est présent en face de vous lors de l'entretien, l'autre écoute l'enregistrement audio de façon anonyme). Ils observent 3 critères :
1. **Votre niveau de langue** → grammaire, richesse du vocabulaire, précision de la prononciation et fluidité d'élocution.
2. **Votre structuration & interaction** → discours cohérent, idées bien développées, écoute active et réactivité dans l'échange.
3. **Votre adaptation sociolinguistique** → savoir adapter votre registre selon la situation *(un ami ≠ un agent immobilier ≠ un examinateur)*.

---

## Tableau récapitulatif des 3 tâches

* **Tâche 1 (Se présenter)** : **2 à 3 minutes** *(sans préparation)* — Entretien dirigé où l'examinateur mène le jeu. Parler de soi, de sa famille, de son travail, de ses études et de ses projets.
* **Tâche 2 (Interagir pour obtenir des informations)** : **3 minutes 30** *(après **2 minutes de préparation**)* — Mener un entretien en posant des questions ciblées dans une situation du quotidien, écouter et rebondir logiquement.
* **Tâche 3 (Exprimer un point de vue)** : **4 minutes 30** *(sans préparation)* — Comprendre un sujet de société, développer une opinion personnelle étayée d'exemples (~2 min monologue), puis débattre et nuancer avec l'examinateur (~2 min 30).

---

## Ce qui compte le plus au final

* **Maîtriser la méthodologie** spécifique à chaque tâche.
* **Savoir utiliser des connecteurs logiques variés** pour un discours fluide et cohérent.
* **Bien comprendre le sujet et la consigne** avant de commencer à répondre.
* **Limiter les fautes de grammaire et soigner la prononciation**.

---

## Checklist avant l'épreuve

* [ ] Ai-je préparé du vocabulaire sur les grands thèmes de communication de la tâche 1 ?
* [ ] Est-ce que je sais adapter mon registre (*tu / vous*) selon la situation ?
* [ ] Est-ce que je maîtrise les 4 formes de questions pour la tâche 2 ?
* [ ] Est-ce que je garde une structure (introduction / développement / conclusion) même sans préparation en tâche 3 ?
* [ ] Ai-je des connecteurs logiques variés prêts à l'emploi (*tout d'abord, cependant, en revanche, par exemple, en définitive*) ?
* [ ] Est-ce que je reste souriant(e), naturel(le) et attentif(ve) pour rebondir sur les remarques de l'examinateur ?
$CONTENT$
),
(
  'e0000000-0000-0000-0000-000000000002'::uuid,
  'EO_tache1',
  'B2',
  'Expression Orale — Tâche 1 : Se présenter (Entretien dirigé — 2 à 3 minutes)',
  6,
  $CONTENT$# Expression Orale — Tâche 1 : Se présenter (Entretien dirigé)

## Repères officiels de l'épreuve
* **Format** : Entretien dirigé sans temps de préparation. C'est l'examinateur qui pose les questions.
* **Durée** : **2 à 3 minutes**.
* **Objectif clé** : Parler de vous, de votre famille, de votre travail, de votre environnement et de vos expériences.

---

## Consigne officielle
> *(Donnée à l'oral par l'examinateur, peut varier légèrement)* :  
> « Bonjour. Pour commencer, est-ce que vous pouvez vous présenter ? »

---

## Les thèmes de communication possibles
L'examinateur peut vous poser des questions sur n'importe lequel de ces thèmes. Préparez le vocabulaire associé à l'avance :
* **État civil / caractère / langue(s) parlée(s)** : Nom, prénom, âge, nationalité, traits de caractère, parcours linguistique.
* **Famille** : Situation familiale, enfants, fratrie, parents.
* **Relations amicales** : Amis, activités de groupe, sorties.
* **Formation / études** : Diplômes, parcours scolaire et universitaire, apprentissage du français.
* **Situation professionnelle / universitaire** : Métier actuel, responsabilités, domaine d'activité.
* **Activités / habitudes** : Travail, université, loisirs, sports, passions du week-end.
* **Aptitudes / goûts / centres d'intérêt** : Ce que vous aimez faire, vos talents particuliers.
* **Événement ou activité passés** : Votre dernier voyage, une célébration marquante, une anecdote.
* **Conditions de vie** : Logement, quartier, ville d'origine, environnement, climat.
* **Objets personnels** : Un souvenir, un objet de valeur sentimentale ou outil de travail.
* **Projets / souhaits / désirs** : Projet d'immigration au Canada, perspectives professionnelles.
* **Déplacements / voyages / itinéraire** : Moyens de transport, séjours à l'étranger.
* **Institutions publiques / infrastructures / associations** : Vie communautaire, services publics, bénévolat.

---

## Trois conseils essentiels

1. **Restez ouvert(e) et détendu(e)** :
   * Souriez, saluez poliment au début et remerciez à la fin.
   * Regardez l'examinateur avec confiance.
   * Si vous ne comprenez pas une question, ne paniquez pas : demandez simplement à l'examinateur de répéter ou de parler un peu plus lentement (*« Excusez-moi, pourriez-vous répéter s'il vous plaît ? »*).
2. **Préparez les thèmes, pas des réponses toutes faites** :
   * Entraînez-vous sur le lexique de chaque thème, mais **n'apprenez rien par cœur** (cela sonnerait faux et mécanique).
   * Restez spontané(e), naturel(le) et sincère.
3. **Restez organisé(e)** :
   * Allez du plus large (*qui vous êtes*) au plus précis (*vos goûts, vos projets canadiens*).
   * Développez un peu chacune de vos réponses sans faire de long monologue interminable.

---

## Exemple de présentation modèle à l'oral

Voici un exemple concret de présentation fluide, spontanée et structurée, calibrée pour durer environ 1 minute 30 à 2 minutes avant les relances de l'examinateur :

> « Bonjour. Je m'appelle Julien, j'ai 30 ans et je vis actuellement à Nantes, dans l'ouest de la France, depuis maintenant six ans.
>
> Sur le plan professionnel, je travaille comme chef de projet en marketing digital pour une agence nantaise spécialisée dans l'accompagnement des PME. J'ai une formation universitaire en communication et en gestion de projets, et j'apprécie particulièrement le dynamisme de mon métier, qui me permet de collaborer quotidiennement avec des équipes très diverses.
>
> Concernant mon cadre de vie, j'habite près des bords de la Loire, dans un quartier à la fois vivant et verdoyant. Durant mon temps libre, je suis un grand amateur de vélo et de randonnée, deux activités faciles à pratiquer dans la région nantaise. Je m'intéresse également beaucoup à la vie culturelle locale, notamment aux expositions d'art contemporain et aux événements associatifs du centre-ville.
>
> Enfin, si je passe le TCF Canada aujourd'hui, c'est parce que j'ai pour projet de m'installer au Canada, plus particulièrement à Montréal, afin de donner un nouvel élan à ma carrière professionnelle et de vivre une expérience humaine enrichissante dans un environnement multiculturel. »

---

### Pourquoi cette présentation fonctionne parfaitement à l'examen :
* **Progression logique et claire** : Identité → Métier & Formation → Cadre de vie & Loisirs → Projet Canada.
* **Vocabulaire soutenu et naturel** : *« sur le plan professionnel »*, *« cadre de vie »*, *« donner un nouvel élan »*, *« environnement multiculturel »*.
* **Équilibre optimal du temps de parole** : Le candidat expose les éléments clés en 90 secondes avec aisance, tout en laissant l'examinateur rebondir sur ses passions ou son projet.
$CONTENT$
),
(
  'e0000000-0000-0000-0000-000000000003'::uuid,
  'EO_tache2',
  'B2',
  'Expression Orale — Tâche 2 : Interagir pour obtenir des informations (3 min 30)',
  7,
  $CONTENT$# Expression Orale — Tâche 2 : Interagir pour obtenir des informations

## Repères officiels de l'épreuve
* **Format** : Exercice en interaction où **VOUS** menez l'échange face à l'examinateur.
* **Préparation** : **2 minutes de préparation** (prise de notes autorisée sur brouillon).
* **Durée de l'échange** : **3 minutes 30** *(après les 2 minutes de préparation)*.
* **Objectif clé** : Obtenir des informations précises dans une situation de vie quotidienne sur un sujet donné. *(Des images ou une annonce peuvent vous être montrées pour vous aider)*.

---

## Exemple de situation
> *« Vous rencontrez un agent immobilier pour vous aider à trouver un logement pour votre installation au Canada. Vous devez lui poser une dizaine de questions pour obtenir toutes les informations dont vous avez besoin (loyer, charges, quartier, commerces, transports, bail). »*

---

## Trois conseils essentiels

1. **Analysez bien la situation** :
   * Identifiez d'emblée le registre : *"tu"* (ami, proche, voisin) ou *"vous"* (formel, ex : agent immobilier, responsable, commerçant).
   * Commencez toujours par résumer la situation en une phrase d'amorce pour montrer que vous l'avez parfaitement comprise :  
     *« Bonjour Monsieur, je viens vous voir suite à votre annonce immobilière. J'aimerais vous poser plusieurs questions sur ce logement. »*
2. **Variez vos questions** :
   * Ne commencez pas toutes vos phrases par *"Est-ce que..."*.
   * Utilisez plusieurs formes interrogatives pour démontrer la richesse de vos compétences syntaxiques.
3. **Réagissez aux réponses de l'examinateur** :
   * Écoutez attentivement et rebondissez de façon logique sur ce qu'il vous dit.
   * Utilisez des mots de transition naturels comme *« Entendu »*, *« D'accord »*, *« C'est noté »*, *« Parfait »* pour fluidifier le dialogue et sonner authentique.

---

## Quatre façons de poser une question

* **1. L'inversion du sujet (Registre formel et soigné)** :
  * *« Avez-vous des conseils pour ma recherche de logement ? »*
  * *« Pourriez-vous me préciser si les animaux de compagnie sont acceptés ? »*
* **2. Avec un mot interrogatif (Où, quand, comment, quel, combien)** :
  * *« Où est-ce que les prix sont les moins élevés dans cette ville ? »*
  * *« Quel est le montant exact des charges mensuelles ? »*
  * *« À partir de quelle date l'appartement sera-t-il libre ? »*
* **3. Avec « Est-ce que » (Courant et direct)** :
  * *« Est-ce que mon budget est suffisant pour ce type de bien ? »*
  * *« Est-ce que le quartier dispose d'espaces verts à proximité ? »*
* **4. L'intonation montante (Naturel et spontané)** :
  * *« Vous me conseillez plutôt d'habiter dans une maison ou dans un appartement ? »*
  * *« Le chauffage est inclus dans le loyer affiché ? »*

---

## Les pièges à éviter absolument

* ⚠️ **Ignorer la réponse de l'examinateur et poser une question sans lien logique** avec ce qu'il vient de dire.
  * *Exemple à éviter* : L'examinateur vous dit : *« Cherchez plutôt un appartement plus petit, les grandes maisons sont hors budget »*, et vous répondez : *« Quel est le budget pour une grande maison avec jardin ? »* → Incohérent et pénalisé !
  * *Manière recommandée de rebondir* : *« D'accord, je comprends. Un deux-pièces serait donc plus adapté à mes moyens ? Et y a-t-il des quartiers moins chers à proximité des transports ? »*
$CONTENT$
),
(
  'e0000000-0000-0000-0000-000000000004'::uuid,
  'EO_tache3',
  'B2',
  'Expression Orale — Tâche 3 : Exprimer un point de vue (Monologue & Débat — 4 min 30)',
  8,
  $CONTENT$# Expression Orale — Tâche 3 : Exprimer un point de vue

## Repères officiels de l'épreuve
* **Format** : Expression d'un point de vue argumenté sans temps de préparation, suivi d'un échange avec l'examinateur.
* **Durée totale** : **4 minutes 30** *(environ 2 minutes de monologue continu + environ 2 min 30 de débat/discussion)*.
* **Objectif clé** : Comprendre le sujet de société donné, puis développer votre opinion et vos arguments de manière claire, structurée et nuancée.

---

## Exemple de sujet officiel
> « Selon vous, est-il préférable d'exercer un métier que l'on aime ou un métier qui rapporte beaucoup d'argent ? »  
> (Autres thématiques fréquentes : le télétravail, les loisirs, la consommation responsable, l'intelligence artificielle, l'éducation, les réseaux sociaux...)

---

## La structure à suivre (3 étapes indispensables)

Même sans temps de préparation, gardez rigoureusement cette ossature :
1. **1. Introduction (environ 20 secondes)** :
   * Présentez le sujet en le reformulant avec vos propres mots.
   * Donnez votre avis général d'entrée de jeu.
   * Annoncez brièvement votre plan de réflexion.
2. **2. Développement (environ 1 min 20)** :
   * Développez **2 à 3 idées centrales bien distinctes**.
   * **Règle d'or** : chaque idée doit obligatoirement être accompagnée d'un exemple concret (anecdote vécue, réalité sociale ou professionnelle).
   * Intégrez une nuance pour démontrer votre capacité de recul.
3. **3. Conclusion (environ 20 secondes)** :
   * Résumez votre point de vue en une phrase nette et sans ambiguïté.
   * Vous pouvez ouvrir le débat vers une perspective d'avenir.

---

## Trois conseils essentiels

1. **Identifiez vite le thème** :
   * Vous n'avez pas de temps de préparation écrite : réagissez de façon spontanée, posée et ciblée dès que l'examinateur a fini de lire la consigne.
2. **Structurez quand même votre réponse** :
   * Même sans préparation, gardez toujours en tête le triptyque : **Introduction / Développement / Conclusion**.
3. **Restez clair(e) sur votre position** :
   * Vous pouvez présenter des contre-arguments pour enrichir votre discours, mais votre opinion doit rester parfaitement compréhensible du début à la fin.
   * **Rappel fondamental** : L'examinateur juge uniquement votre façon de vous exprimer, votre grammaire et votre logique d'argumentation, et non votre opinion elle-même.

---

## Boîte à outils : expressions utiles pour bien structurer

Ces expressions sont particulièrement précieuses pour la tâche 3, mais aussi pour enrichir votre vocabulaire tout au long de l'épreuve :

### Pour introduire votre opinion
* *« Personnellement, je suis convaincu(e) que... »*
* *« Il me semble évident que... »*
* *« D'après moi, il est essentiel de considérer que... »*
* *« J'aimerais commencer par dire que... »*

### Pour structurer et enchaîner vos arguments
* *« Tout d'abord / En premier lieu... »*
* *« De plus / Par ailleurs / Qui plus est... »*
* *« D'un côté... de l'autre côté... »*
* *« D'une part... d'autre part... »*

### Pour nuancer votre propos
* *« Certes, il est vrai que... néanmoins... »*
* *« Bien que cette approche présente des avantages, il faut reconnaître que... »*
* *« Tout dépend en réalité du contexte et des priorités de chacun... »*

### Pour donner un exemple concret
* *« À titre d'exemple... »*
* *« Pour illustrer ce point, prenons le cas de... »*
* *« D'après mon expérience personnelle... »*

### Pour conclure avec force
* *« En somme / En définitive... »*
* *« Pour conclure, je dirais que... »*
* *« En fin de compte, l'équilibre réside dans... »*
$CONTENT$
)
ON CONFLICT (id) DO UPDATE SET
  titre = EXCLUDED.titre,
  epreuve = EXCLUDED.epreuve,
  niveau = EXCLUDED.niveau,
  ordre_affichage = EXCLUDED.ordre_affichage,
  contenu = EXCLUDED.contenu,
  updated_at = NOW();
