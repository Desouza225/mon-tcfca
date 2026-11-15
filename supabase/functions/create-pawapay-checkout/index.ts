import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const pawapayApiKey = Deno.env.get('PAWAPAY_API_KEY');
const configuredBaseUrl = Deno.env.get('PAWAPAY_BASE_URL') || 'https://api.pawapay.io';

const PLAN_CATALOG: Record<string, { nom: string; priceUsd: number; priceXof: number; dureeJours: number; description: string; cleanReason: string }> = {
  essentiel: {
    nom: 'Formule Essentiel',
    cleanReason: 'Mon TCFCA Essentiel',
    priceUsd: 14.99,
    priceXof: 9500,
    dureeJours: 30,
    description: '8 devoirs écrits, 4 oraux, 1 examen blanc et accès aux 4 320 items.',
  },
  standard: {
    nom: 'Formule Standard',
    cleanReason: 'Mon TCFCA Standard',
    priceUsd: 29.99,
    priceXof: 18500,
    dureeJours: 30,
    description: '20 devoirs écrits, 12 oraux, 2 examens blancs et accès complet.',
  },
  intensif: {
    nom: 'Formule Intensif',
    cleanReason: 'Mon TCFCA Intensif',
    priceUsd: 47.99,
    priceXof: 29900,
    dureeJours: 40,
    description: '50 devoirs écrits, 30 oraux, 5 examens blancs et coaching maximal.',
  },
  express: {
    nom: 'Formule Express',
    cleanReason: 'Mon TCFCA Express',
    priceUsd: 14.99,
    priceXof: 9500,
    dureeJours: 14,
    description: '20 devoirs écrits, 12 oraux, 2 examens blancs concentrés sur 14 jours.',
  },
  pack_express: {
    nom: 'Formule Express',
    cleanReason: 'Mon TCFCA Express',
    priceUsd: 14.99,
    priceXof: 9500,
    dureeJours: 14,
    description: '20 devoirs écrits, 12 oraux, 2 examens blancs concentrés sur 14 jours.',
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!pawapayApiKey) {
      console.error("❌ La variable d'environnement PAWAPAY_API_KEY n'est pas définie dans Supabase.");
      return new Response(
        JSON.stringify({ error: "La clé secrète PAWAPAY_API_KEY n'est pas configurée dans les secrets Supabase." }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Authentification de l'utilisateur
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Session expirée. Veuillez vous reconnecter pour payer.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { planId, returnUrl } = body;

    const normalizedPlanId = planId === 'pack_express' ? 'express' : planId;
    const targetPlan = PLAN_CATALOG[planId];
    if (!targetPlan) {
      return new Response(
        JSON.stringify({ error: `Plan invalide sélectionné : ${planId}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Générer un identifiant unique UUIDv4 pour la session de paiement (checkoutId)
    const checkoutId = crypto.randomUUID();

    // 3. Montant fixe et verrouillé (non modifiable par le candidat sur PawaPay)
    const amountStr = String(Math.round(targetPlan.priceXof));

    // Liste des pays de la zone Franc CFA avec montant verrouillé
    const amounts = [
      { country: 'CIV', currency: 'XOF', amount: amountStr },
      { country: 'BEN', currency: 'XOF', amount: amountStr },
      { country: 'SEN', currency: 'XOF', amount: amountStr },
      { country: 'CMR', currency: 'XAF', amount: amountStr },
      { country: 'GAB', currency: 'XAF', amount: amountStr },
      { country: 'COG', currency: 'XAF', amount: amountStr },
    ];

    // 4. URL de retour HTTPS propre (conforme aux règles PawaPay v2)
    const pawapayReturnUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/pawapay-redirect`;

    // 5. Payload officiel PawaPay Checkouts v2 (verrouille le montant et empêche toute modification)
    const checkoutPayload = {
      checkoutId,
      returnUrl: pawapayReturnUrl,
      amounts,
      reason: {
        fr: targetPlan.cleanReason,
        en: targetPlan.cleanReason,
      },
      metadata: [
        { project: 'mon-tcfca' },
        { userId: user.id },
        { planId: normalizedPlanId },
      ],
    };

    const baseUrl = configuredBaseUrl.replace(/\/+$/, '');
    const endpoint = `${baseUrl}/v2/checkouts`;
    console.log(`Calling PawaPay Checkouts at ${endpoint} for checkout ${checkoutId}`);

    const pawapayRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${pawapayApiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkoutPayload),
    });

    const pawapayRawText = await pawapayRes.text();
    let pawapayData: any = {};
    try {
      pawapayData = JSON.parse(pawapayRawText);
    } catch {
      pawapayData = { message: pawapayRawText };
    }

    if (!pawapayRes.ok || !pawapayData.redirectUrl) {
      console.error('❌ Erreur retour PawaPay Checkouts API (Status ' + pawapayRes.status + '):', pawapayData);
      const errorMsg =
        pawapayData.failureReason?.failureMessage ||
        pawapayData.failureReason?.failureCode ||
        pawapayData.errorMessage ||
        pawapayData.message ||
        pawapayData.error ||
        (pawapayRes.status === 401 ? "Clé API PawaPay non valide." : null) ||
        (pawapayRes.status === 403 ? "Accès PawaPay non autorisé pour ce compte marchand." : null) ||
        `Échec de l'initialisation PawaPay (Code HTTP ${pawapayRes.status})`;

      return new Response(
        JSON.stringify({ error: errorMsg, details: pawapayData, httpStatus: pawapayRes.status }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Enregistrer l'intention de paiement en base de données avec checkoutCode et returnUrl
    const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const clientReturnUrl = returnUrl || 'http://localhost:5173/etudiant/abonnement/succes';

    const { error: insertError } = await supabaseAdmin.from('paiements').insert({
      user_id: user.id,
      etudiant_id: user.id,
      montant: targetPlan.priceXof,
      amount: targetPlan.priceXof,
      devise: 'XOF',
      currency: 'XOF',
      provider: 'pawapay',
      methode: 'mobile_money',
      provider_payment_id: checkoutId,
      transaction_id: pawapayData.checkoutCode || checkoutId,
      status: 'en_attente',
      statut: 'en_attente',
      metadata: {
        project: 'mon-tcfca',
        planId: normalizedPlanId,
        userEmail: user.email || '',
        returnUrl: clientReturnUrl,
        checkoutId,
        checkoutCode: pawapayData.checkoutCode || '',
      },
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('Erreur enregistrement intention de paiement:', insertError);
    }

    return new Response(
      JSON.stringify({
        checkoutId,
        depositId: checkoutId,
        checkoutCode: pawapayData.checkoutCode,
        redirectUrl: pawapayData.redirectUrl,
        url: pawapayData.redirectUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Erreur interne create-pawapay-checkout:', error);
    return new Response(
      JSON.stringify({ error: error?.message || "Erreur interne lors de l'initialisation PawaPay" }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
