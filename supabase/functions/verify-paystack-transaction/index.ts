import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');

const PLAN_QUOTAS: Record<string, { ee: number; eo: number; examens: number; dureeJours: number }> = {
  essentiel: { ee: 8, eo: 4, examens: 1, dureeJours: 30 },
  standard: { ee: 20, eo: 12, examens: 2, dureeJours: 30 },
  intensif: { ee: 50, eo: 30, examens: 5, dureeJours: 40 },
  express: { ee: 20, eo: 12, examens: 2, dureeJours: 14 },
  pack_express: { ee: 20, eo: 12, examens: 2, dureeJours: 14 },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!paystackSecretKey) {
      throw new Error("La clé secrète PAYSTACK_SECRET_KEY n'est pas configurée.");
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Utilisateur non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseAdminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Session invalide' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { reference } = await req.json();
    if (!reference) {
      return new Response(JSON.stringify({ error: 'Référence Paystack manquante' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Interroger l'API Paystack pour vérifier la référence
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      console.error('Erreur retour Paystack Verify API:', paystackData);
      return new Response(
        JSON.stringify({ success: false, error: paystackData.message || 'Échec de la vérification' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const txData = paystackData.data;
    const isSuccess = txData.status === 'success';

    // Vérifier que la transaction appartient bien à l'utilisateur connecté (protection IDOR)
    const txUserId = txData.metadata?.user_id;
    const txEmail = txData.customer?.email?.toLowerCase();
    const callerEmail = user.email?.toLowerCase();
    if (
      (txUserId && txUserId !== user.id) ||
      (!txUserId && txEmail && callerEmail && txEmail !== callerEmail)
    ) {
      console.error(`❌ Tentative IDOR Paystack: user ${user.id} tente de réclamer la transaction de ${txUserId || txEmail}`);
      return new Response(
        JSON.stringify({ success: false, error: "Cette transaction n'appartient pas à votre compte." }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (isSuccess) {
      const planId = txData.metadata?.plan_id || 'standard';
      const channel = txData.channel || 'card';
      const currency = txData.currency || 'USD';
      const amount = txData.amount ? txData.amount / 100 : 29.99;
      const quotas = PLAN_QUOTAS[planId] || PLAN_QUOTAS.standard;
      const periodStart = new Date();
      const periodEnd = new Date(periodStart.getTime() + quotas.dureeJours * 24 * 60 * 60 * 1000);

      const chLower = channel.toLowerCase();
      const isMobileMoney = chLower.includes('mobile') || chLower.includes('momo') || chLower.includes('wave') || chLower.includes('orange') || chLower.includes('mtn');
      const methodStr = isMobileMoney ? 'mobile_money' : channel;
      const autoRenew = (chLower === 'card');

      // Client admin pour mettre à jour la base
      const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Vérifier l'idempotence (empêcher le rejeu d'une référence déjà créditée)
      const { data: existingPayment } = await supabaseAdmin
        .from('paiements')
        .select('id')
        .eq('provider_payment_id', reference)
        .maybeSingle();

      if (!existingPayment) {
        // Mettre à jour l'abonnement
        const { data: subData } = await supabaseAdmin
          .from('abonnements')
          .upsert({
            user_id: user.id,
            etudiant_id: user.id,
            plan_id: planId,
            status: 'active',
            statut: 'actif',
            provider: 'paystack',
            provider_subscription_id: reference,
            methode: methodStr,
            auto_renew: autoRenew,
            quota_ee_restant: quotas.ee,
            quota_eo_restant: quotas.eo,
            quota_examen_blanc_restant: quotas.examens,
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            date_debut: periodStart.toISOString(),
            date_fin: periodEnd.toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })
          .select()
          .single();

        // Enregistrer le paiement
        await supabaseAdmin
          .from('paiements')
          .insert({
            user_id: user.id,
            etudiant_id: user.id,
            abonnement_id: subData?.id || null,
            amount: amount,
            montant: amount,
            currency: currency,
            devise: currency,
            provider: 'paystack',
            methode: channel,
            provider_payment_id: reference,
            status: 'confirme',
            statut: 'confirme',
            created_at: new Date().toISOString(),
          });
      }
    }

    return new Response(
      JSON.stringify({
        success: isSuccess,
        status: txData.status,
        amount: txData.amount ? txData.amount / 100 : undefined,
        planId: txData.metadata?.plan_id,
        reference: txData.reference,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erreur verify-paystack-transaction:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur lors de la vérification' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
