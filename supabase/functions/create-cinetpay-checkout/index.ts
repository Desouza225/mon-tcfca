import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const cinetpayApiKey = Deno.env.get('CINETPAY_API_KEY');
const cinetpayApiPassword = Deno.env.get('CINETPAY_API_PASSWORD');
const cinetpayBaseUrl = (Deno.env.get('CINETPAY_BASE_URL') || 'https://api.cinetpay.net').replace(/\/+$/, '');

const PLAN_CATALOG: Record<
  string,
  { nom: string; priceUsd: number; priceXof: number; dureeJours: number; cleanDescription: string }
> = {
  essentiel: {
    nom: 'Formule Essentiel',
    cleanDescription: 'Mon TCFCA Formule Essentiel 30 jours',
    priceUsd: 14.99,
    priceXof: 9500,
    dureeJours: 30,
  },
  standard: {
    nom: 'Formule Standard',
    cleanDescription: 'Mon TCFCA Formule Standard 30 jours',
    priceUsd: 29.99,
    priceXof: 18500,
    dureeJours: 30,
  },
  intensif: {
    nom: 'Formule Intensif',
    cleanDescription: 'Mon TCFCA Formule Intensif 40 jours',
    priceUsd: 47.99,
    priceXof: 29900,
    dureeJours: 40,
  },
  express: {
    nom: 'Formule Express',
    cleanDescription: 'Mon TCFCA Formule Express 14 jours',
    priceUsd: 14.99,
    priceXof: 9500,
    dureeJours: 14,
  },
  pack_express: {
    nom: 'Formule Express',
    cleanDescription: 'Mon TCFCA Formule Express 14 jours',
    priceUsd: 14.99,
    priceXof: 9500,
    dureeJours: 14,
  },
};

/**
 * Authentification OAuth CinetPay v1
 * POST /v1/oauth/login -> récupère le Bearer token
 */
async function getCinetPayToken(): Promise<{ token?: string; error?: string; raw?: any }> {
  try {
    const res = await fetch(`${cinetpayBaseUrl}/v1/oauth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        api_key: cinetpayApiKey?.trim(),
        api_password: cinetpayApiPassword?.trim(),
      }),
    });

    const data = await res.json().catch(() => ({}));

    // CinetPay retourne le token dans access_token (ou data.token / token)
    const token = data?.access_token || data?.data?.token || data?.token;
    if (token) {
      return { token };
    }

    const errorDesc =
      data?.description ||
      data?.message ||
      data?.status ||
      `Erreur authentification CinetPay (Code ${data?.code || res.status})`;

    return { error: errorDesc, raw: data };
  } catch (err: any) {
    return { error: err?.message || 'Connexion impossible à api.cinetpay.net' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!cinetpayApiKey || !cinetpayApiPassword) {
      return new Response(
        JSON.stringify({
          error: "CINETPAY_API_KEY ou CINETPAY_API_PASSWORD n'est pas configuré dans Supabase.",
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Authentification Supabase de l'utilisateur
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Session non autorisée. Veuillez vous connecter.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseAdminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Session expirée. Veuillez vous reconnecter pour payer.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { planId, returnUrl, phoneNumber } = body;

    const normalizedPlanId = planId === 'pack_express' ? 'express' : planId;
    const targetPlan = PLAN_CATALOG[planId];
    if (!targetPlan) {
      return new Response(
        JSON.stringify({ error: `Plan invalide sélectionné : ${planId}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. Profil candidat
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('nom, prenom, pays, telephone')
      .eq('id', user.id)
      .maybeSingle();

    const customerName = (profile?.nom || 'Candidat').replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'Candidat';
    const customerSurname = (profile?.prenom || 'TCFCA').replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'TCFCA';
    const rawPhone = (phoneNumber || profile?.telephone || '+2250707070700').replace(/\s+/g, '');

    // 3. Authentification CinetPay v1 (OAuth)
    const authResult = await getCinetPayToken();
    if (!authResult.token) {
      console.error('❌ Échec login CinetPay:', authResult);
      return new Response(
        JSON.stringify({
          error: `CinetPay: ${authResult.error}`,
          details: authResult.raw,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Initialisation du paiement POST /v1/payment
    const transactionId = `TCF${Date.now()}${Math.floor(100 + Math.random() * 900)}`;
    const amount = Math.round(targetPlan.priceXof);
    const cleanSupabaseUrl = supabaseUrl.replace(/\/+$/, '');
    const notifyUrl = `${cleanSupabaseUrl}/functions/v1/cinetpay-webhook`;
    const successUrl = `${cleanSupabaseUrl}/functions/v1/cinetpay-redirect?tx=${encodeURIComponent(transactionId)}`;
    const failedUrl = `${cleanSupabaseUrl}/functions/v1/cinetpay-redirect?tx=${encodeURIComponent(transactionId)}&failed=1`;

    const paymentRequest = {
      currency: 'XOF',
      merchant_transaction_id: transactionId,
      amount,
      lang: 'FR',
      designation: targetPlan.cleanDescription,
      client_email: user.email || 'candidat@montcfca.com',
      client_first_name: customerSurname,
      client_last_name: customerName,
      client_phone_number: rawPhone,
      success_url: successUrl,
      failed_url: failedUrl,
      notify_url: notifyUrl,
      channel: 'WEB',
    };

    console.log(`Initialisation CinetPay /v1/payment pour transaction ${transactionId} (${amount} XOF)`);

    const payRes = await fetch(`${cinetpayBaseUrl}/v1/payment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authResult.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(paymentRequest),
    });

    const payData = await payRes.json().catch(() => ({}));
    console.log('Réponse CinetPay /v1/payment:', payData);

    const paymentUrl = payData?.payment_url || payData?.data?.payment_url;
    const paymentToken = payData?.payment_token || payData?.data?.payment_token;

    if (!paymentUrl) {
      const errMsg =
        payData?.description ||
        payData?.message ||
        `Échec création du paiement CinetPay (Code ${payData?.code || payRes.status})`;
      return new Response(
        JSON.stringify({ error: errMsg, details: payData }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Enregistrer l'intention de paiement en base
    const clientReturnUrl = returnUrl || 'http://localhost:5173/etudiant/abonnement/succes';
    await supabaseAdmin.from('paiements').insert({
      user_id: user.id,
      etudiant_id: user.id,
      montant: amount,
      amount,
      devise: 'XOF',
      currency: 'XOF',
      provider: 'cinetpay',
      methode: 'cinetpay',
      provider_payment_id: transactionId,
      transaction_id: transactionId,
      status: 'en_attente',
      statut: 'en_attente',
      metadata: {
        project: 'mon-tcfca',
        planId: normalizedPlanId,
        userEmail: user.email || '',
        returnUrl: clientReturnUrl,
        transactionId,
        paymentToken: paymentToken || '',
      },
      created_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        transactionId,
        paymentToken,
        paymentUrl,
        url: paymentUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erreur create-cinetpay-checkout:', error);
    return new Response(
      JSON.stringify({ error: error?.message || "Erreur interne CinetPay" }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
