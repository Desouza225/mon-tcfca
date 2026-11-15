-- ══════════════════════════════════════════════════════════════════════════════
-- MON TCFCA — MIGRATION 00052 : FICHE DE COURS OFFICIELLE COMPRÉHENSION ORALE (CO)
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

-- INSERTION / MISE À JOUR DE LA FICHE OFFICIELLE DE COMPRÉHENSION ORALE
INSERT INTO public.course_sheets (id, epreuve, niveau, titre, ordre_affichage, contenu)
VALUES
(
  'c0000000-0000-0000-0000-000000000001'::uuid,
  'CO',
  'B2',
  'TCF Canada : Compréhension Orale — Méthode Complète, Stratégies & Écoute Active',
  15,
  $CONTENT$# TCF CANADA : COMPRÉHENSION ORALE

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

* `parce que, puisque, en raison de` : indique la cause
* `donc, par conséquent, ainsi` : indique la conséquence
* `mais, cependant, pourtant` : indique l'opposition
* `en revanche, au contraire` : indique le contraste
* `malgré, bien que` : indique la concession
* `afin de, pour que` : indique le but recherché
* `d'abord, ensuite, enfin` : indique l'ordre chronologique des idées
* `je pense que, à mon avis` : signale une opinion personnelle
* `il faudrait, je vous conseille de` : formule un conseil ou une recommandation
* `finalement, en définitive` : introduit la conclusion ou le bilan

### Les négations (Attention aux pièges d'inversion !)
Des petits mots comme `ne… pas`, `ne… plus`, `ne… jamais`, `sauf`, `seulement` inversent complètement la réalité de la situation :
* *« Je voulais venir, mais je n'ai finalement pas pu. »* → La personne n'est **pas** venue.

### Les corrections et changements d'avis (Le réflexe de la dernière information)
Dans les dialogues authentiques, un interlocuteur commence souvent par dire une chose avant de se corriger :
* Repères audios : *« Non, finalement… »*, *« En fait… »*, *« Je voulais dire… »*.
* **Règle d'or** : C'est **toujours la dernière information exprimée** qui est la bonne !
* *Exemple* : *« Au début, je trouvais ce travail difficile. Aujourd'hui, je le trouve passionnant. »* → L'opinion finale actuelle est **positive**.

---

## 6. Les 5 pièges majeurs à déjouer

1. **Le même mot dans la réponse (Leurre acoustique)** : Un mot clairement entendu dans l'enregistrement figure souvent dans un faux choix pour attirer votre attention. La bonne réponse utilise presque toujours un **synonyme** ou une **reformulation**.
2. **La confusion des sons proches (Paronymes & nombres)** : Attention aux sonorités semblables comme `quinze` (15) et `cinquante` (50), ou `deux` et `douze`. Entraînez votre oreille sur les nombres, dates et horaires.
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
$CONTENT$
)
ON CONFLICT (id) DO UPDATE SET
  titre = EXCLUDED.titre,
  epreuve = EXCLUDED.epreuve,
  niveau = EXCLUDED.niveau,
  ordre_affichage = EXCLUDED.ordre_affichage,
  contenu = EXCLUDED.contenu,
  updated_at = NOW();
