import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Trophy,
  TrendingUp,
  Search,
  Calendar,
  Sparkles,
  ArrowRight,
  BookOpen,
  Volume2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Mic,
  Award,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  COURSE_EPREUVE_LABELS,
  type CourseEpreuve,
  CECRL_COLORS,
  pctToCECRL,
} from '@/types/index';
import { fetchAudioBlobUrl } from '@/lib/audioProcessing';

interface CorrectionItem {
  id: string;
  submission_id?: string;
  task_type: string;
  raw_text: string | null;
  file_url: string | null;
  consigne: string | null;
  reference: string | null;
  submitted_at: string;
  score: number;
  niveau_cecrl: string;
  commentaire?: string | null;
  source: 'submission' | 'production';
  note_linguistique?: any;
  note_pragmatique?: any;
  note_sociolinguistique?: any;
  feedback_par_critere?: any;
  erreurs_et_corrections?: any[];
  version_amelioree?: string | null;
  plan_progression?: any;
  points_forts?: string[];
  points_faibles?: string[];
}

interface ExamSessionItem {
  id: string;
  created_at: string;
  statut: string;
  score_oral: number | null;
  score_ecrit: number | null;
  score_expression_ecrite: number | null;
  score_expression_orale: number | null;
  score_global: number | null;
  niveau_cecrl: string | null;
}

function getPointsForts(item: CorrectionItem): string[] {
  if (Array.isArray(item.points_forts) && item.points_forts.length > 0) {
    return item.points_forts;
  }
  if (Array.isArray(item.feedback_par_critere?.points_forts) && item.feedback_par_critere.points_forts.length > 0) {
    return item.feedback_par_critere.points_forts;
  }
  const list: string[] = [];
  if (item.feedback_par_critere?.developpement_consigne) {
    list.push(item.feedback_par_critere.developpement_consigne);
  }
  if (item.feedback_par_critere?.lexique) {
    list.push(`Vocabulaire : ${item.feedback_par_critere.lexique}`);
  }
  if (list.length === 0) {
    list.push('Le sujet a été globalement compris et traité selon la consigne.');
    list.push('Les éléments clés de communication attendus sont bien présents.');
  }
  return list;
}

function getPointsFaibles(item: CorrectionItem): string[] {
  if (Array.isArray(item.points_faibles) && item.points_faibles.length > 0) {
    return item.points_faibles;
  }
  if (Array.isArray(item.feedback_par_critere?.points_faibles) && item.feedback_par_critere.points_faibles.length > 0) {
    return item.feedback_par_critere.points_faibles;
  }
  const list: string[] = [];
  if (item.feedback_par_critere?.grammaire) {
    list.push(`Grammaire & Syntaxe : ${item.feedback_par_critere.grammaire}`);
  }
  if (item.feedback_par_critere?.coherence_structuration) {
    list.push(`Organisation du discours : ${item.feedback_par_critere.coherence_structuration}`);
  }
  if (list.length === 0) {
    if (Array.isArray(item.erreurs_et_corrections) && item.erreurs_et_corrections.length > 0) {
      list.push(`${item.erreurs_et_corrections.length} erreurs ou maladresses précises relevées dans le texte.`);
    } else {
      list.push('Certaines tournures méritent d\'être précisées et diversifiées.');
    }
  }
  return list;
}

function getPlanProgression(item: CorrectionItem): { priorites: string[]; objectif?: string } {
  const plan = item.plan_progression || {};
  const priorites: string[] = Array.isArray(plan.priorites) && plan.priorites.length > 0
    ? plan.priorites
    : [
        'Enrichir les connecteurs logiques pour structurer les paragraphes.',
        'Varier les temps et modes verbaux pour un niveau B2/C1.',
        'Relire attentivement les accords en genre et en nombre.'
      ];
  const objectif = plan.objectif_prochaine_seance || 'Viser une rédaction plus fluide et riche en expressions idiomatiques.';
  return { priorites, objectif };
}

export default function HistoriquePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [corrections, setCorrections] = useState<CorrectionItem[]>([]);
  const [examSessions, setExamSessions] = useState<ExamSessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // État accordéon pour consultation directe du Sujet, Rédaction et Commentaires IA
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskFilter, setSelectedTaskFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | '7days' | '30days' | '90days'>('all');
  const [activeTab, setActiveTab] = useState<'corrections' | 'examens'>('corrections');

  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // 1. Charger les soumissions et corrections IA avec TOUS les champs nécessaires
        const { data: subData, error: subError } = await supabase
          .from('submissions')
          .select(`
            id,
            user_id,
            task_type,
            raw_text,
            file_url,
            consigne,
            reference,
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
              version_amelioree,
              plan_progression
            )
          `)
          .eq('user_id', user.id)
          .order('submitted_at', { ascending: false });

        if (subError) console.error('Erreur chargement submissions:', subError);

        // 2. Charger les productions terminées
        const { data: prodData } = await supabase
          .from('productions')
          .select('*')
          .eq('etudiant_id', user.id)
          .order('created_at', { ascending: false });

        // 3. Charger les sessions d'examen blanc
        const { data: sessionData } = await supabase
          .from('sessions_examen')
          .select('*')
          .eq('etudiant_id', user.id)
          .eq('mode', 'examen_blanc')
          .order('created_at', { ascending: false });

        const formattedList: CorrectionItem[] = [];
        const seenIds = new Set<string>();

        // Intégrer les submissions
        if (Array.isArray(subData)) {
          for (const s of subData) {
            seenIds.add(s.id);
            const corr = Array.isArray(s.corrections) && s.corrections.length > 0 ? s.corrections[0] : null;
            const score = corr?.total ?? 0;
            formattedList.push({
              id: s.id,
              submission_id: s.id,
              task_type: s.task_type,
              raw_text: s.raw_text,
              file_url: s.file_url,
              consigne: s.consigne,
              reference: s.reference,
              submitted_at: s.submitted_at,
              score,
              niveau_cecrl: corr?.niveau_cecrl || (score >= 14 ? 'C1' : score >= 10 ? 'B2' : 'B1'),
              commentaire: corr?.feedback_par_critere?.appreciation_generale || corr?.feedback_par_critere?.remarque_generale,
              source: 'submission',
              note_linguistique: corr?.note_linguistique,
              note_pragmatique: corr?.note_pragmatique,
              note_sociolinguistique: corr?.note_sociolinguistique,
              feedback_par_critere: corr?.feedback_par_critere,
              erreurs_et_corrections: corr?.erreurs_et_corrections,
              version_amelioree: corr?.version_amelioree,
              plan_progression: corr?.plan_progression,
              points_forts: corr?.feedback_par_critere?.points_forts || (corr as any)?.points_forts,
              points_faibles: corr?.feedback_par_critere?.points_faibles || (corr as any)?.points_faibles,
            });
          }
        }

        // Intégrer les productions qui ne sont pas déjà dans submissions
        if (Array.isArray(prodData)) {
          for (const p of prodData) {
            if (p.session_id && seenIds.has(p.session_id)) continue;
            if (seenIds.has(p.id)) continue;

            const taskType = `${p.epreuve === 'expression_ecrite' ? 'EE' : 'EO'}_tache${p.numero_tache}`;
            formattedList.push({
              id: p.id,
              task_type: taskType,
              raw_text: p.contenu_texte,
              file_url: p.audio_url,
              consigne: p.reference ? `Exercice TCF Canada réf. ${p.reference}` : 'Consigne officielle TCF Canada',
              reference: p.reference,
              submitted_at: p.created_at,
              score: p.score ?? 0,
              niveau_cecrl: p.grille_notation?.niveau_cecrl || (p.score && p.score >= 14 ? 'C1' : 'B2'),
              commentaire: p.commentaire,
              source: 'production',
              note_linguistique: p.grille_notation?.note_linguistique,
              note_pragmatique: p.grille_notation?.note_pragmatique,
              note_sociolinguistique: p.grille_notation?.note_sociolinguistique,
              feedback_par_critere: {
                appreciation_generale: p.commentaire || 'Évaluation effectuée selon les critères officiels.',
              },
              erreurs_et_corrections: p.grille_notation?.erreurs || [],
              version_amelioree: p.grille_notation?.version_amelioree || null,
              plan_progression: null,
              points_forts: p.grille_notation?.points_forts,
              points_faibles: p.grille_notation?.points_faibles,
            });
          }
        }

        // Trier par date décroissante
        formattedList.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());

        setCorrections(formattedList);
        setExamSessions(Array.isArray(sessionData) ? sessionData : []);
      } catch (err) {
        console.error('Erreur globale HistoriquePage:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Filtrage des corrections
  const filteredCorrections = useMemo(() => {
    return corrections.filter(item => {
      // 1. Filtre par tâche
      if (selectedTaskFilter !== 'all' && item.task_type !== selectedTaskFilter) {
        return false;
      }

      // 2. Filtre par date
      if (dateFilter !== 'all') {
        const itemDate = new Date(item.submitted_at).getTime();
        const now = Date.now();
        const diffDays = (now - itemDate) / (1000 * 3600 * 24);
        if (dateFilter === '7days' && diffDays > 7) return false;
        if (dateFilter === '30days' && diffDays > 30) return false;
        if (dateFilter === '90days' && diffDays > 90) return false;
      }

      // 3. Filtre par recherche textuelle
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesText = item.raw_text?.toLowerCase().includes(query);
        const matchesConsigne = item.consigne?.toLowerCase().includes(query);
        const matchesRef = item.reference?.toLowerCase().includes(query);
        const matchesTask = item.task_type.toLowerCase().includes(query);
        if (!matchesText && !matchesConsigne && !matchesRef && !matchesTask) {
          return false;
        }
      }

      return true;
    });
  }, [corrections, selectedTaskFilter, dateFilter, searchQuery]);

  // Statistiques globales
  const stats = useMemo(() => {
    const totalCount = corrections.length;
    if (totalCount === 0) {
      return {
        total: 0,
        average: 0,
        nclcRate: 0,
        currentNclc: 'NCLC 4',
        trendPts: 0,
      };
    }

    const sum = corrections.reduce((acc, c) => acc + c.score, 0);
    const avg = Math.round((sum / totalCount) * 10) / 10;
    const nclc7Count = corrections.filter(c => c.score >= 14).length;
    const rate = Math.round((nclc7Count / totalCount) * 100);

    // Progression entre les 3 premières et les 3 dernières
    let trend = 0;
    if (corrections.length >= 2) {
      const recent = corrections.slice(0, Math.min(3, corrections.length));
      const older = corrections.slice(-Math.min(3, corrections.length));
      const recentAvg = recent.reduce((acc, c) => acc + c.score, 0) / recent.length;
      const olderAvg = older.reduce((acc, c) => acc + c.score, 0) / older.length;
      trend = Math.round((recentAvg - olderAvg) * 10) / 10;
    }

    let nclcLevel = 'NCLC 5 (B1)';
    if (avg >= 16) nclcLevel = 'NCLC 9 (C2)';
    else if (avg >= 14) nclcLevel = 'NCLC 8 (C1)';
    else if (avg >= 10) nclcLevel = 'NCLC 7 (B2)';

    return {
      total: totalCount,
      average: avg,
      nclcRate: rate,
      currentNclc: nclcLevel,
      trendPts: trend,
    };
  }, [corrections]);

  // 6 dernières sessions par ordre chronologique pour le graphique épuré
  const recentSessions = useMemo(() => {
    const reversed = [...corrections].reverse();
    const last = reversed.slice(-6);
    return last.map(item => {
      const isEO = item.task_type.startsWith('EO');
      const numTache = item.task_type.slice(-1);
      const shortTask = `${isEO ? 'EO' : 'EE'} T${numTache}`;
      return {
        id: item.id,
        score: item.score,
        taskLabel: shortTask,
        isEO,
        date: new Date(item.submitted_at).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'short',
        }),
      };
    });
  }, [corrections]);

  const taskFilterOptions = [
    { key: 'all', label: `Toutes (${corrections.length})` },
    { key: 'EE_tache1', label: `EE Tâche 1 (${corrections.filter(c => c.task_type === 'EE_tache1').length})` },
    { key: 'EE_tache2', label: `EE Tâche 2 (${corrections.filter(c => c.task_type === 'EE_tache2').length})` },
    { key: 'EE_tache3', label: `EE Tâche 3 (${corrections.filter(c => c.task_type === 'EE_tache3').length})` },
    { key: 'EO_tache1', label: `EO Tâche 1 (${corrections.filter(c => c.task_type === 'EO_tache1').length})` },
    { key: 'EO_tache2', label: `EO Tâche 2 (${corrections.filter(c => c.task_type === 'EO_tache2').length})` },
    { key: 'EO_tache3', label: `EO Tâche 3 (${corrections.filter(c => c.task_type === 'EO_tache3').length})` },
  ];

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6 pb-20 fade-in">
      {/* 1. Header Navigation */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe] font-heading font-bold text-xs uppercase tracking-wide">
          <span className="w-2 h-2 rounded-full bg-[#e53e3e]" />
          <span>Suivi Pédagogique Certifié</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a] tracking-tight">
          Historique des Corrections
        </h1>
        <p className="text-xs sm:text-sm text-[#475569] max-w-2xl">
          Suivez vos progrès épreuve par épreuve et analysez les retours certifiés de l'IA &amp; des professeurs de français langue étrangère.
        </p>
      </div>

      {/* 2. Suivi de progression & Graphique épuré */}
      <Card className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">
        <CardContent className="p-5 sm:p-6 space-y-6">
          {/* En-tête : Moyenne & Statut NCLC */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e2e8f0]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-[#d2e4ff] text-[#051c33] font-heading font-bold text-xs">
                  {stats.total} devoirs évalués
                </span>
                <span className="px-3 py-1 rounded-full bg-[#ffdcc3] text-[#6e3900] font-heading font-bold text-xs">
                  {stats.currentNclc}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-2">
                <span className="font-heading font-extrabold text-3xl sm:text-4xl text-[#0d233a]">
                  {stats.average > 0 ? stats.average.toFixed(1) : '—'}
                </span>
                <span className="text-sm font-semibold text-[#64748b]">/ 20 en moyenne</span>
              </div>
            </div>

            {/* Statut immigration Canada */}
            <div className="sm:text-right">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#eff4ff] text-[#0d233a] font-heading font-extrabold text-sm border border-[#d3e4fe]">
                <TrendingUp className="w-4 h-4 text-[#e53e3e]" />
                {stats.trendPts >= 0 ? `+${stats.trendPts.toFixed(1)} pts de progression` : `${stats.trendPts.toFixed(1)} pts`}
              </div>
              <p className="text-xs text-[#64748b] mt-1">
                {stats.average >= 14
                  ? '🎯 Seuil NCLC 7 atteint pour l\'Entrée Express'
                  : stats.average > 0
                  ? `À ${(14 - stats.average).toFixed(1)} pts du seuil cible NCLC 7 (14/20)`
                  : 'Cible : 14/20 (NCLC 7)'}
              </p>
            </div>
          </div>

          {/* Graphique à barres épuré et lisible */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-heading font-bold text-[#0d233a]">
                Évolution des dernières sessions
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-[#e53e3e] font-semibold">
                <span className="w-3 h-0.5 bg-[#e53e3e] inline-block rounded-full" />
                Seuil cible NCLC 7 (14/20)
              </span>
            </div>

            {recentSessions.length === 0 ? (
              <div className="h-36 rounded-xl bg-[#f8f9ff] border border-dashed border-[#cbd5e1] flex flex-col items-center justify-center p-4 text-center">
                <FileText className="w-6 h-6 text-[#94a3b8] mb-1" />
                <p className="text-xs font-semibold text-[#0d233a]">Aucun devoir pour l'instant</p>
                <p className="text-[11px] text-[#64748b]">Effectuez vos premiers entraînements pour voir vos notes s'afficher ici.</p>
              </div>
            ) : (
              <div className="relative rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] p-4 pt-8">
                {/* Ligne horizontale repère pour le seuil NCLC 7 (14/20 = 70%) */}
                <div
                  className="absolute left-3 right-3 border-b-2 border-dashed border-[#e53e3e]/70 pointer-events-none z-10 flex justify-end"
                  style={{ bottom: 'calc(70% * 0.72 + 38px)' }}
                >
                  <span className="bg-white text-[10px] text-[#e53e3e] font-bold px-1.5 py-0.5 rounded shadow-2xs -translate-y-1/2 border border-red-200">
                    14/20
                  </span>
                </div>

                {/* Colonnes de notes */}
                <div className="flex items-end justify-between sm:justify-around gap-2 h-36">
                  {recentSessions.map((session, idx) => {
                    const isSuccess = session.score >= 14;
                    const isMedium = session.score >= 10;
                    // Hauteur proportionnelle bornée entre 14% et 100%
                    const heightPct = Math.max(14, Math.min(100, (session.score / 20) * 100));

                    return (
                      <div
                        key={session.id || idx}
                        className="flex-1 max-w-[56px] flex flex-col items-center h-full justify-end group"
                      >
                        {/* Note au-dessus de la barre */}
                        <span
                          className={cn(
                            'text-xs font-heading font-extrabold mb-1.5 transition-transform group-hover:-translate-y-0.5',
                            isSuccess ? 'text-[#16a34a]' : isMedium ? 'text-[#0d233a]' : 'text-[#dc2626]'
                          )}
                        >
                          {session.score > 0 ? session.score.toFixed(1) : '—'}
                        </span>

                        {/* Barre verticale */}
                        <div className="w-full h-full max-h-[82px] flex items-end">
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={cn(
                              'w-full rounded-t-lg transition-all duration-300 shadow-2xs',
                              isSuccess
                                ? 'bg-gradient-to-t from-[#16a34a] to-[#22c55e]'
                                : isMedium
                                ? 'bg-gradient-to-t from-[#0d233a] to-[#1e3a8a]'
                                : 'bg-gradient-to-t from-[#dc2626] to-[#f87171]'
                            )}
                          />
                        </div>

                        {/* Légende en dessous : Tâche et Date */}
                        <div className="w-full pt-2 flex flex-col items-center border-t border-[#e2e8f0]/80 mt-1">
                          <span className="text-[10px] font-heading font-bold text-[#0d233a] truncate">
                            {session.taskLabel}
                          </span>
                          <span className="text-[9px] text-[#64748b] truncate">
                            {session.date}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3 Indicateurs synthétiques */}
          <div className="grid grid-cols-3 gap-3 pt-1">
            <div className="bg-[#eff4ff] rounded-xl p-3 flex flex-col items-center text-center border border-[#d3e4fe]/50">
              <span className="font-heading font-extrabold text-base sm:text-xl text-[#0d233a]">
                {stats.nclcRate}%
              </span>
              <span className="text-[11px] text-[#475569] leading-tight mt-0.5">
                Taux NCLC 7+
              </span>
            </div>

            <div className="bg-[#eff4ff] rounded-xl p-3 flex flex-col items-center text-center border border-[#d3e4fe]/50">
              <span className="font-heading font-extrabold text-base sm:text-xl text-[#0d233a]">
                {stats.average > 0 ? `${stats.average.toFixed(1)} / 20` : '—'}
              </span>
              <span className="text-[11px] text-[#475569] leading-tight mt-0.5">
                Moyenne globale
              </span>
            </div>

            <div className="bg-[#eff4ff] rounded-xl p-3 flex flex-col items-center text-center border border-[#d3e4fe]/50">
              <span className="font-heading font-extrabold text-base sm:text-xl text-[#e53e3e]">
                {stats.total}
              </span>
              <span className="text-[11px] text-[#475569] leading-tight mt-0.5">
                Devoirs archivés
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Onglets : Corrections de devoirs vs Examens Blancs */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList className="bg-[#e2e8f0]/60 p-1 rounded-xl">
            <TabsTrigger
              value="corrections"
              className="rounded-lg text-xs sm:text-sm font-heading font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0d233a] data-[state=active]:shadow-xs"
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Devoirs &amp; Tâches ({corrections.length})
            </TabsTrigger>
            <TabsTrigger
              value="examens"
              className="rounded-lg text-xs sm:text-sm font-heading font-semibold data-[state=active]:bg-white data-[state=active]:text-[#0d233a] data-[state=active]:shadow-xs"
            >
              <Trophy className="w-4 h-4 mr-1.5" />
              Examens Blancs ({examSessions.length})
            </TabsTrigger>
          </TabsList>

          <Button
            asChild
            size="sm"
            className="bg-[#0d233a] hover:bg-[#1a365d] text-white rounded-xl shadow-xs text-xs font-heading font-semibold hidden sm:flex"
          >
            <Link to="/etudiant/entrainement">
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-[#e9a820]" />
              Nouvel entraînement
            </Link>
          </Button>
        </div>

        {/* ═══ ONGLET 1 : CORRECTIONS DE DEVOIRS ═══ */}
        <TabsContent value="corrections" className="space-y-4 m-0">
          {/* Barre de recherche et filtres */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Champ recherche */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#94a3b8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Rechercher par mot-clé, sujet ou consigne..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl bg-white border-[#e2e8f0] shadow-xs text-sm"
                />
              </div>

              {/* Filtre de date */}
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#e2e8f0] shadow-xs text-xs">
                <Calendar className="w-3.5 h-3.5 text-[#64748b] ml-2" />
                <button
                  type="button"
                  onClick={() => setDateFilter('all')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg font-medium transition-colors',
                    dateFilter === 'all' ? 'bg-[#0d233a] text-white' : 'text-[#475569] hover:bg-slate-100'
                  )}
                >
                  Tout
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('7days')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg font-medium transition-colors',
                    dateFilter === '7days' ? 'bg-[#0d233a] text-white' : 'text-[#475569] hover:bg-slate-100'
                  )}
                >
                  7 j
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('30days')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg font-medium transition-colors',
                    dateFilter === '30days' ? 'bg-[#0d233a] text-white' : 'text-[#475569] hover:bg-slate-100'
                  )}
                >
                  30 j
                </button>
                <button
                  type="button"
                  onClick={() => setDateFilter('90days')}
                  className={cn(
                    'px-2.5 py-1 rounded-lg font-medium transition-colors',
                    dateFilter === '90days' ? 'bg-[#0d233a] text-white' : 'text-[#475569] hover:bg-slate-100'
                  )}
                >
                  3 mois
                </button>
              </div>
            </div>

            {/* Chips horizontaux par type de tâche */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 no-scrollbar">
              {taskFilterOptions.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setSelectedTaskFilter(opt.key)}
                  className={cn(
                    'whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-heading font-semibold transition-all shadow-xs',
                    selectedTaskFilter === opt.key
                      ? 'bg-[#0d233a] text-white'
                      : 'bg-white text-[#475569] border border-[#e2e8f0] hover:bg-[#eff4ff]'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Liste des cartes de soumissions */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : filteredCorrections.length === 0 ? (
            <Card className="bg-white rounded-2xl border border-[#e2e8f0] p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#eff4ff] text-[#0d233a] mx-auto flex items-center justify-center">
                <FileText className="w-7 h-7 text-[#0d233a]" />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading font-bold text-base text-[#0d233a]">
                  Aucun devoir trouvé
                </h3>
                <p className="text-xs text-[#64748b] max-w-sm mx-auto">
                  {searchQuery || selectedTaskFilter !== 'all' || dateFilter !== 'all'
                    ? 'Aucune soumission ne correspond à vos filtres actuels.'
                    : 'Vous n\'avez pas encore soumis de devoir pour évaluation.'}
                </p>
              </div>
              <Button asChild className="bg-[#0d233a] hover:bg-[#1a365d] text-white rounded-xl shadow-xs">
                <Link to="/etudiant/entrainement">Commencer un entraînement</Link>
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredCorrections.map(item => {
                const isItemEO = item.task_type.startsWith('EO');
                const label = COURSE_EPREUVE_LABELS[item.task_type as CourseEpreuve] || item.task_type.replace('_', ' ');

                // Code couleur du badge de score
                let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-300';
                let badgeDot = 'bg-emerald-500';
                if (item.score < 10) {
                  badgeClass = 'bg-red-50 text-red-700 border-red-300';
                  badgeDot = 'bg-red-500';
                } else if (item.score < 14) {
                  badgeClass = 'bg-amber-50 text-amber-800 border-amber-300';
                  badgeDot = 'bg-amber-500';
                }

                const isExpanded = expandedIds.has(item.id);
                const wordCount = item.raw_text ? item.raw_text.trim().split(/\s+/).filter(Boolean).length : 0;

                return (
                  <Card
                    key={item.id}
                    className={cn(
                      "bg-white rounded-2xl border shadow-xs transition-all duration-200 overflow-hidden group",
                      isExpanded ? "border-[#0d233a]/60 shadow-md ring-1 ring-[#0d233a]/20" : "border-[#e2e8f0] hover:border-[#0d233a]/40 hover:shadow-md"
                    )}
                  >
                    <CardContent className="p-4 sm:p-5 space-y-4">
                      {/* En-tête de la carte */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        {/* Côté gauche : Détails de la tâche */}
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#eff4ff] text-[#0d233a] font-heading font-bold text-xs uppercase tracking-wide">
                              {isItemEO ? (
                                <Mic className="w-3.5 h-3.5 text-[#e53e3e]" />
                              ) : (
                                <FileText className="w-3.5 h-3.5 text-[#0d233a]" />
                              )}
                              {label}
                            </span>

                            <span className="text-xs text-[#64748b] flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#94a3b8]" />
                              {new Date(item.submitted_at).toLocaleDateString('fr-FR', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>

                            {item.reference && (
                              <span className="text-[11px] font-mono font-medium text-[#64748b] bg-slate-100 px-2 py-0.5 rounded-md">
                                Réf : {item.reference}
                              </span>
                            )}

                            {item.file_url && (
                              <span className="text-[11px] font-semibold text-[#0d233a] bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <Volume2 className="w-3 h-3 text-[#e53e3e]" /> Audio disponible
                              </span>
                            )}
                          </div>

                          {/* Aperçu du texte */}
                          <p className="text-xs sm:text-sm text-[#475569] line-clamp-2 leading-relaxed">
                            {item.raw_text ? (
                              `« ${item.raw_text.slice(0, 160)}${item.raw_text.length > 160 ? '…' : ''} »`
                            ) : (
                              <span className="italic text-[#94a3b8]">Enregistrement audio évalué</span>
                            )}
                          </p>

                          {/* Remarque générale succincte si disponible */}
                          {item.commentaire && !isExpanded && (
                            <p className="text-[11px] text-[#0d233a] font-medium bg-[#f8f9ff] px-2.5 py-1 rounded-lg border border-[#e2e8f0]/60 line-clamp-1">
                              💡 {item.commentaire}
                            </p>
                          )}
                        </div>

                        {/* Côté droit : Score & Actions */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#e2e8f0]">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                'px-3 py-1 rounded-xl border flex items-center gap-2 font-heading font-extrabold text-sm sm:text-base',
                                badgeClass
                              )}
                            >
                              <span className={cn('w-2 h-2 rounded-full', badgeDot)} />
                              <span>{item.score > 0 ? `${item.score.toFixed(1)} / 20` : 'En attente'}</span>
                            </div>
                            <Badge variant="outline" className="text-xs font-bold border-[#cbd5e1] text-[#0d233a]">
                              {item.niveau_cecrl}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => toggleExpand(item.id)}
                              className="rounded-xl border-[#d3e4fe] bg-[#eff4ff] hover:bg-[#dce9ff] text-[#0d233a] font-heading font-semibold text-xs gap-1.5 shadow-2xs"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  <span>Masquer</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="w-3.5 h-3.5 text-[#0d233a]" />
                                  <span>Voir sujet, rédaction &amp; retours IA</span>
                                </>
                              )}
                            </Button>

                            <Button
                              asChild
                              size="sm"
                              className="bg-[#0d233a] hover:bg-[#1a365d] text-white rounded-xl shadow-xs font-heading font-semibold text-xs gap-1.5"
                            >
                              <Link to={`/etudiant/corrections/${item.id}`}>
                                <span>Détail complet</span>
                                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* ═══ PANNEAU DÉPLIABLE : SUJET, RÉDACTION & COMMENTAIRES IA ═══ */}
                      {isExpanded && (
                        <div className="pt-4 border-t border-[#e2e8f0] space-y-4 animate-in fade-in-50 duration-200">
                          {/* 1. BLOC : LE SUJET / LA CONSIGNE */}
                          <div className="p-4 rounded-xl bg-[#f8f9ff] border border-[#d3e4fe] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-heading font-bold text-xs uppercase text-[#0d233a] flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#0d233a]" />
                                📌 Sujet &amp; Consigne Officielle
                              </span>
                              {item.reference && (
                                <span className="text-[10px] font-mono text-[#64748b]">
                                  Sujet réf. {item.reference}
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-[#0d233a] leading-relaxed whitespace-pre-wrap font-sans bg-white p-3 rounded-lg border border-[#e2e8f0]">
                              {item.consigne || 'Consigne officielle TCF Canada pour cette tâche.'}
                            </p>
                          </div>

                          {/* 2. BLOC : LA RÉDACTION DE L'ÉTUDIANT */}
                          <div className="p-4 rounded-xl bg-white border border-[#e2e8f0] space-y-2 shadow-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-heading font-bold text-xs uppercase text-[#0d233a] flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#cf7100]" />
                                ✍️ Rédaction transmise par le candidat
                              </span>
                              {!isItemEO && (
                                <Badge variant="outline" className="text-[11px] font-semibold bg-[#eff4ff] text-[#0d233a] border-[#d3e4fe]">
                                  <BookOpen className="w-3 h-3 mr-1" />
                                  {wordCount} mots rédigés
                                </Badge>
                              )}
                            </div>

                            {/* Lecteur audio si épreuve orale */}
                            {isItemEO && item.file_url && (
                              <div className="p-3 rounded-xl bg-[#0d233a] text-white flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs">
                                  <Volume2 className="w-4 h-4 text-[#e9a820]" />
                                  <span>Enregistrement audio du candidat</span>
                                </div>
                                <audio
                                  controls
                                  src={item.file_url}
                                  className="h-8 max-w-[240px] sm:max-w-xs"
                                  onError={async (e) => {
                                    const target = e.currentTarget;
                                    if (target.dataset.retried === 'true' || !item.file_url) return;
                                    target.dataset.retried = 'true';
                                    const blobUrl = await fetchAudioBlobUrl(item.file_url);
                                    if (blobUrl) {
                                      target.src = blobUrl;
                                      target.load();
                                    }
                                  }}
                                >
                                  <track kind="captions" />
                                </audio>
                              </div>
                            )}

                            {/* Contenu textuel */}
                            <div className="p-3.5 rounded-lg bg-[#f8f9ff] text-xs sm:text-sm text-[#0d233a] leading-relaxed whitespace-pre-wrap font-sans border border-[#e2e8f0]">
                              {item.raw_text || (isItemEO ? 'Enregistrement oral sans transcription brute.' : 'Aucun texte rédigé.')}
                            </div>
                          </div>

                          {/* 3. BLOC : COMMENTAIRES DE L'IA (Ce qui est bon, ce qui n'est pas bon, marge de progression, version corrigée) */}
                          <div className="p-4 sm:p-5 rounded-xl bg-[#f8fbff] border border-[#d3e4fe] space-y-4">
                            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-[#d3e4fe]/60 pb-3">
                              <span className="font-heading font-bold text-xs uppercase text-[#0d233a] flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-[#e53e3e]" />
                                Commentaires &amp; Retours de l'IA (Post-rédaction)
                              </span>
                              <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px] font-bold">
                                Niveau estimé : {item.niveau_cecrl}
                              </Badge>
                            </div>

                            {/* Appréciation globale */}
                            {item.commentaire && (
                              <div className="p-3.5 bg-white rounded-xl border border-[#d3e4fe] text-xs sm:text-sm text-[#0d233a] leading-relaxed">
                                <p className="font-heading font-bold text-xs text-[#0d233a] mb-1 flex items-center gap-1.5">
                                  <span>💡</span> Bilan général de la rédaction :
                                </p>
                                <p>{item.commentaire}</p>
                              </div>
                            )}

                            {/* 1. CE QUI EST BON */}
                            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-2">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <h4 className="font-heading font-bold text-xs uppercase text-emerald-900 tracking-wide">
                                  Ce qui est bon
                                </h4>
                              </div>
                              <ul className="text-xs sm:text-sm text-emerald-950 space-y-1.5 list-disc list-inside">
                                {getPointsForts(item).map((pf) => (
                                  <li key={pf} className="leading-relaxed">{pf}</li>
                                ))}
                              </ul>
                            </div>

                            {/* 2. CE QUI N'EST PAS BON */}
                            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2.5">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                <h4 className="font-heading font-bold text-xs uppercase text-amber-900 tracking-wide">
                                  Ce qui n'est pas bon
                                </h4>
                              </div>
                              <ul className="text-xs sm:text-sm text-amber-950 space-y-1.5 list-disc list-inside">
                                {getPointsFaibles(item).map((pf) => (
                                  <li key={pf} className="leading-relaxed">{pf}</li>
                                ))}
                              </ul>

                              {/* Erreurs avec citations de la copie & corrections */}
                              {Array.isArray(item.erreurs_et_corrections) && item.erreurs_et_corrections.length > 0 && (
                                <div className="pt-2 border-t border-amber-200/60 space-y-2">
                                  <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                                    Erreurs relevées dans votre copie avec corrections :
                                  </p>
                                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                    {item.erreurs_et_corrections.map((err) => (
                                      <div key={`${err.citation || err.extrait}-${err.correction}`} className="p-2.5 bg-white rounded-lg border border-red-200 text-xs space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="line-through text-red-600 font-medium">« {err.citation || err.extrait} »</span>
                                          <span className="text-emerald-700 font-bold">➔ « {err.correction} »</span>
                                        </div>
                                        {err.explication && (
                                          <p className="text-[11px] text-[#475569]">
                                            <strong className="text-[#0d233a]">Règle :</strong> {err.explication}
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* 3. MARGE DE PROGRESSION */}
                            {(() => {
                              const progression = getPlanProgression(item);
                              return (
                                <div className="p-3.5 rounded-xl bg-[#eff4ff] border border-[#d3e4fe] space-y-2">
                                  <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-[#0d233a] shrink-0" />
                                    <h4 className="font-heading font-bold text-xs uppercase text-[#0d233a] tracking-wide">
                                      Marge de progression
                                    </h4>
                                  </div>
                                  <ul className="text-xs sm:text-sm text-slate-800 space-y-1.5 list-disc list-inside">
                                    {progression.priorites.map((prio) => (
                                      <li key={prio} className="leading-relaxed">{prio}</li>
                                    ))}
                                  </ul>
                                  {progression.objectif && (
                                    <div className="mt-2 p-2.5 bg-white rounded-lg border border-[#d3e4fe] text-xs text-[#0d233a] font-medium">
                                      🎯 <strong>Objectif séance suivante :</strong> {progression.objectif}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* 4. LA VERSION CORRIGÉE */}
                            {item.version_amelioree && (
                              <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200 space-y-2">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="w-4 h-4 text-purple-600 shrink-0" />
                                  <h4 className="font-heading font-bold text-xs uppercase text-purple-950 tracking-wide">
                                    Version corrigée et modèle
                                  </h4>
                                </div>
                                <p className="text-[11px] text-purple-800">
                                  Voici la version modèle rédigée répondant parfaitement aux attentes du sujet :
                                </p>
                                <div className="p-3.5 bg-white rounded-xl border border-purple-200/80 text-xs sm:text-sm text-slate-900 leading-relaxed whitespace-pre-wrap font-sans">
                                  {item.version_amelioree}
                                </div>
                              </div>
                            )}

                            {/* Lien vers analyse complète */}
                            <div className="pt-1 flex justify-end">
                              <Button
                                asChild
                                size="sm"
                                className="bg-[#0d233a] hover:bg-[#1a365d] text-white rounded-xl text-xs font-heading font-semibold gap-1.5"
                              >
                                <Link to={`/etudiant/corrections/${item.id}`}>
                                  <span>Voir la fiche détaillée</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ═══ ONGLET 2 : EXAMENS BLANCS COMPLETS ═══ */}
        <TabsContent value="examens" className="space-y-4 m-0">
          {examSessions.length === 0 ? (
            <Card className="bg-white rounded-2xl border border-[#e2e8f0] p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#eff4ff] text-[#0d233a] mx-auto flex items-center justify-center">
                <Trophy className="w-7 h-7 text-[#0d233a]" />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading font-bold text-base text-[#0d233a]">
                  Aucun examen blanc complété
                </h3>
                <p className="text-xs text-[#64748b] max-w-sm mx-auto">
                  Passez votre premier examen blanc chronométré pour évaluer votre niveau global officiel sur 699 points.
                </p>
              </div>
              <Button asChild className="bg-[#0d233a] hover:bg-[#1a365d] text-white rounded-xl shadow-xs">
                <Link to="/etudiant/examen-blanc">Passer un examen blanc</Link>
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {examSessions.map(session => {
                const globalScore = session.score_global;
                const niveau = session.niveau_cecrl || (globalScore ? pctToCECRL(Math.round((globalScore / 699) * 100)) : 'B2');
                const cecrlColor = CECRL_COLORS[niveau as keyof typeof CECRL_COLORS] || '#22C55E';

                return (
                  <Card
                    key={session.id}
                    className="bg-white rounded-2xl border border-[#e2e8f0] shadow-xs hover:border-[#0d233a]/40 hover:shadow-md transition-all overflow-hidden"
                  >
                    <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eff4ff] text-[#0d233a] font-heading font-bold text-xs uppercase">
                            <Trophy className="w-3.5 h-3.5 text-[#e9a820]" />
                            Examen Blanc Complet TCF Canada
                          </span>
                          <span className="text-xs text-[#64748b]">
                            {new Date(session.created_at).toLocaleDateString('fr-FR', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </span>
                        </div>

                        {/* Scores par épreuve */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                          <div className="p-2 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                            <span className="text-[#64748b] block">Compréhension Écrite</span>
                            <span className="font-heading font-bold text-[#0d233a]">
                              {session.score_ecrit !== null ? `${session.score_ecrit} / 699` : '—'}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                            <span className="text-[#64748b] block">Compréhension Orale</span>
                            <span className="font-heading font-bold text-[#0d233a]">
                              {session.score_oral !== null ? `${session.score_oral} / 699` : '—'}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                            <span className="text-[#64748b] block">Expression Écrite</span>
                            <span className="font-heading font-bold text-[#0d233a]">
                              {session.score_expression_ecrite !== null ? `${session.score_expression_ecrite} / 699` : '—'}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-[#f8f9ff] border border-[#e2e8f0]">
                            <span className="text-[#64748b] block">Expression Orale</span>
                            <span className="font-heading font-bold text-[#0d233a]">
                              {session.score_expression_orale !== null ? `${session.score_expression_orale} / 699` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Score global */}
                      <div className="flex md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#e2e8f0]">
                        <div className="text-right">
                          <span className="text-[11px] text-[#64748b] uppercase font-bold tracking-wider block">Score Global</span>
                          <span className="font-heading font-extrabold text-2xl text-[#0d233a]">
                            {globalScore !== null ? `${globalScore} / 699` : 'En cours'}
                          </span>
                        </div>
                        <Badge
                          style={{ backgroundColor: cecrlColor }}
                          className="text-white font-heading font-bold px-3 py-1 text-xs"
                        >
                          Niveau {niveau}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
