import { supabase } from '@/db/supabase';

export interface CheckoutSessionResponse {
  url?: string;
  sessionId?: string;
  error?: string;
}

export interface PortalSessionResponse {
  url?: string;
  error?: string;
}

/**
 * Initialise une session Stripe Checkout pour un plan donné.
 */
export async function createCheckoutSession(
  planId: string,
  successUrl?: string,
  cancelUrl?: string
): Promise<CheckoutSessionResponse> {
  try {
    const origin = window.location.origin;
    const defaultSuccessUrl = `${origin}/etudiant/abonnement/succes?session_id={CHECKOUT_SESSION_ID}`;
    const defaultCancelUrl = `${origin}/etudiant/abonnement`;

    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: {
        planId,
        successUrl: successUrl || defaultSuccessUrl,
        cancelUrl: cancelUrl || defaultCancelUrl,
      },
    });

    if (error) {
      console.error('Erreur appel Edge Function create-checkout-session:', error);
      return { error: error.message || 'Impossible de créer la session de paiement' };
    }

    return data as CheckoutSessionResponse;
  } catch (err: any) {
    console.error('Exception createCheckoutSession:', err);
    return { error: err.message || 'Erreur lors de la connexion avec la passerelle Stripe' };
  }
}

/**
 * Initialise une session vers le Portail Client Stripe (gestion d'abonnement / annulation).
 */
export async function createCustomerPortalSession(returnUrl?: string): Promise<PortalSessionResponse> {
  try {
    const origin = window.location.origin;
    const defaultReturnUrl = `${origin}/etudiant/abonnement`;

    const { data, error } = await supabase.functions.invoke('create-portal-session', {
      body: {
        returnUrl: returnUrl || defaultReturnUrl,
      },
    });

    if (error) {
      console.error('Erreur appel Edge Function create-portal-session:', error);
      return { error: error.message || 'Impossible d’ouvrir le portail de facturation' };
    }

    return data as PortalSessionResponse;
  } catch (err: any) {
    console.error('Exception createCustomerPortalSession:', err);
    return { error: err.message || 'Erreur lors de l’ouverture du portail de facturation' };
  }
}
