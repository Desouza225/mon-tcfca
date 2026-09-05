# 🚀 Guide de Sécurité & Checklist de Mise en Ligne — EDUDESK-TCF

Ce guide rassemble toutes les instructions et vérifications nécessaires pour déployer l'application **EDUDESK-TCF** en production en toute sécurité.

---

## 1. 🔐 Variables d'Environnement de Production

Sur votre plateforme d'hébergement (Vercel, Netlify, Render, Cloudflare Pages, VPS, etc.) :
Configurez les variables d'environnement suivantes :

```env
VITE_SUPABASE_URL=https://<votre-id-projet>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi... (votre clé publique anon)
VITE_APP_ID=app-edudesk-tcf
```

> [!IMPORTANT]
> **Ne configurez JAMAIS** la clé secrète `SERVICE_ROLE_KEY` dans les variables `VITE_*` du frontend React. La clé secrète ne doit être utilisée que dans les **Edge Functions** Supabase.

---

## 2. 🛡️ Vérification de la Sécurité Supabase

### A. Row Level Security (RLS)
Assurez-vous que le RLS est bien activé sur toutes vos tables :
- `profiles`
- `questions`
- `taches`
- `sessions_examen`
- `reponses_qcm`
- `productions`
- `notifications`
- `attributions`
- `abonnements`
- `paiements`
- `audit_suppressions`

Toutes les migrations nécessaires se trouvent dans le dossier `supabase/migrations/` (de `00001_` à `00025_`).

### B. Configuration des Buckets de Stockage Supabase (Storage)
Vérifiez que les buckets suivants existent et sont configurés :
1. **`questions-media`** (Public : Oui) — images et audios des questions QCM / EE / EO.
2. **`productions-audio`** (Public : Oui avec RLS / Accès restreint) — enregistrements vocaux des candidats.

### C. Sécurisation des Edge Functions
Les fonctions `create-user`, `delete-user` et `setup-super-admin` sont situées dans `supabase/functions/`.
- Déployez-les via le CLI Supabase :
  ```bash
  supabase functions deploy create-user
  supabase functions deploy delete-user
  supabase functions deploy setup-super-admin
  supabase functions deploy cleanup-expired-profiles
  supabase functions deploy warn-expiring-profiles
  ```
- Configurez le secret optionnel `SETUP_SECRET_KEY` dans les secrets Supabase :
  ```bash
  supabase secrets set SETUP_SECRET_KEY=votre_cle_secrete_robuste
  ```

---

## 3. 📧 Configuration de l'Envoi d'Emails (Auth & Notifications)
1. Rendez-vous dans **Supabase Dashboard > Authentication > Email Templates**.
2. Configurez un fournisseur SMTP personnalisé (SendGrid, Resend, Mailgun ou Amazon SES) pour éviter les limites de quota du serveur mail par défaut de Supabase.
3. Personnalisez l'URL de redirection de confirmation de mot de passe (`Site URL` : `https://votre-domaine.com`).

---

## 4. 🌐 Hébergement Frontend & Routage SPA (Single Page Application)

L'application utilise **React Router v7** en mode Single Page Application (SPA).
Pour éviter les erreurs `404 Not Found` lors du rafraîchissement d'une page (ex: `/etudiant/entrainement` ou `/admin/questions`) :

### Configuration Vercel (`vercel.json`)
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### Configuration Netlify (`public/_redirects`)
```
/*    /index.html   200
```

### Configuration Nginx (VPS)
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

---

## 5. 🔍 Résumé des Hardening & Protections Intégrées au Code

| Domaine | Protection en Place | Statut |
| :--- | :--- | :---: |
| **Authentification** | Session unique par token dynamique (`current_session_token`), déconnexion automatique en cas de connexion concurrente | ✅ Actif |
| **Contrôle d'Accès** | `RouteGuard` avec contrôle strict des rôles (`super_admin`, `admin`, `professeur`, `etudiant`) | ✅ Actif |
| **Injection XSS** | Aucun usage de `dangerouslySetInnerHTML`, échappement React natif | ✅ Actif |
| **Dépôt Git** | Fichier `.gitignore` étanche (exclusion `.env`, `node_modules`, `dist`, clés) | ✅ Actif |
| **Sécurité Web** | Balises Meta `nosniff`, `strict-origin-when-cross-origin`, protection contre la traduction altérant le DOM | ✅ Actif |
| **Gestion Mémoire** | Révocation des Object URLs (`URL.revokeObjectURL`) et libération des ressources audio | ✅ Actif |
| **Banque Autonome** | 509 sujets EO & 948 sujets EE 100% dédupliqués avec chargement résilient | ✅ Actif |

---

## 6. 🏁 Checklist Finale avant Lancement Public

- [ ] Créer le compte Super Administrateur via l'interface ou l'Edge Function `setup-super-admin`.
- [ ] Vérifier que les variables d'environnement de production sont injectées sur l'hébergeur.
- [ ] Tester une session complète d'examen blanc (CO, CE, EE, EO).
- [ ] Vérifier que la correction par le professeur s'effectue et notifie l'étudiant.
- [ ] Activer le certificat SSL/TLS (HTTPS) sur votre nom de domaine.
