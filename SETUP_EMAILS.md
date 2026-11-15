# 📧 Guide de Configuration des Emails Automatiques (Resend + Supabase)

Ce guide décrit pas à pas la configuration, le déploiement et la mise en production du système d'emails transactionnels et d'authentification pour **Mon TCFCA** (`mon-tcfca.com`).

---

## 🏗️ Architecture Globale & Sécurité

* **Expéditeur officiel** : `Mon TCFCA <noreply@mon-tcfca.com>`
* **Moteur d'envoi** : [Resend](https://resend.com) (API v1 et SMTP)
* **Exécution serveur** : Uniquement via **Supabase Edge Functions** (`send-email` et `cron-daily-emails`).
* **Sécurité stricte** :
  * La clé API Resend (`RESEND_API_KEY`) est un **Secret Supabase**, jamais exposée côté client (Vite) ni commitée dans Git.
  * Les requêtes directes à l'Edge Function utilisent le `SERVICE_ROLE_KEY` (pour webhooks et crons) ou le JWT authentifié utilisateur (avec vérification admin pour les tests).
  * Table `email_logs` protégée par Row Level Security (RLS) : lecture réservée aux administrateurs.
  * Idempotence intégrée par clé unique pour empêcher tout double envoi.
  * Plafond quotidien respecté (100 emails/jour sur le plan Resend gratuit).
  * **Logo officiel Mon TCFCA** : intégré dans l'en-tête de chacun des 10 emails (URL CDN publique haute résolution : `https://levdefzdiwvowtadzdkw.supabase.co/storage/v1/object/public/question-images/brand/mon-tcfca-logo.png`, largeur calibrée et élégante à 96 px, cliquable et 100% responsive sur mobile et tous les clients de messagerie).

---

## 📋 Table des 10 Modèles d'Emails

| N° | Clé / Type | Description | Déclencheur | Canal |
|---|---|---|---|---|
| **1** | `auth_verification` | Vérification de l'adresse e-mail | Inscription Supabase Auth | SMTP Supabase |
| **2** | `auth_password_reset` | Réinitialisation du mot de passe | Demande d'oubli de mot de passe | SMTP Supabase |
| **3** | `auth_password_changed` | Confirmation de changement de mot de passe | Mise à jour réussie du mot de passe | Edge Function |
| **4** | `subscription_confirmed` | Confirmation de souscription abonnement | Webhook CinetPay / Stripe / Paystack | Edge Function |
| **5** | `payment_receipt` | Reçu et facture détaillée de paiement | Webhook paiement réussi | Edge Function |
| **6** | `payment_failed` | Alerte échec de paiement (lien retry) | Webhook paiement échoué | Edge Function |
| **7** | `expiration_reminder` | Rappel avant expiration (J-7 et J-1) | Cron quotidien (07h00 UTC) | Edge Function |
| **8** | `subscription_expired` | Notification d'expiration abonnement | Cron quotidien (07h00 UTC) | Edge Function |
| **9** | `renewal_confirmed` | Confirmation de renouvellement automatique | Webhook paiement récurrent | Edge Function |
| **10** | `inactivity_reminder` | Rappel reprise d'activité (7j d'inactivité) | Cron quotidien (07h00 UTC) | Edge Function |

---

## Étape 1 : Configuration du compte Resend

1. Connectez-vous sur [Resend Dashboard](https://resend.com/overview).
2. Rendez-vous dans **API Keys** > Cliquez sur **Create API Key** :
   * Nom : `mon-tcfca-supabase`
   * Permission : `Full access`
   * Notez précieusement votre clé `re_...`.
3. Rendez-vous dans **Domains** > Cliquez sur **Add Domain** :
   * Domaine : `mon-tcfca.com`
   * Région recommandée : `eu-west-1` ou `us-east-1`
   * Ajoutez les enregistrements DNS (DKIM, SPF, MX/TXT) fournis par Resend chez votre registrar (ex: Hostinger, Cloudflare, OVH, Namecheap).
   * Cliquez sur **Verify DNS Records** jusqu'à l'état `Verified`.

> ⚠️ **Note importante pendant les tests** :  
> Tant que votre domaine `mon-tcfca.com` n'a pas encore le statut *Verified* sur Resend, Resend autorise uniquement l'envoi vers **l'adresse email du compte propriétaire Resend**, avec comme expéditeur `onboarding@resend.dev`. Une fois le domaine vérifié, les envois vers tous les candidats fonctionneront avec `Mon TCFCA <noreply@mon-tcfca.com>`.

---

## Étape 2 : Configuration du SMTP Personnalisé dans Supabase Auth

Pour que les emails d'authentification Supabase (Emails 1 et 2) soient envoyés via Resend avec une délivrabilité maximale :

1. Rendez-vous sur votre [Dashboard Supabase](https://supabase.com/dashboard) > Choisissez votre projet.
2. Allez dans **Project Settings** (icône engrenage) > **Authentication**.
3. Défilez jusqu'à la section **SMTP Settings** et activez **Enable Custom SMTP** :
   * **Sender email** : `noreply@mon-tcfca.com` (ou `onboarding@resend.dev` pendant vos tests initiaux)
   * **Sender name** : `Mon TCFCA`
   * **Host** : `smtp.resend.com`
   * **Port** : `465` (SSL) ou `587` (TLS)
   * **Username** : `resend`
   * **Password** : *(Votre clé API Resend `re_...`)*
4. Cliquez sur **Save**.

---

## Étape 3 : Installation des Modèles HTML d'Authentification

Dans le Dashboard Supabase, allez dans **Authentication** > **Email Templates** :

### 1. Modèle « Confirm signup » (Email 1)
* **Subject** : `Activez votre compte Mon TCFCA`
* **Body** : Ouvrez et copiez l'intégralité du fichier [`supabase/email_templates/1_verification_email.html`](file:///c:/Users/HP/Desktop/MON-TCFCA/supabase/email_templates/1_verification_email.html), puis collez-le dans l'onglet **Message (HTML)**.
* Cliquez sur **Save**.

### 2. Modèle « Reset Password » (Email 2)
* **Subject** : `Réinitialisation de votre mot de passe - Mon TCFCA`
* **Body** : Ouvrez et copiez l'intégralité du fichier [`supabase/email_templates/2_reset_password.html`](file:///c:/Users/HP/Desktop/MON-TCFCA/supabase/email_templates/2_reset_password.html), puis collez-le dans l'onglet **Message (HTML)**.
* Cliquez sur **Save**.

*(Note : L'email 3 « Confirmation de changement de mot de passe » est déclenché côté serveur par l'Edge Function dès que l'utilisateur modifie son mot de passe).*

---

## Étape 4 : Déploiement de la Migration SQL

1. Allez dans le **SQL Editor** de votre Dashboard Supabase.
2. Ouvrez le fichier [`supabase/migrations/00055_create_email_logs_and_triggers.sql`](file:///c:/Users/HP/Desktop/MON-TCFCA/supabase/migrations/00055_create_email_logs_and_triggers.sql).
3. Copiez son contenu, collez-le dans le SQL Editor et cliquez sur **Run**.
4. Cela crée :
   * La table `email_logs` avec ses index d'idempotence et politiques de sécurité RLS.
   * La table `email_unsubscribes` pour gérer les désabonnements aux rappels (emails 7 et 10).
   * Les colonnes de préférences `email_reminders_enabled` et `last_activity_reminder_at` sur `profiles`.

---

## Étape 5 : Configuration des Secrets Supabase

Via la CLI Supabase (dans votre terminal) :
```bash
supabase secrets set RESEND_API_KEY=re_votre_cle_ici
supabase secrets set RESEND_FROM_EMAIL="Mon TCFCA <noreply@mon-tcfca.com>"
supabase secrets set APP_URL=https://mon-tcfca.com
```

*Ou directement via l'interface Supabase* :  
**Project Settings** > **Edge Functions** > **Secrets** > **Add new secret** :
* `RESEND_API_KEY` : `re_...`
* `RESEND_FROM_EMAIL` : `Mon TCFCA <noreply@mon-tcfca.com>` (ou `onboarding@resend.dev` en phase de test sans domaine validé)
* `APP_URL` : `https://mon-tcfca.com`

---

## Étape 6 : Déploiement des Edge Functions

Déployez les deux Edge Functions avec la CLI Supabase :

```bash
# Déploiement de la fonction principale d'envoi d'emails
supabase functions deploy send-email --no-verify-jwt

# Déploiement de la fonction cron quotidienne
supabase functions deploy cron-daily-emails --no-verify-jwt
```

---

## Étape 7 : Planification du Cron Quotidien (Emails 7, 8, 10)

L'Edge Function `cron-daily-emails` est déjà dotée de l'annotation native Deno :
```typescript
Deno.cron('daily-email-reminders', '0 7 * * *', async () => { ... })
```

Si vous souhaitez la déclencher via l'extension PostgreSQL `pg_cron` de Supabase (SQL Editor) :
```sql
-- Activer les extensions nécessaires
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Planifier l'exécution tous les jours à 07h00 UTC
select cron.schedule(
  'daily-tcfca-email-reminders',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://<VOTRE-PROJECT-REF>.supabase.co/functions/v1/cron-daily-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <VOTRE_SUPABASE_SERVICE_ROLE_KEY>'
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);
```

---

## Étape 8 : Tester l'Envoi des Emails

Une interface complète de test et de monitoring est intégrée dans l'espace administrateur de l'application :

1. Connectez-vous avec un compte administrateur sur Mon TCFCA.
2. Allez dans le menu latéral > **Emails & Logs** (URL : `/admin/emails`).
3. Vous pouvez :
   * **Tester individuellement chacun des 10 modèles** : saisissez votre adresse email de test et cliquez sur **Envoyer cet email de test**.
   * **Exécuter manuellement le cron quotidien** : bouton « Lancer le cron manuellement » pour tester les rappels J-7, J-1, expiration et inactivité 7j.
   * **Consulter les logs d'envoi en direct** : filtre par statut (`sent`, `failed`, `rate_limited`), date, destinataire, référence Resend et détail technique des erreurs.

---

## 🛡️ Gestion du Quota Gratuit Resend (100 emails/jour)

L'Edge Function `send-email` intègre un comptage automatique des envois sur les dernières 24 heures via la table `email_logs`.
* Si le seuil de **100 emails / 24h** est atteint :
  * Le statut est enregistré comme `rate_limited` dans `email_logs`.
  * La fonction renvoie un code HTTP 429 propre sans provoquer de plantage ni bloquer le paiement ou l'inscription de l'utilisateur.
  * Les emails en échec ou différés sont re-tentés lors de la prochaine exécution ou au passage sur un plan supérieur Resend Pro.
