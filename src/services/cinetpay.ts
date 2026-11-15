import { supabase } from '@/db/supabase';

export interface CinetPayInitializeResponse {
  url?: string;
  paymentUrl?: string;
  transactionId?: string;
  paymentToken?: string;
  error?: string;
}

export interface CinetPayVerifyResponse {
  success: boolean;
  status?: string;
  amount?: number;
  planId?: string;
  transactionId?: string;
  error?: string;
}

interface SupabaseFunctionError {
  message?: string;
  context?: {
    json?: () => Promise<{ error?: string }>;
  };
}

/**
 * Initialise une session de paiement CinetPay (v2/payment)
 * Accepte Mobile Money (Orange, MTN, Moov, Wave) et Cartes Bancaires (Visa, Mastercard)
 */
export async function initializeCinetPayCheckout(
  planId: string,
  returnUrl?: string
): Promise<CinetPayInitializeResponse> {
  try {
    const origin = window.location.origin;
    const defaultReturnUrl = `${origin}/etudiant/abonnement/succes`;
    const resolvedReturnUrl = returnUrl || defaultReturnUrl;

    // En développement local, passer par le proxy Vite local pour utiliser l'IP whitelistée du poste
    if (import.meta.env.DEV) {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        const localRes = await fetch('/api/cinetpay-local/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            planId,
            returnUrl: resolvedReturnUrl,
          }),
        });

        if (localRes.ok) {
          const localData = await localRes.json().catch(() => null);
          if (localData) {
            if (localData.error) {
              return { error: localData.error };
            }
            if (localData.paymentUrl || localData.url) {
              return {
                url: localData.paymentUrl || localData.url,
                paymentUrl: localData.paymentUrl || localData.url,
                transactionId: localData.transactionId,
                paymentToken: localData.paymentToken,
              };
            }
          }
        }
      }
    }

    const { data, error } = await supabase.functions.invoke('create-cinetpay-checkout', {
      body: {
        planId,
        returnUrl: resolvedReturnUrl,
      },
    });

    if (error) {
      console.error('Erreur appel Edge Function create-cinetpay-checkout:', error);
      let customErrorMsg = error.message;
      const fnErr = error as SupabaseFunctionError;
      try {
        if (fnErr.context && typeof fnErr.context.json === 'function') {
          const errBody = await fnErr.context.json();
          if (errBody?.error) customErrorMsg = errBody.error;
        }
      } catch {}
      return { error: customErrorMsg || "Impossible d'initialiser le paiement CinetPay" };
    }

    if (data?.error) {
      return { error: data.error };
    }

    if (!data?.paymentUrl && !data?.url) {
      return { error: "L'URL de paiement CinetPay n'a pas pu être générée" };
    }

    return {
      url: data?.paymentUrl || data?.url,
      paymentUrl: data?.paymentUrl || data?.url,
      transactionId: data?.transactionId,
      paymentToken: data?.paymentToken,
    };
  } catch (err) {
    console.error('Exception initializeCinetPayCheckout:', err);
    const message = err instanceof Error ? err.message : 'Erreur de connexion avec CinetPay';
    return { error: message };
  }
}

/**
 * Vérifie le statut d'une transaction CinetPay par son transactionId
 */
export async function verifyCinetPayTransaction(transactionId: string): Promise<CinetPayVerifyResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-cinetpay-transaction', {
      body: { transactionId },
    });

    if (error) {
      console.error('Erreur appel verify-cinetpay-transaction:', error);
      return { success: false, error: error.message };
    }

    const isSuccess =
      data?.success === true || String(data?.status || '').toUpperCase() === 'ACCEPTED';

    return {
      success: isSuccess,
      status: data?.status,
      amount: data?.amount,
      planId: data?.planId,
      transactionId: data?.transactionId || transactionId,
      error: data?.error,
    };
  } catch (err) {
    console.error('Exception verifyCinetPayTransaction:', err);
    const message = err instanceof Error ? err.message : 'Erreur lors de la vérification CinetPay';
    return { success: false, error: message };
  }
}

