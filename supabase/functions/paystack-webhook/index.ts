import { createClient } from 'npm:@supabase/supabase-js@2';

const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');

const PLAN_QUOTAS: Record<string, { ee: number; eo: number; examens: number; dureeJours: number }> = {
  essentiel: { ee: 8, eo: 4, examens: 1, dureeJours: 30 },
  standard: { ee: 20, eo: 12, examens: 2, dureeJours: 30 },
  intensif: { ee: 50, eo: 30, examens: 5, dureeJours: 40 },
  express: { ee: 20, eo: 12, examens: 2, dureeJours: 14 },
  pack_express: { ee: 20, eo: 12, examens: 2, dureeJours: 14 },
};

async function verifyPaystackSignature(rawBody: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign', 'verify']
    );

    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    return await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      encoder.encode(rawBody)
    );
  } catch (err) {
    console.error('Erreur vérification signature HMAC-SHA512:', err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  try {
    if (!paystackSecretKey) {
      throw new Error("PAYSTACK_SECRET_KEY n'est pas configurée.");
    }

    const signature = req.headers.get('x-paystack-signature');
    const rawBody = await req.text();

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Signature Paystack manquante' }), { status: 400 });
    }

    // Vérifier la signature cryptographique Paystack
    const isValid = await verifyPaystackSignature(rawBody, signature, paystackSecretKey);
    if (!isValid) {
      console.error('❌ Signature Paystack invalide');
      return new Response(JSON.stringify({ error: 'Signature invalide' }), { status: 400 });
    }

    const event = JSON.parse(rawBody);
    console.log(`🔔 Événement Paystack reçu : ${event.event}`);

    // Client Supabase avec Service Role (bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (event.event === 'charge.success') {
      const data = event.data;
      const userId = data.metadata?.user_id;
      const planId = data.metadata?.plan_id || 'standard';
      const reference = data.reference;
      const channel = data.channel || 'card';
      const currency = data.currency || 'USD';
      const amount = data.amount ? data.amount / 100 : 29.99;

      console.log(`💳 Paiement Paystack validé (${amount} ${currency} via ${channel}) pour l'utilisateur ${userId}`);

      if (!userId) {
        console.warn('⚠️ Aucun user_id dans les métadonnées Paystack.');
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      }

      const quotas = PLAN_QUOTAS[planId] || PLAN_QUOTAS.standard;
      const periodStart = new Date();
      const periodEnd = new Date(periodStart.getTime() + quotas.dureeJours * 24 * 60 * 60 * 1000);

      const chLower = (channel || '').toLowerCase();
      const isMobileMoney = chLower.includes('mobile') || chLower.includes('momo') || chLower.includes('wave') || chLower.includes('orange') || chLower.includes('mtn');
      const methodStr = isMobileMoney ? 'mobile_money' : (channel || 'card');
      const autoRenew = (chLower === 'card');

      // Vérifier l'idempotence (éviter double crédit si verify-paystack-transaction est déjà passé)
      const { data: existingPayment } = await supabaseAdmin
        .from('paiements')
        .select('id')
        .eq('provider_payment_id', reference)
        .maybeSingle();

      if (!existingPayment) {
        // 1. Activer / Recharger l'abonnement en base
        const { data: subData, error: subError } = await supabaseAdmin
          .from('abonnements')
          .upsert({
            user_id: userId,
            etudiant_id: userId,
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

        if (subError) {
          console.error('❌ Erreur mise à jour abonnement:', subError);
        } else {
          console.log('✅ Quotas crédités avec succès pour', userId);
        }

        // 2. Enregistrer la transaction dans paiements
        const { error: payError } = await supabaseAdmin
          .from('paiements')
          .insert({
            user_id: userId,
            etudiant_id: userId,
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

        if (payError) {
          console.error('❌ Erreur enregistrement paiement:', payError);
        } else {
          console.log('✅ Transaction Paystack enregistrée.');
        }
      } else {
        console.log(`ℹ️ Paiement Paystack ${reference} déjà enregistré (idempotent).`);
      }

      // 3. ENVOI DES EMAILS AUTOMATIQUES (NON-BLOQUANT)
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
          } catch (mailErr) {
            console.error('⚠️ Échec non bloquant envoi email Paystack:', mailErr);
          }
        };

        const planNom = `Formule ${planId.charAt(0).toUpperCase() + planId.slice(1)}`;
        const receiptNumber = `REC-PAY-${reference.slice(-6).toUpperCase()}`;

        // Email 4 : Confirmation d'activation
        sendEmailInternal({
          type: 'subscription_confirmed',
          user_id: userId,
          idempotency_key: `sub_conf_${reference}`,
          data: {
            planNom,
            quotaEe: quotas.ee,
            quotaEo: quotas.eo,
            quotaExamens: quotas.examens,
            dureeJours: quotas.dureeJours,
          },
        });

        // Email 5 : Reçu / Facture officiel
        sendEmailInternal({
          type: 'payment_receipt',
          user_id: userId,
          idempotency_key: `receipt_${reference}`,
          data: {
            numeroRecu: receiptNumber,
            planNom,
            montant: amount,
            devise: currency,
            methodePaiement: channel,
            reference: reference,
            datePaiement: new Date().toLocaleDateString('fr-FR'),
          },
        });
      }
    } else if (event.event === 'charge.failed' || event.event === 'invoice.payment_failed') {
      // Événement d'échec de paiement (Email 6)
      const data = event.data;
      const userId = data.metadata?.user_id;
      const planId = data.metadata?.plan_id || 'standard';
      const gatewayResponse = data.gateway_response || 'Transaction refusée par votre opérateur';
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

      if (userId && supabaseUrl && serviceRoleKey) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${serviceRoleKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              type: 'payment_failed',
              user_id: userId,
              idempotency_key: `fail_${data.reference || Date.now()}`,
              data: {
                planNom: `Formule ${planId.charAt(0).toUpperCase() + planId.slice(1)}`,
                motifEchec: gatewayResponse,
                actionUrl: 'https://mon-tcfca.com/etudiant/abonnement',
              },
            }),
          });
          console.log(`✉️ Email d'échec de paiement envoyé à l'utilisateur ${userId}`);
        } catch (e) {
          console.error("⚠️ Échec d'envoi de l'email d'échec de paiement:", e);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: any) {
    console.error('❌ Erreur traitement Webhook Paystack:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});
