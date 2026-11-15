import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    let txId =
      url.searchParams.get('tx') ||
      url.searchParams.get('transaction_id') ||
      url.searchParams.get('cpm_trans_id') ||
      '';

    // Si CinetPay envoie un POST sur return_url (application/x-www-form-urlencoded ou JSON)
    if (!txId && req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const formData = await req.formData().catch(() => null);
        if (formData) {
          txId =
            String(formData.get('transaction_id') || formData.get('cpm_trans_id') || formData.get('tx') || '');
        }
      } else {
        const bodyText = await req.text().catch(() => '');
        try {
          const json = JSON.parse(bodyText);
          txId = json.transaction_id || json.cpm_trans_id || json.tx || '';
        } catch {
          const params = new URLSearchParams(bodyText);
          txId = params.get('transaction_id') || params.get('cpm_trans_id') || params.get('tx') || '';
        }
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAdminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    let targetRedirectBase = 'http://localhost:5173/etudiant/abonnement/succes';

    if (txId && supabaseUrl && supabaseAdminKey) {
      const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: payment } = await supabaseAdmin
        .from('paiements')
        .select('metadata, provider_payment_id')
        .or(`provider_payment_id.eq.${txId},transaction_id.eq.${txId}`)
        .maybeSingle();

      if (payment?.metadata?.returnUrl) {
        targetRedirectBase = payment.metadata.returnUrl;
      }
    }

    const redirectUrl = new URL(targetRedirectBase);
    redirectUrl.searchParams.set('provider', 'cinetpay');
    if (txId) {
      redirectUrl.searchParams.set('transaction_id', txId);
    }

    return Response.redirect(redirectUrl.toString(), 303);
  } catch (err) {
    console.error('Erreur dans cinetpay-redirect:', err);
    return Response.redirect('http://localhost:5173/etudiant/abonnement/succes?provider=cinetpay', 303);
  }
});

