import { createClient } from 'npm:@supabase/supabase-js@2';
import { EMAIL_TEMPLATES, type EmailTemplateData } from './templates.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const DEFAULT_FROM = Deno.env.get('RESEND_FROM_EMAIL') || 'Mon TCF Canada <noreply@mon-tcfca.com>';
const DAILY_LIMIT = 100; // Limite plan gratuit Resend

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Vérification stricte de l'authentification (bloque l'open-relay et la génération non autorisée de liens recovery)
  const authHeader = req.headers.get('Authorization') || '';
  const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!bearerToken) {
    return new Response(JSON.stringify({ error: 'Authentification requise' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let isPrivilegedCaller = Boolean(SERVICE_ROLE_KEY && bearerToken === SERVICE_ROLE_KEY);
  let callerUser: { id: string; email?: string } | null = null;

  if (!isPrivilegedCaller) {
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabaseUserClient = createClient(SUPABASE_URL, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: authData, error: authErr } = await supabaseUserClient.auth.getUser();
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Session invalide ou expirée' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    callerUser = { id: authData.user.id, email: authData.user.email };

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', callerUser.id)
      .maybeSingle();

    if (callerProfile?.role === 'admin' || callerProfile?.role === 'super_admin') {
      isPrivilegedCaller = true;
    }
  }

  let requestBody: any = null;

  try {
    requestBody = await req.json();
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'Body JSON invalide' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const {
    type,
    idempotency_key,
    data = {},
    test = false,
  } = requestBody;
  let user_id = requestBody.user_id;
  let rawEmail = requestBody.email || requestBody.destinataire;

  // Un utilisateur standard ne peut déclencher que son propre email de bienvenue ou de changement de mot de passe
  if (!isPrivilegedCaller) {
    const callerEmail = callerUser?.email?.toLowerCase().trim();
    const requestedEmail = typeof rawEmail === 'string' ? rawEmail.toLowerCase().trim() : '';
    const isSelfAllowed =
      (type === 'auth_password_changed' || type === 'auth_welcome') &&
      !test &&
      (!user_id || user_id === callerUser?.id) &&
      (!requestedEmail || requestedEmail === callerEmail);

    if (!isSelfAllowed) {
      return new Response(
        JSON.stringify({ error: 'Accès refusé : opération réservée aux administrateurs ou au serveur.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    user_id = callerUser?.id;
    rawEmail = callerUser?.email;
  }

  if (!type || (!EMAIL_TEMPLATES[type] && !test)) {
    return new Response(
      JSON.stringify({
        error: `Type d'email inconnu : '${type}'. Types valides : ${Object.keys(EMAIL_TEMPLATES).join(', ')}`,
      }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Clé Resend obligatoire
  if (!RESEND_API_KEY) {
    console.error("❌ Variable RESEND_API_KEY manquante dans l'environnement Supabase.");
    return new Response(
      JSON.stringify({
        error: "Configuration serveur incomplète : RESEND_API_KEY n'est pas définie dans Supabase Secrets.",
        success: false,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    let toEmail = rawEmail;
    let prenom = data.prenom;
    let nom = data.nom;

    // 1. Résolution de l'utilisateur si user_id fourni
    if (user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, prenom, nom, email_reminders_enabled')
        .eq('id', user_id)
        .maybeSingle();

      if (profile) {
        if (!toEmail) toEmail = profile.email;
        if (!prenom) prenom = profile.prenom;
        if (!nom) nom = profile.nom;

        // Vérification des préférences pour les emails non obligatoires
        const isMarketingOrReminder = ['expiration_reminder', 'inactivity_reminder'].includes(type);
        if (isMarketingOrReminder && profile.email_reminders_enabled === false) {
          console.log(`ℹ️ Email ${type} ignoré pour ${user_id} (rappels désactivés dans le profil)`);
          return new Response(
            JSON.stringify({ success: true, skipped: true, reason: 'user_disabled_reminders' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    if (!toEmail) {
      return new Response(
        JSON.stringify({ error: 'Adresse email destinataire manquante (aucun email ni profil valide)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Récupérer le prénom si non fourni
    if (!prenom && toEmail) {
      const { data: p } = await supabaseAdmin
        .from('profiles')
        .select('prenom, nom')
        .eq('email', toEmail.toLowerCase().trim())
        .maybeSingle();
      if (p) {
        prenom = p.prenom;
        nom = p.nom;
      }
    }

    // 2. Vérification dans la table des désinscriptions (pour emails non obligatoires)
    if (['expiration_reminder', 'inactivity_reminder'].includes(type)) {
      const { data: unsub } = await supabaseAdmin
        .from('email_unsubscribes')
        .select('email')
        .eq('email', toEmail.toLowerCase().trim())
        .maybeSingle();

      if (unsub) {
        console.log(`ℹ️ Email ${type} ignoré pour ${toEmail} (adresse présente dans email_unsubscribes)`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: 'unsubscribed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. Idempotence : vérifier si cet email a déjà été envoyé avec cette clé
    if (idempotency_key && user_id) {
      const { data: existingLog } = await supabaseAdmin
        .from('email_logs')
        .select('id, created_at, resend_id')
        .eq('type', type)
        .eq('user_id', user_id)
        .eq('idempotency_key', idempotency_key)
        .eq('statut', 'sent')
        .maybeSingle();

      if (existingLog) {
        console.log(`⚡ Idempotence déclenchée : email ${type} déjà envoyé pour ${user_id} (clé ${idempotency_key})`);
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: 'already_sent',
            log_id: existingLog.id,
            resend_id: existingLog.resend_id,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. Respect du quota journalier Resend (Plan Gratuit : 100/jour)
    const { count: dailyCount } = await supabaseAdmin
      .from('email_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .eq('statut', 'sent');

    if ((dailyCount ?? 0) >= DAILY_LIMIT && !test) {
      console.warn(`⚠️ Quota quotidien Resend atteint (${dailyCount}/${DAILY_LIMIT}). Email ${type} mis en attente.`);
      await supabaseAdmin.from('email_logs').insert({
        user_id: user_id || null,
        type,
        destinataire: toEmail,
        statut: 'rate_limited',
        idempotency_key: idempotency_key || null,
        erreur: `Quota journalier Resend atteint (${dailyCount}/${DAILY_LIMIT}). Envoi reporté.`,
        metadata: data,
      });

      return new Response(
        JSON.stringify({
          success: false,
          rate_limited: true,
          message: 'Quota Resend journalier atteint. Envoi reporté.',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4.bis Génération automatique des liens Supabase Auth si besoin
    if (type === 'auth_password_reset' && !data.confirmationUrl) {
      const siteUrl = Deno.env.get('APP_URL') || 'https://mon-tcfca.com';
      const redirectTo = `${siteUrl}/reinitialisation-mot-de-passe`;
      try {
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: toEmail,
          options: { redirectTo },
        });
        if (!linkErr && linkData?.properties?.action_link) {
          data.confirmationUrl = linkData.properties.action_link;
        } else if (linkErr) {
          console.warn('⚠️ Avertissement génération lien recovery:', linkErr.message);
        }
      } catch (err: any) {
        console.warn('⚠️ Erreur génération lien recovery:', err.message);
      }
    } else if (type === 'auth_verification' && !data.confirmationUrl) {
      const siteUrl = Deno.env.get('APP_URL') || 'https://mon-tcfca.com';
      const redirectTo = `${siteUrl}/connexion`;
      try {
        const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: 'signup',
          email: toEmail,
          options: { redirectTo },
        });
        if (!linkErr && linkData?.properties?.action_link) {
          data.confirmationUrl = linkData.properties.action_link;
        } else if (linkErr) {
          console.warn('⚠️ Avertissement génération lien signup:', linkErr.message);
        }
      } catch (err: any) {
        console.warn('⚠️ Erreur génération lien signup:', err.message);
      }
    }

    // 5. Génération du modèle d'email (avec échappement HTML des champs texte fournis)
    const esc = (v: unknown) =>
      typeof v === 'string'
        ? v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
        : v;
    const templateRenderer = EMAIL_TEMPLATES[type] || EMAIL_TEMPLATES.test_email;
    const templateData: EmailTemplateData = {
      ...data,
      prenom: esc(prenom || data.prenom) as string | undefined,
      nom: esc(nom || data.nom) as string | undefined,
      email: esc(toEmail) as string | undefined,
      planNom: esc(data.planNom) as string | undefined,
      motifEchec: esc(data.motifEchec) as string | undefined,
      methodePaiement: esc(data.methodePaiement) as string | undefined,
      reference: esc(data.reference) as string | undefined,
      numeroRecu: esc(data.numeroRecu) as string | undefined,
    };

    const { subject, html } = templateRenderer(templateData);

    // 6. Expéditeur Resend : Garantir que le nom d'expéditeur affiché soit toujours "Mon TCF Canada"
    let rawFrom = DEFAULT_FROM;
    let senderEmail = 'noreply@mon-tcfca.com';
    const emailMatch = rawFrom.match(/<([^>]+)>/);
    if (emailMatch && emailMatch[1]) {
      senderEmail = emailMatch[1].trim();
    } else if (rawFrom.includes('@')) {
      senderEmail = rawFrom.trim();
    }
    const fromAddress = `Mon TCF Canada <${senderEmail}>`;

    console.log(`📤 Envoi email ${type} à ${toEmail} depuis "${fromAddress}" via Resend...`);

    // 7. Appel API Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toEmail],
        subject: subject,
        html: html,
      }),
    });

    const resendResult = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error(`❌ Échec envoi Resend (${resendResponse.status}):`, resendResult);

      // Journaliser l'échec dans email_logs
      await supabaseAdmin.from('email_logs').insert({
        user_id: user_id || null,
        type,
        destinataire: toEmail,
        sujet: subject,
        statut: 'failed',
        idempotency_key: idempotency_key || null,
        erreur: resendResult?.message || JSON.stringify(resendResult),
        metadata: data,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: resendResult?.message || 'Erreur API Resend',
          resend: resendResult,
        }),
        { status: resendResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Journaliser le succès dans email_logs
    const resendId = resendResult.id || null;
    console.log(`✅ Email ${type} envoyé avec succès à ${toEmail} (Resend ID: ${resendId})`);

    await supabaseAdmin.from('email_logs').insert({
      user_id: user_id || null,
      type,
      destinataire: toEmail,
      sujet: subject,
      statut: 'sent',
      resend_id: resendId,
      idempotency_key: idempotency_key || null,
      metadata: data,
    });

    return new Response(
      JSON.stringify({
        success: true,
        type,
        destinataire: toEmail,
        resend_id: resendId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('❌ Exception inattendue dans send-email:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Erreur interne du serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
