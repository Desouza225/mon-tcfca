-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION : 00047_update_connecteurs_and_tcf_canada.sql
-- Description : Mise à jour de la fiche Connecteurs Logiques (niveaux B2, C1, C2)
-- et ajustement de la fiche TCF Canada.
-- ZÉRO BARRE VERTICALE - Mise en page épurée et harmonieuse.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Mise à jour de la fiche Connecteurs Logiques
UPDATE public.course_sheets
SET contenu = $CONTENT$# Connecteurs Logiques — Structurer et fluidifier vos productions

> **Règle d'or de notation** : L'utilisation judicieuse et variée des connecteurs logiques permet d'obtenir la note maximale en **cohérence et organisation textuelle** (Niveaux B2, C1 et C2).

---

## 1. Exprimer la Cause
*Expliquer l'origine ou la raison d'un fait (B2 à C2)*

* `Étant donné que` : En tête de phrase pour un fait évident (+ indicatif)
* `Puisque` : Cause déjà connue de l’interlocuteur
* `En raison de` : Cause neutre ou formelle (+ nom)
* `Grâce à` : Cause positive (+ nom)
* `À cause de` : Cause négative (+ nom)
* `Eu égard à (+ nom)` : **Niveau C2** • Très soutenu : vu / en considération de (*« Eu égard aux défis actuels... »*)
* `D'autant plus que` : **Niveau C2** • Renforce une cause décisive (*« d'autant plus que l'urgence grandit »*)

---

## 2. Exprimer la Conséquence
*Montrer le résultat ou l'impact d'une action*

* `Par conséquent` : Très formel et valorisé en Tâche 2 et 3
* `C'est pourquoi` : Idéal pour expliquer une décision
* `De ce fait` : Synonyme élégant de "donc"
* `Ainsi` : En début de phrase avec inversion facultative
* `D'où` : Suivi d’un nom pour synthétiser un effet
* `Partant` : **Niveau C2** • Par voie de conséquence directe / déduction logique (*« ..., partant, inefficace »*)
* `À telle enseigne que` : **Niveau C2** • À tel point que, avec une intensité remarquable (+ indicatif)

---

## 3. Opposition & Concession
*Nuancer ou opposer deux points de vue (indispensable en Tâche 3)*

* `Cependant / Néanmoins` : Opposition modérée et élégante
* `Bien que (+ subjonctif)` : Très valorisé (*« Bien qu’il soit difficile... »*)
* `En revanche / Par contre` : Contraste direct entre deux situations
* `Tandis que / Alors que` : Opposition simultanée entre deux documents
* `Certes... toutefois...` : Concéder un point avant de réfuter
* `Nonobstant (+ nom)` : **Niveau C2** • Malgré, sans se laisser arrêter par (*« Nonobstant ces réserves... »*)
* `Quand bien même (+ cond.)` : **Niveau C2** • Même si, dans l'hypothèse la plus exigeante
* `Il n'en demeure pas moins que` : **Niveau C2** • La vérité fondamentale reste inaltérée (+ indicatif)

---

## 4. Addition & Conclusion
*Ajouter des arguments et clore son texte avec force*

* `D'une part... d'autre part...` : Structure binaire parfaite pour développer 2 arguments
* `De surcroît / En outre` : Remplacer le simple "de plus"
* `Non seulement... mais aussi...` : Tournure avancée pour amplifier
* `En somme / En définitive` : Pour débuter sa phrase de conclusion finale
* `Tout compte fait` : Pour faire le bilan d’une expérience (Tâche 2)
* `Qui plus est` : **Niveau C2** • Ajout rhétorique qui renforce puissamment une idée préalable
* `Au demeurant` : **Niveau C2** • Du reste, tout bien pesé, par ailleurs
* `En dernier ressort` : **Niveau C2** • En ultime instance / pour trancher définitivement

---

## 5. Connecteurs Rhétoriques & Stylistiques de Niveau C2 (Maîtrise Supérieure)
*Score Élite — Formules d'exception pour sublimer une argumentation, démontrer une maîtrise linguistique d'excellence et faire la différence lors de la Tâche 3*

* `Tant s'en faut (que + subjonctif)` : Loin de là, absolument pas (*« Le débat n'est pas clos, tant s'en faut »*)
* `Pour peu que (+ subjonctif)` : À la moindre condition favorable (*« Pour peu qu'on y consacre les moyens nécessaires... »*)
* `À supposer que (+ subjonctif)` : Hypothèse soutenue et mesurée (*« À supposer que cette transition aboutisse... »*)
* `En l'occurrence` : Dans le cas précis et spécifique dont il est question ici
* `Pour autant que (+ indicatif / subj.)` : Dans la stricte mesure où l'on puisse en juger (*« Pour autant qu'on puisse l'observer »*)
* `Loin s'en faut` : Synonyme raffiné de "bien au contraire", pour corriger une fausse idée reçue

---

## Les pièges à bannir absolument au TCF

* ⚠️ **Bannir le langage oralisé** : Évitez formellement *du coup*, *en fait*, *bref*, *au final*.
* ⚠️ **Ne pas surcharger artificiellement** : Un connecteur par phrase alourdit le texte. Placez-en un en amorce de paragraphe et un ou deux à l'intérieur pour articuler les idées.
* ⚠️ **Attention au mode verbal** : Rappelez-vous que *bien que*, *pour peu que* et *à supposer que* exigent impérativement le **subjonctif** !$CONTENT$,
updated_at = NOW()
WHERE id = 'og000000-0000-0000-0000-000000000001';
