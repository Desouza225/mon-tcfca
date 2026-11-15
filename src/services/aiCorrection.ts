import { supabase } from '@/db/supabase';

export interface CriterionScore {
  nom: string;
  note: number;
  max: number;
  justification: string;
}

export interface DimensionScore {
  total: number;
  criteres: CriterionScore[];
}

export interface CorrectionErrorItem {
  citation: string;
  correction: string;
  categorie: string;
  explication: string;
}

export interface ConsigneAnalysisElement {
  exigence: string;
  contenu_candidat: string;
  evaluation: string;
  consequence: string;
}

export interface ConsigneAnalysis {
  elements_consigne: ConsigneAnalysisElement[];
  situation_hors_sujet: string;
  bilan_consigne: string;
}

export interface PlanProgression {
  priorites: string[];
  exercices_recommandes: string[];
  erreurs_a_surveiller: string[];
  objectif_prochaine_seance: string;
}

export interface AICorrectionResult {
  total: number;
  niveau_cecrl: string;
  note_linguistique: DimensionScore;
  note_pragmatique: DimensionScore;
  note_sociolinguistique: DimensionScore;
  feedback_par_critere: {
    lexique?: string;
    grammaire?: string;
    fluidite_ou_orthographe?: string;
    coherence_structuration?: string;
    developpement_consigne?: string;
    sociolinguistique?: string;
    [key: string]: string | undefined;
  };
  analyse_consigne?: ConsigneAnalysis;
  erreurs_et_corrections?: CorrectionErrorItem[];
  version_amelioree?: string;
  explications_amelioration?: {
    contenu: string;
    linguistique: string;
    organisation: string;
  };
  plan_progression?: PlanProgression;
  points_forts?: string[];
  points_faibles?: string[];
  appreciation_generale?: string;
}

export interface CorrectionResponse {
  success: boolean;
  submission: {
    id: string;
    user_id: string;
    task_type: string;
    raw_text: string;
    file_url?: string;
    consigne: string;
    reference?: string;
    submitted_at: string;
  };
  correction: {
    id: string;
    submission_id: string;
    total: number;
    niveau_cecrl: string;
    evaluation: AICorrectionResult;
    created_at: string;
  };
  quota_restant: number;
}

export interface SubmitCorrectionParams {
  task_type: 'EE_tache1' | 'EE_tache2' | 'EE_tache3' | 'EO_tache1' | 'EO_tache2' | 'EO_tache3';
  consigne: string;
  raw_text?: string;
  audio_url?: string;
  audio_base64?: string;
  mime_type?: string;
  reference?: string;
  session_id?: string;
  production_id?: string;
}

/**
 * Vérifier le quota restant de l'utilisateur pour l'expression écrite ou orale
 */
export async function checkUserQuota(type: 'ee' | 'eo'): Promise<{
  hasActiveSub: boolean;
  remaining: number;
  planId?: string;
  expiration?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { hasActiveSub: false, remaining: 0 };
    }

    // 1. Tenter l'appel RPC dédié
    const { data, error } = await supabase.rpc('check_user_quota', {
      p_user_id: user.id,
      p_type: type,
    });

    if (!error && data) {
      return {
        hasActiveSub: data.has_active_sub ?? false,
        remaining: data.remaining ?? 0,
        planId: data.plan_id,
        expiration: data.expiration,
      };
    }

    // 2. Fallback direct sur la table abonnements si la RPC n'est pas encore créée
    const { data: subData } = await supabase
      .from('abonnements')
      .select('quota_ee_restant, quota_eo_restant, plan_id, status, statut, current_period_end')
      .or(`user_id.eq.${user.id},etudiant_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subData && (subData.status === 'active' || subData.statut === 'actif')) {
      const remaining = type === 'ee'
        ? (subData.quota_ee_restant ?? 0)
        : (subData.quota_eo_restant ?? 0);
      return {
        hasActiveSub: true,
        remaining,
        planId: subData.plan_id,
        expiration: subData.current_period_end,
      };
    }

    return { hasActiveSub: false, remaining: 0 };
  } catch (err) {
    console.error('Erreur checkUserQuota:', err);
    return { hasActiveSub: false, remaining: 0 };
  }
}

/**
 * Convertir un Blob audio en base64 pour l'envoi direct à l'Edge Function
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // Retirer le préfixe data:audio/...;base64,
      const parts = base64data.split(',');
      resolve(parts[1] || parts[0]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Soumettre une production écrite ou orale pour correction IA
 */
export async function requestAICorrection(
  params: SubmitCorrectionParams
): Promise<CorrectionResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  if (!token) {
    throw new Error('Veuillez vous connecter pour soumettre votre devoir.');
  }

  const { data, error } = await supabase.functions.invoke('correct-expression', {
    body: params,
  });

  if (error) {
    // Si Supabase renvoie une erreur HTTP (ex: 403 quota)
    let errorMessage = error.message;
    let quotaError = false;

    if (error.context?.json) {
      try {
        const jsonErr = await error.context.json();
        if (jsonErr.error === 'QUOTA_EXHAUSTED' || jsonErr.message?.includes('quota')) {
          quotaError = true;
          errorMessage = jsonErr.message;
        } else if (jsonErr.message) {
          errorMessage = jsonErr.message;
        }
      } catch {
        // Ignorer le parse JSON d'erreur
      }
    }

    const customErr: any = new Error(errorMessage || 'Échec de la correction.');
    customErr.isQuotaExhausted = quotaError || errorMessage?.includes('quota');
    throw customErr;
  }

  if (data?.error) {
    const customErr: any = new Error(data.message || data.error);
    customErr.isQuotaExhausted = data.error === 'QUOTA_EXHAUSTED';
    throw customErr;
  }

  return data as CorrectionResponse;
}
