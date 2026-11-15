# Guide d'Intégration & Configuration PawaPay — Mon TCFCA 🌍

Ce guide détaille la mise en service du système de paiement **PawaPay Checkouts (v2)** pour **Mon TCFCA**, permettant d'encaisser directement en **Francs CFA (XOF / XAF)** et monnaies locales via **Mobile Money (Orange Money, MTN MoMo, Wave, Moov Money, Airtel Money, M-Pesa)** dans plus de 15 pays africains (Côte d'Ivoire, Sénégal, Bénin, Cameroun, Gabon, Congo, RDC, Togo, Burkina Faso, Mali, etc.).

---

## 1. Configurer vos URL de rappel (Callback URLs) sur PawaPay

Avant de pouvoir générer votre jeton API, PawaPay vous demande de configurer vos URL de rappel :

1. Connectez-vous sur votre tableau de bord PawaPay :
   - **Mode Réel (Production)** : [https://dashboard.pawapay.io](https://dashboard.pawapay.io)
   - **Mode Test (Sandbox)** : [https://dashboard.sandbox.pawapay.io](https://dashboard.sandbox.pawapay.io)
2. Allez dans la section **Callback URLs** (ou *System Configuration*).
3. Renseignez l'URL suivante pour tous les types d'opérations (Dépôts / Deposits, Payouts, Refunds) :
   ```text
   https://levdefzdiwvowtadzdkw.supabase.co/functions/v1/pawapay-webhook
   ```
4. Cliquez sur **Enregistrer** (Save).

> [!NOTE]
> Cette URL de webhook peut être partagée sur le même compte PawaPay avec d'autres projets futurs : la fonction `pawapay-webhook` effectue un filtrage automatique via `metadata.project === 'mon-tcfca'` et ignore silencieusement avec un code 200 les transactions destinées à vos autres plateformes.

---

## 2. Générer votre jeton d'API PawaPay

1. Une fois l'URL de rappel enregistrée, cliquez sur **Generate New Token** (ou *Generate API Token*).
2. Copiez la clé API générée (`PAWAPAY_API_KEY`).

---

## 3. Configurer les Secrets dans Supabase

La clé secrète **ne doit jamais être exposée dans le frontend**. Elle est stockée dans les Secrets Supabase pour les Edge Functions :

### Méthode A : Via le Dashboard Supabase (Recommandé)
1. Rendez-vous sur votre projet Supabase :  
   👉 [https://supabase.com/dashboard/project/levdefzdiwvowtadzdkw/settings/functions](https://supabase.com/dashboard/project/levdefzdiwvowtadzdkw/settings/functions)
2. Dans la section **Edge Functions Secrets**, ajoutez les variables suivantes :
   - Nom : `PAWAPAY_API_KEY`  
     Valeur : *Votre clé API PawaPay*
   - Nom : `PAWAPAY_BASE_URL`  
     Valeur : `https://api.pawapay.io` *(ou `https://api.sandbox.pawapay.io` pour les tests)*
3. Cliquez sur **Save**.

### Méthode B : Via la CLI Supabase
```bash
supabase secrets set PAWAPAY_API_KEY="votre_cle_api" PAWAPAY_BASE_URL="https://api.pawapay.io" --project-ref levdefzdiwvowtadzdkw
```

---

## 4. Déploiement des 4 Edge Functions Supabase

Déployez les 4 Edge Functions dédiées à PawaPay :

```bash
# 1. Initialisation de la session de paiement hébergée PawaPay Checkouts avec montants verrouillés
npx supabase functions deploy create-pawapay-checkout --project-ref levdefzdiwvowtadzdkw

# 2. Passerelle HTTPS pour la redirection sécurisée vers localhost en dev ou nom de domaine en prod
npx supabase functions deploy pawapay-redirect --no-verify-jwt --project-ref levdefzdiwvowtadzdkw

# 3. Vérification synchrone lors du retour de l'étudiant
npx supabase functions deploy verify-pawapay-transaction --project-ref levdefzdiwvowtadzdkw

# 4. Réception asynchrone des statuts PawaPay (Webhook)
npx supabase functions deploy pawapay-webhook --no-verify-jwt --project-ref levdefzdiwvowtadzdkw
```

---

## 5. Tarifs et Formules configurés (Montants verrouillés)

Les montants configurés pour PawaPay Checkouts sont verrouillés et non modifiables par le candidat :

| Formule | Durée | Prix USD | Prix XOF / XAF (FCFA) | Quotas inclus |
|---|---|---|---|---|
| **Formule Essentiel** | 30 jours | 14.99 $ | **9 500 FCFA** | 8 EE, 4 EO, 1 Examen blanc, 4 320 items |
| **Formule Standard** *(Recommandé)* | 30 jours | 29.99 $ | **18 500 FCFA** | 20 EE, 12 EO, 2 Examens blancs, 4 320 items |
| **Formule Intensif** | 40 jours | 47.99 $ | **29 900 FCFA** | 50 EE, 30 EO, 5 Examens blancs, 4 320 items |
| **Formule Express** | 14 jours | 14.99 $ | **9 500 FCFA** | 20 EE, 12 EO, 2 Examens blancs, 4 320 items |

---

## 6. Flux Utilisateur & Sécurité

1. L'étudiant choisit sa formule sur `/etudiant/abonnement`.
2. Une modale lui propose le choix entre **Mobile Money (PawaPay)** et **Carte & Paystack**.
3. S'il choisit PawaPay, `create-pawapay-checkout` appelle l'API moderne `POST /v2/checkouts` avec un tableau `amounts` verrouillant le prix pour Côte d'Ivoire, Bénin, Sénégal, Cameroun, Gabon et Congo.
4. L'étudiant est redirigé vers `https://checkout.pawapay.io/...` où :
   - Le montant exact est **pré-affiché et grisé** (le candidat ne peut pas le changer).
   - Le candidat choisit son opérateur (Orange, MTN, Wave, Moov...) et entre son numéro de téléphone.
5. Une fois le code PIN validé sur son téléphone :
   - PawaPay le renvoie vers `pawapay-redirect`, qui exécute une redirection HTTP 302 vers l'application (`localhost:5173` en dev ou domaine en prod).
   - L'étudiant arrive sur `/etudiant/abonnement/succes`.
   - `verify-pawapay-transaction` re-valide le paiement directement auprès de l'API PawaPay v2 (`GET /v2/checkouts/:id`).
   - Les quotas et l'accès complet sont instantanément activés sur son profil.
   - La transaction est enregistrée de façon idempotente dans la table `paiements`.
   - Un email de confirmation lui est envoyé automatiquement.
