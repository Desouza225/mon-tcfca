import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen,
  ClipboardList,
  Timer,
  TrendingUp,
  FileText,
  Headphones,
  PenLine,
  Mic,
  ArrowRight,
  Sparkles,
  Award,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  Compass,
  ChevronRight,
  GraduationCap,
  ShieldCheck
} from 'lucide-react';
import type { SessionExamen, NiveauCECRL } from '@/types/index';
import { CECRL_COLORS, EPREUVE_LABELS, PLANS_CONFIG } from '@/types/index';
import { useSubscription } from '@/hooks/useSubscription';
import { fetchWeeklyAnalyses, computeCooldownState, requestWeeklyAnalysis } from '@/services/weeklyAnalysis';

export default function EtudiantDashboard() {
  const { profile, user } = useAuth();
  const { abonnement, hasActiveSubscription, isAdmin, daysRemaining, isExpiringSoon, isExpired, isMobileMoney } = useSubscription();
  const isIntensif = isAdmin || (hasActiveSubscription && abonnement?.plan_id === 'intensif');
  const [sessions, setSessions] = useState<SessionExamen[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Charger les sessions
        const { data: sessionsData } = await supabase
          .from('sessions_examen')
          .select('*')
          .eq('etudiant_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20);

        const loadedSessions = Array.isArray(sessionsData) ? sessionsData : [];
        setSessions(loadedSessions);

        // 2. Charger les submissions + corrections pour EE et EO
        const { data: subData } = await supabase
          .from('submissions')
          .select(`
            id,
            production_id,
            session_id,
            task_type,
            raw_text,
            submitted_at,
            corrections (
              id,
              total,
              note_linguistique,
              note_pragmatique,
              note_sociolinguistique,
              niveau_cecrl,
              feedback_par_critere,
              erreurs_et_corrections,
              created_at
            )
          `)
          .eq('user_id', user.id)
          .order('submitted_at', { ascending: false })
          .limit(30);

        // Fallback aussi sur la table productions si disponible
        const { data: prodData } = await supabase
          .from('productions')
          .select(`
            id,
            session_id,
            epreuve,
            numero_tache,
            score,
            statut_correction,
            commentaire,
            created_at
          `)
          .eq('etudiant_id', user.id)
          .eq('statut_correction', 'corrige')
          .order('created_at', { ascending: false })
          .limit(30);

        const allCorrections: any[] = [];
        const seenProductionIds = new Set<string>();
        const seenSessionTasks = new Set<string>();

        if (Array.isArray(subData)) {
          for (const sub of subData) {
            const corr = Array.isArray(sub.corrections) ? sub.corrections[0] : sub.corrections;
            if (corr) {
              if (sub.production_id) {
                seenProductionIds.add(sub.production_id);
              }
              if (sub.session_id && sub.task_type) {
                seenSessionTasks.add(`${sub.session_id}:${sub.task_type}`);
              }
              allCorrections.push({
                submissionId: sub.id,
                task_type: sub.task_type,
                total: corr.total,
                niveau_cecrl: corr.niveau_cecrl,
                feedback_par_critere: corr.feedback_par_critere,
                erreurs_et_corrections: corr.erreurs_et_corrections,
                created_at: corr.created_at || sub.submitted_at,
              });
            }
          }
        }

        if (Array.isArray(prodData)) {
          for (const p of prodData) {
            const taskType = p.epreuve === 'expression_ecrite' ? `EE_tache${p.numero_tache}` : `EO_tache${p.numero_tache}`;
            if (
              p.score !== null &&
              p.score !== undefined &&
              !seenProductionIds.has(p.id) &&
              !(p.session_id && seenSessionTasks.has(`${p.session_id}:${taskType}`))
            ) {
              allCorrections.push({
                productionId: p.id,
                task_type: taskType,
                total: p.score,
                niveau_cecrl: p.score >= 16 ? 'C1' : p.score >= 14 ? 'B2' : p.score >= 10 ? 'B1' : 'A2',
                feedback_par_critere: null,
                erreurs_et_corrections: null,
                created_at: p.created_at,
              });
            }
          }
        }

        setCorrections(allCorrections);
      } catch (err) {
        console.error('Erreur chargement dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Déclenchement automatique silencieux du bilan hebdomadaire pour les abonnés Intensif arrivés à échéance de 7 jours
  useEffect(() => {
    if (!user || !hasActiveSubscription || abonnement?.plan_id !== 'intensif') return;
    const subStartIso = abonnement.current_period_start || abonnement.date_debut || abonnement.created_at || null;
    let cancelled = false;

    fetchWeeklyAnalyses(user.id)
      .then((list) => {
        if (cancelled) return;
        const state = computeCooldownState(list[0] || null, subStartIso);
        if (state.canGenerate) {
          requestWeeklyAnalysis({ force: false }).catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user, hasActiveSubscription, abonnement]);

  // Calcul des scores réels par épreuve et statistiques globales
  const stats = useMemo(() => {
    // 1. Scores CE & CO depuis sessions_examen
    const ceScores = sessions
      .map(s => s.score_ecrit)
      .filter((s): s is number => typeof s === 'number' && s > 0);
    const coScores = sessions
      .map(s => s.score_oral)
      .filter((s): s is number => typeof s === 'number' && s > 0);

    const avgCE = ceScores.length > 0 
      ? Math.round(ceScores.reduce((a, b) => a + b, 0) / ceScores.length) 
      : null;
    const avgCO = coScores.length > 0 
      ? Math.round(coScores.reduce((a, b) => a + b, 0) / coScores.length) 
      : null;

    // 2. Scores EE & EO depuis les corrections
    const eeScores = corrections
      .filter(c => c.task_type?.startsWith('EE'))
      .map(c => Number(c.total))
      .filter(n => !isNaN(n) && n > 0);

    const eoScores = corrections
      .filter(c => c.task_type?.startsWith('EO'))
      .map(c => Number(c.total))
      .filter(n => !isNaN(n) && n > 0);

    const avgEE = eeScores.length > 0
      ? Number((eeScores.reduce((a, b) => a + b, 0) / eeScores.length).toFixed(1))
      : null;
    const avgEO = eoScores.length > 0
      ? Number((eoScores.reduce((a, b) => a + b, 0) / eoScores.length).toFixed(1))
      : null;

    // 3. Ratios réels d'avancement par rapport aux seuils cibles officiels NCLC 7 (Entrée Express)
    // Seuils requis :
    // - Compréhension Écrite (CE) : 453 pts / 699
    // - Compréhension Orale (CO) : 458 pts / 699
    // - Expression Écrite (EE) : 14 / 20
    // - Expression Orale (EO) : 14 / 20
    const TARGET_CE = 453;
    const TARGET_CO = 458;
    const TARGET_EE = 14;
    const TARGET_EO = 14;

    const pctCE = avgCE !== null ? Math.min(100, Math.round((avgCE / TARGET_CE) * 100)) : 0;
    const pctCO = avgCO !== null ? Math.min(100, Math.round((avgCO / TARGET_CO) * 100)) : 0;
    const pctEE = avgEE !== null ? Math.min(100, Math.round((avgEE / TARGET_EE) * 100)) : 0;
    const pctEO = avgEO !== null ? Math.min(100, Math.round((avgEO / TARGET_EO) * 100)) : 0;

    // La progression globale vers NCLC 7 est la moyenne équilibrée des 4 épreuves :
    const progressPct = Math.round((pctCE + pctCO + pctEE + pctEO) / 4);

    // 4. Calcul du score combiné estimé sur 699 (uniquement sur les épreuves effectivement évaluées)
    const components: number[] = [];
    if (avgCE !== null) components.push(avgCE);
    if (avgCO !== null) components.push(avgCO);
    if (avgEE !== null) components.push(Math.round((avgEE / 20) * 699));
    if (avgEO !== null) components.push(Math.round((avgEO / 20) * 699));

    const avgScore = components.length > 0
      ? Math.round(components.reduce((a, b) => a + b, 0) / components.length)
      : null;

    // Estimation NCLC officielle TCF Canada
    let estimatedNCLC = 'À évaluer';
    let estimatedCECRL: NiveauCECRL | '—' = '—';
    if (avgScore !== null) {
      if (avgScore >= 530) {
        estimatedNCLC = 'NCLC 9+';
        estimatedCECRL = 'C1';
      } else if (avgScore >= 450) {
        estimatedNCLC = 'NCLC 7-8';
        estimatedCECRL = 'B2';
      } else if (avgScore >= 400) {
        estimatedNCLC = 'NCLC 7';
        estimatedCECRL = 'B2';
      } else if (avgScore >= 350) {
        estimatedNCLC = 'NCLC 6';
        estimatedCECRL = 'B1';
      } else {
        estimatedNCLC = 'NCLC 4-5';
        estimatedCECRL = 'A2';
      }
    }

    // Timeline des scores pour le graphique d'évolution
    const timeline = [...sessions]
      .filter(s => s.score_global !== null || s.score_ecrit !== null)
      .slice(0, 6)
      .reverse()
      .map((s, i) => ({
        index: i + 1,
        date: new Date(s.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
        score: s.score_global || Math.round(((s.score_ecrit || 350) + (s.score_oral || 350)) / 2),
        niveau: s.niveau_cecrl || 'B2',
      }));

    return {
      avgScore,
      avgCE,
      avgCO,
      avgEE,
      avgEO,
      pctCE,
      pctCO,
      pctEE,
      pctEO,
      estimatedNCLC,
      estimatedCECRL,
      progressPct,
      totalCompleted: sessions.filter(s => s.statut === 'termine').length + corrections.length,
      timeline,
    };
  }, [sessions, corrections]);

  // Agrégation automatique des erreurs récurrentes à partir de feedback_par_critere & erreurs_et_corrections
  const recurringErrors = useMemo(() => {
    const errorMap: Record<string, { count: number; category: string; description: string; advice: string; examples: string[] }> = {};

    corrections.forEach(c => {
      // 1. Analyse erreurs_et_corrections
      if (Array.isArray(c.erreurs_et_corrections)) {
        c.erreurs_et_corrections.forEach((err: any) => {
          const cat = err.categorie || 'Grammaire & Conjugaison';
          const regle = err.regle || err.explication || 'Point morphosyntaxique';
          const key = `${cat} : ${regle}`.slice(0, 70);

          if (!errorMap[key]) {
            errorMap[key] = {
              count: 0,
              category: cat,
              description: regle,
              advice: 'Revoir la règle ciblée et vérifier systématiquement en phase de relecture.',
              examples: [],
            };
          }
          errorMap[key].count += 1;
          if (err.extrait && errorMap[key].examples.length < 2) {
            errorMap[key].examples.push(`« ${err.extrait} » ➔ ${err.correction || 'Forme corrigée'}`);
          }
        });
      }

      // 2. Analyse feedback_par_critere
      if (c.feedback_par_critere) {
        ['linguistique', 'pragmatique', 'sociolinguistique'].forEach(critere => {
          const critData = c.feedback_par_critere[critere];
          if (critData?.points_amelioration && Array.isArray(critData.points_amelioration)) {
            critData.points_amelioration.forEach((point: string) => {
              const label = point.trim();
              if (label.length > 5) {
                const key = `Critère ${critere} : ${label}`.slice(0, 75);
                if (!errorMap[key]) {
                  errorMap[key] = {
                    count: 0,
                    category: critere === 'linguistique' ? 'Linguistique' : critere === 'pragmatique' ? 'Cohérence & Structure' : 'Registre & Ton',
                    description: label,
                    advice: critere === 'linguistique'
                      ? 'Enrichissez votre lexique thématique et variez les structures de phrases complexes.'
                      : critere === 'pragmatique'
                      ? 'Structurez avec des connecteurs logiques formels (En premier lieu, Néanmoins, Par conséquent).'
                      : 'Adaptez scrupuleusement le registre de langue (formel vs amical) selon le destinataire de la consigne.',
                    examples: [],
                  };
                }
                errorMap[key].count += 1;
              }
            });
          }
        });
      }
    });

    const list = Object.entries(errorMap).map(([title, val]) => ({
      title,
      ...val,
    }));

    // Trier par fréquence décroissante (priorité absolue aux erreurs les plus fréquentes)
    list.sort((a, b) => b.count - a.count);

    return list.slice(0, 6);
  }, [corrections]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 fade-in">
      {/* Alerte Expiration / Relance Renouvellement Mobile Money & Carte */}
      {abonnement && (isExpiringSoon || isExpired) && (
        <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs transition-all ${
          isExpired
            ? 'bg-amber-50 border-amber-300 text-amber-950'
            : 'bg-orange-50 border-orange-300 text-orange-950'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl mt-0.5 shrink-0 ${isExpired ? 'bg-amber-200 text-amber-800' : 'bg-orange-200 text-orange-800'}`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-heading font-extrabold text-sm sm:text-base text-gray-900">
                  {isExpired 
                    ? 'Votre formule est arrivée à expiration'
                    : `Votre formule expire dans ${daysRemaining} jour${(daysRemaining || 0) > 1 ? 's' : ''}`
                  }
                </span>
                {isMobileMoney ? (
                  <Badge variant="outline" className="text-[11px] bg-white border-orange-300 text-orange-800 font-semibold">
                    📱 Mobile Money (Pas de renouvellement auto)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[11px] bg-white border-gray-300 text-gray-700">
                    Échéance proche
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed max-w-2xl">
                {isMobileMoney
                  ? 'Les paiements Mobile Money (Wave, Orange, MTN, Moov) ne permettent pas le prélèvement récurrent automatique. Cliquez ci-dessous pour renouveler votre accès sans interruption.'
                  : 'Renouvelez votre formule pour conserver l’accès complet à vos corrections IA, examens blancs et simulateurs officiels.'}
              </p>
            </div>
          </div>

          <Button
            onClick={() => navigate(`/etudiant/abonnement?renew=${abonnement.plan_id || 'standard'}`)}
            className="shrink-0 w-full sm:w-auto bg-[#cf7100] hover:bg-[#b05f00] text-white shadow-xs font-heading font-bold"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Renouveler ma formule
          </Button>
        </div>
      )}

      {/* 1. Welcome & Target Alert Banner */}
      <section className="bg-white rounded-2xl p-5 sm:p-6 border border-[#e2e8f0] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe] text-xs font-heading font-semibold">
              <span className="w-2 h-2 rounded-full bg-[#e53e3e] animate-pulse" />
              <span>
                {abonnement?.plan_id && PLANS_CONFIG[abonnement.plan_id]
                  ? `${PLANS_CONFIG[abonnement.plan_id].nom} • Espace Candidat Actif`
                  : 'Espace Candidat'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a] tracking-tight">
              Bonjour, {profile?.prenom || profile?.nom || 'Candidat'} 👋
            </h1>
            <p className="text-xs sm:text-sm text-[#475569]">
              Prêt pour votre session du jour ? Suivez votre progression vers le palier d'immigration.
            </p>
          </div>

          <div className="shrink-0 w-12 h-12 rounded-2xl bg-[#ffdcc3] flex items-center justify-center text-[#6e3900] shadow-xs">
            <Award className="w-6 h-6 text-[#cf7100]" />
          </div>
        </div>

        {/* Target Countdown Pill */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#eff4ff] border border-[#d3e4fe]/70 text-[#0d233a]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-[#e53e3e] shrink-0 shadow-xs">
              <Timer className="w-4 h-4 text-[#e53e3e]" />
            </div>
            <div className="truncate">
              <p className="font-heading font-bold text-xs sm:text-sm text-[#0d233a]">
                Objectif Prioritaire : NCLC 7+ (Entrée Express Canada)
              </p>
              <p className="text-[11px] text-[#475569]">
                Palier de points maximum pour la résidence permanente
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#ffdcc3] text-[#6e3900] font-heading font-extrabold text-xs shrink-0 shadow-xs">
            {stats.totalCompleted > 0 ? `${stats.totalCompleted} sessions validées` : 'Prêt pour le 1er test'}
          </span>
        </div>
      </section>

      {/* 2. Predictive Score & Diagnostic Panel */}
      <section className="bg-white rounded-2xl p-5 sm:p-6 border border-[#e2e8f0] shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs uppercase font-heading font-bold text-[#475569] tracking-wider">
              Projection Officielle TCF
            </span>
            <h2 className="font-heading font-bold text-lg sm:text-xl text-[#0d233a] mt-0.5">
              Score Global Estimé
            </h2>
          </div>
          <div className="text-right">
            <span className="font-heading font-extrabold text-xl sm:text-2xl text-[#0d233a]">
              {stats.estimatedNCLC}
            </span>
            <p className="text-xs text-[#475569] font-medium">
              {stats.avgScore !== null ? `${stats.avgScore} pts / 699` : 'En attente d’évaluation'}
            </p>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="p-4 rounded-xl bg-[#eff4ff] space-y-2 border border-[#d3e4fe]/50">
          <div className="flex justify-between text-xs">
            <span className="text-[#475569] font-medium">Progression vers NCLC 7 (Moyenne des 4 épreuves)</span>
            <span className="font-heading font-bold text-[#0d233a]">{stats.progressPct}% atteint</span>
          </div>
          <div className="w-full h-3 rounded-full bg-white overflow-hidden p-0.5 shadow-inner">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0d233a] via-[#1a365d] to-[#e53e3e] transition-all duration-700"
              style={{ width: `${stats.progressPct}%` }}
            />
          </div>
          <p className="text-[11px] text-[#475569] flex items-center gap-1.5 pt-0.5">
            <Sparkles className="w-3.5 h-3.5 text-[#d97706] shrink-0" />
            <span>
              {stats.progressPct === 0
                ? "Complétez vos premières sessions pour évaluer votre progression vers le palier NCLC 7."
                : stats.progressPct >= 100
                ? "Félicitations ! Vous avez validé les seuils NCLC 7 requis pour l'ensemble des 4 épreuves."
                : "Progression calculée sur les 4 épreuves requises (CE, CO, EE, EO) par rapport au seuil officiel NCLC 7."}
            </span>
          </p>
        </div>

        {/* 4 Sub-tests Grid Breakdown avec données réelles calculées */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {/* Compréhension Écrite */}
          <div className="p-3.5 rounded-xl bg-[#eff4ff] border border-[#d3e4fe]/60 flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 rounded-lg bg-white text-[#0d233a] flex items-center justify-center shadow-xs">
                <FileText className="w-4 h-4" />
              </div>
              <Badge className="bg-[#dce9ff] text-[#0d233a] text-[10px] font-bold px-2 py-0.5 border-0">
                {stats.avgCE !== null ? (stats.avgCE >= 453 ? 'NCLC 7+' : stats.avgCE >= 406 ? 'NCLC 6' : stats.avgCE >= 375 ? 'NCLC 5' : 'NCLC < 5') : 'À débuter'}
              </Badge>
            </div>
            <div>
              <p className="font-heading font-bold text-xs sm:text-sm text-[#0d233a] leading-tight">Compr. Écrite</p>
              <p className="text-[11px] font-bold text-[#0d233a] mt-0.5">
                {stats.avgCE !== null ? `${stats.avgCE} pts / 699` : 'Non évalué'}
              </p>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white overflow-hidden">
              <div
                className="h-full bg-[#0d233a] transition-all duration-500"
                style={{ width: `${stats.avgCE !== null ? Math.min(100, Math.round((stats.avgCE / 699) * 100)) : 0}%` }}
              />
            </div>
          </div>

          {/* Compréhension Orale */}
          <div className="p-3.5 rounded-xl bg-[#eff4ff] border border-[#d3e4fe]/60 flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 rounded-lg bg-white text-[#0d233a] flex items-center justify-center shadow-xs">
                <Headphones className="w-4 h-4" />
              </div>
              <Badge className="bg-[#dce9ff] text-[#0d233a] text-[10px] font-bold px-2 py-0.5 border-0">
                {stats.avgCO !== null ? (stats.avgCO >= 458 ? 'NCLC 7+' : stats.avgCO >= 398 ? 'NCLC 6' : stats.avgCO >= 369 ? 'NCLC 5' : 'NCLC < 5') : 'À débuter'}
              </Badge>
            </div>
            <div>
              <p className="font-heading font-bold text-xs sm:text-sm text-[#0d233a] leading-tight">Compr. Orale</p>
              <p className="text-[11px] font-bold text-[#0d233a] mt-0.5">
                {stats.avgCO !== null ? `${stats.avgCO} pts / 699` : 'Non évalué'}
              </p>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white overflow-hidden">
              <div
                className="h-full bg-[#0d233a] transition-all duration-500"
                style={{ width: `${stats.avgCO !== null ? Math.min(100, Math.round((stats.avgCO / 699) * 100)) : 0}%` }}
              />
            </div>
          </div>

          {/* Expression Écrite */}
          <div className="p-3.5 rounded-xl bg-[#ffdcc3]/50 border border-[#ffdcc3] flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 rounded-lg bg-white text-[#cf7100] flex items-center justify-center shadow-xs">
                <PenLine className="w-4 h-4" />
              </div>
              <Badge className="bg-[#ffdcc3] text-[#6e3900] text-[10px] font-bold px-2 py-0.5 border-0">
                {stats.avgEE !== null ? (stats.avgEE >= 14 ? 'NCLC 7+' : stats.avgEE >= 10 ? 'NCLC 6' : stats.avgEE >= 6 ? 'NCLC 5' : 'NCLC < 5') : 'À débuter'}
              </Badge>
            </div>
            <div>
              <p className="font-heading font-bold text-xs sm:text-sm text-[#6e3900] leading-tight">Expr. Écrite</p>
              <p className="text-[11px] font-bold text-[#6e3900] mt-0.5">
                {stats.avgEE !== null ? `${stats.avgEE} / 20` : 'Non évalué'}
              </p>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white overflow-hidden">
              <div
                className="h-full bg-[#d97706] transition-all duration-500"
                style={{ width: `${stats.avgEE !== null ? Math.min(100, Math.round((stats.avgEE / 20) * 100)) : 0}%` }}
              />
            </div>
          </div>

          {/* Expression Orale */}
          <div className="p-3.5 rounded-xl bg-[#ffdcc3]/50 border border-[#ffdcc3] flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="w-7 h-7 rounded-lg bg-white text-[#b51822] flex items-center justify-center shadow-xs">
                <Mic className="w-4 h-4" />
              </div>
              <Badge className="bg-[#ffdcc3] text-[#6e3900] text-[10px] font-bold px-2 py-0.5 border-0">
                {stats.avgEO !== null ? (stats.avgEO >= 14 ? 'NCLC 7+' : stats.avgEO >= 10 ? 'NCLC 6' : stats.avgEO >= 6 ? 'NCLC 5' : 'NCLC < 5') : 'À débuter'}
              </Badge>
            </div>
            <div>
              <p className="font-heading font-bold text-xs sm:text-sm text-[#6e3900] leading-tight">Expr. Orale</p>
              <p className="text-[11px] font-bold text-[#6e3900] mt-0.5">
                {stats.avgEO !== null ? `${stats.avgEO} / 20` : 'Non évalué'}
              </p>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white overflow-hidden">
              <div
                className="h-full bg-[#d97706] transition-all duration-500"
                style={{ width: `${stats.avgEO !== null ? Math.min(100, Math.round((stats.avgEO / 20) * 100)) : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Évolution chronologique du niveau CECRL */}
        {stats.timeline.length > 1 && (
          <div className="mt-4 pt-4 border-t border-[#e2e8f0]/60">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-heading font-bold text-[#0d233a] flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-[#0d233a]" />
                Évolution des scores récents
              </span>
              <span className="text-[11px] text-[#475569]">Seuil NCLC 7 visé : 400 pts</span>
            </div>
            <div className="flex items-end justify-between gap-2 h-20 pt-2 px-2 bg-[#f8f9ff] rounded-xl border border-[#e2e8f0]/50">
              {stats.timeline.map((point) => {
                const heightPct = Math.max(20, Math.min(100, Math.round((point.score / 699) * 100)));
                const isPass = point.score >= 400;
                return (
                  <div key={point.index} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                    <span className="text-[10px] font-bold text-[#0d233a] opacity-80 group-hover:opacity-100 transition-opacity">
                      {point.score}
                    </span>
                    <div
                      className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                        isPass ? 'bg-[#0d233a]' : 'bg-[#d97706]'
                      }`}
                      style={{ height: `${heightPct}%` }}
                      title={`${point.date} : ${point.score} pts (${point.niveau})`}
                    />
                    <span className="text-[9px] text-[#475569] truncate w-full text-center">
                      {point.date}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 3. Action Cards (Modes d'entraînement & Fiches pédagogiques) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Cours & Fiches */}
        <Card className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm hover:border-[#cf7100]/40 hover:shadow-md transition-all duration-200 overflow-hidden group flex flex-col justify-between">
          <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#ffdcc3] text-[#6e3900] flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileText className="w-6 h-6 text-[#cf7100]" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-[#0d233a]">
                  Cours &amp; Fiches
                </h3>
                <p className="text-xs sm:text-sm text-[#475569] mt-1 leading-relaxed">
                  Méthodes complètes, fiches lexicales, connecteurs logiques et modèles types pour réussir le TCF Canada.
                </p>
              </div>
            </div>

            <Button
              className="w-full bg-[#cf7100] hover:bg-[#b05f00] text-white font-heading font-bold rounded-xl py-5 shadow-sm mt-2"
              onClick={() => navigate('/etudiant/cours')}
            >
              <span>Consulter les fiches</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Examen Blanc Complet */}
        <Card className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm hover:border-[#e53e3e]/40 hover:shadow-md transition-all duration-200 overflow-hidden group flex flex-col justify-between">
          <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#ffdad7]/60 text-[#e53e3e] flex items-center justify-center group-hover:scale-105 transition-transform">
                <ClipboardList className="w-6 h-6 text-[#e53e3e]" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-[#0d233a]">
                  Examen Blanc Complet
                </h3>
                <p className="text-xs sm:text-sm text-[#475569] mt-1 leading-relaxed">
                  Simulation officielle complète des 4 épreuves chronométrées avec correction humaine et IA.
                </p>
              </div>
            </div>

            <Button
              className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white font-heading font-bold rounded-xl py-5 shadow-sm mt-2"
              onClick={() => navigate('/etudiant/examen-blanc')}
            >
              <span>Lancer un examen blanc</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Entraînement Ciblé */}
        <Card className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm hover:border-[#0d233a]/40 hover:shadow-md transition-all duration-200 overflow-hidden group flex flex-col justify-between">
          <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#eff4ff] text-[#0d233a] flex items-center justify-center group-hover:scale-105 transition-transform">
                <BookOpen className="w-6 h-6 text-[#0d233a]" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-lg text-[#0d233a]">
                  Entraînement Ciblé
                </h3>
                <p className="text-xs sm:text-sm text-[#475569] mt-1 leading-relaxed">
                  Travaillez épreuve par épreuve (CE, CO, EE, EO) avec fiches pédagogiques et feedback immédiat.
                </p>
              </div>
            </div>

            <Button
              className="w-full bg-[#0d233a] hover:bg-[#1a365d] text-white font-heading font-bold rounded-xl py-5 shadow-sm mt-2"
              onClick={() => navigate('/etudiant/entrainement')}
            >
              <span>Accéder aux épreuves</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 3b. Bilan Hebdomadaire Professeur Certifié (Exclusivité Intensif) */}
      <section className="rounded-2xl p-5 sm:p-6 bg-gradient-to-r from-[#0d233a] via-[#142f4d] to-[#1a365d] text-white shadow-sm border border-[#1a365d] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
            <GraduationCap className="w-6 h-6 text-[#ffdcc3]" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-amber-400/20 text-amber-200 border border-amber-400/30 text-[10px] font-heading font-bold">
                Formule Intensif
              </Badge>
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                Professeur certifié · Tous les 7 jours
              </span>
            </div>
            <h3 className="font-heading font-extrabold text-base sm:text-lg text-white">
              Analyse comparative détaillée &amp; retour individualisé
            </h3>
            <p className="text-xs text-white/75 max-w-xl leading-relaxed">
              {isIntensif
                ? 'Consultez votre bilan hebdomadaire rédigé par votre professeur certifié à partir de vos scores réels et de votre activité des 7 derniers jours.'
                : 'Bénéficiez chaque semaine d’un retour personnalisé d’un professeur certifié basé sur vos résultats réels avec la Formule Intensif.'}
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate('/etudiant/bilan-hebdomadaire')}
          className="shrink-0 rounded-xl bg-[#e53e3e] hover:bg-[#c53030] text-white font-heading font-bold text-xs px-5 h-10 gap-1.5 shadow-md shadow-[#e53e3e]/25"
        >
          <span>{isIntensif ? 'Voir mon bilan professeur' : 'Découvrir ce suivi'}</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </section>

      {/* 4. Sessions Récentes */}
      <section className="bg-white rounded-2xl p-5 sm:p-6 border border-[#e2e8f0] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#0d233a]" />
            <h2 className="font-heading font-bold text-lg text-[#0d233a]">
              Historique des Sessions Récentes
            </h2>
          </div>
          <Link
            to="/etudiant/historique"
            className="text-xs sm:text-sm font-heading font-bold text-[#e53e3e] hover:underline flex items-center gap-1"
          >
            <span>Voir tout</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {!loading && sessions.length > 0 && (
          <div className="space-y-2.5">
            {sessions.slice(0, 4).map((session) => (
              <button
                type="button"
                key={session.id}
                className="w-full text-left p-3.5 sm:p-4 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] hover:border-[#0d233a]/30 hover:bg-white hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                onClick={() => navigate('/etudiant/historique')}
              >
                <div className="min-w-0 space-y-0.5">
                  <p className="font-heading font-bold text-sm text-[#0d233a] truncate">
                    {session.mode === 'entrainement' ? 'Entraînement' : 'Examen Blanc Officiel'} —{' '}
                    {session.epreuve_actuelle
                      ? EPREUVE_LABELS[session.epreuve_actuelle]
                      : 'Épreuves Combinées'}
                  </p>
                  <p className="text-[11px] text-[#475569]">
                    {new Date(session.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {session.niveau_cecrl && (
                    <Badge
                      style={{ backgroundColor: CECRL_COLORS[session.niveau_cecrl] }}
                      className="text-white text-xs font-bold px-2 py-0.5 rounded-full"
                    >
                      {session.niveau_cecrl}
                    </Badge>
                  )}
                  {session.score_global !== null && (
                    <span className="font-heading font-extrabold text-xs text-[#0d233a] bg-white px-2.5 py-1 rounded-lg border border-[#e2e8f0]">
                      {session.score_global} / 699 pts
                    </span>
                  )}
                  <Badge
                    variant={session.statut === 'termine' ? 'default' : 'outline'}
                    className={`text-xs px-2.5 py-0.5 rounded-full ${
                      session.statut === 'termine'
                        ? 'bg-emerald-600 text-white border-0'
                        : 'text-[#475569] border-[#cbd5e1]'
                    }`}
                  >
                    {session.statut === 'termine'
                      ? 'Terminé'
                      : session.statut === 'en_cours'
                      ? 'En cours'
                      : 'Abandonné'}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="text-center py-8 bg-[#f8f9ff] rounded-xl border border-dashed border-[#cbd5e1] space-y-2">
            <Compass className="w-8 h-8 text-[#475569] mx-auto" />
            <p className="font-heading font-semibold text-sm text-[#0d233a]">
              Aucune session effectuée pour le moment
            </p>
            <p className="text-xs text-[#475569]">
              Lancez votre premier entraînement pour obtenir votre diagnostic NCLC !
            </p>
          </div>
        )}

        {loading && (
          <div className="space-y-2.5">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl bg-[#eff4ff]" />
            ))}
          </div>
        )}
      </section>

      {/* 5. Vue Erreurs Récurrentes & Diagnostics IA */}
      <section className="bg-white rounded-2xl p-5 sm:p-6 border border-[#e2e8f0] shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#fff1f0] text-[#e53e3e] flex items-center justify-center shadow-xs">
              <AlertTriangle className="w-4 h-4 text-[#e53e3e]" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base sm:text-lg text-[#0d233a]">
                Erreurs Récurrentes &amp; Points Faibles Ciblés
              </h2>
              <p className="text-xs text-[#475569]">
                Agrégation automatique issue de vos devoirs écrits et oraux corrigés par IA
              </p>
            </div>
          </div>

          <Link
            to="/etudiant/historique"
            className="text-xs font-heading font-bold text-[#0d233a] hover:text-[#e53e3e] flex items-center gap-1 transition-colors"
          >
            <span>Consulter l'historique complet</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="space-y-3 pt-1">
          {recurringErrors.length === 0 ? (
            <div className="p-5 rounded-xl bg-[#f8f9ff] border border-dashed border-[#cbd5e1] text-center space-y-1.5">
              <p className="text-sm font-heading font-semibold text-[#0d233a]">
                Aucune erreur récurrente détectée pour le moment
              </p>
              <p className="text-xs text-[#64748b] max-w-lg mx-auto">
                Effectuez vos premiers exercices d'Expression Écrite ou d'Expression Orale pour obtenir une analyse personnalisée de vos points faibles.
              </p>
            </div>
          ) : (
            recurringErrors.map((err) => (
            <div
              key={`${err.title}-${err.category}`}
              className="p-3.5 sm:p-4 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] hover:border-[#0d233a]/30 transition-all space-y-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-heading font-bold text-sm text-[#0d233a]">
                      {err.title}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-white border-[#d3e4fe] text-[#0d233a]">
                      {err.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#475569] leading-relaxed">
                    {err.description}
                  </p>
                </div>

                <Badge className="shrink-0 bg-[#fed7d7] text-[#9b2c2c] border-0 text-[11px] font-bold px-2 py-0.5">
                  Fréquence : {err.count}x
                </Badge>
              </div>

              {/* Exemple concret tiré des copies */}
              {err.examples && err.examples.length > 0 && (
                <div className="p-2.5 rounded-lg bg-white border border-[#e2e8f0] text-xs space-y-1">
                  <p className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                    Exemple repéré dans vos copies :
                  </p>
                  {err.examples.map((ex) => (
                    <p key={ex} className="font-mono text-xs text-[#0d233a]">
                      {ex}
                    </p>
                  ))}
                </div>
              )}

              {/* Conseil de remédiation */}
              <div className="flex items-start gap-1.5 text-xs text-[#6e3900] bg-[#fffaf0] p-2 rounded-lg border border-[#feebc8]">
                <Sparkles className="w-3.5 h-3.5 text-[#d69e2e] shrink-0 mt-0.5" />
                <span className="leading-snug">{err.advice}</span>
              </div>
            </div>
          ))
          )}
        </div>
      </section>
    </div>
  );
}
