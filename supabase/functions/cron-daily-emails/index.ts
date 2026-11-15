import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Déclencheur Deno.cron natif tous les matins à 07h00 UTC
Deno.cron('cron-daily-emails', '0 7 * * *', async () => {
  console.log('⏰ Exécution planifiée Deno.cron : cron-daily-emails');
  await executeDailyEmails();
});

async function executeDailyEmails(): Promise<{
  remindersJ7: number;
  remindersJ1: number;
  expirations: number;
  inactivities: number;
}> {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const now = new Date();
  const summary = { remindersJ7: 0, remindersJ1: 0, expirations: 0, inactivities: 0 };

  // Helper pour appeler send-email en interne
  const triggerEmail = async (payload: any) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      return data?.success;
    } catch (e) {
      console.error('Erreur appel send-email:', e);
      return false;
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // 1. RAPPEL J-7 AVANT EXPIRATION DE L'ABONNEMENT
  // ══════════════════════════════════════════════════════════════════════════
  const j7Start = new Date(now.getTime() + 6 * 24 * 3600 * 1000).toISOString();
  const j7End = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();

  const { data: subsJ7 } = await supabase
    .from('abonnements')
    .select('id, user_id, etudiant_id, plan_id, current_period_end, quota_ee_restant, quota_eo_restant, quota_examen_blanc_restant')
    .in('status', ['active', 'actif'])
    .gte('current_period_end', j7Start)
    .lte('current_period_end', j7End);

  for (const sub of subsJ7 || []) {
    const userId = sub.user_id || sub.etudiant_id;
    if (!userId) continue;

    const dateFinStr = new Date(sub.current_period_end).toLocaleDateString('fr-FR');
    const idempotencyKey = `j7_${sub.id}_${sub.current_period_end.slice(0, 10)}`;

    const ok = await triggerEmail({
      type: 'expiration_reminder',
      user_id: userId,
      idempotency_key: idempotencyKey,
      data: {
        joursRestants: 7,
        dateFin: dateFinStr,
        quotaEe: sub.quota_ee_restant,
        quotaEo: sub.quota_eo_restant,
        quotaExamens: sub.quota_examen_blanc_restant,
      },
    });
    if (ok) summary.remindersJ7++;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. RAPPEL J-1 AVANT EXPIRATION (DERNIÈRE CHANCE)
  // ══════════════════════════════════════════════════════════════════════════
  const j1Start = now.toISOString();
  const j1End = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();

  const { data: subsJ1 } = await supabase
    .from('abonnements')
    .select('id, user_id, etudiant_id, plan_id, current_period_end, quota_ee_restant, quota_eo_restant, quota_examen_blanc_restant')
    .in('status', ['active', 'actif'])
    .gte('current_period_end', j1Start)
    .lte('current_period_end', j1End);

  for (const sub of subsJ1 || []) {
    const userId = sub.user_id || sub.etudiant_id;
    if (!userId) continue;

    const dateFinStr = new Date(sub.current_period_end).toLocaleDateString('fr-FR');
    const idempotencyKey = `j1_${sub.id}_${sub.current_period_end.slice(0, 10)}`;

    const ok = await triggerEmail({
      type: 'expiration_reminder',
      user_id: userId,
      idempotency_key: idempotencyKey,
      data: {
        joursRestants: 1,
        dateFin: dateFinStr,
        quotaEe: sub.quota_ee_restant,
        quotaEo: sub.quota_eo_restant,
        quotaExamens: sub.quota_examen_blanc_restant,
      },
    });
    if (ok) summary.remindersJ1++;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. NOTIFICATION D'EXPIRATION DU JOUR (EXPIRÉ DEPUIS MOINS DE 24H)
  // ══════════════════════════════════════════════════════════════════════════
  const expHier = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

  const { data: subsExpired } = await supabase
    .from('abonnements')
    .select('id, user_id, etudiant_id, plan_id, current_period_end')
    .lte('current_period_end', now.toISOString())
    .gte('current_period_end', expHier);

  for (const sub of subsExpired || []) {
    const userId = sub.user_id || sub.etudiant_id;
    if (!userId) continue;

    // Basculer le statut en expired si ce n'est pas déjà fait
    await supabase
      .from('abonnements')
      .update({ status: 'expired', statut: 'expire' })
      .eq('id', sub.id);

    const idempotencyKey = `expired_${sub.id}_${sub.current_period_end.slice(0, 10)}`;

    const ok = await triggerEmail({
      type: 'subscription_expired',
      user_id: userId,
      idempotency_key: idempotencyKey,
      data: {
        planNom: sub.plan_id ? `Formule ${sub.plan_id}` : 'Votre formule',
      },
    });
    if (ok) summary.expirations++;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. RAPPEL D'INACTIVITÉ (7 JOURS SANS CONNEXION)
  // ══════════════════════════════════════════════════════════════════════════
  const inactifMin = new Date(now.getTime() - 8 * 24 * 3600 * 1000).toISOString();
  const inactifMax = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();

  const { data: inactifs } = await supabase
    .from('profiles')
    .select('id, email, prenom, last_active_at, last_activity_reminder_at, email_reminders_enabled')
    .eq('role', 'etudiant')
    .eq('email_reminders_enabled', true)
    .gte('last_active_at', inactifMin)
    .lte('last_active_at', inactifMax)
    .or(`last_activity_reminder_at.is.null,last_activity_reminder_at.lte.${new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString()}`);

  for (const prof of inactifs || []) {
    const idempotencyKey = `inact_${prof.id}_${now.toISOString().slice(0, 10)}`;

    const ok = await triggerEmail({
      type: 'inactivity_reminder',
      user_id: prof.id,
      email: prof.email,
      idempotency_key: idempotencyKey,
      data: {
        prenom: prof.prenom,
        joursInactivite: 7,
      },
    });

    if (ok) {
      summary.inactivities++;
      await supabase
        .from('profiles')
        .update({ last_activity_reminder_at: now.toISOString() })
        .eq('id', prof.id);
    }
  }

  console.log('📊 Résumé cron quotidien emails :', summary);
  return summary;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const cronSecret = Deno.env.get('CRON_SECRET') || Deno.env.get('CLEANUP_SECRET') || '';

    let isAuthorized = false;
    if (cronSecret && bearerToken === cronSecret) {
      isAuthorized = true;
    } else if (SERVICE_ROLE_KEY && bearerToken === SERVICE_ROLE_KEY) {
      isAuthorized = true;
    } else if (bearerToken) {
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
      const userClient = createClient(SUPABASE_URL, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: authData } = await userClient.auth.getUser();
      if (authData?.user) {
        const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .maybeSingle();
        if (profile?.role === 'admin' || profile?.role === 'super_admin') {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ success: false, error: 'Non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const summary = await executeDailyEmails();
    return new Response(JSON.stringify({ success: true, summary }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Erreur exécution cron-daily-emails:', err);
    return new Response(JSON.stringify({ success: false, error: err?.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
