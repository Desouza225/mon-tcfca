import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || '';
const CLAUDE_MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5-5';

const COOLDOWN_DAYS = 7;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

const DEFAULT_PROF_NAME = 'Prof. Claire Beaumont';
const DEFAULT_PROF_TITLE = 'Examinatrice & Formatrice Certifiée TCF Canada';

// Seuils officiels NCLC 7 (Entrée Express Canada) & C1/C2
const OFFICIAL_BENCHMARKS = {
  nclc7: { ce: 453, co: 458, ee: 14, eo: 14 },
  nclc9_c1: { ce: 524, co: 523, ee: 14, eo: 14 },
  nclc10_c2: { ce: 549, co: 549, ee: 16, eo: 16 },
};

function cleanAndParseJSON(rawText: string): any {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return JSON.parse(cleaned);
}

function isAnalysisValid(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.objet !== 'string' || data.objet.trim().length < 5) return false;
  if (typeof data.mot_du_professeur !== 'string' || data.mot_du_professeur.trim().length < 30) return false;
  if (!data.synthese_comparative || typeof data.synthese_comparative !== 'object') return false;
  if (!Array.isArray(data.analyse_par_epreuve) || data.analyse_par_epreuve.length < 4) return false;
  if (!Array.isArray(data.plan_action_7_jours) || data.plan_action_7_jours.length < 2) return false;
  if (typeof data.mot_de_fin !== 'string' || data.mot_de_fin.trim().length < 15) return false;
  return true;
}

function avg(nums: number[], decimals = 0): number | null {
  if (nums.length === 0) return null;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  return decimals === 0 ? Math.round(mean) : Number(mean.toFixed(decimals));
}

function computeDelta(current: number | null, previous: number | null, decimals = 0): number | null {
  if (current === null || previous === null) return null;
  const diff = current - previous;
  return decimals === 0 ? Math.round(diff) : Number(diff.toFixed(decimals));
}

interface StudentMetricsSnapshot {
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

async function gatherStudentRealData(
  supabaseAdmin: any,
  userId: string,
  abonnement: any,
  numeroBilan: number,
  previousReport: any | null
): Promise<{
  profile: any;
  professeurNom: string;
  professeurTitre: string;
  snapshot: StudentMetricsSnapshot;
  recentCorrectionsDetails: any[];
}> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - COOLDOWN_MS);
  const fourteenDaysAgo = new Date(now.getTime() - 2 * COOLDOWN_MS);

  // 1. Profil étudiant + attribution professeur éventuelle
  const [{ data: profile }, { data: attribution }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, email, prenom, nom, last_active_at, created_at')
      .eq('id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('attributions')
      .select('professeur_id, professeur:profiles!attributions_professeur_id_fkey(prenom, nom)')
      .eq('etudiant_id', userId)
      .maybeSingle(),
  ]);

  let professeurNom = DEFAULT_PROF_NAME;
  const professeurTitre = DEFAULT_PROF_TITLE;
  const profObj = Array.isArray(attribution?.professeur)
    ? attribution?.professeur[0]
    : attribution?.professeur;
  if (profObj && (profObj.prenom || profObj.nom)) {
    professeurNom = `Prof. ${[profObj.prenom, profObj.nom].filter(Boolean).join(' ')}`;
  }

  // 2. Sessions d'examen, soumissions + corrections, productions, fiches lues
  const [
    { data: sessionsData },
    { data: submissionsData },
    { data: productionsData },
    { data: sheetReadsData },
    { count: totalSheetsCount },
  ] = await Promise.all([
    supabaseAdmin
      .from('sessions_examen')
      .select('id, mode, epreuve_actuelle, statut, score_oral, score_ecrit, score_expression_ecrite, score_expression_orale, score_global, niveau_cecrl, created_at, termine_at')
      .eq('etudiant_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('submissions')
      .select(`
        id,
        task_type,
        production_id,
        session_id,
        submitted_at,
        corrections (
          id,
          total,
          niveau_cecrl,
          note_linguistique,
          note_pragmatique,
          note_sociolinguistique,
          feedback_par_critere,
          erreurs_et_corrections,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('productions')
      .select('id, session_id, epreuve, numero_tache, score, statut_correction, commentaire, created_at')
      .eq('etudiant_id', userId)
      .eq('statut_correction', 'corrige')
      .order('created_at', { ascending: false })
      .limit(100),
    supabaseAdmin
      .from('course_sheet_reads')
      .select('id, read_at, sheet:course_sheets(epreuve, titre)')
      .eq('user_id', userId),
    supabaseAdmin
      .from('course_sheets')
      .select('id', { count: 'exact', head: true }),
  ]);

  const sessions = Array.isArray(sessionsData) ? sessionsData : [];
  const sessions7j = sessions.filter((s: any) => new Date(s.created_at) >= sevenDaysAgo);
  const sessionsPrev = sessions.filter(
    (s: any) => new Date(s.created_at) >= fourteenDaysAgo && new Date(s.created_at) < sevenDaysAgo
  );

  // 3. Réponses QCM sur les 14 derniers jours (via session_ids)
  const recentSessionIds = sessions
    .filter((s: any) => new Date(s.created_at) >= fourteenDaysAgo)
    .map((s: any) => s.id);

  let qcmResponses: any[] = [];
  if (recentSessionIds.length > 0) {
    const { data: qcmData } = await supabaseAdmin
      .from('reponses_qcm')
      .select('id, session_id, est_correcte, created_at, question:questions(epreuve, niveau)')
      .in('session_id', recentSessionIds)
      .limit(1500);
    qcmResponses = Array.isArray(qcmData) ? qcmData : [];
  }

  const qcm7j = qcmResponses.filter((r: any) => new Date(r.created_at) >= sevenDaysAgo);
  const qcmPrev = qcmResponses.filter(
    (r: any) => new Date(r.created_at) >= fourteenDaysAgo && new Date(r.created_at) < sevenDaysAgo
  );

  const qcmCorrect7j = qcm7j.filter((r: any) => r.est_correcte === true).length;
  const qcmPct7j = qcm7j.length > 0 ? Math.round((qcmCorrect7j / qcm7j.length) * 100) : null;

  const qcmCorrectPrev = qcmPrev.filter((r: any) => r.est_correcte === true).length;
  const qcmPctPrev = qcmPrev.length > 0 ? Math.round((qcmCorrectPrev / qcmPrev.length) * 100) : null;

  const qcmByLevel7j: Record<string, { total: number; correctes: number; taux_pct: number }> = {};
  for (const r of qcm7j) {
    const qObj = Array.isArray(r.question) ? r.question[0] : r.question;
    const niveau = qObj?.niveau || 'Non classé';
    if (!qcmByLevel7j[niveau]) {
      qcmByLevel7j[niveau] = { total: 0, correctes: 0, taux_pct: 0 };
    }
    qcmByLevel7j[niveau].total += 1;
    if (r.est_correcte === true) qcmByLevel7j[niveau].correctes += 1;
  }
  for (const key of Object.keys(qcmByLevel7j)) {
    const item = qcmByLevel7j[key];
    item.taux_pct = item.total > 0 ? Math.round((item.correctes / item.total) * 100) : 0;
  }

  // 4. Consolidation des corrections EE/EO (dédupliquées entre submissions/corrections et productions)
  const allCorrections: any[] = [];
  const seenProdIds = new Set<string>();
  const seenSessionTasks = new Set<string>();

  for (const sub of Array.isArray(submissionsData) ? submissionsData : []) {
    const corr = Array.isArray(sub.corrections) ? sub.corrections[0] : sub.corrections;
    if (corr) {
      if (sub.production_id) seenProdIds.add(sub.production_id);
      if (sub.session_id && sub.task_type) seenSessionTasks.add(`${sub.session_id}:${sub.task_type}`);
      allCorrections.push({
        task_type: sub.task_type,
        total: Number(corr.total),
        niveau_cecrl: corr.niveau_cecrl,
        feedback_par_critere: corr.feedback_par_critere,
        erreurs_et_corrections: corr.erreurs_et_corrections,
        created_at: corr.created_at || sub.submitted_at,
      });
    }
  }

  for (const p of Array.isArray(productionsData) ? productionsData : []) {
    const taskType =
      p.epreuve === 'expression_ecrite'
        ? `EE_tache${p.numero_tache}`
        : `EO_tache${p.numero_tache}`;
    if (
      p.score !== null &&
      p.score !== undefined &&
      !seenProdIds.has(p.id) &&
      !(p.session_id && seenSessionTasks.has(`${p.session_id}:${taskType}`))
    ) {
      allCorrections.push({
        task_type: taskType,
        total: Number(p.score),
        niveau_cecrl: null,
        feedback_par_critere: null,
        erreurs_et_corrections: null,
        created_at: p.created_at,
      });
    }
  }

  const corr7j = allCorrections.filter((c) => new Date(c.created_at) >= sevenDaysAgo);
  const corrPrev = allCorrections.filter(
    (c) => new Date(c.created_at) >= fourteenDaysAgo && new Date(c.created_at) < sevenDaysAgo
  );

  // Scores CE/CO
  const ce7j = avg(sessions7j.map((s: any) => s.score_ecrit).filter((n: any) => typeof n === 'number' && n > 0));
  const co7j = avg(sessions7j.map((s: any) => s.score_oral).filter((n: any) => typeof n === 'number' && n > 0));
  const cePrev = avg(sessionsPrev.map((s: any) => s.score_ecrit).filter((n: any) => typeof n === 'number' && n > 0));
  const coPrev = avg(sessionsPrev.map((s: any) => s.score_oral).filter((n: any) => typeof n === 'number' && n > 0));
  const ceGlobal = avg(sessions.map((s: any) => s.score_ecrit).filter((n: any) => typeof n === 'number' && n > 0));
  const coGlobal = avg(sessions.map((s: any) => s.score_oral).filter((n: any) => typeof n === 'number' && n > 0));

  // Scores EE/EO
  const ee7j = avg(corr7j.filter((c) => c.task_type?.startsWith('EE')).map((c) => c.total).filter((n) => !isNaN(n) && n > 0), 1);
  const eo7j = avg(corr7j.filter((c) => c.task_type?.startsWith('EO')).map((c) => c.total).filter((n) => !isNaN(n) && n > 0), 1);
  const eePrev = avg(corrPrev.filter((c) => c.task_type?.startsWith('EE')).map((c) => c.total).filter((n) => !isNaN(n) && n > 0), 1);
  const eoPrev = avg(corrPrev.filter((c) => c.task_type?.startsWith('EO')).map((c) => c.total).filter((n) => !isNaN(n) && n > 0), 1);
  const eeGlobal = avg(allCorrections.filter((c) => c.task_type?.startsWith('EE')).map((c) => c.total).filter((n) => !isNaN(n) && n > 0), 1);
  const eoGlobal = avg(allCorrections.filter((c) => c.task_type?.startsWith('EO')).map((c) => c.total).filter((n) => !isNaN(n) && n > 0), 1);

  // Score global estimé sur 699 (priorité aux scores 7j, sinon global)
  const refCE = ce7j ?? ceGlobal;
  const refCO = co7j ?? coGlobal;
  const refEE = ee7j ?? eeGlobal;
  const refEO = eo7j ?? eoGlobal;

  const components: number[] = [];
  if (refCE !== null) components.push(refCE);
  if (refCO !== null) components.push(refCO);
  if (refEE !== null) components.push(Math.round((refEE / 20) * 699));
  if (refEO !== null) components.push(Math.round((refEO / 20) * 699));
  const scoreGlobalEstime = avg(components);

  let niveauNclc = 'À évaluer';
  if (scoreGlobalEstime !== null) {
    if (scoreGlobalEstime >= 549) niveauNclc = 'NCLC 10 (C2)';
    else if (scoreGlobalEstime >= 524) niveauNclc = 'NCLC 9 (C1)';
    else if (scoreGlobalEstime >= 458) niveauNclc = 'NCLC 7-8 (B2-C1)';
    else if (scoreGlobalEstime >= 400) niveauNclc = 'NCLC 6-7 (B2)';
    else if (scoreGlobalEstime >= 350) niveauNclc = 'NCLC 5-6 (B1)';
    else niveauNclc = 'NCLC 4-5 (A2)';
  }

  // Détail par tâche EE/EO
  const expressionParTache: Record<string, { count: number; moyenne: number }> = {};
  const taskBuckets: Record<string, number[]> = {};
  for (const c of allCorrections) {
    if (!c.task_type || isNaN(c.total)) continue;
    if (!taskBuckets[c.task_type]) taskBuckets[c.task_type] = [];
    taskBuckets[c.task_type].push(c.total);
  }
  for (const [task, vals] of Object.entries(taskBuckets)) {
    const m = avg(vals, 1);
    if (m !== null) expressionParTache[task] = { count: vals.length, moyenne: m };
  }

  // Erreurs récurrentes réelles (issues des corrections récentes)
  const errorMap: Record<string, { categorie: string; count: number; exemples: string[] }> = {};
  for (const c of allCorrections.slice(0, 15)) {
    if (Array.isArray(c.erreurs_et_corrections)) {
      for (const err of c.erreurs_et_corrections) {
        const cat = (err.categorie || 'Grammaire & Syntaxe').trim();
        if (!errorMap[cat]) {
          errorMap[cat] = { categorie: cat, count: 0, exemples: [] };
        }
        errorMap[cat].count += 1;
        const citation = err.citation || err.extrait;
        if (citation && err.correction && errorMap[cat].exemples.length < 2) {
          errorMap[cat].exemples.push(`« ${citation} » → « ${err.correction} »`);
        }
      }
    }
  }
  const erreursRecurrentes = Object.values(errorMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Fiches de cours lues
  const sheetReads = Array.isArray(sheetReadsData) ? sheetReadsData : [];
  const fichesLues7j = sheetReads.filter((r: any) => new Date(r.read_at) >= sevenDaysAgo).length;
  const luesParEpreuve: Record<string, number> = {};
  for (const r of sheetReads) {
    const sheetObj = Array.isArray(r.sheet) ? r.sheet[0] : r.sheet;
    const ep = sheetObj?.epreuve || 'Autre';
    luesParEpreuve[ep] = (luesParEpreuve[ep] || 0) + 1;
  }

  // Quotas Intensif
  const endDate = abonnement?.current_period_end || abonnement?.date_fin;
  const joursRestants = endDate
    ? Math.max(0, Math.ceil((new Date(endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  // Deltas vs période précédente (ou snapshot du bilan précédent si dispo)
  const prevSnap = previousReport?.statistiques_snapshot;
  const prevRefCE = cePrev ?? prevSnap?.scores_actuels?.ce_moyenne_7j ?? prevSnap?.scores_actuels?.ce_moyenne_globale ?? null;
  const prevRefCO = coPrev ?? prevSnap?.scores_actuels?.co_moyenne_7j ?? prevSnap?.scores_actuels?.co_moyenne_globale ?? null;
  const prevRefEE = eePrev ?? prevSnap?.scores_actuels?.ee_moyenne_7j ?? prevSnap?.scores_actuels?.ee_moyenne_globale ?? null;
  const prevRefEO = eoPrev ?? prevSnap?.scores_actuels?.eo_moyenne_7j ?? prevSnap?.scores_actuels?.eo_moyenne_globale ?? null;

  const snapshot: StudentMetricsSnapshot = {
    periode_debut: sevenDaysAgo.toISOString(),
    periode_fin: now.toISOString(),
    numero_bilan: numeroBilan,
    activite_7j: {
      sessions_total: sessions7j.length,
      sessions_terminees: sessions7j.filter((s: any) => s.statut === 'termine').length,
      examens_blancs: sessions7j.filter((s: any) => s.mode === 'examen_blanc').length,
      entrainements: sessions7j.filter((s: any) => s.mode === 'entrainement').length,
      corrections_ee: corr7j.filter((c) => c.task_type?.startsWith('EE')).length,
      corrections_eo: corr7j.filter((c) => c.task_type?.startsWith('EO')).length,
      qcm_reponses_total: qcm7j.length,
      qcm_taux_reussite_pct: qcmPct7j,
      fiches_lues_7j: fichesLues7j,
    },
    activite_periode_precedente: {
      sessions_total: sessionsPrev.length,
      corrections_ee: corrPrev.filter((c) => c.task_type?.startsWith('EE')).length,
      corrections_eo: corrPrev.filter((c) => c.task_type?.startsWith('EO')).length,
      qcm_reponses_total: qcmPrev.length,
      qcm_taux_reussite_pct: qcmPctPrev,
    },
    scores_actuels: {
      ce_moyenne_7j: ce7j,
      co_moyenne_7j: co7j,
      ee_moyenne_7j: ee7j,
      eo_moyenne_7j: eo7j,
      ce_moyenne_globale: ceGlobal,
      co_moyenne_globale: coGlobal,
      ee_moyenne_globale: eeGlobal,
      eo_moyenne_globale: eoGlobal,
      score_global_estime_699: scoreGlobalEstime,
      niveau_nclc_estime: niveauNclc,
    },
    evolutions_vs_precedent: {
      delta_ce: computeDelta(refCE, prevRefCE, 0),
      delta_co: computeDelta(refCO, prevRefCO, 0),
      delta_ee: computeDelta(refEE, prevRefEE, 1),
      delta_eo: computeDelta(refEO, prevRefEO, 1),
      delta_qcm_pct: computeDelta(qcmPct7j, qcmPctPrev, 0),
      delta_sessions: sessions7j.length - sessionsPrev.length,
    },
    qcm_par_niveau_7j: qcmByLevel7j,
    expression_par_tache: expressionParTache,
    erreurs_recurrentes: erreursRecurrentes,
    fiches_pedagogiques: {
      total_lues: sheetReads.length,
      total_disponibles: totalSheetsCount ?? 0,
      lues_par_epreuve: luesParEpreuve,
    },
    quotas_intensif: {
      ee_restant: abonnement?.quota_ee_restant ?? null,
      eo_restant: abonnement?.quota_eo_restant ?? null,
      examens_blancs_restant: abonnement?.quota_examen_blanc_restant ?? null,
      jours_abonnement_restants: joursRestants,
    },
    comparaison_seuils_nclc7: {
      ecart_ce: refCE !== null ? refCE - OFFICIAL_BENCHMARKS.nclc7.ce : null,
      ecart_co: refCO !== null ? refCO - OFFICIAL_BENCHMARKS.nclc7.co : null,
      ecart_ee: refEE !== null ? Number((refEE - OFFICIAL_BENCHMARKS.nclc7.ee).toFixed(1)) : null,
      ecart_eo: refEO !== null ? Number((refEO - OFFICIAL_BENCHMARKS.nclc7.eo).toFixed(1)) : null,
    },
  };

  // Extraire un résumé des dernières corrections pour enrichir le retour du professeur
  const recentCorrectionsDetails = corr7j.slice(0, 6).map((c) => ({
    task_type: c.task_type,
    note: c.total,
    niveau: c.niveau_cecrl,
    points_forts: c.feedback_par_critere?.points_forts?.slice(0, 2) || [],
    points_faibles: c.feedback_par_critere?.points_faibles?.slice(0, 2) || [],
    date: c.created_at,
  }));

  return { profile, professeurNom, professeurTitre, snapshot, recentCorrectionsDetails };
}

async function generateProfessorReportWithClaude(
  professeurNom: string,
  professeurTitre: string,
  studentFirstName: string,
  snapshot: StudentMetricsSnapshot,
  recentCorrectionsDetails: any[],
  previousReport: any | null,
  isRetry = false
): Promise<any> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("La variable d'environnement ANTHROPIC_API_KEY n'est pas configurée côté serveur.");
  }

  const systemPrompt = `
Tu es ${professeurNom}, ${professeurTitre}, membre de l'équipe pédagogique officielle de Mon TCF Canada.
Tu rédiges le bilan hebdomadaire d'« Analyse comparative détaillée & retour individualisé » réservé aux étudiants de la Formule Intensif.

RÈGLES ABSOLUES D'IDENTITÉ ET DE TON :
1. Tu t'exprimes UNIQUEMENT en tant que vrai professeur certifié qui suit personnellement cet étudiant.
2. NE MENTIONNE JAMAIS l'intelligence artificielle, un algorithme, un modèle, Claude, Anthropic, une génération automatique ou un système automatisé, ni le sigle « FEI » / « France Éducation International ».
3. Utilise un français impeccable, chaleureux, exigeant et profondément pédagogique (vouvoiement bienveillant, adresse par le prénom).
4. Fais preuve d'une vraie expertise TCF Canada (barème officiel sur 699 pts pour CE/CO, sur 20 pour EE/EO, équivalences NCLC 7 / NCLC 9 / C1 / C2 pour Entrée Express).

RÈGLES ABSOLUES DE CONCISION ET DE CONTENU :
1. Le retour doit être COURT, CLAIR et AGRÉABLE À LIRE (pas de longs pavés, va à l'essentiel).
2. Tu dois couvrir exactement ces 4 axes essentiels :
   - L'évolution réelle des notes (en progression, en baisse ou stables),
   - La fréquence et la régularité de travail sur les 7 derniers jours,
   - Des orientations personnalisées et réalistes pour progresser ou consolider ses acquis,
   - Des mots de félicitation (si les notes progressent ou atteignent l'objectif) ou d'encouragement bienveillants (si les notes stagnent, baissent ou si l'activité est faible).
3. Respecte strictement ces limites de longueur :
   - "mot_du_professeur" : 1 court paragraphe de 4 à 6 lignes maximum (80 à 120 mots max) commentant l'évolution des notes et la fréquence de travail.
   - "synthese_comparative" : 1 à 2 phrases courtes par champ (25 mots max chacun).
   - "analyse_par_epreuve" : 1 à 2 phrases courtes pour "commentaire_professeur" et 1 phrase concrète pour "conseil_cible".
   - "points_forts" : 2 à 3 points courts (1 phrase chacun).
   - "axes_amelioration" : 2 axes prioritaires maximum, formulés de façon brève et directe.
   - "plan_action_7_jours" : 2 à 3 actions réalistes et concises (pas plus de 3).
   - "mot_de_fin" : 2 phrases maximum d'encouragement ou de félicitation parfaitement adaptées aux notes obtenues.

RÈGLES ABSOLUES DE RIGUEUR CHIFFRÉE :
1. Tu dois t'appuyer EXCLUSIVEMENT sur les chiffres et activités réels fournis dans le dossier JSON de l'étudiant ci-dessous.
2. N'INVENTE JAMAIS une note, un pourcentage, un nombre de sessions ou une erreur qui ne figure pas dans les données.
3. Si une épreuve n'a pas encore été travaillée (null ou 0), dis-le simplement et recommande de la démarrer cette semaine.
4. Si l'étudiant a eu peu ou pas d'activité sur les 7 derniers jours, constate-le avec bienveillance et propose une reprise réaliste.
5. Compare brièvement les résultats actuels à la période précédente (si dispo) et aux seuils NCLC 7 (CE 453/699, CO 458/699, EE 14/20, EO 14/20).
6. Si un bilan précédent est fourni, fais un bref suivi des objectifs de la semaine dernière.

FORMAT DE SORTIE STRICT (JSON UNIQUEMENT, SANS MARKDOWN NI TEXTE AUTOUR) :
{
  "objet": "Titre court et personnalisé du bilan (10 à 14 mots max)",
  "mot_du_professeur": "Court message personnel (4 à 6 lignes max) adressé par le prénom : bilan de la fréquence de travail et de l'évolution des notes (progression, stabilité ou baisse).",
  "synthese_comparative": {
    "tendance_globale": "progression | stagnation | baisse | demarrage",
    "resume_chiffre": "1-2 phrases courtes résumant la fréquence de travail et les chiffres clés des 7 derniers jours.",
    "comparaison_nclc7": "1-2 phrases courtes situant l'étudiant par rapport aux seuils NCLC 7.",
    "evolution_periode": "1-2 phrases courtes indiquant si les notes évoluent à la hausse, à la baisse ou restent stables."
  },
  "analyse_par_epreuve": [
    {
      "epreuve": "CE",
      "label": "Compréhension Écrite",
      "statut": "objectif_atteint | en_progres | a_consolider | non_evalue",
      "score_actuel": "ex: 465 / 699 pts ou Non évalué",
      "evolution": "ex: +18 pts (en hausse) / Stable / Première évaluation",
      "commentaire_professeur": "1 à 2 phrases courtes sur le niveau réel et la tendance.",
      "conseil_cible": "1 orientation réaliste et concrète."
    },
    {
      "epreuve": "CO",
      "label": "Compréhension Orale",
      "statut": "objectif_atteint | en_progres | a_consolider | non_evalue",
      "score_actuel": "...",
      "evolution": "...",
      "commentaire_professeur": "...",
      "conseil_cible": "..."
    },
    {
      "epreuve": "EE",
      "label": "Expression Écrite",
      "statut": "objectif_atteint | en_progres | a_consolider | non_evalue",
      "score_actuel": "ex: 13.5 / 20 ou Non évalué",
      "evolution": "...",
      "commentaire_professeur": "...",
      "conseil_cible": "..."
    },
    {
      "epreuve": "EO",
      "label": "Expression Orale",
      "statut": "objectif_atteint | en_progres | a_consolider | non_evalue",
      "score_actuel": "...",
      "evolution": "...",
      "commentaire_professeur": "...",
      "conseil_cible": "..."
    }
  ],
  "points_forts": [
    "Point fort court appuyé par un chiffre réel",
    "Point fort court 2"
  ],
  "axes_amelioration": [
    {
      "axe": "Titre court de l'axe prioritaire",
      "constat_chiffre": "1 phrase factuelle issue des données réelles",
      "action_concrete": "1 orientation réaliste pour progresser ou consolider"
    }
  ],
  "plan_action_7_jours": [
    {
      "priorite": 1,
      "titre": "Orientation réaliste n°1",
      "description": "1 à 2 phrases simples et applicables cette semaine",
      "objectif_mesurable": "Cible courte et atteignable sous 7 jours"
    }
  ],
  "mot_de_fin": "1 à 2 phrases de félicitation ou d'encouragement adaptées aux notes réelles de l'étudiant."
}
${isRetry ? "\nATTENTION : La réponse précédente était incomplète ou invalide. Retourne UNIQUEMENT un objet JSON valide et complet respectant exactement toutes les clés demandées (y compris les 4 épreuves CE, CO, EE, EO dans analyse_par_epreuve)." : ''}
`.trim();

  const previousContext = previousReport
    ? {
        numero_bilan_precedent: previousReport.numero_bilan,
        date_bilan_precedent: previousReport.created_at,
        objet_precedent: previousReport.analyse_contenu?.objet || null,
        plan_action_precedent: previousReport.analyse_contenu?.plan_action_7_jours || [],
      }
    : null;

  const userMessage = `
DOSSIER PÉDAGOGIQUE RÉEL DE L'ÉTUDIANT :
- Prénom : ${studentFirstName}
- Bilan n° : ${snapshot.numero_bilan}
- Formule : Intensif

DONNÉES CHIFFRÉES VÉRIFIÉES (JSON) :
${JSON.stringify(snapshot, null, 2)}

DÉTAILS DES CORRECTIONS RÉCENTES (7 DERNIERS JOURS) :
${JSON.stringify(recentCorrectionsDetails, null, 2)}

${previousContext ? `SUIVI DU BILAN PRÉCÉDENT :\n${JSON.stringify(previousContext, null, 2)}` : 'PREMIER BILAN HEBDOMADAIRE DE CET ÉTUDIANT.'}

Rédige maintenant l'analyse comparative détaillée et le retour individualisé de ${professeurNom} au format JSON strict.
`.trim();

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Erreur API Anthropic (weekly-analysis):', errText);
    throw new Error(`Erreur lors de la rédaction du bilan (${response.status})`);
  }

  const result = await response.json();
  let textContent = '';
  if (Array.isArray(result.content)) {
    for (const block of result.content) {
      if (block.type === 'text' && typeof block.text === 'string') {
        textContent += block.text;
      }
    }
  }

  if (!textContent.trim()) {
    throw new Error('Contenu de bilan vide renvoyé par le moteur.');
  }

  return cleanAndParseJSON(textContent);
}

async function generateReportForUser(
  supabaseAdmin: any,
  userId: string,
  options: { force?: boolean; allowAdminWithoutSub?: boolean } = {}
): Promise<{ status: number; body: any }> {
  const now = new Date();

  // 1. Vérifier l'abonnement actif Intensif
  const { data: abonnement } = await supabaseAdmin
    .from('abonnements')
    .select('*')
    .or(`user_id.eq.${userId},etudiant_id.eq.${userId}`)
    .in('status', ['active', 'actif'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const endDate = abonnement?.current_period_end || abonnement?.date_fin;
  const isExpired = endDate ? new Date(endDate).getTime() <= now.getTime() : false;
  const isIntensifActive = !!abonnement && abonnement.plan_id === 'intensif' && !isExpired;

  if (!isIntensifActive && !options.allowAdminWithoutSub) {
    return {
      status: 403,
      body: {
        error: 'INTENSIF_REQUIRED',
        message: "L'analyse comparative détaillée & retour individualisé est réservée aux abonnés de la Formule Intensif.",
      },
    };
  }

  // 2. Vérifier le délai strict de 7 jours depuis le dernier bilan
  const { data: latestReport } = await supabaseAdmin
    .from('analyses_comparatives')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestReport && !options.force) {
    const lastCreated = new Date(latestReport.created_at).getTime();
    const nextAvailableMs = lastCreated + COOLDOWN_MS;
    if (now.getTime() < nextAvailableMs) {
      const daysRemaining = Math.ceil((nextAvailableMs - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        status: 429,
        body: {
          error: 'COOLDOWN_ACTIVE',
          message: `Votre prochain bilan pédagogique sera disponible dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}.`,
          next_available_at: new Date(nextAvailableMs).toISOString(),
          days_remaining: daysRemaining,
          last_report_id: latestReport.id,
        },
      };
    }
  }

  const numeroBilan = latestReport ? (latestReport.numero_bilan || 1) + 1 : 1;

  // 3. Agréger toutes les données réelles de l'étudiant
  const { profile, professeurNom, professeurTitre, snapshot, recentCorrectionsDetails } =
    await gatherStudentRealData(supabaseAdmin, userId, abonnement, numeroBilan, latestReport);

  const studentFirstName = profile?.prenom || profile?.nom || 'Candidat';

  // 4. Générer le retour avec Claude (avec retry qualité)
  let analyseContenu: any = null;
  try {
    analyseContenu = await generateProfessorReportWithClaude(
      professeurNom,
      professeurTitre,
      studentFirstName,
      snapshot,
      recentCorrectionsDetails,
      latestReport,
      false
    );
    if (!isAnalysisValid(analyseContenu)) {
      analyseContenu = await generateProfessorReportWithClaude(
        professeurNom,
        professeurTitre,
        studentFirstName,
        snapshot,
        recentCorrectionsDetails,
        latestReport,
        true
      );
    }
  } catch (err) {
    console.warn('1ère tentative rédaction bilan échouée, retry:', err);
    analyseContenu = await generateProfessorReportWithClaude(
      professeurNom,
      professeurTitre,
      studentFirstName,
      snapshot,
      recentCorrectionsDetails,
      latestReport,
      true
    );
  }

  if (!isAnalysisValid(analyseContenu)) {
    throw new Error('Impossible de finaliser un bilan complet conforme aux standards pédagogiques.');
  }

  // 5. Enregistrer dans analyses_comparatives
  const { data: savedReport, error: insertErr } = await supabaseAdmin
    .from('analyses_comparatives')
    .insert({
      user_id: userId,
      abonnement_id: abonnement?.id || null,
      periode_debut: snapshot.periode_debut,
      periode_fin: snapshot.periode_fin,
      numero_bilan: numeroBilan,
      professeur_nom: professeurNom,
      professeur_titre: professeurTitre,
      statistiques_snapshot: snapshot,
      analyse_contenu: analyseContenu,
      ai_model_used: CLAUDE_MODEL,
    })
    .select()
    .single();

  if (insertErr || !savedReport) {
    console.error('Erreur insertion analyses_comparatives:', insertErr);
    throw new Error("Impossible d'enregistrer le bilan pédagogique.");
  }

  // 6. Créer une notification in-app pour l'étudiant
  try {
    await supabaseAdmin.from('notifications').insert({
      utilisateur_id: userId,
      titre: `Nouveau bilan de ${professeurNom}`,
      message: `Votre analyse comparative hebdomadaire n°${numeroBilan} est disponible : « ${analyseContenu.objet} ».`,
      lien: '/etudiant/bilan-hebdomadaire',
      lue: false,
    });
  } catch (notifErr) {
    console.warn('Avertissement création notification bilan:', notifErr);
  }

  // 7. Envoyer l'email de notification (non bloquant)
  try {
    const dateKey = now.toISOString().slice(0, 10);
    await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'weekly_professor_report',
        user_id: userId,
        idempotency_key: `weekly_prof_report_${userId}_${dateKey}_b${numeroBilan}`,
        data: {
          prenom: studentFirstName,
          professeurNom,
          professeurTitre,
          numeroBilan,
          objetBilan: analyseContenu.objet,
          resumeChiffre: analyseContenu.synthese_comparative?.resume_chiffre || '',
          niveauEstime: snapshot.scores_actuels.niveau_nclc_estime,
        },
      }),
    });
  } catch (mailErr) {
    console.warn('Avertissement envoi email bilan hebdomadaire:', mailErr);
  }

  return {
    status: 200,
    body: {
      success: true,
      report: savedReport,
    },
  };
}

async function runWeeklyCronBatch(supabaseAdmin: any): Promise<{
  checked: number;
  generated: number;
  skipped: number;
  errors: number;
}> {
  const now = new Date();
  const cutoffIso = new Date(now.getTime() - COOLDOWN_MS).toISOString();
  const summary = { checked: 0, generated: 0, skipped: 0, errors: 0 };

  // Récupérer tous les abonnés Intensif actifs et non expirés
  const { data: activeIntensifs } = await supabaseAdmin
    .from('abonnements')
    .select('id, user_id, etudiant_id, plan_id, created_at, current_period_start, current_period_end, date_fin')
    .eq('plan_id', 'intensif')
    .in('status', ['active', 'actif']);

  const processedUsers = new Set<string>();

  for (const sub of activeIntensifs || []) {
    const userId = sub.user_id || sub.etudiant_id;
    if (!userId || processedUsers.has(userId)) continue;
    processedUsers.add(userId);

    const endDate = sub.current_period_end || sub.date_fin;
    if (endDate && new Date(endDate).getTime() <= now.getTime()) continue;

    summary.checked++;

    // Vérifier le dernier bilan de cet étudiant
    const { data: lastReport } = await supabaseAdmin
      .from('analyses_comparatives')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastReport) {
      if (new Date(lastReport.created_at).toISOString() > cutoffIso) {
        summary.skipped++;
        continue;
      }
    } else {
      // Premier bilan automatique : déclenché après 7 jours d'abonnement
      const subStart = sub.current_period_start || sub.created_at;
      if (subStart && new Date(subStart).toISOString() > cutoffIso) {
        summary.skipped++;
        continue;
      }
    }

    try {
      const res = await generateReportForUser(supabaseAdmin, userId);
      if (res.status === 200) summary.generated++;
      else summary.skipped++;
    } catch (err) {
      console.error(`Erreur génération bilan cron pour ${userId}:`, err);
      summary.errors++;
    }
  }

  console.log('📊 Résumé batch bilans hebdomadaires Intensif:', summary);
  return summary;
}

// Exécution quotidienne automatique à 08h00 UTC (si supporté par le runtime)
if (typeof (Deno as unknown as { cron?: unknown }).cron === 'function') {
  (Deno as unknown as { cron: (name: string, schedule: string, fn: () => Promise<void>) => void }).cron(
    'weekly-intensif-analyses',
    '0 8 * * *',
    async () => {
      console.log('⏰ Exécution planifiée Deno.cron : weekly-intensif-analyses');
      const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await runWeeklyCronBatch(supabaseAdmin);
    }
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const cronSecret = Deno.env.get('CRON_SECRET') || Deno.env.get('CLEANUP_SECRET') || '';

    if (!bearerToken) {
      return new Response(JSON.stringify({ error: 'Authentification requise' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const isServiceCaller =
      (SERVICE_ROLE_KEY && bearerToken === SERVICE_ROLE_KEY) ||
      (cronSecret && bearerToken === cronSecret);

    // Mode cron (appelé par cron-daily-emails ou planificateur externe)
    if (isServiceCaller && body.mode === 'cron') {
      const summary = await runWeeklyCronBatch(supabaseAdmin);
      return new Response(JSON.stringify({ success: true, summary }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mode service-role ciblant un utilisateur précis
    if (isServiceCaller && body.user_id) {
      const result = await generateReportForUser(supabaseAdmin, body.user_id, {
        force: Boolean(body.force),
        allowAdminWithoutSub: true,
      });
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Mode utilisateur authentifié
    const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !authData?.user) {
      return new Response(JSON.stringify({ error: 'Session utilisateur invalide ou expirée' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();

    const isAdmin = callerProfile?.role === 'admin' || callerProfile?.role === 'super_admin';
    const targetUserId = isAdmin && body.user_id ? body.user_id : authData.user.id;

    const result = await generateReportForUser(supabaseAdmin, targetUserId, {
      force: isAdmin && Boolean(body.force),
      allowAdminWithoutSub: isAdmin,
    });

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Erreur globale generate-weekly-analysis:', err);
    return new Response(
      JSON.stringify({
        error: 'ANALYSIS_GENERATION_FAILED',
        message: err?.message || 'Une erreur est survenue lors de la préparation de votre bilan.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
