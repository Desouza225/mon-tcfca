import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@14.14.0';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

const PLAN_QUOTAS: Record<string, { ee: number; eo: number; examens: number; dureeJours: number }> = {
  essentiel: { ee: 8, eo: 4, examens: 1, dureeJours: 30 },
  standard: { ee: 20, eo: 12, examens: 2, dureeJours: 30 },
  intensif: { ee: 50, eo: 30, examens: 5, dureeJours: 40 },
  express: { ee: 20, eo: 12, examens: 2, dureeJours: 14 },
  pack_express: { ee: 20, eo: 12, examens: 2, dureeJours: 14 },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  try {
    if (!stripeSecretKey || !stripeWebhookSecret) {
      console.error('❌ STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET non configurée.');
      return new Response(JSON.stringify({ error: 'Configuration webhook Stripe incomplète.' }), { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Signature Stripe manquante' }), { status: 400 });
    }

    const rawBody = await req.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, stripeWebhookSecret);
    } catch (err: any) {
      console.error('❌ Échec validation signature Webhook Stripe:', err.message);
      return new Response(JSON.stringify({ error: `Signature invalide : ${err.message}` }), { status: 400 });
    }

    console.log(`🔔 Événement Stripe reçu : ${event.type}`);

    // Initialisation Supabase avec service role pour bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const planId = session.metadata?.plan_id || 'standard';
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;

        console.log(`💳 Checkout terminé pour l'utilisateur ${userId}, Plan : ${planId}`);

        if (!userId) {
          console.warn('⚠️ Aucun user_id dans les métadonnées de la session Checkout.');
          break;
        }

        const paymentRef = (session.payment_intent as string) || session.id;
        const { data: existingPayment } = await supabaseAdmin
          .from('paiements')
          .select('id')
          .eq('provider_payment_id', paymentRef)
          .maybeSingle();

        if (existingPayment) {
          console.log(`ℹ️ Paiement Stripe ${paymentRef} déjà traité (idempotent).`);
          break;
        }

        const quotas = PLAN_QUOTAS[planId] || PLAN_QUOTAS.standard;
        const periodStart = new Date();
        const periodEnd = new Date(periodStart.getTime() + quotas.dureeJours * 24 * 60 * 60 * 1000);

        // 1. Créer ou Mettre à jour l'abonnement
        const { data: subData, error: subError } = await supabaseAdmin
          .from('abonnements')
          .upsert({
            user_id: userId,
            etudiant_id: userId,
            plan_id: planId,
            status: 'active',
            statut: 'actif',
            provider: 'stripe',
            provider_subscription_id: subscriptionId || null,
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

        if (subError) {
          console.error('❌ Erreur insertion abonnement:', subError);
        } else {
          console.log('✅ Abonnement activé avec succès pour', userId);
        }

        // 2. Enregistrer le paiement
        const amountTotal = session.amount_total ? session.amount_total / 100 : 0;
        const { error: payError } = await supabaseAdmin
          .from('paiements')
          .insert({
            user_id: userId,
            etudiant_id: userId,
            abonnement_id: subData?.id || null,
            amount: amountTotal,
            montant: amountTotal,
            currency: (session.currency || 'eur').toUpperCase(),
            devise: (session.currency || 'eur').toUpperCase(),
            provider: 'stripe',
            methode: 'stripe',
            provider_payment_id: session.payment_intent as string || session.id,
            status: 'confirme',
            statut: 'confirme',
            created_at: new Date().toISOString(),
          });

        if (payError) {
          console.error('❌ Erreur insertion paiement:', payError);
        } else {
          console.log('✅ Paiement enregistré avec succès.');
        }

        // ENVOI EMAILS : SOUSCRIPTION & REÇU
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (supabaseUrl && serviceRoleKey) {
          const sendEmailInternal = async (payload: any) => {
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${serviceRoleKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
              });
            } catch (e) {
              console.error('⚠️ Échec non bloquant envoi email Stripe:', e);
            }
          };

          const planNom = `Formule ${planId.charAt(0).toUpperCase() + planId.slice(1)}`;
          const receiptNumber = `REC-ST-${(session.id || '').slice(-6).toUpperCase()}`;

          // Email 4 : Confirmation
          sendEmailInternal({
            type: 'subscription_confirmed',
            user_id: userId,
            idempotency_key: `stripe_sub_${session.id}`,
            data: {
              planNom,
              quotaEe: quotas.ee,
              quotaEo: quotas.eo,
              quotaExamens: quotas.examens,
              dureeJours: quotas.dureeJours,
            },
          });

          // Email 5 : Reçu / Facture
          sendEmailInternal({
            type: 'payment_receipt',
            user_id: userId,
            idempotency_key: `stripe_rec_${session.id}`,
            data: {
              numeroRecu: receiptNumber,
              planNom,
              montant: amountTotal,
              devise: (session.currency || 'eur').toUpperCase(),
              methodePaiement: 'Carte bancaire (Stripe)',
              reference: session.id,
              datePaiement: new Date().toLocaleDateString('fr-FR'),
            },
          });
        }

        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;

        if (!subscriptionId) break;

        console.log(`🔄 Renouvellement / Facture payée pour souscription ${subscriptionId}`);

        const { data: existingInvoicePayment } = await supabaseAdmin
          .from('paiements')
          .select('id')
          .eq('provider_payment_id', invoice.id)
          .maybeSingle();

        if (existingInvoicePayment) {
          console.log(`ℹ️ Facture Stripe ${invoice.id} déjà traitée (idempotent).`);
          break;
        }

        // Trouver l'abonnement correspondant
        const { data: existingSub } = await supabaseAdmin
          .from('abonnements')
          .select('*')
          .eq('provider_subscription_id', subscriptionId)
          .maybeSingle();

        if (existingSub) {
          const planId = existingSub.plan_id || 'standard';
          const quotas = PLAN_QUOTAS[planId] || PLAN_QUOTAS.standard;
          const periodStart = new Date();
          const periodEnd = new Date(periodStart.getTime() + quotas.dureeJours * 24 * 60 * 60 * 1000);

          // Réinitialiser les quotas pour le nouveau mois
          await supabaseAdmin
            .from('abonnements')
            .update({
              status: 'active',
              statut: 'actif',
              quota_ee_restant: quotas.ee,
              quota_eo_restant: quotas.eo,
              quota_examen_blanc_restant: quotas.examens,
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingSub.id);

          // Enregistrer le paiement renouvelé
          const amountPaid = invoice.amount_paid ? invoice.amount_paid / 100 : 0;
          await supabaseAdmin
            .from('paiements')
            .insert({
              user_id: existingSub.user_id,
              etudiant_id: existingSub.user_id,
              abonnement_id: existingSub.id,
              amount: amountPaid,
              montant: amountPaid,
              currency: (invoice.currency || 'eur').toUpperCase(),
              devise: (invoice.currency || 'eur').toUpperCase(),
              provider: 'stripe',
              methode: 'stripe',
              provider_payment_id: invoice.id,
              status: 'confirme',
              statut: 'confirme',
              created_at: new Date().toISOString(),
            });

          console.log(`✅ Quotas renouvelés avec succès pour ${existingSub.user_id}`);

          // ENVOI EMAILS : RENOUVELLEMENT & REÇU
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

          if (supabaseUrl && serviceRoleKey) {
            const planNom = `Formule ${planId.charAt(0).toUpperCase() + planId.slice(1)}`;
            const receiptNumber = `REC-REN-${invoice.id.slice(-6).toUpperCase()}`;

            // Email 9 : Confirmation de renouvellement
            fetch(`${supabaseUrl}/functions/v1/send-email`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'renewal_confirmed',
                user_id: existingSub.user_id,
                idempotency_key: `renew_${invoice.id}`,
                data: {
                  planNom,
                  dateFin: periodEnd.toLocaleDateString('fr-FR'),
                },
              }),
            }).catch((err) => console.error('Erreur email renouvellement:', err));

            // Email 5 : Facture / Reçu
            fetch(`${supabaseUrl}/functions/v1/send-email`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'payment_receipt',
                user_id: existingSub.user_id,
                idempotency_key: `receipt_${invoice.id}`,
                data: {
                  numeroRecu: receiptNumber,
                  planNom,
                  montant: amountPaid,
                  devise: (invoice.currency || 'eur').toUpperCase(),
                  methodePaiement: 'Carte bancaire (Renouvellement)',
                  reference: invoice.id,
                  datePaiement: new Date().toLocaleDateString('fr-FR'),
                },
              }),
            }).catch((err) => console.error('Erreur email reçu renouvellement:', err));
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (subscriptionId && supabaseUrl && serviceRoleKey) {
          const { data: sub } = await supabaseAdmin
            .from('abonnements')
            .select('user_id, plan_id')
            .eq('provider_subscription_id', subscriptionId)
            .maybeSingle();

          if (sub?.user_id) {
            fetch(`${supabaseUrl}/functions/v1/send-email`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'payment_failed',
                user_id: sub.user_id,
                idempotency_key: `fail_${invoice.id}`,
                data: {
                  planNom: sub.plan_id ? `Formule ${sub.plan_id}` : 'Votre formule',
                  motifEchec: 'Échec de prélèvement sur votre carte bancaire',
                  actionUrl: 'https://mon-tcfca.com/etudiant/abonnement',
                },
              }),
            }).catch((e) => console.error('Erreur email échec Stripe:', e));
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        console.log(`🛑 Résiliation de l'abonnement Stripe ${sub.id}`);

        await supabaseAdmin
          .from('abonnements')
          .update({
            status: 'cancelled',
            statut: 'annule',
            updated_at: new Date().toISOString(),
          })
          .eq('provider_subscription_id', sub.id);

        console.log(`✅ Abonnement marqué comme annulé pour ${sub.id}`);
        break;
      }

      default:
        console.log(`ℹ️ Événement non géré : ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: any) {
    console.error('❌ Erreur traitement Webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
