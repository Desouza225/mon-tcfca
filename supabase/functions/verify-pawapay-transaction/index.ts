import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

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
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!pawapayApiKey) {
      throw new Error("La clé secrète PAWAPAY_API_KEY n'est pas configurée dans les variables Supabase.");
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
      return new Response(JSON.stringify({ error: 'Session invalide ou expirée' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { depositId } = await req.json();
    if (!depositId) {
      return new Response(JSON.stringify({ error: 'Identifiant de transaction (depositId) PawaPay manquant' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Chercher l'intention de paiement initiale dans la base locale (par checkoutId ou checkoutCode)
    let existingPayment: any = null;
    const { data: byPaymentId } = await supabaseAdmin
      .from('paiements')
      .select('*')
      .eq('provider_payment_id', depositId)
      .maybeSingle();

    if (byPaymentId) {
      existingPayment = byPaymentId;
    } else {
      const { data: byTrxId } = await supabaseAdmin
        .from('paiements')
        .select('*')
        .eq('transaction_id', depositId)
        .maybeSingle();
      existingPayment = byTrxId;
    }

    // Protection anti-IDOR : la transaction doit appartenir à l'utilisateur connecté
    const paymentUserId = existingPayment?.user_id || existingPayment?.etudiant_id;
    if (paymentUserId && paymentUserId !== user.id) {
      console.error(`❌ Tentative IDOR PawaPay: user ${user.id} tente de valider la transaction de ${paymentUserId}`);
      return new Response(
        JSON.stringify({ success: false, error: "Cette transaction PawaPay n'appartient pas à votre compte." }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetLookupId = existingPayment?.provider_payment_id || depositId;

    // 2. Interroger l'API PawaPay v2 : d'abord v2/checkouts, puis fallback sur v2/deposits
    let isCompleted = false;
    let finalStatus = 'PENDING';
    let txDetails: any = {};

    const checkoutsEndpoint = `${pawapayBaseUrl.replace(/\/+$/, '')}/v2/checkouts/${encodeURIComponent(targetLookupId)}`;
    console.log(`Checking PawaPay status at ${checkoutsEndpoint}`);

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
          amount: cData.deposit?.amount || existingPayment?.amount,
          currency: cData.deposit?.currency || existingPayment?.currency || 'XOF',
          correspondent: cData.deposit?.correspondent || 'MOBILE_MONEY',
          transactionId: cData.deposit?.financialTransactionId || cData.checkoutCode || targetLookupId,
          metadata: cData.metadata,
        };
      }
    }

    // Si non trouvé sur /v2/checkouts, interroger /v2/deposits
    if (!txDetails.status || txDetails.status === 'NOT_FOUND') {
      const depositsEndpoint = `${pawapayBaseUrl.replace(/\/+$/, '')}/v2/deposits/${encodeURIComponent(targetLookupId)}`;
      console.log(`Checking PawaPay fallback at ${depositsEndpoint}`);

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
          amount: tx.amount || existingPayment?.amount,
          currency: tx.currency || existingPayment?.currency || 'XOF',
          correspondent: tx.correspondent || 'MOBILE_MONEY',
          transactionId: tx.financialTransactionId?.MTN_FINAL || tx.financialTransactionId?.ORANGE_FINAL || targetLookupId,
          metadata: tx.metadata,
        };
      }
    }

    // Déterminer le planId
    const planId =
      existingPayment?.metadata?.planId ||
      extractMetadataValue(txDetails.metadata, 'planId') ||
      'standard';

    if (isCompleted) {
      const correspondent = txDetails.correspondent || 'MOBILE_MONEY';
      const currency = txDetails.currency || 'XOF';
      const amount = txDetails.amount ? parseFloat(txDetails.amount) : (existingPayment?.amount || 18500);
      const quotas = PLAN_QUOTAS[planId] || PLAN_QUOTAS.standard;
      const periodStart = new Date();
      const periodEnd = new Date(periodStart.getTime() + quotas.dureeJours * 24 * 60 * 60 * 1000);

      const isAlreadyConfirmed =
        existingPayment?.status === 'confirme' || existingPayment?.statut === 'confirme';

      if (!isAlreadyConfirmed) {
        // Mettre à jour / créer l'abonnement
        const { data: subData, error: subError } = await supabaseAdmin
          .from('abonnements')
          .upsert({
            user_id: user.id,
            etudiant_id: user.id,
            plan_id: planId,
            status: 'active',
            statut: 'actif',
            provider: 'pawapay',
            provider_subscription_id: targetLookupId,
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
          console.error("Erreur upsert abonnement PawaPay:", subError);
        }

        // Mettre à jour le paiement existant ou en insérer un nouveau
        if (existingPayment) {
          await supabaseAdmin
            .from('paiements')
            .update({
              status: 'confirme',
              statut: 'confirme',
              abonnement_id: subData?.id || existingPayment.abonnement_id,
              transaction_id: txDetails.transactionId,
              metadata: {
                ...(existingPayment.metadata || {}),
                correspondent,
                pawapay_completed: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingPayment.id);
        } else {
          await supabaseAdmin.from('paiements').insert({
            user_id: user.id,
            etudiant_id: user.id,
            abonnement_id: subData?.id || null,
            amount: amount,
            montant: amount,
            currency: currency,
            devise: currency,
            provider: 'pawapay',
            methode: 'mobile_money',
            provider_payment_id: targetLookupId,
            transaction_id: txDetails.transactionId,
            status: 'confirme',
            statut: 'confirme',
            metadata: {
              project: 'mon-tcfca',
              planId,
              correspondent,
            },
            created_at: new Date().toISOString(),
          });
        }

        // Activer l'accès examen blanc sur le profil
        await supabaseAdmin
          .from('profiles')
          .update({ examen_blanc_actif: true })
          .eq('id', user.id);

        console.log(`✅ Abonnement et paiement PawaPay activés avec succès pour l'étudiant ${user.id}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: isCompleted,
        status: finalStatus,
        amount: txDetails.amount || existingPayment?.amount,
        planId,
        depositId: targetLookupId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Erreur verify-pawapay-transaction:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erreur lors de la vérification PawaPay' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
