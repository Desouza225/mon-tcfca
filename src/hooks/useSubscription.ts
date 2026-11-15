import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Abonnement } from '@/types/index';

export function useSubscription() {
  const { user, isAdmin } = useAuth();
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setAbonnement(null);
      setLoading(false);
      return;
    }

    // L'administrateur a un accès complet sans restriction
    if (isAdmin) {
      setAbonnement({
        id: 'admin-unlimited',
        user_id: user.id,
        plan_id: 'intensif',
        status: 'active',
        quota_ee_restant: 999,
        quota_eo_restant: 999,
        quota_examen_blanc_restant: 999,
        created_at: new Date().toISOString(),
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data } = await supabase
        .from('abonnements')
        .select('*')
        .or(`user_id.eq.${user.id},etudiant_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const rawStatut = (data as { statut?: string } | null)?.statut;
      if (data && (data.status === 'active' || data.status === 'actif' || rawStatut === 'actif')) {
        setAbonnement(data);
        // Déclencher discrètement la détection des expirations pour notifier si besoin
        Promise.resolve(supabase.rpc('verifier_et_notifier_expirations_abonnements')).catch(() => {});
      } else {
        setAbonnement(null);
      }
    } catch (err) {
      console.error('Erreur chargement abonnement:', err);
      setAbonnement(null);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const endDate = abonnement?.current_period_end 
    ? new Date(abonnement.current_period_end) 
    : abonnement?.date_fin 
      ? new Date(abonnement.date_fin) 
      : null;

  const daysRemaining = endDate ? Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 5 && daysRemaining > 0;
  const isExpired = endDate !== null && endDate.getTime() <= Date.now();
  const isMobileMoney = !!abonnement && (abonnement.methode === 'mobile_money' || abonnement.auto_renew === false);

  const rawAbonnementStatut = (abonnement as { statut?: string } | null)?.statut;
  const hasActiveSubscription =
    !!abonnement &&
    (abonnement.status === 'active' || abonnement.status === 'actif' || rawAbonnementStatut === 'actif') &&
    !isExpired;

  return {
    abonnement,
    hasActiveSubscription,
    daysRemaining,
    isExpiringSoon,
    isExpired,
    isMobileMoney,
    loading,
    isAdmin,
    refreshSubscription: fetchSubscription,
  };
}
