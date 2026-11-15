import { createClient } from 'npm:@supabase/supabase-js@2';

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
  // CinetPay effectue parfois un HEAD/GET de vérification
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return new Response(JSON.stringify({ status: 'ok', service: 'cinetpay-webhook' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    let transactionId = '';
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await req.formData().catch(() => null);
      if (formData) {
        transactionId = String(
          formData.get('merchant_transaction_id') ||
          formData.get('transaction_id') ||
          formData.get('cpm_trans_id') ||
          ''
        );
      }
    } else {
      const rawText = await req.text().catch(() => '');
      try {
        const json = JSON.parse(rawText);
        transactionId = String(
          json.merchant_transaction_id ||
          json.transaction_id ||
          json.cpm_trans_id ||
          ''
        );
      } catch {
        const params = new URLSearchParams(rawText);
        transactionId = String(
          params.get('merchant_transaction_id') ||
          params.get('transaction_id') ||
          params.get('cpm_trans_id') ||
          ''
        );
      }
    }

    if (!transactionId) {
      return new Response(JSON.stringify({ received: true, message: 'No transaction ID' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAdminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: existingPayment } = await supabaseAdmin
      .from('paiements')
      .select('*')
      .or(`provider_payment_id.eq.${transactionId},transaction_id.eq.${transactionId}`)
      .maybeSingle();

    // Règle de sécurité CinetPay : toujours re-vérifier le statut canonique via GET /v1/payment/{merchant_transaction_id}
    const { token } = await getCinetPayToken();
    let isSuccess = false;
    let statusStr = 'PENDING';

    if (token) {
      const checkRes = await fetch(`${cinetpayBaseUrl}/v1/payment/${encodeURIComponent(transactionId)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const checkData = await checkRes.json().catch(() => ({}));
      statusStr = String(checkData?.status || checkData?.data?.status || '').toUpperCase();
      isSuccess = statusStr === 'SUCCESS' || String(checkData?.code) === '100';
    }

    const userId = existingPayment?.user_id || existingPayment?.etudiant_id;
    const planId = existingPayment?.metadata?.planId || 'standard';

    if (isSuccess && userId) {
      const isAlreadyConfirmed =
        existingPayment?.status === 'confirme' || existingPayment?.statut === 'confirme';

      if (!isAlreadyConfirmed) {
        const quotas = PLAN_QUOTAS[planId] || PLAN_QUOTAS.standard;
        const periodStart = new Date();
        const periodEnd = new Date(periodStart.getTime() + quotas.dureeJours * 24 * 60 * 60 * 1000);

        const { data: subData } = await supabaseAdmin
          .from('abonnements')
          .upsert(
            {
              user_id: userId,
              etudiant_id: userId,
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
                cinetpay_webhook_completed: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingPayment.id);
        }

        await supabaseAdmin
          .from('profiles')
          .update({ examen_blanc_actif: true })
          .eq('id', userId);

        console.log(`✅ Webhook CinetPay: Transaction ${transactionId} confirmée pour ${userId}`);
      }
    } else if (statusStr === 'FAILED' || statusStr === 'EXPIRED') {
      if (existingPayment && existingPayment.status === 'en_attente') {
        await supabaseAdmin
          .from('paiements')
          .update({ status: 'echoue', statut: 'echoue', updated_at: new Date().toISOString() })
          .eq('id', existingPayment.id);
      }
    }

    return new Response(JSON.stringify({ received: true, status: statusStr }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Erreur webhook CinetPay:', err);
    return new Response(JSON.stringify({ error: err?.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
