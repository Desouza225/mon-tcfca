-- ══════════════════════════════════════════════════════════════════════════════
-- MON TCFCA — MIGRATION 00054 : INSERTION / MISE À JOUR DES 4 FICHES D'EXPRESSION ÉCRITE (EE)
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

-- INSERTION / MISE À JOUR DES 4 FICHES OFFICIELLES D'EXPRESSION ÉCRITE
INSERT INTO public.course_sheets (id, epreuve, niveau, titre, ordre_affichage, contenu)
VALUES
(
  'ee000000-0000-0000-0000-000000000001'::uuid,
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
  'ee000000-0000-0000-0000-000000000002'::uuid,
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

---

## Formules

### Entrées en matière efficaces
* `« Je me permets de vous écrire afin de vous informer de... »` *(formel)*
* `« J'espère que tu vas bien. Je t'écris pour te raconter... »` *(amical)*
* `« Faisant suite à notre conversation d'hier matin, je tiens à vous préciser que... »`

### Prises de congé & Formules de politesse
* `« N'hésite pas à me faire signe dès que tu auras un moment libre ! »` *(amical)*
* `« Dans l'attente de votre réponse, je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées. »` *(très formel)*
* `« Bien cordialement, »` / `« Sincères salutations, »` *(professionnel courant)*
$CONTENT$
),
(
  'ee000000-0000-0000-0000-000000000003'::uuid,
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

---

## Formules

### Planter le décor
* `« Il y a quelques semaines, j'ai eu l'heureuse opportunité de participer à... »`
* `« Lors de mon récent séjour à Montréal, j'ai découvert... »`

### Exprimer un ressenti fort *(Indispensable pour la note maximale)*
* `« J'ai été profondément impressionné(e) par la convivialité de l'accueil. »`
* `« Ce qui m'a le plus marqué(e), c'est la rigueur et l'enthousiasme de l'équipe. »`
* `« À mon grand soulagement, tout s'est déroulé dans des conditions idéales. »`
* `« J'en conserve un souvenir particulièrement enrichissant et inspirant. »`

### Recommander et conseiller
* `« Si vous en avez l'occasion, je vous encourage vivement à tenter cette expérience. »`
* `« C'est une démarche que je ne peux que recommander sans la moindre hésitation. »`
$CONTENT$
),
(
  'ee000000-0000-0000-0000-000000000004'::uuid,
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

---

## Formules

### Présenter la problématique
* `« De nos jours, la question de (...) est au cœur des débats sociétaux. »`
* `« Ces dernières années, la question de (...) a suscité un intérêt croissant et donné lieu à des opinions parfois divergentes. »`

### Reformuler les avis opposés (Partie 1 — Synthèse neutre, zéro "je")
* `« Selon le premier intervenant, (...) constitue un progrès incontestable. »`
* `« À l'opposé, le second document alerte quant aux dérives potentielles de ce phénomène. »`
* `« D'une part, on met en avant les avantages économiques ; d'autre part, on dénonce les risques sociaux. »`

### Exprimer son opinion personnelle (Partie 2 — Argumentation)
* `« Pour ma part, je suis fermement convaincu(e) que... »`
* `« À mes yeux, il est primordial de considérer que... »`
* `« J'estime pour ma part que la priorité doit être accordée à... »`

### Nuancer avec subtilité (Signe du niveau C1/C2)
* `« Il n'en demeure pas moins que... »`
* `« Certes, cet aspect est louable, néanmoins il serait imprudent d'ignorer... »`
$CONTENT$
)
ON CONFLICT (id) DO UPDATE SET
  titre = EXCLUDED.titre,
  epreuve = EXCLUDED.epreuve,
  niveau = EXCLUDED.niveau,
  ordre_affichage = EXCLUDED.ordre_affichage,
  contenu = EXCLUDED.contenu,
  updated_at = NOW();
