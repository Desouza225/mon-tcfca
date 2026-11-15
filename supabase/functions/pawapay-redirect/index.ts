import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // PawaPay appends checkoutCode, checkoutId, or depositId as query parameter
  const checkoutCode = url.searchParams.get('checkoutCode') || url.searchParams.get('checkout_code');
  const depositId =
    url.searchParams.get('checkoutId') ||
    url.searchParams.get('checkout_id') ||
    url.searchParams.get('depositId') ||
    url.searchParams.get('deposit_id');

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAdminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseAdmin = createClient(supabaseUrl, supabaseAdminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let targetReturnUrl = 'http://localhost:5173/etudiant/abonnement/succes';
  let paiement: any = null;

  if (depositId) {
    const { data } = await supabaseAdmin
      .from('paiements')
      .select('provider_payment_id, metadata')
      .eq('provider_payment_id', depositId)
      .maybeSingle();
    paiement = data;
  }

  if (!paiement && checkoutCode) {
    const { data } = await supabaseAdmin
      .from('paiements')
      .select('provider_payment_id, metadata')
      .eq('transaction_id', checkoutCode)
      .maybeSingle();
    paiement = data;
  }

  if (paiement?.metadata?.returnUrl) {
    targetReturnUrl = paiement.metadata.returnUrl;
  }

  const finalDepositId = paiement?.provider_payment_id || depositId || checkoutCode || '';
  const separator = targetReturnUrl.includes('?') ? '&' : '?';
  const finalRedirect = `${targetReturnUrl}${separator}deposit_id=${encodeURIComponent(finalDepositId)}&checkout_code=${encodeURIComponent(checkoutCode || '')}&provider=pawapay`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: finalRedirect,
    },
  });
});
