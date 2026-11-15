import type { CourseSheet } from '@/types/index';

export const DEFAULT_COURSE_SHEETS: CourseSheet[] = [
  // ══════════════════════════════════════════════════════════════════════════════
  // 0. PRÉSENTATION DU TCF CANADA — GUIDE GLOBAL DES 4 ÉPREUVES
  // ══════════════════════════════════════════════════════════════════════════════
  {
    id: 'tcf-canada-deroulement-officiel',
    epreuve: 'DEROULEMENT_TCF',
    niveau: 'B2',
    titre: 'Présentation du TCF Canada',
    ordre_affichage: 0,
    fichier_pdf_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    contenu: `# Présentation du TCF Canada

> **Objectif IRCC (Immigration Canada)** : Évaluer avec précision votre niveau de français sur les 4 compétences clés pour valider le palier **NCLC 7+** (Niveau de Compétence Linguistique Canadien 7 ou plus, équivalent B2 avancé), seuil qui octroie jusqu'à **50 points bonus** dans le système Entrée Express.
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
   * Entraînez-vous en conditions réelles avec chronomètre sur la plateforme Mon TCFCA pour automatiser vos réflexes le jour de l'examen.
`
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // 1. EXPRESSION ÉCRITE — LES 4 FICHES OFFICIELLES EXCLUSIVES
  // ══════════════════════════════════════════════════════════════════════════════

  // FICHE 1 : ÉPREUVE TOTALE & VUE D'ENSEMBLE
  {
    id: 'ee000000-0000-0000-0000-000000000001',
    epreuve: 'EE',
    niveau: 'B2',
    titre: "Expression Écrite — Épreuve Totale & Vue d'ensemble (Méthode Complète)",
    ordre_affichage: 1,
    fichier_pdf_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    contenu: `# EXPRESSION ÉCRITE — TCF Canada (Épreuve Totale)

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
`
  },

  // FICHE 2 : TÂCHE 1 — ÉCRIRE UN MESSAGE
  {
    id: 'ee000000-0000-0000-0000-000000000002',
    epreuve: 'EE_tache1',
    niveau: 'B2',
    titre: "Expression Écrite — Tâche 1 : Écrire un message (60 à 120 mots)",
    ordre_affichage: 2,
    fichier_pdf_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    contenu: `# Expression Écrite — Tâche 1 : Écrire un message

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
   * *Formel* : \`Madame, Monsieur,\` / \`Monsieur le Directeur,\`
   * *Informel* : \`Salut Julie,\` / \`Chère Julie,\`
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
* \`« Je me permets de vous écrire afin de vous informer de... »\` *(formel)*
* \`« J'espère que tu vas bien. Je t'écris pour te raconter... »\` *(amical)*
* \`« Faisant suite à notre conversation d'hier matin, je tiens à vous préciser que... »\`

### Prises de congé & Formules de politesse
* \`« N'hésite pas à me faire signe dès que tu auras un moment libre ! »\` *(amical)*
* \`« Dans l'attente de votre réponse, je vous prie d'agréer, Madame, Monsieur, mes salutations distinguées. »\` *(très formel)*
* \`« Bien cordialement, »\` / \`« Sincères salutations, »\` *(professionnel courant)*
`
  },

  // FICHE 3 : TÂCHE 2 — ÉCRIRE UN ARTICLE OU UNE NOTE
  {
    id: 'ee000000-0000-0000-0000-000000000003',
    epreuve: 'EE_tache2',
    niveau: 'B2',
    titre: "Expression Écrite — Tâche 2 : Écrire un article ou une note (120 à 150 mots)",
    ordre_affichage: 3,
    fichier_pdf_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    contenu: `# Expression Écrite — Tâche 2 : Écrire un article ou une note

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
* \`« Il y a quelques semaines, j'ai eu l'heureuse opportunité de participer à... »\`
* \`« Lors de mon récent séjour à Montréal, j'ai découvert... »\`

### Exprimer un ressenti fort *(Indispensable pour la note maximale)*
* \`« J'ai été profondément impressionné(e) par la convivialité de l'accueil. »\`
* \`« Ce qui m'a le plus marqué(e), c'est la rigueur et l'enthousiasme de l'équipe. »\`
* \`« À mon grand soulagement, tout s'est déroulé dans des conditions idéales. »\`
* \`« J'en conserve un souvenir particulièrement enrichissant et inspirant. »\`

### Recommander et conseiller
* \`« Si vous en avez l'occasion, je vous encourage vivement à tenter cette expérience. »\`
* \`« C'est une démarche que je ne peux que recommander sans la moindre hésitation. »\`
`
  },

  // FICHE 4 : TÂCHE 3 — COMPARER DEUX POINTS DE VUE ET DONNER SON AVIS
  {
    id: 'ee000000-0000-0000-0000-000000000004',
    epreuve: 'EE_tache3',
    niveau: 'B2',
    titre: "Expression Écrite — Tâche 3 : Comparer deux points de vue et donner son avis (120 à 180 mots)",
    ordre_affichage: 4,
    fichier_pdf_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    contenu: `# Expression Écrite — Tâche 3 : Comparer deux points de vue et donner son avis

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
* \`« De nos jours, la question de (...) est au cœur des débats sociétaux. »\`
* \`« Ces dernières années, la question de (...) a suscité un intérêt croissant et donné lieu à des opinions parfois divergentes. »\`

### Reformuler les avis opposés (Partie 1 — Synthèse neutre, zéro "je")
* \`« Selon le premier intervenant, (...) constitue un progrès incontestable. »\`
* \`« À l'opposé, le second document alerte quant aux dérives potentielles de ce phénomène. »\`
* \`« D'une part, on met en avant les avantages économiques ; d'autre part, on dénonce les risques sociaux. »\`

### Exprimer son opinion personnelle (Partie 2 — Argumentation)
* \`« Pour ma part, je suis fermement convaincu(e) que... »\`
* \`« À mes yeux, il est primordial de considérer que... »\`
* \`« J'estime pour ma part que la priorité doit être accordée à... »\`

### Nuancer avec subtilité (Signe du niveau C1/C2)
* \`« Il n'en demeure pas moins que... »\`
* \`« Certes, cet aspect est louable, néanmoins il serait imprudent d'ignorer... »\`
`
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // OUTILS LINGUISTIQUES & GRAMMAIRE ESSENTIELLE (TCF CANADA)
  // ══════════════════════════════════════════════════════════════════════════════

  // FICHE 5 : CONNECTEURS LOGIQUES
  {
    id: 'og000000-0000-0000-0000-000000000001',
    epreuve: 'OUTILS_CONNECTEURS',
    niveau: 'B2',
    titre: 'Connecteurs Logiques — Les mots de liaison indispensables pour structurer vos écrits',
    ordre_affichage: 9,
    fichier_pdf_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    contenu: `# Connecteurs Logiques — Structurer et fluidifier vos productions

> **Règle d'or de notation** : L'utilisation judicieuse et variée des connecteurs logiques permet d'obtenir la note maximale en **cohérence et organisation textuelle** (Niveaux B2, C1 et C2). Cliquez pour copier une expression :

---

## 1. Exprimer la Cause
*Expliquer l'origine ou la raison d'un fait (B2 à C2)*

* \`Étant donné que\` : En tête de phrase pour un fait évident (+ indicatif)
* \`Puisque\` : Cause déjà connue de l’interlocuteur
* \`En raison de\` : Cause neutre ou formelle (+ nom)
* \`Grâce à\` : Cause positive (+ nom)
* \`À cause de\` : Cause négative (+ nom)
* \`Eu égard à (+ nom)\` : **Niveau C2** • Très soutenu : vu / en considération de (*« Eu égard aux défis actuels... »*)
* \`D'autant plus que\` : **Niveau C2** • Renforce une cause décisive (*« d'autant plus que l'urgence grandit »*)

---

## 2. Exprimer la Conséquence
*Montrer le résultat ou l'impact d'une action*

* \`Par conséquent\` : Très formel et valorisé en Tâche 2 et 3
* \`C'est pourquoi\` : Idéal pour expliquer une décision
* \`De ce fait\` : Synonyme élégant de "donc"
* \`Ainsi\` : En début de phrase avec inversion facultative
* \`D'où\` : Suivi d’un nom pour synthétiser un effet
* \`Partant\` : **Niveau C2** • Par voie de conséquence directe / déduction logique (*« ..., partant, inefficace »*)
* \`À telle enseigne que\` : **Niveau C2** • À tel point que, avec une intensité remarquable (+ indicatif)

---

## 3. Opposition & Concession
*Nuancer ou opposer deux points de vue (indispensable en Tâche 3)*

* \`Cependant / Néanmoins\` : Opposition modérée et élégante
* \`Bien que (+ subjonctif)\` : Très valorisé (*« Bien qu’il soit difficile... »*)
* \`En revanche / Par contre\` : Contraste direct entre deux situations
* \`Tandis que / Alors que\` : Opposition simultanée entre deux documents
* \`Certes... toutefois...\` : Concéder un point avant de réfuter
* \`Nonobstant (+ nom)\` : **Niveau C2** • Malgré, sans se laisser arrêter par (*« Nonobstant ces réserves... »*)
* \`Quand bien même (+ cond.)\` : **Niveau C2** • Même si, dans l'hypothèse la plus exigeante
* \`Il n'en demeure pas moins que\` : **Niveau C2** • La vérité fondamentale reste inaltérée (+ indicatif)

---

## 4. Addition & Conclusion
*Ajouter des arguments et clore son texte avec force*

* \`D'une part... d'autre part...\` : Structure binaire parfaite pour développer 2 arguments
* \`De surcroît / En outre\` : Remplacer le simple "de plus"
* \`Non seulement... mais aussi...\` : Tournure avancée pour amplifier
* \`En somme / En définitive\` : Pour débuter sa phrase de conclusion finale
* \`Tout compte fait\` : Pour faire le bilan d’une expérience (Tâche 2)
* \`Qui plus est\` : **Niveau C2** • Ajout rhétorique qui renforce puissamment une idée préalable
* \`Au demeurant\` : **Niveau C2** • Du reste, tout bien pesé, par ailleurs
* \`En dernier ressort\` : **Niveau C2** • En ultime instance / pour trancher définitivement

---

## 5. Connecteurs Rhétoriques & Stylistiques de Niveau C2 (Maîtrise Supérieure)
*Score Élite — Formules d'exception pour sublimer une argumentation, démontrer une maîtrise linguistique d'excellence et faire la différence lors de la Tâche 3*

* \`Tant s'en faut (que + subjonctif)\` : Loin de là, absolument pas (*« Le débat n'est pas clos, tant s'en faut »*)
* \`Pour peu que (+ subjonctif)\` : À la moindre condition favorable (*« Pour peu qu'on y consacre les moyens nécessaires... »*)
* \`À supposer que (+ subjonctif)\` : Hypothèse soutenue et mesurée (*« À supposer que cette transition aboutisse... »*)
* \`En l'occurrence\` : Dans le cas précis et spécifique dont il est question ici
* \`Pour autant que (+ indicatif / subj.)\` : Dans la stricte mesure où l'on puisse en juger (*« Pour autant qu'on puisse l'observer »*)
* \`Loin s'en faut\` : Synonyme raffiné de "bien au contraire", pour corriger une fausse idée reçue

---

## Les pièges à bannir absolument au TCF

* ⚠️ **Bannir le langage oralisé** : Évitez formellement *du coup*, *en fait*, *bref*, *au final*.
* ⚠️ **Ne pas surcharger artificiellement** : Un connecteur par phrase alourdit le texte. Placez-en un en amorce de paragraphe et un ou deux à l'intérieur pour articuler les idées.
* ⚠️ **Attention au mode verbal** : Rappelez-vous que *bien que*, *pour peu que* et *à supposer que* exigent impérativement le **subjonctif** !
`
  },

  // FICHE 7 : PASSÉ COMPOSÉ ET IMPARFAIT
  {
    id: 'og000000-0000-0000-0000-000000000003',
    epreuve: 'OUTILS_TEMPS',
    niveau: 'B2',
    titre: 'Passé composé et Imparfait — Raconter des faits et décrire le cadre sans faute de temps',
    ordre_affichage: 11,
    fichier_pdf_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    contenu: `# Passé composé et Imparfait — L'art de raconter au passé

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

---

## Exercice pratique interactif : Validez vos acquis

:::qcm
Q: Pendant que je (...) mes valises dans le salon, mon collègue est venu me chercher en taxi.
- préparais (correct)
- ai préparé
R: L'action de préparer était en cours de déroulement et servait de toile de fond (décor continu) quand un événement ponctuel et soudain est intervenu (mon collègue est venu). On utilise donc l'Imparfait.

Q: Samedi dernier, nous (...) un dîner d'affaires très concluant avec les investisseurs.
- partagions
- avons partagé (correct)
R: Il s'agit d'un événement précis, achevé et délimité dans le temps (« Samedi dernier »). On utilise donc le Passé Composé.

Q: À cette époque, je (...) tous les matins au travail à pied pour faire de l'exercice.
- suis allé
- allais (correct)
R: « À cette époque » et « tous les matins » désignent une habitude ou une répétition passée sans fin délimitée. C'est l'emploi typique de l'Imparfait.

Q: Soudain, la connexion Internet (...) et nous avons dû interrompre la visioconférence.
- s'est coupée (correct)
- se coupait
R: « Soudain » marque une rupture nette et une action ponctuelle qui fait progresser l'histoire. On utilise le Passé Composé.

Q: Les locaux de l'entreprise (...) très lumineux et offraient une vue magnifique sur le fleuve.
- ont été
- étaient (correct)
R: Il s'agit d'une description de décor et d'état (la caméra en plan large qui décrit les lieux sans action ponctuelle). On utilise l'Imparfait.
:::
`
  },

  // FICHE 8 : LES ACCORDS ESSENTIELS
  {
    id: 'og000000-0000-0000-0000-000000000004',
    epreuve: 'OUTILS_ACCORDS',
    niveau: 'B2',
    titre: 'Les Accords Essentiels — Sujet-verbe, adjectifs et participe passé sans hésitation',
    ordre_affichage: 12,
    fichier_pdf_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    contenu: `# Les Accords Essentiels — Éliminer les fautes qui coûtent cher

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

---

## Exercice pratique interactif : Validez vos acquis

:::qcm
Q: La majorité des candidats (...) réussi l'épreuve de compréhension écrite avec brio.
- a (correct)
- ont
R: Lorsque le sujet collectif est précédé d'un article singulier (« La majorité »), le verbe s'accorde au singulier en français soigné (« La majorité a réussi »).

Q: Les recommandations que la commission nous a (...) sont immédiatement applicables.
- transmis
- transmises (correct)
R: Avec l'auxiliaire avoir, le participe passé s'accorde avec le COD placé AVANT le verbe. Ici, « que » reprend « les recommandations » (féminin pluriel) placé avant → « transmises ».

Q: Les agents de bord portaient tous d'élégantes vestes (...).
- bleu marine (correct)
- bleues marines
R: Les adjectifs de couleur composés (comme « bleu marine », « vert clair ») restent toujours invariables en genre et en nombre.

Q: Tout au long de la réunion, les deux directeurs se sont (...) avec grand respect.
- parlé (correct)
- parlés
R: « Parler » se construit avec la préposition « à » (parler À quelqu'un). Le pronom « se » est donc un COI. Sans COD direct, le participe passé reste invariable : « ils se sont parlé ».

Q: C'est moi qui (...) responsable de la coordination de ce projet à Montréal.
- est
- suis (correct)
R: Le pronom relatif « qui » s'accorde avec son antécédent. L'antécédent étant « moi » (1re personne du singulier), le verbe s'accorde à la première personne : « C'est moi qui suis... ».
:::
`
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // EXPRESSION ORALE — LES 4 FICHES OFFICIELLES EXCLUSIVES
  // ══════════════════════════════════════════════════════════════════════════════

  // FICHE 9 : ÉPREUVE TOTALE & VUE D'ENSEMBLE
  {
    id: 'e0000000-0000-0000-0000-000000000001',
    epreuve: 'EO',
    niveau: 'B2',
    titre: "Expression Orale — Épreuve Totale & Vue d'ensemble (Méthode Complète)",
    ordre_affichage: 5,
    fichier_pdf_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    contenu: `# EXPRESSION ORALE — TCF Canada (Épreuve Totale)

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
`
  },

  // FICHE 10 : TÂCHE 1 — SE PRÉSENTER
  {
    id: 'e0000000-0000-0000-0000-000000000002',
    epreuve: 'EO_tache1',
    niveau: 'B2',
    titre: 'Expression Orale — Tâche 1 : Se présenter (Entretien dirigé — 2 à 3 minutes)',
    ordre_affichage: 6,
    fichier_pdf_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    contenu: `# Expression Orale — Tâche 1 : Se présenter (Entretien dirigé)

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
`
  },

  // FICHE 11 : TÂCHE 2 — INTERAGIR POUR OBTENIR DES INFORMATIONS
  {
    id: 'e0000000-0000-0000-0000-000000000003',
    epreuve: 'EO_tache2',
    niveau: 'B2',
    titre: 'Expression Orale — Tâche 2 : Interagir pour obtenir des informations (3 min 30)',
    ordre_affichage: 7,
    fichier_pdf_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    contenu: `# Expression Orale — Tâche 2 : Interagir pour obtenir des informations

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
`
  },

  // FICHE 12 : TÂCHE 3 — EXPRIMER UN POINT DE VUE
  {
    id: 'e0000000-0000-0000-0000-000000000004',
    epreuve: 'EO_tache3',
    niveau: 'B2',
    titre: "Expression Orale — Tâche 3 : Exprimer un point de vue (Monologue & Débat — 4 min 30)",
    ordre_affichage: 8,
    fichier_pdf_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    contenu: `# Expression Orale — Tâche 3 : Exprimer un point de vue

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

### Pour structurer votre discours
* *« Tout d'abord / Premièrement... »*
* *« Ensuite / Deuxièmement... »*
* *« De plus / En outre... »*
* *« Enfin / Pour conclure... »*

### Pour nuancer votre point de vue (Niveau B2/C1)
* *« Certes (...), mais il ne faut pas oublier que... »*
* *« Bien que cela puisse paraître vrai, je pense que... »*
* *« Il est vrai que (...), toutefois... »*
* *« Malgré cela, je considère que... »*

### Pour comparer ou opposer
* *« Comparé à... »*
* *« Tandis que... »*
* *« Contrairement à ce que certains pensent... »*
* *« En revanche... »*

### Pour donner des exemples concrets
* *« Prenons l'exemple de... »*
* *« Par exemple,... »*
* *« Un cas concret serait celui de... »*
* *« Cela se voit notamment dans... »*

### Pour conclure avec force
* *« En somme / En résumé,... »*
* *« Pour toutes ces raisons, je pense que... »*
* *« Cela dit, chacun est libre de son opinion. »*
* *« Finalement, ce qui importe, c'est de... »*
`
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // COMPRÉHENSION ÉCRITE (CE) — LES 2 FICHES OFFICIELLES EXCLUSIVES
  // ══════════════════════════════════════════════════════════════════════════════

  // FICHE 13 : TCF CANADA — COMPRÉHENSION ÉCRITE
  {
    id: 'ce000000-0000-0000-0000-000000000001',
    epreuve: 'CE',
    niveau: 'B2',
    titre: 'TCF Canada : Compréhension Écrite — Méthode Complète, Stratégies & Gestion du Temps',
    ordre_affichage: 13,
    fichier_pdf_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    contenu: `# TCF CANADA : COMPRÉHENSION ÉCRITE

> **Objectif officiel** : Comprendre des textes en français, repérer les informations clés, identifier l'intention de l'auteur, éviter les pièges et répondre efficacement aux questions pour valider le palier **NCLC 7+** (453 à 699 points).

| Paramètre | Modalité officielle de l'épreuve |
| :--- | :--- |
| **Durée totale** | 60 minutes (1 heure), gestion libre du temps entre les 39 questions |
| **Format** | 39 questions à choix multiples (QCM), avec 4 propositions (A, B, C, D) et une seule bonne réponse |
| **Navigation** | Sur ordinateur, possibilité de revenir en arrière sur les questions |
| **Progression** | Textes de plus en plus longs et complexes, du niveau A1 au C2 |
| **Score global** | Noté sur 699 points (les questions difficiles rapportent plus de points) |
| **Zéro pénalité** | Il n'y a pas de points négatifs : répondez impérativement à toutes les questions |
| **Objectif immigration (NCLC 7+ Entrée Express)** | Viser 453 à 699 points en Compréhension Écrite |

---

## 1. Format de l'épreuve par Paliers CECRL

Les 39 questions sont réparties selon la progression suivante :

* **Questions 1 à 4 (Niveau A1)** : Repérage direct d'informations très simples.
* **Questions 5 à 10 (Niveau A2)** : Compréhension de documents élémentaires du quotidien.
* **Questions 11 à 19 (Niveau B1)** : Textes factuels et informatifs courts.
* **Questions 20 à 29 (Niveau B2)** : Textes argumentatifs et articles de société *(Palier décisif NCLC 7)*.
* **Questions 30 à 35 (Niveau C1)** : Textes longs, nuances, analyses et implicite.
* **Questions 36 à 39 (Niveau C2)** : Textes denses, langue abstraite, figures de style et double sens.

---

## 2. Gérer son temps (60 minutes)

Vous disposez d'environ **1 minute 30 par question en moyenne**. Allez vite sur les premières pour garder du temps pour les dernières.

* **Questions faciles (A1-A2, environ Q1 à Q15)** :
  * Temps conseillé : **10 à 12 minutes**.
  * Repère : Environ **45 secondes par question**, textes très courts.
* **Questions moyennes (B1-B2, environ Q16 à Q30)** :
  * Temps conseillé : **Environ 25 minutes**.
  * Repère : Environ **1 min 30 par question**, textes de longueur moyenne.
* **Questions difficiles (C1-C2, environ Q31 à Q39)** :
  * Temps conseillé : **20 à 25 minutes**.
  * Repère : Environ **2 min 30 par question**, textes longs et abstraits.

> **Conseil stratégique** : Si une question résiste, passez à la suivante et revenez-y si le temps le permet. Ne laissez jamais une case vide !

---

## 3. Les types de documents

### Selon le niveau
* **Niveau A1 - A2** :
  * *Documents* : Panneaux, affiches, petites annonces, menus, messages courts, courriels simples.
  * *À comprendre* : Informations concrètes (horaires, prix, lieux, consignes simples).
* **Niveau B1 - B2** :
  * *Documents* : Courriels, lettres, avis, publicités, articles de presse, courriers administratifs.
  * *À comprendre* : Idée générale, argumentation, points de vue, intention de l'auteur.
* **Niveau C1 - C2** :
  * *Documents* : Textes d'opinion, essais, extraits littéraires, articles spécialisés.
  * *À comprendre* : Nuances, implicite, ironie, langue dense et abstraite.

### Ce que vous devez identifier dans un texte
* **Le thème** : De quoi parle le texte ?
* **L'idée principale** : Quel est le message essentiel ?
* **Les informations précises** : Qui, quoi, où, quand, comment, pourquoi ?
* **L'intention de l'auteur** : Informer, expliquer, convaincre, critiquer, conseiller, dénoncer.
* **L'opinion et les arguments** : Ce que pense l'auteur et les raisons qu'il avance.
* **L'implicite** : Ce qu'il fait comprendre sans le dire directement.

---

## 4. La méthode en 5 étapes

1. **Lisez la question et les propositions AVANT le texte** : Vous saurez ce que vous cherchez : une date, une cause, une opinion, l'objectif du texte.
2. **Identifiez le type de document puis survolez** : Titre, expéditeur, mise en page, premières phrases des paragraphes, mots en gras, chiffres.
3. **Repérez les mots-clés** : Noms, dates, chiffres, verbes importants, connecteurs logiques. Ne vous arrêtez pas sur chaque mot inconnu : le contexte aide à deviner.
4. **Comparez les propositions** : Éliminez celles qui contredisent le texte ou qui n'y sont pas justifiées, puis comparez les deux restantes.
5. **Vérifiez le sens** : La réponse doit correspondre exactement à la question posée. Cherchez la reformulation : **la bonne réponse reprend rarement les mots du texte**.

### Lecture selon le niveau
* **A1 à B1** : Balayez le texte pour retrouver les mots-clés ou synonymes de la question.
* **B2 à C2** : Suivez les connecteurs (*cependant, néanmoins, en revanche, en effet*) pour comprendre le cheminement de la pensée de l'auteur.

### Exemple concret

**Extrait de texte** : « Depuis plusieurs années, de nombreuses entreprises autorisent leurs employés à travailler à distance. Cette organisation permet de réduire les déplacements et d'améliorer la flexibilité. Toutefois, certains salariés regrettent le manque de contact avec leurs collègues. »

**Question posée** : Quel inconvénient du télétravail est mentionné dans le texte ?

A. La diminution des salaires  
B. Le manque de contact avec les collègues (Bonne réponse)  
C. L'augmentation des déplacements  
D. La suppression des emplois  

> **Explication** : Réponse **B**. Le texte spécifie explicitement que certains salariés regrettent le manque de contact avec leurs collègues.

---

## 5. Les mots-clés qui guident

### Connecteurs logiques
* \`parce que, puisque, en raison de\` : la cause
* \`donc, par conséquent, ainsi\` : la conséquence
* \`mais, cependant, pourtant, néanmoins\` : l'opposition
* \`en revanche, au contraire\` : le contraste
* \`malgré, bien que (+ subjonctif)\` : la concession
* \`afin de, dans le but de\` : le but
* \`d'abord, ensuite, enfin\` : l'ordre des idées
* \`en effet, effectivement\` : l'explication ou la confirmation
* \`par exemple, notamment\` : l'illustration
* \`finalement, en conclusion\` : la conclusion

### Les négations et les restrictions
Des formulations comme \`ne… pas\`, \`ne… plus\`, \`ne… jamais\`, \`ne… que\`, \`ne… guère\`, \`sans que\`, \`sauf\`, \`uniquement\`, \`à l'exception de\` peuvent changer tout le sens :
* *« Tous les candidats ont réussi, sauf deux. »* → Deux candidats n'ont pas réussi.

### Les reformulations
Une même information s'exprime avec des mots différents dans le texte et dans la bonne réponse. Il faut comprendre le sens, pas seulement reconnaître les mêmes mots :
* *Texte* : « Le coût des transports a augmenté. »  
* *Réponse* : « Les déplacements sont devenus plus chers. »

---

## 6. Les 9 pièges à éviter

1. **Le même mot dans la réponse** : Un mot du texte est repris dans un faux choix pour attirer l'œil, mais l'information est modifiée. Lisez la proposition en entier.
2. **La réponse « vraie » mais hors sujet** : Exacte dans le texte, mais elle ne répond pas à la question posée.
3. **La généralisation abusive** : \`toujours\`, \`jamais\`, \`aucun\`, \`tous\`, \`exclusivement\` sont rarement justes.
4. **Le détail modifié** : Chiffre, négation, cause et conséquence inversées.
5. **Thème ≠ Idée principale** : Un article sur l'environnement peut défendre une idée précise sur les transports ou la consommation.
6. **Fait ≠ Opinion** : Un fait se vérifie, une opinion exprime un jugement. Repérez *« selon l'auteur »*, *« il semble que »*, *« je considère que »*, *« il est regrettable que »*.
7. **L'interprétation personnelle** : Tenez-vous à ce que dit le texte, pas à ce que vous en pensez.
8. **Vouloir comprendre chaque mot** : Un mot inconnu ne rend pas le texte incompréhensible. Utilisez le contexte.
9. **Mal gérer son temps** : Trop s'attarder sur un texte difficile empêche de répondre aux questions suivantes.

## À retenir absolument

1. **39 questions, 60 minutes** : Environ 1 min 30 par question.
2. **Lisez les questions avant le texte** pour savoir ce que vous cherchez.
3. **La bonne réponse est souvent une reformulation**, pas une copie du texte.
4. **Surveillez les connecteurs, négations, généralisations et les détails modifiés**.
5. **Aucun point négatif** : Répondez à toutes les questions.
6. **Ne bloquez pas** : Passez à la suite et revenez-y si le temps le permet.

---

## Exercice pratique interactif : Validez vos acquis

:::qcm
Q: Dans un texte sur le télétravail, l'auteur mentionne : « Cette organisation permet d'améliorer la flexibilité. Toutefois, certains salariés regrettent le manque de contact avec leurs collègues. » Quel inconvénient du télétravail est identifié ?
- La baisse générale des rémunérations
- Le manque de contact avec les collègues (correct)
- L'obligation de travailler le week-end
- La suppression brutale des postes
R: L'auteur oppose le gain de flexibilité à un regret exprimé par certains salariés : le manque d'échanges directs avec leurs pairs.

Q: Lors de l'épreuve de Compréhension Écrite, quel temps moyen devez-vous consacrer aux 15 premières questions (A1-A2) ?
- 25 minutes pour s'assurer de ne faire aucune erreur.
- 10 à 12 minutes (environ 45 secondes par question), afin de garder un maximum de temps pour les textes longs et abstraits de fin d'épreuve. (correct)
- 4 minutes seulement pour l'ensemble du bloc.
R: Les textes du début sont très courts. En y passant 10 à 12 minutes, vous préservez plus de 45 minutes pour aborder sereinement les questions B1 à C2.

Q: Si une proposition de réponse réutilise exactement la même phrase mot pour mot que le document source :
- C'est systématiquement la bonne réponse.
- Il faut se méfier car il s'agit très souvent d'un leurre lexical visant à piéger le candidat pressé ; la bonne réponse est souvent une reformulation. (correct)
- Cela indique que la question a été annulée.
R: Les rédacteurs du TCF piègent fréquemment les candidats en recopiant une phrase du texte dont le contexte ou la portée a été modifiée, alors que la réponse exacte reformule le sens à l'aide de synonymes.

Q: La phrase suivante apparaît dans un avis : « Tous les candidats ont réussi l'épreuve, sauf deux. » Que signifie-t-elle exactement ?
- Tous les candidats ont réussi sans exception.
- Deux candidats n'ont pas réussi l'épreuve. (correct)
- Seuls deux candidats ont obtenu leur examen.
- L'épreuve a été annulée pour deux candidats.
R: La restriction « sauf deux » isole deux candidats qui n'ont pas obtenu l'épreuve, tandis que tous les autres l'ont réussie.

Q: Que devez-vous faire en fin d'épreuve s'il ne vous reste que 30 secondes et qu'une question reste sans réponse ?
- Ne rien cocher pour éviter les points négatifs.
- Cocher immédiatement une réponse par déduction ou au hasard, car il n'y a aucune pénalité pour mauvaise réponse. (correct)
- Fermer la session d'examen immédiatement.
R: Au TCF Canada, il n'y a aucun point négatif. Laisser une case vide garantit 0 point, alors qu'une réponse cochée vous donne une chance d'obtenir des points.
:::
`
  },

  // ══════════════════════════════════════════════════════════════════════════════
  // COMPRÉHENSION ORALE (CO)
  // ══════════════════════════════════════════════════════════════════════════════
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    epreuve: 'CO',
    niveau: 'B2',
    titre: 'TCF Canada : Compréhension Orale — Méthode Complète, Stratégies & Écoute Active',
    ordre_affichage: 15,
    fichier_pdf_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    contenu: `# TCF CANADA : COMPRÉHENSION ORALE

> **Objectif officiel** : Comprendre les enregistrements sonores authentiques, repérer les informations clés, éviter les pièges et répondre correctement aux questions pour viser le palier **NCLC 7+** (458 à 699 points).

| Paramètre | Modalité officielle de l'épreuve |
| :--- | :--- |
| **Durée totale** | 35 minutes |
| **Format** | 39 questions à choix multiples (QCM), avec 4 propositions (A, B, C, D) et une seule bonne réponse |
| **Règle capitale** | Une seule et unique écoute par enregistrement ! |
| **Modalité** | Épreuve individuelle sur ordinateur, avec casque audio |
| **Progression** | Difficulté croissante, du niveau A1 au C2 |
| **Score global** | Noté sur 699 points (les questions difficiles rapportent plus de points) |
| **Zéro pénalité** | Il n'y a pas de points négatifs : ne laissez jamais une question sans réponse |
| **Objectif immigration (NCLC 7+ Entrée Express)** | Viser 458 à 699 points en Compréhension Orale |

---

## 1. Format de l'épreuve par Paliers CECRL

Les 39 questions progressent graduellement du niveau débutant au niveau supérieur :

* **Questions 1 à 4 (Niveau A1)** : Messages très courts et situations simples de la vie quotidienne.
* **Questions 5 à 10 (Niveau A2)** : Annonces publiques et dialogues du quotidien.
* **Questions 11 à 19 (Niveau B1)** : Conversations professionnelles, reportages et extraits d'émissions.
* **Questions 20 à 29 (Niveau B2)** : Interviews, discussions argumentées et débats d'actualité *(Palier clé NCLC 7)*.
* **Questions 30 à 35 (Niveau C1)** : Conférences, débats contradictoires, discours à débit rapide.
* **Questions 36 à 39 (Niveau C2)** : Extraits complexes, nuances, implicite, humour et registre soutenu.

---

## 2. Déroulement d'une question

Chaque question suit une séquence chronologique stricte et automatique :

1. **Affichage préalable** : Les 4 propositions s'affichent à l'écran (parfois accompagnées d'une image d'illustration pour les premières questions).
2. **Signal sonore** : Un bip annonce le début immédiat de l'enregistrement.
3. **Écoute unique** : Vous écoutez le document audio une seule et unique fois.
4. **Question posée à l'oral** : La question est formulée **à l'oral à la fin** de l'enregistrement. Elle n'apparaît **pas** sous forme de texte à l'écran !
5. **Chronomètre de réponse** : Un compte à rebours défile à l'écran. Vous devez cliquer sur votre réponse avant le passage automatique à la question suivante.

---

## 3. Les types de documents sonores

### Selon le niveau CECRL

* **Niveaux A1 - A2** :
  * *Documents* : Messages téléphoniques courts, annonces en gare ou aéroport, conversations du quotidien.
  * *À comprendre* : Informations concrètes immédiates (heure, lieu, prix, motif de retard, consigne simple).
* **Niveaux B1 - B2** :
  * *Documents* : Dialogues professionnels, interviews journalistiques, reportages de société, chroniques radio.
  * *À comprendre* : Idée principale, opinions formulées, arguments des intervenants, ton général.
* **Niveaux C1 - C2** :
  * *Documents* : Débats d'experts, exposés scientifiques, conférences universitaires.
  * *À comprendre* : Nuances subtiles, implicite, second degré, débit de parole soutenu et rapide.

### Ce que vous devez identifier à chaque écoute

* **Le thème** : De quoi parle-t-on exactement ?
* **Les informations précises** : Qui parle, à qui, quoi, où, quand, pourquoi ?
* **L'intention** : Informer, demander, conseiller, critiquer, convaincre, se plaindre, féliciter.
* **L'opinion de la personne** : Est-elle favorable, défavorable, réservée ou neutre ?
* **L'implicite** : Ce que le locuteur laisse entendre sans le formuler de manière directe.

---

## 4. La méthode en 3 temps

### Temps 1 : Avant l'écoute (Anticipation)
* Survolez très rapidement les 4 propositions à l'écran.
* Elles vous révèlent d'emblée le thème général et le type d'information recherchée (un lieu, un chiffre, une raison, une émotion, un avis).

### Temps 2 : Pendant l'écoute (Concentration totale)
* **Dès les premières secondes**, repérez la situation : qui parle, à qui, de quoi et dans quel but.
* **Privilégiez le sens global** plutôt que chaque mot isolé.
* **Ne bloquez jamais sur un mot inconnu** : continuez d'écouter le fil du document.
* **Ne lisez pas les propositions pendant la diffusion de l'audio** : vous risqueriez de perdre le fil et de rater une information capitale.
* Notez mentalement ou sur votre brouillon les éléments précis : chiffres, dates, prix et horaires.

### Temps 3 : Après l'écoute (Validation immédiate)
* **Écoutez avec une attention maximale la question orale finale** : c'est elle qui pose le critère exact (ce que la personne accepte ou refuse, la cause précise, l'opinion définitive…).
* Choisissez la réponse strictement fidèle au document sonore, et **non celle qui vous paraîtrait logique dans la vie réelle**.
* Éliminez rapidement les propositions incohérentes ou contradictoires, puis cliquez sans hésiter.
* Basculez immédiatement votre esprit sur la question suivante dès la validation.

---

## 5. Les mots-clés qui guident l'écoute

### Les connecteurs logiques entendus

* \`parce que, puisque, en raison de\` : indique la cause
* \`donc, par conséquent, ainsi\` : indique la conséquence
* \`mais, cependant, pourtant\` : indique l'opposition
* \`en revanche, au contraire\` : indique le contraste
* \`malgré, bien que\` : indique la concession
* \`afin de, pour que\` : indique le but recherché
* \`d'abord, ensuite, enfin\` : indique l'ordre chronologique des idées
* \`je pense que, à mon avis\` : signale une opinion personnelle
* \`il faudrait, je vous conseille de\` : formule un conseil ou une recommandation
* \`finalement, en définitive\` : introduit la conclusion ou le bilan

### Les négations (Attention aux pièges d'inversion !)
Des petits mots comme \`ne… pas\`, \`ne… plus\`, \`ne… jamais\`, \`sauf\`, \`seulement\` inversent complètement la réalité de la situation :
* *« Je voulais venir, mais je n'ai finalement pas pu. »* → La personne n'est **pas** venue.

### Les corrections et changements d'avis (Le réflexe de la dernière information)
Dans les dialogues authentiques, un interlocuteur commence souvent par dire une chose avant de se corriger :
* Repères audios : *« Non, finalement… »*, *« En fait… »*, *« Je voulais dire… »*.
* **Règle d'or** : C'est **toujours la dernière information exprimée** qui est la bonne !
* *Exemple* : *« Au début, je trouvais ce travail difficile. Aujourd'hui, je le trouve passionnant. »* → L'opinion finale actuelle est **positive**.

---

## 6. Les 5 pièges majeurs à déjouer

1. **Le même mot dans la réponse (Leurre acoustique)** : Un mot clairement entendu dans l'enregistrement figure souvent dans un faux choix pour attirer votre attention. La bonne réponse utilise presque toujours un **synonyme** ou une **reformulation**.
2. **La confusion des sons proches (Paronymes & nombres)** : Attention aux sonorités semblables comme \`quinze\` (15) et \`cinquante\` (50), ou \`deux\` et \`douze\`. Entraînez votre oreille sur les nombres, dates et horaires.
3. **Thème ≠ Idée principale** : Un document peut traiter du télétravail en général, mais la question peut porter précisément sur un inconvénient, une statistique ou le ressenti personnel de l'interlocuteur.
4. **Vouloir tout traduire mot à mot** : Essayer de comprendre 100% des mots est impossible et inutile. Le message général et les repères factuels suffisent amplement.
5. **Se laisser déstabiliser par une question manquée** : Si vous n'avez pas compris un enregistrement, cochez une option au hasard et oubliez-le instantanément. Restez 100% concentré sur le suivant.

### Exemple concret

**Enregistrement sonore** : « Bonjour, votre train pour Montréal aura vingt minutes de retard en raison d'un problème technique. »

**Question posée à l'oral** : Pourquoi le train est-il retardé ?

A. La météo  
B. Un problème technique (Bonne réponse)  
C. Une grève  
D. Un accident  

> **Explication** : Réponse **B**. L'enregistrement spécifie explicitement la cause technique de ce contretemps.

---

## 7. Points de vigilance culturels et linguistiques

* **Diversité des accents francophones** : Le TCF Canada intègre des voix de France, du Québec, d'Afrique francophone, de Belgique et de Suisse.
* **Expressions orales familières et élisions** : Dans les conversations spontanées, les locuteurs contractent souvent la langue (*« j'sais pas »* pour *je ne sais pas*, tournures et expressions québécoises du quotidien).
* **Intonations expressives** : Soyez attentif à la musique de la voix : ironie, hésitation, soulagement, agacement ou enthousiasme.

---

## À retenir absolument

1. **39 questions en 35 minutes, une seule et unique écoute**.
2. **La question est énoncée à l'oral à la fin** : écoutez-la avec une vigilance absolue.
3. **Cherchez le sens global**, ne vous arrêtez pas sur un mot inconnu.
4. **Surveillez les négations, les connecteurs logiques, les chiffres et les rectifications de dernière minute**.
5. **Aucun point négatif** : cochez systématiquement une réponse.
6. **Entraînez-vous avec des audios authentiques et des simulations en temps réel**.

---

## Exercice pratique interactif : Validez vos réflexes d'écoute

:::qcm
Q: Dans un enregistrement, une personne déclare : « J'avais prévu de partir en vacances en juillet, mais finalement mon employeur m'a demandé de décaler mon séjour en septembre ». Quelle information est correcte ?
- La personne partira en vacances en juillet comme prévu.
- La personne a annulé définitivement toutes ses vacances cette année.
- La personne prendra ses vacances au mois de septembre. (correct)
- La personne a démissionné de son entreprise.
R: L'expression « mais finalement » marque une correction de dernière minute : c'est la date de septembre qui est la décision définitive retenue.

Q: Pourquoi ne faut-il pas lire les propositions de réponse pendant que l'enregistrement audio est diffusé ?
- Parce que l'écran s'éteint automatiquement pendant l'écoute.
- Parce que lire et écouter en même temps divise votre attention et vous fait rater des informations capitales du document sonore. (correct)
- Parce que les propositions changent pendant l'enregistrement.
R: La lecture mobilise les mêmes ressources cognitives que l'écoute analytique. Vous devez survoler les options AVANT l'audio, écouter à 100% PENDANT, puis choisir APRÈS avoir entendu la question finale.

Q: Lors d'une annonce en gare, vous entendez : « Le train en provenance de Lyon est attendu voie 15 à 14h50 ». La question orale demande le numéro de la voie. Deux options affichent « 15 » et « 50 ». Quel est le piège classique ?
- L'inversion des dates de départ.
- La confusion auditive entre des nombres à sonorités proches (quinze vs cinquante). (correct)
- L'annonce n'est pas en français.
R: Les confusions entre quinze/cinquante, seize/soixante ou treize/trente font partie des pièges récurrents de compréhension orale au TCF. La voie annoncée est bien la voie 15.

Q: La question posée à la fin de chaque document sonore :
- Est affichée en gros caractères au centre de l'écran pendant toute la durée du test.
- Est formulée uniquement à l'oral à la toute fin de l'audio et n'est pas écrite à l'écran. (correct)
- Est facultative : on peut répondre sans écouter la question.
R: C'est une spécificité capitale de la Compréhension Orale au TCF : la question n'apparaît pas à l'écran, elle est posée oralement à la fin de l'enregistrement. Il faut donc rester concentré jusqu'à la dernière seconde.

Q: Si vous avez manqué la compréhension d'un document sonore au milieu de l'épreuve :
- Vous pouvez appuyer sur le bouton "Rejouer" pour écouter une deuxième fois.
- Vous devez immédiatement choisir une réponse par élimination ou au hasard, puis vous concentrer sans regret sur la question suivante. (correct)
- Vous devez interrompre l'épreuve et appeler l'examinateur.
R: Il n'y a qu'une seule écoute au TCF et aucun point négatif. Cocher une réponse rapidement permet d'aborder la question suivante l'esprit libre sans perdre de temps.
:::
`
  }
];
