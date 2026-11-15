import { supabase } from '@/db/supabase';

export interface PaystackInitializeResponse {
  url?: string;
  authorization_url?: string;
  access_code?: string;
  reference?: string;
  error?: string;
}

export interface PaystackVerifyResponse {
  success: boolean;
  status?: string;
  amount?: number;
  planId?: string;
  error?: string;
}

/**
 * Initialise une transaction Paystack en Francs CFA (XOF)
 * Accepte : Wave, Orange Money, MTN, Moov, Visa, Mastercard.
 */
export async function initializePaystackCheckout(
  planId: string,
  callbackUrl?: string
): Promise<PaystackInitializeResponse> {
  try {
    const origin = window.location.origin;
    const defaultCallbackUrl = `${origin}/etudiant/abonnement/succes`;

    const { data, error } = await supabase.functions.invoke('create-paystack-checkout', {
      body: {
        planId,
        callbackUrl: callbackUrl || defaultCallbackUrl,
      },
    });

    if (error) {
      console.error('Erreur appel Edge Function create-paystack-checkout:', error);
      return { error: error.message || 'Impossible d’initialiser le paiement Paystack' };
    }

    return {
      url: data?.authorization_url || data?.url,
      authorization_url: data?.authorization_url,
      access_code: data?.access_code,
      reference: data?.reference,
    };
  } catch (err: any) {
    console.error('Exception initializePaystackCheckout:', err);
    return { error: err.message || 'Erreur de connexion avec Paystack' };
  }
}

/**
 * Vérifie le statut d'une transaction Paystack par sa référence
 */
export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('verify-paystack-transaction', {
      body: { reference },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: data?.status === 'success',
      status: data?.status,
      amount: data?.amount,
      planId: data?.planId,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
