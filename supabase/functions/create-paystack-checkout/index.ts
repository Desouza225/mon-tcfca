import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');

const PLAN_CATALOG: Record<string, { nom: string; priceUsd: number; priceXof: number; dureeJours: number; description: string }> = {
  essentiel: {
    nom: 'Formule Essentiel',
    priceUsd: 14.99,
    priceXof: 9500,
    dureeJours: 30,
    description: '8 devoirs écrits, 4 oraux, 1 examen blanc et accès aux 4 320 items.',
  },
  standard: {
    nom: 'Formule Standard',
    priceUsd: 29.99,
    priceXof: 18500,
    dureeJours: 30,
    description: '20 devoirs écrits, 12 oraux, 2 examens blancs et accès complet.',
  },
  intensif: {
    nom: 'Formule Intensif',
    priceUsd: 47.99,
    priceXof: 29900,
    dureeJours: 40,
    description: '50 devoirs écrits, 30 oraux, 5 examens blancs et coaching maximal.',
  },
  express: {
    nom: 'Formule Express (14 Jours)',
    priceUsd: 14.99,
    priceXof: 9500,
    dureeJours: 14,
    description: '20 devoirs écrits, 12 oraux, 2 examens blancs concentrés sur 14 jours.',
  },
  pack_express: {
    nom: 'Formule Express (14 Jours)',
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
    if (!paystackSecretKey) {
      throw new Error("La clé secrète PAYSTACK_SECRET_KEY n'est pas configurée.");
    }

    // 1. Authentification de l'utilisateur
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Utilisateur non autorisé' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
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

    const { planId, callbackUrl } = await req.json();

    if (callbackUrl !== undefined && callbackUrl !== null) {
      try {
        const parsedCb = new URL(String(callbackUrl));
        if (parsedCb.protocol !== 'http:' && parsedCb.protocol !== 'https:') {
          throw new Error('Invalid protocol');
        }
      } catch {
        return new Response(JSON.stringify({ error: 'URL de retour (callbackUrl) invalide.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const targetPlan = PLAN_CATALOG[planId];
    if (!targetPlan) {
      return new Response(JSON.stringify({ error: `Plan invalide : ${planId}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Paystack attend le montant en sous-unités (centimes de FCFA : montant * 100)
    const amountInSubunits = targetPlan.priceXof * 100;
    const reference = `TCF_${planId.toUpperCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 2. Initialiser la transaction auprès de Paystack en XOF (monnaie du compte marchand & Mobile Money)
    const paystackPayload = {
      email: user.email,
      amount: amountInSubunits,
      currency: 'XOF',
      reference,
      callback_url: callbackUrl,
      channels: ['card', 'mobile_money'],
      metadata: {
        user_id: user.id,
        plan_id: planId === 'pack_express' ? 'express' : planId,
        custom_fields: [
          {
            display_name: 'Formule Mon TCFCA',
            variable_name: 'formule_nom',
            value: `${targetPlan.nom} (${targetPlan.priceUsd.toFixed(2)} $ USD)`,
          },
          {
            display_name: 'Candidat',
            variable_name: 'candidat_email',
            value: user.email,
          },
        ],
      },
    };

    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload),
    });

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      console.error('Erreur retour Paystack API:', paystackData);
      throw new Error(paystackData.message || "Échec de l'initialisation du paiement Paystack");
    }

    return new Response(
      JSON.stringify({
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Erreur create-paystack-checkout:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur lors de la création de la session Paystack' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
