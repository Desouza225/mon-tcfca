import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const cinetpayApiKey = Deno.env.get('CINETPAY_API_KEY');
const cinetpayApiPassword = Deno.env.get('CINETPAY_API_PASSWORD');
const cinetpayBaseUrl = (Deno.env.get('CINETPAY_BASE_URL') || 'https://api.cinetpay.net').replace(/\/+$/, '');

const PLAN_QUOTAS: Record<string, { ee: number; eo: number; examens: number; dureeJours: number }> = {
  essentiel: { ee: 8, eo: 4, examens: 1, dureeJours: 30 },
  standard: { ee: 20, eo: 12, examens: 2, dureeJours: 30 },
  intensif: { ee: 50, eo: 30, examens: 5, dureeJours: 40 },
  express: { ee: 20, eo: 12, examens: 2, dureeJours: 14 },
  pack_express: { ee: 20, eo: 12, examens: 2, dureeJours: 14 },
};

async function getCinetPayToken(): Promise<{ token?: string; error?: string }> {
  try {
    const res = await fetch(`${cinetpayBaseUrl}/v1/oauth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        api_key: cinetpayApiKey?.trim(),
        api_password: cinetpayApiPassword?.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    const token = data?.access_token || data?.data?.token || data?.token;
    if (token) return { token };
    return { error: data?.description || data?.message || 'Échec auth CinetPay' };
  } catch (err: any) {
    return { error: err?.message || 'Erreur réseau CinetPay' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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
      return new Response(JSON.stringify({ error: 'Session invalide ou expirée' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { transactionId } = await req.json().catch(() => ({}));
    if (!transactionId) {
      return new Response(JSON.stringify({ error: 'Identifiant de transaction manquant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Transaction locale
    const { data: existingPayment } = await supabaseAdmin
      .from('paiements')
      .select('*')
      .or(`provider_payment_id.eq.${transactionId},transaction_id.eq.${transactionId}`)
      .maybeSingle();

    const paymentUserId = existingPayment?.user_id || existingPayment?.etudiant_id;
    if (paymentUserId && paymentUserId !== user.id) {
      return new Response(
        JSON.stringify({ success: false, error: "Cette transaction n'appartient pas à votre compte." }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Vérification auprès de l'API CinetPay v1
    const { token, error: tokenError } = await getCinetPayToken();
    let isSuccess = false;
    let statusStr = 'PENDING';
    let checkData: any = {};

    if (token) {
      const checkRes = await fetch(`${cinetpayBaseUrl}/v1/payment/${encodeURIComponent(transactionId)}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      checkData = await checkRes.json().catch(() => ({}));
      statusStr = String(checkData?.status || checkData?.data?.status || 'PENDING').toUpperCase();
      isSuccess = statusStr === 'SUCCESS' || String(checkData?.code) === '100';
    } else {
      console.warn('Vérification sans token (Erreur token):', tokenError);
    }

    const planId = existingPayment?.metadata?.planId || 'standard';

    if (isSuccess) {
      const amount = existingPayment?.amount || 18500;
      const currency = existingPayment?.currency || 'XOF';
      const quotas = PLAN_QUOTAS[planId] || PLAN_QUOTAS.standard;
      const periodStart = new Date();
      const periodEnd = new Date(periodStart.getTime() + quotas.dureeJours * 24 * 60 * 60 * 1000);

      const isAlreadyConfirmed =
        existingPayment?.status === 'confirme' || existingPayment?.statut === 'confirme';

      if (!isAlreadyConfirmed) {
        const { data: subData } = await supabaseAdmin
          .from('abonnements')
          .upsert(
            {
              user_id: user.id,
              etudiant_id: user.id,
              plan_id: planId,
              status: 'active',
              statut: 'actif',
              provider: 'cinetpay',
              provider_subscription_id: transactionId,
              methode: 'cinetpay',
              auto_renew: false,
              quota_ee_restant: quotas.ee,
              quota_eo_restant: quotas.eo,
              quota_examen_blanc_restant: quotas.examens,
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
              date_debut: periodStart.toISOString(),
              date_fin: periodEnd.toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          )
          .select()
          .single();

        if (existingPayment) {
          await supabaseAdmin
            .from('paiements')
            .update({
              status: 'confirme',
              statut: 'confirme',
              abonnement_id: subData?.id || existingPayment.abonnement_id,
              metadata: {
                ...(existingPayment.metadata || {}),
                cinetpay_status: statusStr,
                cinetpay_verified_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingPayment.id);
        }

        await supabaseAdmin
          .from('profiles')
          .update({ examen_blanc_actif: true })
          .eq('id', user.id);

        console.log(`✅ Abonnement et paiement CinetPay confirmés pour ${user.id}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: isSuccess,
        status: statusStr,
        amount: existingPayment?.amount,
        planId,
        transactionId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erreur verify-cinetpay-transaction:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur vérification CinetPay' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
