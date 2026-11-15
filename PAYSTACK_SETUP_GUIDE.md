# Guide d'Intégration & Configuration Paystack — Mon TCFCA 🇨🇮

Ce guide détaille la mise en service du système de paiement **Paystack** pour **Mon TCFCA**, permettant d'encaisser directement en **Francs CFA (XOF)** via **Wave, Orange Money, MTN MoMo, Moov Money** et **Carte bancaire (Visa/Mastercard)** en Côte d'Ivoire et à l'international.

---

## 1. Récupérer vos clés d'API Paystack

1. Connectez-vous sur votre tableau de bord Paystack : [https://dashboard.paystack.com/#/settings/developer](https://dashboard.paystack.com/#/settings/developer)
2. Dans la section **API Keys & Webhooks** :
   - En mode Test (ou Live) :
     - **Public Key** : `pk_test_...` (ou `pk_live_...`)
     - **Secret Key** : `sk_test_...` (ou `sk_live_...`)

---

## 2. Configuration dans l'application locale / Frontend

Dans le fichier [`.env`](file:///c:/Users/HP/Desktop/MON-TCFCA/.env) :

```env
VITE_SUPABASE_URL=https://levdefzdiwvowtadzdkw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# Clé publique Paystack (Exposée au frontend)
VITE_PAYSTACK_PUBLIC_KEY=pk_test_votre_cle_publique_ici
```

---

## 3. Configuration des Secrets dans Supabase

La clé secrète **ne doit jamais être exposée dans le frontend**. Elle est stockée dans les Secrets Supabase pour les Edge Functions :

### Méthode A : Via le Dashboard Supabase (Le plus simple)
1. Rendez-vous sur votre dashboard Supabase : [https://supabase.com/dashboard/project/levdefzdiwvowtadzdkw](https://supabase.com/dashboard/project/levdefzdiwvowtadzdkw)
2. Allez dans **Project Settings** > **Edge Functions** (ou **Vault / Secrets**).
3. Cliquez sur **New Secret** :
   - Nom : `PAYSTACK_SECRET_KEY`
   - Valeur : `sk_test_...` (ou `sk_live_...`)

### Méthode B : Via la CLI Supabase
```bash
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_votre_cle_secrete_ici
```

---

## 4. Déploiement des Edge Functions Supabase

Déployez les 3 fonctions d'encaissement et de vérification :

```bash
# 1. Initialisation du checkout (Wave, Orange, MTN, Moov, Carte)
supabase functions deploy create-paystack-checkout --no-verify-jwt

# 2. Vérification immédiate au retour sur la page succès
supabase functions deploy verify-paystack-transaction

# 3. Webhook de confirmation asynchrone (Signature HMAC-SHA512)
supabase functions deploy paystack-webhook --no-verify-jwt
```

---

## 5. Configuration du Webhook dans le Dashboard Paystack

1. Rendez-vous dans **Paystack Dashboard** > **Settings** > **API Keys & Webhooks**.
2. Dans le champ **Webhook URL**, saisissez l'URL suivante :
   ```
   https://levdefzdiwvowtadzdkw.supabase.co/functions/v1/paystack-webhook
   ```
3. Cliquez sur **Save Changes**.

---

## 6. Grille des 4 Formules & Quotas associés (en USD $)

| Formule | Prix (USD $) | Durée | Corrections EE | Corrections EO | Examens Blancs | Banque d'items |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Essentiel** | **14,99 $** | 30 jours | 8 | 4 | 1 | 4 320 items |
| **Standard** *(Recommandé)* | **29,99 $** | 30 jours | 20 | 12 | 2 | 4 320 items |
| **Intensif** | **47,99 $** | 40 jours | 50 | 30 | 5 | 4 320 items |
| **Express** | **14,99 $** | 14 jours | 20 | 12 | 2 | 4 320 items |

---

## 7. Parcours Candidat validé

1. Le candidat va sur `/etudiant/abonnement`.
2. Il choisit sa formule et clique sur **Payer en FCFA**.
3. Il est redirigé vers la page sécurisée Paystack où il choisit son moyen de paiement (Wave, Orange Money, MTN, Moov, ou Carte).
4. Dès validation sur son téléphone ou sa carte, il est redirigé vers `/etudiant/abonnement/succes`.
5. Ses quotas sont immédiatement crédités dans la base de données Supabase (`public.abonnements`), et la transaction est archivée dans `public.paiements`.
6. Les modules d'entraînement et d'examen blanc sont automatiquement déverrouillés.
