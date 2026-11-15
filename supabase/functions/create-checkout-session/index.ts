import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@14.14.0';
import { corsHeaders } from '../_shared/cors.ts';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

const PLAN_CATALOG: Record<string, { nom: string; amountEurCents: number; interval: 'month' | 'day'; intervalCount?: number; description: string }> = {
  essentiel: {
    nom: 'Formule Essentiel',
    amountEurCents: 1500, // 15.00 EUR (~10 000 FCFA)
    interval: 'month',
    description: '8 devoirs écrits, 4 oraux, 1 examen blanc et accès aux 4 320 items.',
  },
  standard: {
    nom: 'Formule Standard',
    amountEurCents: 2700, // 27.00 EUR (~18 000 FCFA)
    interval: 'month',
    description: '20 devoirs écrits, 12 oraux, 2 examens blancs et accès complet.',
  },
  intensif: {
    nom: 'Formule Intensif',
    amountEurCents: 4200, // 42.00 EUR (~28 000 FCFA)
    interval: 'month',
    description: '50 devoirs écrits, 30 oraux, 5 examens blancs et coaching maximal.',
  },
  pack_express: {
    nom: 'Pack Express (14 Jours)',
    amountEurCents: 1500, // 15.00 EUR (~10 000 FCFA)
    interval: 'day',
    intervalCount: 14,
    description: '20 devoirs écrits, 12 oraux, 2 examens blancs concentrés sur 14 jours.',
  },
  express: {
    nom: 'Formule Express (14 Jours)',
    amountEurCents: 1500, // 15.00 EUR (~10 000 FCFA)
    interval: 'day',
    intervalCount: 14,
    description: '20 devoirs écrits, 12 oraux, 2 examens blancs concentrés sur 14 jours.',
  },
};

function isValidHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!stripeSecretKey) {
      throw new Error("La clé secrète STRIPE_SECRET_KEY n'est pas configurée.");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

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

    const { planId, successUrl, cancelUrl } = await req.json();

    if (!isValidHttpUrl(successUrl) || !isValidHttpUrl(cancelUrl)) {
      return new Response(JSON.stringify({ error: 'URLs de redirection invalides.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetPlan = PLAN_CATALOG[planId];
    if (!targetPlan) {
      return new Response(JSON.stringify({ error: `Plan invalide : ${planId}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Récupérer ou créer le client Stripe
    let customerId: string | undefined;
    const existingCustomers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    } else {
      const newCustomer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      });
      customerId = newCustomer.id;
    }

    // 3. Créer la session Checkout Stripe
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      billing_address_collection: 'auto',
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: `Mon TCFCA — ${targetPlan.nom}`,
              description: targetPlan.description,
              metadata: {
                plan_id: planId,
              },
            },
            unit_amount: targetPlan.amountEurCents,
            recurring: {
              interval: targetPlan.interval,
              interval_count: targetPlan.intervalCount || 1,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        plan_id: planId,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: planId,
        },
      },
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Erreur create-checkout-session:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur lors de la création de la session de paiement' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
