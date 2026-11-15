import { createClient } from 'npm:@supabase/supabase-js@2';

const pawapayApiKey = Deno.env.get('PAWAPAY_API_KEY');
const pawapayBaseUrl = Deno.env.get('PAWAPAY_BASE_URL') || 'https://api.pawapay.io';

const PLAN_QUOTAS: Record<string, { ee: number; eo: number; examens: number; dureeJours: number }> = {
  essentiel: { ee: 8, eo: 4, examens: 1, dureeJours: 30 },
  standard: { ee: 20, eo: 12, examens: 2, dureeJours: 30 },
  intensif: { ee: 50, eo: 30, examens: 5, dureeJours: 40 },
  express: { ee: 20, eo: 12, examens: 2, dureeJours: 14 },
  pack_express: { ee: 20, eo: 12, examens: 2, dureeJours: 14 },
};

function extractMetadataValue(metadata: any, fieldName: string): string | null {
  if (!metadata) return null;
  if (Array.isArray(metadata)) {
    const item = metadata.find((m: any) => m.fieldName === fieldName || m.name === fieldName || m.key === fieldName || m[fieldName]);
    if (!item) return null;
    return item[fieldName] ? String(item[fieldName]) : String(item.fieldValue ?? item.value ?? '');
  }
  if (typeof metadata === 'object') {
    return metadata[fieldName] ? String(metadata[fieldName]) : null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200 });
  }

  // Permettre le test de santé (healthcheck / ping GET ou HEAD)
  if (req.method === 'GET' || req.method === 'HEAD') {
    return new Response(JSON.stringify({ status: 'ok', service: 'pawapay-webhook' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const rawBody = await req.text();
    if (!rawBody || rawBody.trim() === '') {
      return new Response(JSON.stringify({ received: true, note: 'Empty ping received' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ received: true, note: 'Non-JSON ping' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log(`🔔 Callback webhook PawaPay reçu :`, JSON.stringify(event));

    const lookupId =
      event.checkoutId ||
      event.data?.checkoutId ||
      event.depositId ||
      event.data?.depositId;

    if (!lookupId) {
      console.log('ℹ️ Événement PawaPay reçu sans identifiant (test ping ou healthcheck)');
      return new Response(JSON.stringify({ received: true, message: 'Webhook endpoint active' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1. Filtrage multi-projets précoce
    const earlyProject =
      extractMetadataValue(event.metadata, 'project') ||
      extractMetadataValue(event.data?.metadata, 'project');

    if (earlyProject && earlyProject !== 'mon-tcfca') {
      console.log(`ℹ️ Callback PawaPay pour ${lookupId} ignoré (projet tiers '${earlyProject}').`);
      return new Response(JSON.stringify({ received: true, ignored: true, project: earlyProject }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!pawapayApiKey) {
      console.warn("⚠️ PAWAPAY_API_KEY n'est pas encore configurée dans Supabase. Événement reçu :", lookupId);
      return new Response(JSON.stringify({ received: true, note: 'PAWAPAY_API_KEY pending' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Validation auprès de l'API PawaPay v2 (checkouts puis deposits)
    let isCompleted = false;
    let finalStatus = 'PENDING';
    let txDetails: any = {};

    const checkoutsEndpoint = `${pawapayBaseUrl.replace(/\/+$/, '')}/v2/checkouts/${encodeURIComponent(lookupId)}`;
    const checkoutRes = await fetch(checkoutsEndpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${pawapayApiKey.trim()}`,
        'Content-Type': 'application/json',
      },
    });

    if (checkoutRes.ok) {
      const checkoutData = await checkoutRes.json();
      if (checkoutData.status === 'FOUND' && checkoutData.data) {
        const cData = checkoutData.data;
        finalStatus = String(cData.status || '').toUpperCase();
        const depositStatus = String(cData.deposit?.status || '').toUpperCase();
        isCompleted = finalStatus === 'COMPLETED' || depositStatus === 'COMPLETED';
        txDetails = {
          status: isCompleted ? 'COMPLETED' : finalStatus,
          amount: cData.deposit?.amount,
          currency: cData.deposit?.currency || 'XOF',
          correspondent: cData.deposit?.correspondent || 'MOBILE_MONEY',
          transactionId: cData.deposit?.financialTransactionId || cData.checkoutCode || lookupId,
          metadata: cData.metadata,
        };
      }
    }

    if (!txDetails.status || txDetails.status === 'NOT_FOUND') {
      const depositsEndpoint = `${pawapayBaseUrl.replace(/\/+$/, '')}/v2/deposits/${encodeURIComponent(lookupId)}`;
      const depositRes = await fetch(depositsEndpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${pawapayApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
      });

      if (depositRes.ok) {
        const depositData = await depositRes.json();
        const tx = depositData.data || depositData;
        finalStatus = String(tx.status || '').toUpperCase();
        isCompleted = finalStatus === 'COMPLETED';
        txDetails = {
          status: finalStatus,
          amount: tx.amount,
          currency: tx.currency || 'XOF',
          correspondent: tx.correspondent || 'MOBILE_MONEY',
          transactionId: tx.financialTransactionId?.MTN_FINAL || tx.financialTransactionId?.ORANGE_FINAL || lookupId,
          metadata: tx.metadata,
        };
      }
    }

    console.log(`Statut vérifié pour PawaPay ${lookupId} : ${finalStatus}`);

    // Client Supabase avec Service Role (bypass RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    if (isCompleted) {
      // Rechercher l'intention de paiement initiale dans notre base de données
      let initialPayment: any = null;
      const { data: byPaymentId } = await supabaseAdmin
        .from('paiements')
        .select('*')
        .eq('provider_payment_id', lookupId)
        .maybeSingle();

      if (byPaymentId) {
        initialPayment = byPaymentId;
      } else {
        const { data: byTrxId } = await supabaseAdmin
          .from('paiements')
          .select('*')
          .eq('transaction_id', lookupId)
          .maybeSingle();
        initialPayment = byTrxId;
      }

      const project = initialPayment?.metadata?.project || extractMetadataValue(txDetails.metadata, 'project');
      if (project && project !== 'mon-tcfca') {
        console.log(`ℹ️ Dépôt PawaPay ${lookupId} ignoré par MON-TCFCA car destiné au projet tiers '${project}'.`);
        return new Response(JSON.stringify({ received: true, ignored: true, project }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const userId = initialPayment?.user_id || initialPayment?.etudiant_id || extractMetadataValue(txDetails.metadata, 'userId');
      if (!userId) {
        console.log(`ℹ️ Dépôt PawaPay ${lookupId} absent de notre base de données. Ignoré pour mon-tcfca (projet tiers).`);
        return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200 });
      }

      const planId = initialPayment?.metadata?.planId || extractMetadataValue(txDetails.metadata, 'planId') || 'standard';
      const correspondent = txDetails.correspondent || 'MOBILE_MONEY';
      const currency = txDetails.currency || initialPayment?.currency || 'XOF';
      const amount = txDetails.amount ? parseFloat(txDetails.amount) : (initialPayment?.amount || 18500);

      const quotas = PLAN_QUOTAS[planId] || PLAN_QUOTAS.standard;
      const periodStart = new Date();
      const periodEnd = new Date(periodStart.getTime() + quotas.dureeJours * 24 * 60 * 60 * 1000);

      const isAlreadyConfirmed =
        initialPayment?.status === 'confirme' || initialPayment?.statut === 'confirme';

      if (!isAlreadyConfirmed) {
        // 1. Activer / Recharger l'abonnement en base
        const { data: subData, error: subError } = await supabaseAdmin
          .from('abonnements')
          .upsert({
            user_id: userId,
            etudiant_id: userId,
            plan_id: planId,
            status: 'active',
            statut: 'actif',
            provider: 'pawapay',
            provider_subscription_id: lookupId,
            methode: 'mobile_money',
            auto_renew: false,
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
          console.error("Erreur upsert abonnement webhook PawaPay:", subError);
        }

        // 2. Mettre à jour le paiement existant ou en insérer un nouveau
        if (initialPayment) {
          await supabaseAdmin
            .from('paiements')
            .update({
              status: 'confirme',
              statut: 'confirme',
              abonnement_id: subData?.id || initialPayment.abonnement_id,
              transaction_id: txDetails.transactionId,
              metadata: {
                ...(initialPayment.metadata || {}),
                correspondent,
                pawapay_completed: new Date().toISOString(),
                webhook_event: event,
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', initialPayment.id);
        } else {
          await supabaseAdmin
            .from('paiements')
            .insert({
              user_id: userId,
              etudiant_id: userId,
              abonnement_id: subData?.id || null,
              amount: amount,
              montant: amount,
              currency: currency,
              devise: currency,
              provider: 'pawapay',
              methode: 'mobile_money',
              provider_payment_id: lookupId,
              transaction_id: txDetails.transactionId,
              status: 'confirme',
              statut: 'confirme',
              metadata: {
                project: 'mon-tcfca',
                planId,
                correspondent,
                webhook_event: event,
              },
              created_at: new Date().toISOString(),
            });
        }

        // 3. Activer l'accès aux examens blancs sur le profil
        await supabaseAdmin
          .from('profiles')
          .update({ examen_blanc_actif: true })
          .eq('id', userId);

        // 4. Envoi des emails transactionnels automatiques (non-bloquant)
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (supabaseUrl && serviceRoleKey) {
          const sendEmailInternal = async (payload: any) => {
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${serviceRoleKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
              });
            } catch (err) {
              console.error('Erreur non bloquante envoi email PawaPay:', err);
            }
          };

          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('email, prenom, nom')
            .eq('id', userId)
            .maybeSingle();

          const clientEmail = profile?.email;
          const clientPrenom = profile?.prenom || 'Étudiant';

          if (clientEmail) {
            sendEmailInternal({
              to: clientEmail,
              subject: 'Confirmation de votre abonnement MON-TCFCA (Mobile Money PawaPay)',
              template: 'payment_success',
              data: {
                prenom: clientPrenom,
                plan: planId,
                amount: `${amount} ${currency}`,
                date: new Date().toLocaleDateString('fr-FR'),
                provider: `PawaPay Mobile Money (${correspondent})`,
              },
            });
          }
        }

        console.log(`✅ Webhook PawaPay : Abonnement activé avec succès pour l'étudiant ${userId}`);
      } else {
        console.log(`ℹ️ PawaPay ${lookupId} déjà traité. Aucune action répétée.`);
      }
    }

    return new Response(JSON.stringify({ received: true, status: finalStatus }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Erreur traitement webhook PawaPay:', error);
    return new Response(JSON.stringify({ received: true, error: error.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
