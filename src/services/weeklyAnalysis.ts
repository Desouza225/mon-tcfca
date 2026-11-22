import { supabase } from '@/db/supabase';

export interface WeeklyStatsSnapshot {
  periode_debut: string;
  periode_fin: string;
  numero_bilan: number;
  activite_7j: {
    sessions_total: number;
    sessions_terminees: number;
    examens_blancs: number;
    entrainements: number;
    corrections_ee: number;
    corrections_eo: number;
    qcm_reponses_total: number;
    qcm_taux_reussite_pct: number | null;
    fiches_lues_7j: number;
  };
  activite_periode_precedente: {
    sessions_total: number;
    corrections_ee: number;
    corrections_eo: number;
    qcm_reponses_total: number;
    qcm_taux_reussite_pct: number | null;
  };
  scores_actuels: {
    ce_moyenne_7j: number | null;
    co_moyenne_7j: number | null;
    ee_moyenne_7j: number | null;
    eo_moyenne_7j: number | null;
    ce_moyenne_globale: number | null;
    co_moyenne_globale: number | null;
    ee_moyenne_globale: number | null;
    eo_moyenne_globale: number | null;
    score_global_estime_699: number | null;
    niveau_nclc_estime: string;
  };
  evolutions_vs_precedent: {
    delta_ce: number | null;
    delta_co: number | null;
    delta_ee: number | null;
    delta_eo: number | null;
    delta_qcm_pct: number | null;
    delta_sessions: number;
  };
  qcm_par_niveau_7j: Record<string, { total: number; correctes: number; taux_pct: number }>;
  expression_par_tache: Record<string, { count: number; moyenne: number }>;
  erreurs_recurrentes: { categorie: string; count: number; exemples: string[] }[];
  fiches_pedagogiques: {
    total_lues: number;
    total_disponibles: number;
    lues_par_epreuve: Record<string, number>;
  };
  quotas_intensif: {
    ee_restant: number | null;
    eo_restant: number | null;
    examens_blancs_restant: number | null;
    jours_abonnement_restants: number | null;
  };
  comparaison_seuils_nclc7: {
    ecart_ce: number | null;
    ecart_co: number | null;
    ecart_ee: number | null;
    ecart_eo: number | null;
  };
}

export interface EpreuveAnalysisItem {
  epreuve: 'CE' | 'CO' | 'EE' | 'EO' | string;
  label: string;
  statut: 'objectif_atteint' | 'en_progres' | 'a_consolider' | 'non_evalue' | string;
  score_actuel: string;
  evolution: string;
  commentaire_professeur: string;
  conseil_cible: string;
}

export interface AxeAmeliorationItem {
  axe: string;
  constat_chiffre: string;
  action_concrete: string;
}

export interface PlanActionItem {
  priorite: number;
  titre: string;
  description: string;
  objectif_mesurable: string;
}

export interface WeeklyAnalysisContent {
  objet: string;
  mot_du_professeur: string;
  synthese_comparative: {
    tendance_globale: 'progression' | 'stagnation' | 'baisse' | 'demarrage' | string;
    resume_chiffre: string;
    comparaison_nclc7: string;
    evolution_periode: string;
  };
  analyse_par_epreuve: EpreuveAnalysisItem[];
  points_forts: string[];
  axes_amelioration: AxeAmeliorationItem[];
  plan_action_7_jours: PlanActionItem[];
  mot_de_fin: string;
}

export interface WeeklyAnalysisReport {
  id: string;
  user_id: string;
  abonnement_id: string | null;
  periode_debut: string;
  periode_fin: string;
  numero_bilan: number;
  professeur_nom: string;
  professeur_titre: string;
  statistiques_snapshot: WeeklyStatsSnapshot;
  analyse_contenu: WeeklyAnalysisContent;
  lu_at: string | null;
  created_at: string;
}

export interface CooldownState {
  canGenerate: boolean;
  daysRemaining: number;
  nextAvailableAt: Date | null;
}

const COOLDOWN_DAYS = 7;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export function computeCooldownState(
  latestReport: WeeklyAnalysisReport | null,
  subscriptionStartIso?: string | null
): CooldownState {
  const now = Date.now();

  if (!latestReport) {
    if (subscriptionStartIso) {
      const firstAvailableMs = new Date(subscriptionStartIso).getTime() + COOLDOWN_MS;
      if (now < firstAvailableMs) {
        return {
          canGenerate: false,
          daysRemaining: Math.ceil((firstAvailableMs - now) / (1000 * 60 * 60 * 24)),
          nextAvailableAt: new Date(firstAvailableMs),
        };
      }
    }
    return { canGenerate: true, daysRemaining: 0, nextAvailableAt: null };
  }

  const lastCreated = new Date(latestReport.created_at).getTime();
  const nextAvailableMs = lastCreated + COOLDOWN_MS;

  if (now >= nextAvailableMs) {
    return { canGenerate: true, daysRemaining: 0, nextAvailableAt: null };
  }

  return {
    canGenerate: false,
    daysRemaining: Math.ceil((nextAvailableMs - now) / (1000 * 60 * 60 * 24)),
    nextAvailableAt: new Date(nextAvailableMs),
  };
}

export async function fetchWeeklyAnalyses(userId: string): Promise<WeeklyAnalysisReport[]> {
  const { data, error } = await supabase
    .from('analyses_comparatives')
    .select(
      'id, user_id, abonnement_id, periode_debut, periode_fin, numero_bilan, professeur_nom, professeur_titre, statistiques_snapshot, analyse_contenu, lu_at, created_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (data || []) as WeeklyAnalysisReport[];
}

export async function markAnalysisAsRead(reportId: string): Promise<void> {
  await supabase
    .from('analyses_comparatives')
    .update({ lu_at: new Date().toISOString() })
    .eq('id', reportId)
    .is('lu_at', null);
}

export async function requestWeeklyAnalysis(options?: {
  force?: boolean;
}): Promise<WeeklyAnalysisReport> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData?.session?.access_token) {
    throw new Error('Veuillez vous connecter pour consulter votre bilan pédagogique.');
  }

  const { data, error } = await supabase.functions.invoke('generate-weekly-analysis', {
    body: options?.force ? { force: true } : {},
  });

  if (error) {
    let errorMessage = error.message;
    let errorCode = 'UNKNOWN';
    let daysRemaining: number | undefined;
    let nextAvailableAt: string | undefined;

    if (error.context?.json) {
      try {
        const jsonErr = await error.context.json();
        errorCode = jsonErr.error || errorCode;
        errorMessage = jsonErr.message || errorMessage;
        daysRemaining = jsonErr.days_remaining;
        nextAvailableAt = jsonErr.next_available_at;
      } catch {
        // Ignorer l'erreur de parsing
      }
    }

    const customErr: any = new Error(errorMessage || 'Impossible de préparer votre bilan pédagogique.');
    customErr.code = errorCode;
    customErr.daysRemaining = daysRemaining;
    customErr.nextAvailableAt = nextAvailableAt;
    throw customErr;
  }

  if (data?.error) {
    const customErr: any = new Error(data.message || data.error);
    customErr.code = data.error;
    customErr.daysRemaining = data.days_remaining;
    customErr.nextAvailableAt = data.next_available_at;
    throw customErr;
  }

  return data.report as WeeklyAnalysisReport;
}
