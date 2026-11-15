-- ══════════════════════════════════════════════════════════════════════════════
-- MON TCFCA — MIGRATION 00051 : FICHE DE COURS OFFICIELLE COMPRÉHENSION ÉCRITE (CE)
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

-- INSERTION / MISE À JOUR DE LA FICHE OFFICIELLE DE COMPRÉHENSION ÉCRITE
INSERT INTO public.course_sheets (id, epreuve, niveau, titre, ordre_affichage, contenu)
VALUES
(
  'ce000000-0000-0000-0000-000000000001'::uuid,
  'CE',
  'B2',
  'TCF Canada : Compréhension Écrite — Méthode Complète, Stratégies & Gestion du Temps',
  13,
  $CONTENT$# TCF CANADA : COMPRÉHENSION ÉCRITE

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
* `parce que, puisque, en raison de` : la cause
* `donc, par conséquent, ainsi` : la conséquence
* `mais, cependant, pourtant, néanmoins` : l'opposition
* `en revanche, au contraire` : le contraste
* `malgré, bien que (+ subjonctif)` : la concession
* `afin de, dans le but de` : le but
* `d'abord, ensuite, enfin` : l'ordre des idées
* `en effet, effectivement` : l'explication ou la confirmation
* `par exemple, notamment` : l'illustration
* `finalement, en conclusion` : la conclusion

### Les négations et les restrictions
Des formulations comme `ne… pas`, `ne… plus`, `ne… jamais`, `ne… que`, `ne… guère`, `sans que`, `sauf`, `uniquement`, `à l'exception de` peuvent changer tout le sens :
* *« Tous les candidats ont réussi, sauf deux. »* → Deux candidats n'ont pas réussi.

### Les reformulations
Une même information s'exprime avec des mots différents dans le texte et dans la bonne réponse. Il faut comprendre le sens, pas seulement reconnaître les mêmes mots :
* *Texte* : « Le coût des transports a augmenté. »  
* *Réponse* : « Les déplacements sont devenus plus chers. »

---

## 6. Les 9 pièges à éviter

1. **Le même mot dans la réponse** : Un mot du texte est repris dans un faux choix pour attirer l'œil, mais l'information est modifiée. Lisez la proposition en entier.
2. **La réponse « vraie » mais hors sujet** : Exacte dans le texte, mais elle ne répond pas à la question posée.
3. **La généralisation abusive** : `toujours`, `jamais`, `aucun`, `tous`, `exclusivement` sont rarement justes.
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
R: Au TCF Canada, il n'y a aucun point négatif. Laisser une case vide garantit 0 point, alors que cocher une option vous donne une chance d'obtenir des points.
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
