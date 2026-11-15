import { supabase } from '@/db/supabase';

/**
 * Vérifie et génère automatiquement les alertes dans la table `notifications` :
 * 1. Abonnement bientôt expiré (<= 5 jours)
 * 2. Quota de corrections presque épuisé (<= 2 corrections restantes)
 * 3. Nouvelle fiche pédagogique publiée récemment
 */
export async function checkAndTriggerStudentAlerts(userId: string): Promise<void> {
  if (!userId) return;

  try {
    // 1. Charger l'abonnement actif
    const { data: abonnement } = await supabase
      .from('abonnements')
      .select('*')
      .or(`user_id.eq.${userId},etudiant_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Récupérer les notifications récentes (48 dernières heures) pour éviter les doublons
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: recentNotifs } = await supabase
      .from('notifications')
      .select('titre, created_at')
      .eq('utilisateur_id', userId)
      .gte('created_at', fortyEightHoursAgo);

    const recentTitles = Array.isArray(recentNotifs) ? recentNotifs.map(n => n.titre) : [];

    if (abonnement && (abonnement.status === 'active' || abonnement.statut === 'actif')) {
      // ─── A. Alerte abonnement bientôt expiré ───────────────────────────────
      const endDate = abonnement.current_period_end 
        ? new Date(abonnement.current_period_end) 
        : abonnement.date_fin 
          ? new Date(abonnement.date_fin) 
          : null;

      if (endDate) {
        const daysRemaining = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysRemaining <= 5 && daysRemaining > 0) {
          const alreadyNotified = recentTitles.some(t => t.includes('Abonnement bientôt expiré'));
          if (!alreadyNotified) {
            await supabase.from('notifications').insert({
              utilisateur_id: userId,
              titre: 'Abonnement bientôt expiré ⚠️',
              message: `Votre formule expire dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}. Pensez à renouveler votre formule pour continuer vos corrections et simulations sans interruption.`,
              lien: '/etudiant/abonnement',
            });
          }
        }
      }

      // ─── B. Alerte quota de corrections bientôt épuisé ─────────────────────
      const eeRestant = abonnement.quota_ee_restant;
      const eoRestant = abonnement.quota_eo_restant;

      const isQuotaLow = 
        (typeof eeRestant === 'number' && eeRestant <= 2 && eeRestant > 0) ||
        (typeof eoRestant === 'number' && eoRestant <= 2 && eoRestant > 0);

      if (isQuotaLow) {
        const alreadyNotified = recentTitles.some(t => t.includes('Quota de corrections'));
        if (!alreadyNotified) {
          await supabase.from('notifications').insert({
            utilisateur_id: userId,
            titre: 'Quota de corrections bientôt épuisé ⚡',
            message: `Il ne vous reste que ${eeRestant ?? 0} correction(s) écrite(s) et ${eoRestant ?? 0} correction(s) orale(s). Rechargez vos crédits pour poursuivre vos entraînements intensifs.`,
            lien: '/etudiant/abonnement',
          });
        }
      }
    }

    // ─── C. Alerte nouvelle fiche pédagogique ajoutée ───────────────────────
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentSheets } = await supabase
      .from('course_sheets')
      .select('id, titre, epreuve, created_at')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1);

    if (Array.isArray(recentSheets) && recentSheets.length > 0) {
      const latestSheet = recentSheets[0];
      const notifKey = `Nouvelle fiche : ${latestSheet.titre}`;

      // Vérifier si cette fiche spécifique a déjà été notifiée dans toute l'histoire
      const { data: existingSheetNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('utilisateur_id', userId)
        .ilike('message', `%${latestSheet.titre}%`)
        .limit(1);

      if (!existingSheetNotif || existingSheetNotif.length === 0) {
        await supabase.from('notifications').insert({
          utilisateur_id: userId,
          titre: 'Nouvelle fiche pédagogique disponible 📚',
          message: `Une nouvelle fiche méthodologique a été publiée : « ${latestSheet.titre} » (${latestSheet.epreuve}). Consultez-la dès maintenant !`,
          lien: '/etudiant/fiches',
        });
      }
    }
  } catch (err) {
    console.error('Erreur checkAndTriggerStudentAlerts:', err);
  }
}
