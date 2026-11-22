// ══════════════════════════════════════════════════════════════════════════════
// MON TCFCA — TEMPLATES D'EMAILS TRANSACTIONNELS PROFESSIONNELS
// ══════════════════════════════════════════════════════════════════════════════

export interface EmailTemplateData {
  prenom?: string;
  nom?: string;
  email?: string;
  // Données d'abonnement / plan
  planNom?: string;
  planId?: string;
  dureeJours?: number;
  dateDebut?: string;
  dateFin?: string;
  joursRestants?: number;
  quotaEe?: number;
  quotaEo?: number;
  quotaExamens?: number;
  // Données de paiement / reçu
  montant?: number | string;
  devise?: string;
  reference?: string;
  numeroRecu?: string;
  methodePaiement?: string;
  datePaiement?: string;
  motifEchec?: string;
  // Liens d'action
  actionUrl?: string;
  actionText?: string;
  unsubscribeUrl?: string;
  // Données spécifiques
  joursInactivite?: number;
  tachesEnAttente?: number;
  // Bilan hebdomadaire professeur certifié (Intensif)
  professeurNom?: string;
  professeurTitre?: string;
  numeroBilan?: number;
  objetBilan?: string;
  resumeChiffre?: string;
  niveauEstime?: string;
  // Données auth
  confirmationUrl?: string;
  dateChangement?: string;
  ipAddress?: string;
}

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Layout HTML commun pour tous les emails Mon TCF Canada
 */
export function wrapWithLayout(title: string, bodyContent: string, showUnsubscribe = false, unsubscribeEmail = ''): string {
  const currentYear = new Date().getFullYear();
  const unsubscribeSection = showUnsubscribe
    ? `
      <p style="margin: 12px 0 0 0; font-size: 11px; color: #94A3B8;">
        Vous recevez cet email car vous préparez votre TCF Canada sur mon-tcfca.com.<br>
        Si vous ne souhaitez plus recevoir nos rappels pédagogiques, vous pouvez 
        <a href="https://mon-tcfca.com/unsubscribe?email=${encodeURIComponent(unsubscribeEmail)}" style="color: #64748B; text-decoration: underline;">vous désinscrire en 1 clic</a>.
      </p>
    `
    : `
      <p style="margin: 12px 0 0 0; font-size: 11px; color: #94A3B8;">
        Cet email transactionnel obligatoire concerne votre compte ou vos transactions sur Mon TCF Canada.
      </p>
    `;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #F8F9FF;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      color: #1E293B;
    }
    table {
      border-collapse: collapse;
    }
    img {
      border: 0;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    @media only screen and (max-width: 620px) {
      .container {
        width: 100% !important;
        padding: 16px !important;
      }
      .card {
        padding: 24px 20px !important;
      }
      .btn {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 32px 0; background-color: #F8F9FF;">
  <center>
    <table role="presentation" class="container" style="width: 600px; max-width: 600px; margin: 0 auto; text-align: left;">
      <!-- EN-TÊTE DE MARQUE AVEC LOGO OFFICIEL -->
      <tr>
        <td style="padding: 0 0 20px 0; text-align: center;">
          <a href="https://mon-tcfca.com" target="_blank" style="text-decoration: none; display: inline-block;">
            <img src="https://levdefzdiwvowtadzdkw.supabase.co/storage/v1/object/public/question-images/brand/mon-tcfca-logo.png" alt="Mon TCF Canada — Préparation TCF Canada" width="96" style="width: 96px; max-width: 96px; height: auto; display: block; margin: 0 auto; border: 0;" />
          </a>
        </td>
      </tr>

      <!-- CARTE CONTENU PRINCIPAL -->
      <tr>
        <td>
          <table role="presentation" class="card" style="width: 100%; background-color: #FFFFFF; border-radius: 20px; border: 1px solid #E2E8F0; box-shadow: 0 4px 16px rgba(13, 35, 58, 0.04); overflow: hidden;">
            <tr>
              <td style="padding: 40px 36px;">
                ${bodyContent}
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- PIED DE PAGE -->
      <tr>
        <td style="padding: 28px 20px; text-align: center;">
          <p style="margin: 0; font-size: 13px; font-weight: 600; color: #0D233A;">
            Mon TCF Canada — La plateforme n°1 pour réussir le TCF Canada
          </p>
          <p style="margin: 6px 0 0 0; font-size: 12px; color: #64748B;">
            Besoin d'aide ? Notre équipe est à votre écoute : 
            <a href="mailto:support@mon-tcfca.com" style="color: #0D233A; font-weight: 600; text-decoration: underline;">support@mon-tcfca.com</a>
          </p>
          ${unsubscribeSection}
          <p style="margin: 16px 0 0 0; font-size: 11px; color: #CBD5E1;">
            © ${currentYear} Mon TCF Canada. Tous droits réservés. Conforme Entrée Express Canada.
          </p>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
}

/**
 * Bouton d'action standardisé
 */
function renderButton(text: string, url: string, variant: 'primary' | 'crimson' | 'amber' = 'primary'): string {
  const bg = variant === 'crimson' ? '#E53E3E' : variant === 'amber' ? '#D97706' : '#0D233A';
  return `
    <div style="margin: 32px 0; text-align: center;">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:48px;v-text-anchor:middle;width:260px;" arcsize="20%" stroke="f" fillcolor="${bg}">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:bold;">${text}</center>
      </v:roundrect>
      <![endif]-->
      <a class="btn" href="${url}" target="_blank" style="display: inline-block; background-color: ${bg}; color: #FFFFFF; font-size: 15px; font-weight: 700; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(13, 35, 58, 0.15);">
        ${text} →
      </a>
    </div>
  `;
}

// ══════════════════════════════════════════════════════════════════════════════
// LES 10 TEMPLATES TRANSACTIONNELS OFFICIELS
// ══════════════════════════════════════════════════════════════════════════════

export const EMAIL_TEMPLATES: Record<string, (d: EmailTemplateData) => { subject: string; html: string }> = {

  // 0. EMAIL DE BIENVENUE APRÈS INSCRIPTION
  auth_welcome: (d) => {
    const prenom = escapeHtml(d.prenom || 'Cher candidat');
    const url = d.actionUrl || 'https://mon-tcfca.com/etudiant';
    const subject = 'Bienvenue sur Mon TCF Canada — Votre espace est prêt !';
    const body = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 14px; background: #EFF4FF; color: #0D233A; font-weight: 700; font-size: 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          Bienvenue sur Mon TCF CA
        </span>
      </div>
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0D233A; line-height: 32px; text-align: center;">
        Votre compte candidat a été créé avec succès
      </h1>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Bonjour <strong>${prenom}</strong>,
      </p>
      <p style="margin: 0 0 18px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Bienvenue sur <strong>Mon TCF Canada</strong> ! Vous pouvez dès maintenant consulter la fiche de présentation officielle du TCF Canada dans votre espace, puis choisir la formule qui correspond à votre objectif NCLC 7+ / C1-C2.
      </p>
      ${renderButton('Accéder à mon espace candidat', url, 'primary')}
      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin-top: 24px; font-size: 13px; color: #64748B; line-height: 20px;">
        Besoin d'aide ? Contactez notre équipe à <a href="mailto:contact@mon-tcfca.com" style="color: #0D233A; font-weight: 600;">contact@mon-tcfca.com</a>.
      </div>
    `;
    return { subject, html: wrapWithLayout(subject, body, false) };
  },

  // 1. VÉRIFICATION D'EMAIL
  auth_verification: (d) => {
    const prenom = d.prenom || 'Cher candidat';
    const url = d.confirmationUrl || d.actionUrl || 'https://mon-tcfca.com';
    const subject = 'Bienvenue sur Mon TCF Canada — Confirmez votre adresse email';
    const body = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 14px; background: #EFF4FF; color: #0D233A; font-weight: 700; font-size: 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          Création de compte
        </span>
      </div>
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0D233A; line-height: 32px; text-align: center;">
        Validez votre adresse pour débuter votre entraînement
      </h1>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Bonjour <strong>${prenom}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Nous sommes ravis de vous accompagner dans votre projet d'immigration au Canada. Pour sécuriser votre compte et accéder à nos examens blancs et entraînements corrigés, veuillez confirmer votre adresse email en cliquant ci-dessous :
      </p>
      ${renderButton('Confirmer mon adresse email', url, 'primary')}
      <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin-top: 24px; font-size: 13px; color: #64748B; line-height: 20px;">
        💡 <strong>Sécurité :</strong> Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement ce message. Le lien expirera dans 24 heures.
      </div>
    `;
    return { subject, html: wrapWithLayout(subject, body, false) };
  },

  // 2. RÉINITIALISATION DU MOT DE PASSE
  auth_password_reset: (d) => {
    const prenom = d.prenom || 'Cher candidat';
    const url = d.confirmationUrl || d.actionUrl || 'https://mon-tcfca.com/reset-password';
    const subject = 'Réinitialisation de votre mot de passe — Mon TCF Canada';
    const body = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 14px; background: #FEF3C7; color: #92400E; font-weight: 700; font-size: 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          Sécurité du compte
        </span>
      </div>
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0D233A; line-height: 32px; text-align: center;">
        Demande de réinitialisation de mot de passe
      </h1>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Bonjour <strong>${prenom}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Une demande de réinitialisation de mot de passe a été demandée pour votre compte Mon TCF Canada. Cliquez sur le bouton ci-dessous pour en définir un nouveau :
      </p>
      ${renderButton('Changer mon mot de passe', url, 'crimson')}
      <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 16px; margin-top: 24px; font-size: 13px; color: #991B1B; line-height: 20px;">
        ⚠️ <strong>Important :</strong> Si vous n'avez pas demandé ce changement, ne cliquez pas sur le lien. Votre mot de passe actuel reste inchangé et votre compte est en sécurité.
      </div>
    `;
    return { subject, html: wrapWithLayout(subject, body, false) };
  },

  // 3. CONFIRMATION DU CHANGEMENT DE MOT DE PASSE
  auth_password_changed: (d) => {
    const prenom = d.prenom || 'Cher candidat';
    const dateStr = d.dateChangement || new Date().toLocaleString('fr-FR', { timeZone: 'UTC' });
    const subject = 'Votre mot de passe Mon TCF Canada a été modifié';
    const body = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 14px; background: #DCFCE7; color: #166534; font-weight: 700; font-size: 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          Sécurité validée
        </span>
      </div>
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0D233A; line-height: 32px; text-align: center;">
        Confirmation de modification de mot de passe
      </h1>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Bonjour <strong>${prenom}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Nous vous confirmons que le mot de passe de votre compte <strong>${d.email || ''}</strong> a été modifié avec succès le <strong>${dateStr} (UTC)</strong>.
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Vous pouvez dès à présent vous connecter à votre espace d'entraînement avec votre nouveau mot de passe.
      </p>
      ${renderButton('Accéder à mon espace', 'https://mon-tcfca.com/login', 'primary')}
      <div style="background-color: #FEF2F2; border: 1px solid #FECACA; border-radius: 12px; padding: 16px; margin-top: 24px; font-size: 13px; color: #991B1B; line-height: 20px;">
        🚨 <strong>Vous n'êtes pas à l'origine de cette action ?</strong> Contactez d'urgence notre assistance à <a href="mailto:support@mon-tcfca.com" style="color: #991B1B; font-weight: bold; text-decoration: underline;">support@mon-tcfca.com</a> afin de sécuriser votre compte.
      </div>
    `;
    return { subject, html: wrapWithLayout(subject, body, false) };
  },

  // 4. CONFIRMATION DE SOUSCRIPTION À UN ABONNEMENT
  subscription_confirmed: (d) => {
    const prenom = d.prenom || 'Cher candidat';
    const planNom = d.planNom || 'Formule Standard';
    const subject = `Félicitations ! Votre formule ${planNom} est activée — Mon TCF Canada`;
    const body = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 14px; background: #DCFCE7; color: #166534; font-weight: 700; font-size: 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          Abonnement Activé
        </span>
      </div>
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0D233A; line-height: 32px; text-align: center;">
        Votre préparation au TCF Canada passe au niveau supérieur
      </h1>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Bonjour <strong>${prenom}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Nous confirmons l'activation immédiate de votre formule <strong>${planNom}</strong>. Vos quotas d'évaluations certifiées ont été crédités sur votre compte :
      </p>

      <table role="presentation" style="width: 100%; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; margin: 20px 0;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #E2E8F0;">
            <strong style="color: #0D233A;">✍️ Expression Écrite :</strong>
            <span style="float: right; font-weight: bold; color: #0D233A;">${d.quotaEe ?? 20} corrections</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #E2E8F0;">
            <strong style="color: #0D233A;">🎙️ Expression Orale :</strong>
            <span style="float: right; font-weight: bold; color: #0D233A;">${d.quotaEo ?? 12} évaluations audio</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #E2E8F0;">
            <strong style="color: #0D233A;">🎯 Examens Blancs Complets :</strong>
            <span style="float: right; font-weight: bold; color: #0D233A;">${d.quotaExamens ?? 2} sessions complètes</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px;">
            <strong style="color: #0D233A;">⏳ Durée de validité :</strong>
            <span style="float: right; font-weight: bold; color: #0D233A;">${d.dureeJours ?? 30} jours</span>
          </td>
        </tr>
      </table>

      <p style="margin: 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Chaque correction est analysée selon la grille officielle de France Éducation International (niveaux CECRL A1 à C2, scores sur 699 pts et équivalences NCLC Canada).
      </p>
      ${renderButton('Commencer un entraînement', 'https://mon-tcfca.com/etudiant/dashboard', 'primary')}
    `;
    return { subject, html: wrapWithLayout(subject, body, false) };
  },

  // 5. REÇU / FACTURE DE PAIEMENT (ESSENTIEL)
  payment_receipt: (d) => {
    const prenom = d.prenom || 'Cher client';
    const num = d.numeroRecu || `REC-${Math.floor(100000 + Math.random() * 900000)}`;
    const dateStr = d.datePaiement || new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const planNom = d.planNom || 'Formule Mon TCF Canada';
    const montant = typeof d.montant === 'number' ? d.montant.toLocaleString('fr-FR') : (d.montant || '18 000');
    const devise = d.devise || 'FCFA';
    const methode = d.methodePaiement || 'Carte bancaire / Mobile Money';
    const ref = d.reference || 'PAY-REF';
    const subject = `Reçu de paiement #${num} — Mon TCF Canada`;

    const body = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 14px; background: #EFF4FF; color: #0D233A; font-weight: 700; font-size: 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          Reçu officiel de paiement
        </span>
      </div>
      <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 800; color: #0D233A; line-height: 32px; text-align: center;">
        Merci pour votre règlement !
      </h1>
      <p style="margin: 0 0 24px 0; font-size: 14px; color: #64748B; text-align: center;">
        Reçu n° <strong>${num}</strong> • Émis le ${dateStr}
      </p>

      <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <thead>
          <tr style="background-color: #0D233A; color: #FFFFFF;">
            <th style="padding: 12px 16px; text-align: left; font-size: 13px; font-weight: 700; border-radius: 10px 0 0 0;">Description</th>
            <th style="padding: 12px 16px; text-align: right; font-size: 13px; font-weight: 700; border-radius: 0 10px 0 0;">Montant</th>
          </tr>
        </thead>
        <tbody style="background: #F8FAFC; border: 1px solid #E2E8F0;">
          <tr>
            <td style="padding: 16px; border-bottom: 1px solid #E2E8F0;">
              <strong style="color: #0D233A; font-size: 14px;">Souscription formule ${planNom}</strong><br>
              <span style="color: #64748B; font-size: 12px;">Accès illimité aux fiches, QCM et banques d'expression</span>
            </td>
            <td style="padding: 16px; text-align: right; font-weight: 700; color: #0D233A; font-size: 14px; border-bottom: 1px solid #E2E8F0;">
              ${montant} ${devise}
            </td>
          </tr>
          <tr>
            <td style="padding: 14px 16px; font-weight: 700; color: #0D233A; text-align: right;">Total payé</td>
            <td style="padding: 14px 16px; text-align: right; font-size: 18px; font-weight: 800; color: #0D233A;">
              ${montant} ${devise}
            </td>
          </tr>
        </tbody>
      </table>

      <table role="presentation" style="width: 100%; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; margin-bottom: 24px; font-size: 13px;">
        <tr>
          <td style="padding: 12px 16px; color: #64748B;">Client :</td>
          <td style="padding: 12px 16px; font-weight: 600; color: #0D233A; text-align: right;">${prenom} (${d.email || ''})</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #64748B; border-top: 1px solid #F1F5F9;">Mode de paiement :</td>
          <td style="padding: 12px 16px; font-weight: 600; color: #0D233A; text-align: right; text-transform: capitalize;">${methode}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #64748B; border-top: 1px solid #F1F5F9;">Référence transaction :</td>
          <td style="padding: 12px 16px; font-family: monospace; font-size: 12px; color: #0D233A; text-align: right;">${ref}</td>
        </tr>
        <tr>
          <td style="padding: 12px 16px; color: #64748B; border-top: 1px solid #F1F5F9;">Statut :</td>
          <td style="padding: 12px 16px; font-weight: 700; color: #166534; text-align: right;">Payé avec succès ✅</td>
        </tr>
      </table>

      ${renderButton('Consulter mon espace & mes factures', 'https://mon-tcfca.com/etudiant/abonnement', 'primary')}
    `;
    return { subject, html: wrapWithLayout(subject, body, false) };
  },

  // 6. NOTIFICATION D'ÉCHEC DE PAIEMENT
  payment_failed: (d) => {
    const prenom = d.prenom || 'Cher candidat';
    const planNom = d.planNom || 'votre formule';
    const motif = d.motifEchec || 'Solde insuffisant ou rejet temporaire de l’opérateur';
    const retryUrl = d.actionUrl || 'https://mon-tcfca.com/etudiant/abonnement';
    const subject = `Échec de transaction pour ${planNom} — Action requise`;
    const body = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 14px; background: #FEF2F2; color: #991B1B; font-weight: 700; font-size: 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          Paiement non abouti
        </span>
      </div>
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0D233A; line-height: 32px; text-align: center;">
        Votre règlement n'a pas pu être validé
      </h1>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Bonjour <strong>${prenom}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Nous vous informons que la transaction pour la souscription à <strong>${planNom}</strong> n'a pas pu aboutir.
      </p>

      <div style="background-color: #FEF2F2; border-left: 4px solid #E53E3E; padding: 16px; margin: 20px 0; border-radius: 0 12px 12px 0;">
        <div style="font-size: 13px; font-weight: 700; color: #991B1B; text-transform: uppercase;">Motif communiqué par l'opérateur :</div>
        <div style="font-size: 14px; color: #7F1D1D; margin-top: 4px;">${motif}</div>
      </div>

      <p style="margin: 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Rassurez-vous : aucun montant n'a été débité. Vos entraînements et votre progression sont sauvegardés. Vous pouvez réessayer avec le même moyen de paiement (Orange Money, MTN, Moov, Wave, Carte) ou choisir une autre méthode :
      </p>
      ${renderButton('Réessayer le paiement', retryUrl, 'crimson')}
    `;
    return { subject, html: wrapWithLayout(subject, body, false) };
  },

  // 7. RAPPEL AVANT EXPIRATION (J-7 ou J-1)
  expiration_reminder: (d) => {
    const prenom = d.prenom || 'Cher candidat';
    const jours = d.joursRestants ?? 7;
    const planNom = d.planNom || 'votre formule actuelle';
    const dateFin = d.dateFin || 'bientôt';
    const isJ1 = jours <= 1;
    const subject = isJ1
      ? `Dernier jour ! Votre abonnement Mon TCF Canada expire demain`
      : `Plus que 7 jours avant l'expiration de votre abonnement Mon TCF Canada`;

    const body = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 14px; background: ${isJ1 ? '#FEF2F2' : '#FEF3C7'}; color: ${isJ1 ? '#991B1B' : '#92400E'}; font-weight: 700; font-size: 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          ${isJ1 ? '⚠️ Dernières 24 heures' : '⏳ Rappel échéance'}
        </span>
      </div>
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0D233A; line-height: 32px; text-align: center;">
        ${isJ1 ? 'Votre accès expire demain' : `Votre formule expire dans ${jours} jours`}
      </h1>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Bonjour <strong>${prenom}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Votre abonnement <strong>${planNom}</strong> arrive à échéance le <strong>${dateFin}</strong>.
      </p>

      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 18px; margin: 20px 0;">
        <div style="font-size: 14px; font-weight: 700; color: #0D233A; margin-bottom: 8px;">
          📊 Quotas restants à consommer :
        </div>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #475569; line-height: 22px;">
          <li>${d.quotaEe ?? 0} corrections d'Expression Écrite restantes</li>
          <li>${d.quotaEo ?? 0} évaluations d'Expression Orale restantes</li>
          <li>${d.quotaExamens ?? 0} sessions d'examens blancs complètes</li>
        </ul>
      </div>

      <p style="margin: 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Pour ne pas perdre le rythme de vos révisions et maintenir vos acquis pour le palier NCLC 7+, renouvelez votre formule en quelques clics :
      </p>
      ${renderButton('Renouveler mon abonnement', 'https://mon-tcfca.com/etudiant/abonnement', isJ1 ? 'crimson' : 'amber')}
    `;
    return { subject, html: wrapWithLayout(subject, body, true, d.email || '') };
  },

  // 8. NOTIFICATION D'EXPIRATION DE L'ABONNEMENT
  subscription_expired: (d) => {
    const prenom = d.prenom || 'Cher candidat';
    const planNom = d.planNom || 'votre formule';
    const subject = `Votre formule Mon TCF Canada a expiré — Reprenez là où vous en étiez`;
    const body = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 14px; background: #F1F5F9; color: #475569; font-weight: 700; font-size: 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          Abonnement Terminé
        </span>
      </div>
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0D233A; line-height: 32px; text-align: center;">
        Votre période d'abonnement est arrivée à son terme
      </h1>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Bonjour <strong>${prenom}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Votre souscription à <strong>${planNom}</strong> a pris fin. Vous conservez toujours l'accès à votre historique de notes et à vos corrections passées.
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Pour débloquer de nouveaux sujets d'examens blancs, soumettre de nouvelles productions écrites ou orales et continuer votre préparation active :
      </p>
      ${renderButton('Réactiver mon compte', 'https://mon-tcfca.com/etudiant/abonnement', 'primary')}
    `;
    return { subject, html: wrapWithLayout(subject, body, false) };
  },

  // 9. CONFIRMATION DE RENOUVELLEMENT
  renewal_confirmed: (d) => {
    const prenom = d.prenom || 'Cher candidat';
    const planNom = d.planNom || 'Formule Standard';
    const dateFin = d.dateFin || 'dans 30 jours';
    const subject = `Renouvellement confirmé : vos quotas ${planNom} sont rechargés !`;
    const body = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 14px; background: #DCFCE7; color: #166534; font-weight: 700; font-size: 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          Renouvellement réussi
        </span>
      </div>
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0D233A; line-height: 32px; text-align: center;">
        Votre abonnement a été reconduit avec succès
      </h1>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Bonjour <strong>${prenom}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Votre formule <strong>${planNom}</strong> a été renouvelée. Vos crédits d'entraînements et d'examens blancs sont de nouveau disponibles jusqu'au <strong>${dateFin}</strong>.
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Continuez votre entraînement régulier pour maximiser vos points dans le bassin Entrée Express Canada !
      </p>
      ${renderButton('Reprendre mes entraînements', 'https://mon-tcfca.com/etudiant/dashboard', 'primary')}
    `;
    return { subject, html: wrapWithLayout(subject, body, false) };
  },

  // 10. RAPPEL DE REPRISE D'ACTIVITÉ (INACTIF DEPUIS 7 JOURS)
  inactivity_reminder: (d) => {
    const prenom = d.prenom || 'Cher candidat';
    const subject = `Vous nous manquez, ${prenom} ! Reprenez votre entraînement TCF Canada 🎯`;
    const body = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 14px; background: #EFF4FF; color: #0D233A; font-weight: 700; font-size: 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          Régularité & Réussite
        </span>
      </div>
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0D233A; line-height: 32px; text-align: center;">
        La régularité est le secret du niveau NCLC 7+
      </h1>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Bonjour <strong>${prenom}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Nous avons remarqué que vous ne vous êtes pas entraîné(e) depuis 7 jours. La préparation au TCF Canada demande de la constance : <strong>15 à 20 minutes par jour</strong> suffisent pour consolider vos automatismes en Compréhension et Expression.
      </p>

      <table role="presentation" style="width: 100%; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; margin: 20px 0;">
        <tr>
          <td style="padding: 16px;">
            <div style="font-weight: 700; color: #0D233A; font-size: 14px; margin-bottom: 4px;">🚀 Votre programme rapide du jour :</div>
            <div style="font-size: 13px; color: #64748B; line-height: 20px;">
              • Relire 1 fiche méthode en Compréhension Écrite ou Orale (4 min)<br>
              • Faire 1 série rapide de 10 questions QCM (8 min)<br>
              • Pratiquer 1 sujet d'Expression Orale Tâche 1 (3 min)
            </div>
          </td>
        </tr>
      </table>

      <p style="margin: 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Votre objectif d'immigration est à portée de main. Reprenez dès aujourd'hui :
      </p>
      ${renderButton('Faire une session rapide', 'https://mon-tcfca.com/etudiant/dashboard', 'primary')}
    `;
    return { subject, html: wrapWithLayout(subject, body, true, d.email || '') };
  },

  // BILAN HEBDOMADAIRE PROFESSEUR CERTIFIÉ (FORMULE INTENSIF)
  weekly_professor_report: (d) => {
    const prenom = escapeHtml(d.prenom || 'Cher(e) candidat(e)');
    const profNom = escapeHtml(d.professeurNom || 'Prof. Claire Beaumont');
    const profTitre = escapeHtml(d.professeurTitre || 'Examinatrice & Formatrice Certifiée TCF Canada');
    const num = d.numeroBilan ?? 1;
    const objetBilan = escapeHtml(d.objetBilan || `Votre analyse comparative de la semaine n°${num}`);
    const resume = escapeHtml(d.resumeChiffre || 'Votre professeur certifié a analysé vos derniers résultats et établi votre plan de progression sur 7 jours.');
    const niveau = escapeHtml(d.niveauEstime || 'En cours d’évaluation');
    const subject = `Bilan hebdomadaire n°${num} de ${profNom} — Mon TCF Canada`;

    const body = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 14px; background: #EFF4FF; color: #0D233A; font-weight: 700; font-size: 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          Formule Intensif • Retour Professeur Certifié
        </span>
      </div>
      <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 800; color: #0D233A; line-height: 30px; text-align: center;">
        ${objetBilan}
      </h1>
      <p style="margin: 0 0 20px 0; font-size: 13px; color: #64748B; text-align: center;">
        Rédigé par <strong>${profNom}</strong> — ${profTitre}
      </p>

      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Bonjour <strong>${prenom}</strong>,
      </p>
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Votre <strong>analyse comparative détaillée &amp; retour individualisé n°${num}</strong> est désormais disponible dans votre espace candidat.
      </p>

      <table role="presentation" style="width: 100%; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; margin: 20px 0;">
        <tr>
          <td style="padding: 16px; border-bottom: 1px solid #E2E8F0;">
            <strong style="color: #0D233A; font-size: 13px;">📊 Niveau NCLC estimé :</strong>
            <span style="float: right; font-weight: 700; color: #0D233A; font-size: 13px;">${niveau}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px;">
            <div style="font-weight: 700; color: #0D233A; font-size: 13px; margin-bottom: 6px;">📝 Synthèse de votre professeur :</div>
            <div style="font-size: 13px; color: #475569; line-height: 20px;">${resume}</div>
          </td>
        </tr>
      </table>

      <p style="margin: 20px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Consultez dès maintenant votre bilan complet, le détail par épreuve (CE, CO, EE, EO) ainsi que votre feuille de route personnalisée pour les 7 prochains jours :
      </p>
      ${renderButton('Consulter mon bilan professeur', 'https://mon-tcfca.com/etudiant/bilan-hebdomadaire', 'primary')}
    `;
    return { subject, html: wrapWithLayout(subject, body, true, d.email || '') };
  },

  // MODÈLE DE TEST (POUR LE MODE TEST & DÉBOGAGE)
  test_email: (d) => {
    const typeTeste = d.planNom || 'test_email';
    const subject = `[TEST] Mon TCF Canada — Validation modèle : ${typeTeste}`;
    const body = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="display: inline-block; padding: 6px 14px; background: #FEF3C7; color: #92400E; font-weight: 700; font-size: 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 1px;">
          Mode Test Resend
        </span>
      </div>
      <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #0D233A; line-height: 32px; text-align: center;">
        Validation d'envoi du système d'emails
      </h1>
      <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 24px; color: #334155;">
        Cet email confirme le bon fonctionnement de votre configuration <strong>Resend + Supabase Edge Functions</strong> pour le domaine <strong>mon-tcfca.com</strong>.
      </p>
      <table role="presentation" style="width: 100%; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Modèle testé :</td>
          <td style="padding: 6px 0; font-weight: bold; color: #0D233A; text-align: right;">${typeTeste}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Horodatage :</td>
          <td style="padding: 6px 0; font-weight: bold; color: #0D233A; text-align: right;">${new Date().toISOString()}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Statut API :</td>
          <td style="padding: 6px 0; font-weight: bold; color: #166534; text-align: right;">OK (200) ✅</td>
        </tr>
      </table>
      ${renderButton('Tester la plateforme', 'https://mon-tcfca.com', 'primary')}
    `;
    return { subject, html: wrapWithLayout(subject, body, false) };
  },
};
