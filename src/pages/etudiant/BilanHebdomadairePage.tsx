import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import {
  fetchWeeklyAnalyses,
  markAnalysisAsRead,
  requestWeeklyAnalysis,
  computeCooldownState,
  type WeeklyAnalysisReport,
} from '@/services/weeklyAnalysis';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  GraduationCap,
  Award,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Target,
  BookOpen,
  FileText,
  Headphones,
  PenLine,
  Mic,
  ArrowRight,
  Lock,
  Sparkles,
  ShieldCheck,
  Loader2,
  RefreshCw,
  ClipboardCheck,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const EPREUVE_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; accent: string; bg: string; border: string }
> = {
  CE: {
    icon: FileText,
    accent: 'text-[#0d233a]',
    bg: 'bg-[#eff4ff]',
    border: 'border-[#d3e4fe]',
  },
  CO: {
    icon: Headphones,
    accent: 'text-[#0d233a]',
    bg: 'bg-[#eff4ff]',
    border: 'border-[#d3e4fe]',
  },
  EE: {
    icon: PenLine,
    accent: 'text-[#cf7100]',
    bg: 'bg-[#fff7ed]',
    border: 'border-[#fed7aa]',
  },
  EO: {
    icon: Mic,
    accent: 'text-[#b51822]',
    bg: 'bg-[#fef2f2]',
    border: 'border-[#fecaca]',
  },
};

function getStatusBadge(statut: string) {
  switch (statut) {
    case 'objectif_atteint':
      return { label: 'Objectif NCLC 7+ atteint', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    case 'en_progres':
      return { label: 'En progression', className: 'bg-blue-100 text-blue-800 border-blue-300' };
    case 'a_consolider':
      return { label: 'À consolider', className: 'bg-amber-100 text-amber-800 border-amber-300' };
    default:
      return { label: 'À débuter', className: 'bg-slate-100 text-slate-700 border-slate-300' };
  }
}

function getTrendMeta(tendance: string) {
  switch (tendance) {
    case 'progression':
      return {
        label: 'Dynamique en progression',
        icon: TrendingUp,
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      };
    case 'baisse':
      return {
        label: 'Point de vigilance',
        icon: TrendingDown,
        className: 'bg-rose-50 text-rose-800 border-rose-200',
      };
    case 'stagnation':
      return {
        label: 'Phase de consolidation',
        icon: Minus,
        className: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    default:
      return {
        label: 'Bilan de lancement',
        icon: Target,
        className: 'bg-blue-50 text-blue-800 border-blue-200',
      };
  }
}

function formatDateFr(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatDelta(val: number | null, suffix: string) {
  if (val === null || val === undefined) return null;
  if (val > 0) return { text: `+${val}${suffix}`, positive: true };
  if (val < 0) return { text: `${val}${suffix}`, positive: false };
  return { text: `0${suffix}`, positive: null };
}

export default function BilanHebdomadairePage() {
  const { user, isAdmin } = useAuth();
  const { abonnement, hasActiveSubscription, loading: subLoading } = useSubscription();

  const [reports, setReports] = useState<WeeklyAnalysisReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const hasIntensifAccess =
    isAdmin || (hasActiveSubscription && abonnement?.plan_id === 'intensif');

  const loadReports = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const list = await fetchWeeklyAnalyses(user.id);
      setReports(list);
      if (list.length > 0) {
        setSelectedReportId((prev) => prev || list[0].id);
        if (!list[0].lu_at) {
          markAnalysisAsRead(list[0].id).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Erreur chargement bilans hebdomadaires:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!subLoading && hasIntensifAccess) {
      loadReports();
    } else if (!subLoading) {
      setLoading(false);
    }
  }, [subLoading, hasIntensifAccess, loadReports]);

  const latestReport = reports[0] || null;
  const activeReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) || latestReport,
    [reports, selectedReportId, latestReport]
  );

  const cooldown = useMemo(() => computeCooldownState(latestReport), [latestReport]);

  const handleSelectReport = (report: WeeklyAnalysisReport) => {
    setSelectedReportId(report.id);
    if (!report.lu_at) {
      markAnalysisAsRead(report.id).catch(() => {});
      setReports((prev) =>
        prev.map((r) => (r.id === report.id ? { ...r, lu_at: new Date().toISOString() } : r))
      );
    }
  };

  const handleRequestReport = async (force = false) => {
    try {
      setGenerating(true);
      const report = await requestWeeklyAnalysis({ force });
      setReports((prev) => [report, ...prev.filter((r) => r.id !== report.id)]);
      setSelectedReportId(report.id);
      toast.success('Votre bilan pédagogique hebdomadaire est prêt !');
    } catch (err: any) {
      if (err?.code === 'COOLDOWN_ACTIVE') {
        toast.info(err.message || 'Un nouveau bilan est disponible tous les 7 jours.');
      } else if (err?.code === 'INTENSIF_REQUIRED') {
        toast.error('Cette fonctionnalité est réservée à la Formule Intensif.');
      } else {
        toast.error(err?.message || 'Impossible de préparer votre bilan pour le moment.');
      }
    } finally {
      setGenerating(false);
    }
  };

  // État de chargement initial
  if (subLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 pb-12">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  // Barrière Formule Intensif pour les étudiants sur d'autres formules ou sans abonnement
  if (!hasIntensifAccess) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-2 fade-in">
        <Card className="rounded-3xl border-2 border-[#0d233a]/15 shadow-xl bg-white overflow-hidden">
          <div className="bg-gradient-to-br from-[#0d233a] via-[#153152] to-[#1a365d] p-8 sm:p-10 text-white text-center relative">
            <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <GraduationCap className="w-8 h-8 text-[#ffdcc3]" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30 text-xs font-heading font-semibold mb-3">
              <Lock className="w-3.5 h-3.5" />
              <span>Exclusivité Formule Intensif</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">
              Analyse comparative détaillée &amp; retour individualisé
            </h1>
            <p className="text-xs sm:text-sm text-white/80 mt-3 max-w-2xl mx-auto leading-relaxed">
              Tous les 7 jours, un professeur certifié TCF Canada analyse vos résultats réels, compare votre progression d'une semaine à l'autre face aux seuils officiels NCLC 7+ / C1-C2 et vous remet un plan d'action sur mesure.
            </p>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-[#eff4ff] text-[#0d233a] flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <h3 className="font-heading font-bold text-sm text-[#0d233a]">
                  Comparatif hebdomadaire chiffré
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Évolution exacte de vos scores CE, CO, EE et EO sur 7 jours et positionnement face au barème officiel NCLC 7+.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#cf7100] flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="font-heading font-bold text-sm text-[#0d233a]">
                  Retour d'un professeur certifié
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Un diagnostic individuel complet basé sur vos copies corrigées, vos erreurs récurrentes et vos fiches étudiées.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Target className="w-5 h-5" />
                </div>
                <h3 className="font-heading font-bold text-sm text-[#0d233a]">
                  Plan d'action sur 7 jours
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Des objectifs concrets et mesurables pour la semaine suivante afin de maximiser vos points Entrée Express.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                asChild
                className="w-full sm:w-auto rounded-xl bg-[#e53e3e] hover:bg-[#c53030] text-white font-heading font-bold px-8 shadow-md shadow-[#e53e3e]/20 gap-2"
              >
                <Link to="/etudiant/abonnement?plan=intensif">
                  <Sparkles className="w-4 h-4" />
                  <span>Passer à la Formule Intensif</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="w-full sm:w-auto rounded-xl text-slate-600 hover:text-[#0d233a]"
              >
                <Link to="/etudiant">Retour au tableau de bord</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const snap = activeReport?.statistiques_snapshot;
  const content = activeReport?.analyse_contenu;
  const trend = content ? getTrendMeta(content.synthese_comparative?.tendance_globale) : null;

  const ceScore = snap?.scores_actuels?.ce_moyenne_7j ?? snap?.scores_actuels?.ce_moyenne_globale ?? null;
  const coScore = snap?.scores_actuels?.co_moyenne_7j ?? snap?.scores_actuels?.co_moyenne_globale ?? null;
  const eeScore = snap?.scores_actuels?.ee_moyenne_7j ?? snap?.scores_actuels?.ee_moyenne_globale ?? null;
  const eoScore = snap?.scores_actuels?.eo_moyenne_7j ?? snap?.scores_actuels?.eo_moyenne_globale ?? null;

  const deltaCE = formatDelta(snap?.evolutions_vs_precedent?.delta_ce ?? null, ' pts');
  const deltaCO = formatDelta(snap?.evolutions_vs_precedent?.delta_co ?? null, ' pts');
  const deltaEE = formatDelta(snap?.evolutions_vs_precedent?.delta_ee ?? null, ' pts');
  const deltaEO = formatDelta(snap?.evolutions_vs_precedent?.delta_eo ?? null, ' pts');

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16 fade-in">
      {/* ═══ En-tête Professeur Certifié & Cycle 7 jours ═══ */}
      <section className="rounded-2xl bg-gradient-to-br from-[#0d233a] via-[#142f4d] to-[#1a365d] text-white p-6 sm:p-7 shadow-md border border-[#1a365d]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-amber-400/20 text-amber-200 border border-amber-400/30 text-[11px] font-heading font-bold px-2.5 py-0.5">
                <Award className="w-3.5 h-3.5 mr-1" />
                Formule Intensif • Suivi Hebdomadaire
              </Badge>
              <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[11px] font-semibold px-2.5 py-0.5">
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Professeur Certifié
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">
              Analyse comparative &amp; retour individualisé
            </h1>
            <p className="text-xs sm:text-sm text-white/80 max-w-2xl leading-relaxed">
              Chaque semaine (tous les 7 jours), votre professeur certifié examine vos résultats réels, vos copies corrigées et votre rythme d'entraînement pour guider votre montée vers le C1-C2.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-2.5 shrink-0">
            {cooldown.canGenerate ? (
              <Button
                onClick={() => handleRequestReport(false)}
                disabled={generating}
                className="rounded-xl bg-[#e53e3e] hover:bg-[#c53030] text-white font-heading font-bold shadow-md shadow-[#e53e3e]/25 gap-2 px-5 h-11"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Préparation du bilan en cours...</span>
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="w-4 h-4" />
                    <span>
                      {reports.length === 0
                        ? 'Recevoir mon 1er bilan professeur'
                        : 'Recevoir mon nouveau bilan (7j)'}
                    </span>
                  </>
                )}
              </Button>
            ) : (
              <div className="px-4 py-3 rounded-xl bg-white/10 border border-white/15 text-xs space-y-1 text-left lg:text-right">
                <div className="flex items-center lg:justify-end gap-1.5 font-heading font-bold text-[#ffdcc3]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Prochain bilan dans {cooldown.daysRemaining} jour{cooldown.daysRemaining > 1 ? 's' : ''}
                  </span>
                </div>
                {cooldown.nextAvailableAt && (
                  <p className="text-[11px] text-white/70">
                    Disponible le {formatDateFr(cooldown.nextAvailableAt.toISOString())}
                  </p>
                )}
              </div>
            )}

            {isAdmin && !cooldown.canGenerate && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRequestReport(true)}
                disabled={generating}
                className="rounded-xl bg-white/10 hover:bg-white/20 text-white border-white/25 text-xs gap-1.5"
              >
                {generating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Générer un bilan (Mode Admin)</span>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* ═══ État de préparation en cours ═══ */}
      {generating && (
        <Card className="rounded-2xl border border-[#d3e4fe] bg-[#eff4ff]/60 shadow-sm">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#0d233a] text-white flex items-center justify-center mx-auto shadow-md">
              <Loader2 className="w-7 h-7 animate-spin text-[#ffdcc3]" />
            </div>
            <div className="space-y-1.5 max-w-lg mx-auto">
              <h2 className="font-heading font-bold text-lg text-[#0d233a]">
                Consolidation de votre bilan pédagogique en cours...
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Votre professeur certifié passe en revue vos sessions QCM, vos corrections d'expression écrite et orale, vos erreurs récurrentes et vos fiches étudiées sur les 7 derniers jours.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ État vide (aucun bilan encore généré) ═══ */}
      {!generating && reports.length === 0 && (
        <Card className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-8 sm:p-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-[#eff4ff] border border-[#d3e4fe] text-[#0d233a] flex items-center justify-center mx-auto">
              <GraduationCap className="w-8 h-8" />
            </div>
            <div className="space-y-2 max-w-xl mx-auto">
              <h2 className="font-heading font-extrabold text-xl text-[#0d233a]">
                Votre premier bilan personnalisé est prêt à être établi
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Prof. Claire Beaumont (Examinatrice &amp; Formatrice Certifiée TCF Canada) va analyser l'ensemble de votre activité réelle et de vos notes actuelles pour établir votre point de départ comparatif et votre feuille de route des 7 prochains jours.
              </p>
            </div>
            <Button
              onClick={() => handleRequestReport(false)}
              disabled={generating}
              className="rounded-xl bg-[#0d233a] hover:bg-[#1a365d] text-white font-heading font-bold px-6 h-11 gap-2"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Demander mon premier bilan hebdomadaire</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ═══ Sélecteur d'historique des bilans ═══ */}
      {reports.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-heading font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            Mes bilans :
          </span>
          {reports.map((rep) => {
            const isSelected = rep.id === activeReport?.id;
            return (
              <button
                key={rep.id}
                type="button"
                onClick={() => handleSelectReport(rep)}
                className={cn(
                  'px-3.5 py-2 rounded-xl text-xs font-heading font-bold border transition-all shrink-0 flex items-center gap-2',
                  isSelected
                    ? 'bg-[#0d233a] text-white border-[#0d233a] shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-[#0d233a]/40'
                )}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Bilan #{rep.numero_bilan}</span>
                <span className={cn('text-[11px] font-normal', isSelected ? 'text-white/75' : 'text-slate-400')}>
                  {new Date(rep.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ═══ Affichage complet du bilan sélectionné ═══ */}
      {activeReport && snap && content && (
        <div className="space-y-6">
          {/* 1. Carte Professeur & Mot d'ouverture */}
          <Card className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-[#f8faff] border-b border-[#e2e8f0] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#0d233a] to-[#1a365d] text-white flex items-center justify-center font-heading font-extrabold text-base shadow-sm shrink-0 border border-white/10">
                  <GraduationCap className="w-6 h-6 text-[#ffdcc3]" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading font-extrabold text-base text-[#0d233a]">
                      {activeReport.professeur_nom}
                    </h2>
                    <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Professeur certifié
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">{activeReport.professeur_titre}</p>
                </div>
              </div>

              <div className="text-left sm:text-right text-xs text-slate-500 space-y-0.5">
                <p className="font-heading font-bold text-[#0d233a]">
                  Bilan Hebdomadaire n°{activeReport.numero_bilan}
                </p>
                <p>
                  Période du {formatDateFr(activeReport.periode_debut)} au {formatDateFr(activeReport.periode_fin)}
                </p>
              </div>
            </div>

            <CardContent className="p-6 sm:p-7 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg sm:text-xl font-heading font-extrabold text-[#0d233a]">
                  {content.objet}
                </h3>
                {trend && (
                  <Badge variant="outline" className={cn('text-xs font-bold px-3 py-1 gap-1.5', trend.className)}>
                    <trend.icon className="w-3.5 h-3.5" />
                    {trend.label}
                  </Badge>
                )}
              </div>

              <div className="p-5 rounded-2xl bg-[#f8f9ff] border border-[#e2e8f0] text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                {content.mot_du_professeur}
              </div>

              {/* Synthèse comparative en 3 blocs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                  <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-slate-500">
                    Activité des 7 derniers jours
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {content.synthese_comparative.resume_chiffre}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#d3e4fe] space-y-1">
                  <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-[#0d233a]">
                    Comparaison seuils NCLC 7+
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {content.synthese_comparative.comparaison_nclc7}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/70 space-y-1">
                  <span className="text-[11px] font-heading font-bold uppercase tracking-wider text-amber-900">
                    Évolution vs période précédente
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {content.synthese_comparative.evolution_periode}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Tableau de bord chiffré vérifié (KPI réels) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {[
              {
                key: 'CE',
                label: 'Compréhension Écrite',
                value: ceScore !== null ? `${ceScore} / 699` : 'Non évalué',
                target: 'Cible NCLC 7 : 453',
                delta: deltaCE,
                icon: FileText,
              },
              {
                key: 'CO',
                label: 'Compréhension Orale',
                value: coScore !== null ? `${coScore} / 699` : 'Non évalué',
                target: 'Cible NCLC 7 : 458',
                delta: deltaCO,
                icon: Headphones,
              },
              {
                key: 'EE',
                label: 'Expression Écrite',
                value: eeScore !== null ? `${eeScore} / 20` : 'Non évalué',
                target: 'Cible NCLC 7 : 14/20',
                delta: deltaEE,
                icon: PenLine,
              },
              {
                key: 'EO',
                label: 'Expression Orale',
                value: eoScore !== null ? `${eoScore} / 20` : 'Non évalué',
                target: 'Cible NCLC 7 : 14/20',
                delta: deltaEO,
                icon: Mic,
              },
            ].map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Card key={kpi.key} className="rounded-2xl border border-slate-200 bg-white shadow-xs">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-[#eff4ff] text-[#0d233a] flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </div>
                      {kpi.delta && (
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-bold px-2 py-0.5',
                            kpi.delta.positive === true
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : kpi.delta.positive === false
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          )}
                        >
                          {kpi.delta.text}
                        </Badge>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 font-medium">{kpi.label}</p>
                      <p className="text-lg font-heading font-extrabold text-[#0d233a]">{kpi.value}</p>
                    </div>
                    <p className="text-[10px] text-slate-400">{kpi.target}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Barre d'activité réelle 7j */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs text-center">
            <div>
              <p className="text-xl font-heading font-extrabold text-[#0d233a]">
                {snap.activite_7j.sessions_total}
              </p>
              <p className="text-[11px] text-slate-500">Sessions (7j)</p>
            </div>
            <div>
              <p className="text-xl font-heading font-extrabold text-[#0d233a]">
                {snap.activite_7j.qcm_reponses_total}
                {snap.activite_7j.qcm_taux_reussite_pct !== null && (
                  <span className="text-xs font-bold text-emerald-700 ml-1">
                    ({snap.activite_7j.qcm_taux_reussite_pct}%)
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-500">Questions QCM (7j)</p>
            </div>
            <div>
              <p className="text-xl font-heading font-extrabold text-[#0d233a]">
                {snap.activite_7j.corrections_ee + snap.activite_7j.corrections_eo}
              </p>
              <p className="text-[11px] text-slate-500">Copies EE &amp; EO (7j)</p>
            </div>
            <div>
              <p className="text-xl font-heading font-extrabold text-[#0d233a]">
                {snap.fiches_pedagogiques.total_lues}
                {snap.fiches_pedagogiques.total_disponibles > 0 && (
                  <span className="text-xs font-normal text-slate-400">
                    /{snap.fiches_pedagogiques.total_disponibles}
                  </span>
                )}
              </p>
              <p className="text-[11px] text-slate-500">Fiches étudiées</p>
            </div>
          </div>

          {/* 3. Analyse détaillée par épreuve */}
          <div className="space-y-3">
            <h3 className="font-heading font-extrabold text-lg text-[#0d233a] flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#0d233a]" />
              <span>Analyse comparative par épreuve</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {content.analyse_par_epreuve.map((item) => {
                const meta = EPREUVE_META[item.epreuve] || EPREUVE_META.CE;
                const Icon = meta.icon;
                const st = getStatusBadge(item.statut);
                return (
                  <Card key={item.epreuve} className="rounded-2xl border border-slate-200 bg-white shadow-xs">
                    <CardHeader className="p-5 pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center border', meta.bg, meta.border, meta.accent)}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-heading font-extrabold text-[#0d233a]">
                              {item.label}
                            </CardTitle>
                            <CardDescription className="text-xs font-semibold text-slate-600">
                              {item.score_actuel} · {item.evolution}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="outline" className={cn('text-[10px] font-bold shrink-0', st.className)}>
                          {st.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 pt-2 space-y-3">
                      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        {item.commentaire_professeur}
                      </p>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs text-[#0d233a]">
                        <strong className="font-heading">Conseil du professeur :</strong>{' '}
                        <span className="text-slate-700">{item.conseil_cible}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* 4. Points forts & Axes d'amélioration chiffrés */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="rounded-2xl border border-emerald-200/80 bg-emerald-50/30 shadow-xs">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-heading font-extrabold text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Vos points forts confirmés</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-2">
                <ul className="space-y-2.5 text-xs sm:text-sm text-emerald-950">
                  {(content.points_forts || []).map((pf, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
                      <span className="leading-relaxed">{pf}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-amber-200/80 bg-amber-50/30 shadow-xs">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-heading font-extrabold text-amber-950 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Axes prioritaires à travailler</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-2 space-y-3">
                {(content.axes_amelioration || []).map((axe, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-white/80 border border-amber-200/70 space-y-1">
                    <p className="text-xs font-heading font-bold text-amber-950">{axe.axe}</p>
                    <p className="text-[11px] text-slate-600">{axe.constat_chiffre}</p>
                    <p className="text-xs text-[#0d233a] font-medium pt-0.5">→ {axe.action_concrete}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* 5. Plan d'action personnalisé pour les 7 prochains jours */}
          <Card className="rounded-2xl border border-[#d3e4fe] bg-white shadow-sm">
            <CardHeader className="p-6 pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-heading font-extrabold text-[#0d233a] flex items-center gap-2">
                    <Target className="w-5 h-5 text-[#e53e3e]" />
                    <span>Votre feuille de route pour les 7 prochains jours</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Objectifs personnalisés fixés par {activeReport.professeur_nom} pour votre prochaine semaine d'entraînement.
                  </CardDescription>
                </div>
                <Button asChild size="sm" variant="outline" className="rounded-xl text-xs hidden sm:inline-flex gap-1.5">
                  <Link to="/etudiant/entrainement">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Passer à l'entraînement</span>
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-3.5">
              {(content.plan_action_7_jours || []).map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-4 p-4 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0]"
                >
                  <div className="w-8 h-8 rounded-xl bg-[#0d233a] text-white font-heading font-extrabold text-sm flex items-center justify-center shrink-0">
                    {step.priorite || idx + 1}
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-heading font-bold text-sm text-[#0d233a]">{step.titre}</h4>
                      <Badge className="bg-[#ffdcc3] text-[#6e3900] border-0 text-[10px] font-bold">
                        Objectif : {step.objectif_mesurable}
                      </Badge>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 6. Mot de fin & Signature du professeur certifié */}
          <Card className="rounded-2xl border border-slate-200 bg-gradient-to-r from-[#f8faff] to-white shadow-xs">
            <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <p className="text-sm text-slate-700 italic leading-relaxed">
                  « {content.mot_de_fin} »
                </p>
                <div className="pt-1">
                  <p className="font-heading font-extrabold text-sm text-[#0d233a]">
                    {activeReport.professeur_nom}
                  </p>
                  <p className="text-xs text-slate-500">{activeReport.professeur_titre}</p>
                </div>
              </div>
              <div className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-heading font-bold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Retour certifié Mon TCFCA</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
