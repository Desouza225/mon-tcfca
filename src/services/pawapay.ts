import { supabase } from '@/db/supabase';

export interface PawaPayInitializeResponse {
  url?: string;
  redirectUrl?: string;
  depositId?: string;
  error?: string;
}

export interface PawaPayVerifyResponse {
  success: boolean;
  status?: string;
  amount?: number;
  planId?: string;
  depositId?: string;
  error?: string;
}

interface SupabaseFunctionError {
  message?: string;
  context?: {
    json?: () => Promise<{ error?: string }>;
  };
}

/**
 * Initialise une session de paiement PawaPay (Payment Page v2)
 * Accepte les réseaux Mobile Money dans toute l'Afrique :
 * MTN, Orange Money, Wave, Moov, Airtel, M-Pesa, etc.
 */
export async function initializePawaPayCheckout(
  planId: string,
  returnUrl?: string
): Promise<PawaPayInitializeResponse> {
  try {
    const origin = window.location.origin;
    const defaultReturnUrl = `${origin}/etudiant/abonnement/succes`;

    const { data, error } = await supabase.functions.invoke('create-pawapay-checkout', {
      body: {
        planId,
        returnUrl: returnUrl || defaultReturnUrl,
      },
    });

    if (error) {
      console.error('Erreur appel Edge Function create-pawapay-checkout:', error);
      let customErrorMsg = error.message;
      const fnErr = error as SupabaseFunctionError;
      try {
        if (fnErr.context && typeof fnErr.context.json === 'function') {
          const errBody = await fnErr.context.json();
          if (errBody?.error) customErrorMsg = errBody.error;
        }
      } catch {}
      return { error: customErrorMsg || "Impossible d'initialiser le paiement PawaPay" };
    }

    if (data?.error) {
      return { error: data.error };
    }

    if (!data?.redirectUrl && !data?.url) {
      return { error: "L'URL de paiement PawaPay n'a pas pu être générée" };
    }

    return {
      url: data?.redirectUrl || data?.url,
      redirectUrl: data?.redirectUrl || data?.url,
      depositId: data?.depositId,
    };
  } catch (err) {
    console.error('Exception initializePawaPayCheckout:', err);
    const message = err instanceof Error ? err.message : 'Erreur de connexion avec PawaPay';
    return { error: message };
  }
}

/**
 * Vérifie le statut d'une transaction PawaPay par son depositId
 */
export async function verifyPawaPayTransaction(depositId: string): Promise<PawaPayVerifyResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-pawapay-transaction', {
      body: { depositId },
    });

    if (error) {
      console.error('Erreur appel verify-pawapay-transaction:', error);
      return { success: false, error: error.message };
    }

    const isSuccess = data?.success === true || String(data?.status || '').toUpperCase() === 'COMPLETED';

    return {
      success: isSuccess,
      status: data?.status,
      amount: data?.amount,
      planId: data?.planId,
      depositId: data?.depositId || depositId,
      error: data?.error,
    };
  } catch (err) {
    console.error('Exception verifyPawaPayTransaction:', err);
    const message = err instanceof Error ? err.message : 'Erreur lors de la vérification PawaPay';
    return { success: false, error: message };
  }
}
