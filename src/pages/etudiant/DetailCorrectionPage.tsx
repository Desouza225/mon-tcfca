import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Printer,
  Sparkles,
  Award,
  BookOpen,
  Info,
  Calendar,
  Volume2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import { COURSE_EPREUVE_LABELS, type CourseEpreuve } from '@/types/index';
import { fetchAudioBlobUrl } from '@/lib/audioProcessing';

interface CorrectionData {
  id: string;
  submission_id: string;
  total: number;
  niveau_cecrl: string;
  note_linguistique?: {
    total?: number;
    criteres?: Array<{ nom: string; note: number; max: number; justification?: string }>;
  };
  note_pragmatique?: {
    total?: number;
    criteres?: Array<{ nom: string; note: number; max: number; justification?: string }>;
  };
  note_sociolinguistique?: {
    total?: number;
    criteres?: Array<{ nom: string; note: number; max: number; justification?: string }>;
  };
  feedback_par_critere?: Record<string, string>;
  erreurs_et_corrections?: Array<{
    citation: string;
    correction: string;
    categorie: string;
    explication: string;
  }>;
  analyse_consigne?: any;
  version_amelioree?: string;
  plan_progression?: {
    priorites?: string[];
    exercices_recommandes?: string[];
    erreurs_a_surveiller?: string[];
    objectif_prochaine_seance?: string;
  };
  ai_model_used?: string;
  created_at: string;
}

interface SubmissionData {
  id: string;
  user_id: string;
  task_type: string;
  raw_text: string | null;
  file_url: string | null;
  consigne: string;
  reference: string | null;
  submitted_at: string;
  corrections?: CorrectionData[];
}

export default function DetailCorrectionPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [correction, setCorrection] = useState<CorrectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Collapsible state for raw submission
  const [showRawText, setShowRawText] = useState(true);

  useEffect(() => {
    if (!id || !user) return;

    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Tenter de récupérer par submission_id
        let subRes = await supabase
          .from('submissions')
          .select(`
            *,
            corrections (*)
          `)
          .eq('id', id)
          .eq('user_id', user.id)
          .maybeSingle();

        // 2. Si pas trouvé, vérifier si l'id passé était l'id de la correction elle-même
        if (!subRes.data) {
          const corrRes = await supabase
            .from('corrections')
            .select(`
              *,
              submissions:submission_id (*)
            `)
            .eq('id', id)
            .maybeSingle();

          if (corrRes.data && corrRes.data.submissions) {
            const sub = corrRes.data.submissions as any;
            if (sub.user_id === user.id) {
              setSubmission({
                ...sub,
                corrections: [corrRes.data],
              });
              setCorrection(corrRes.data);
              setLoading(false);
              return;
            }
          }
        }

        if (subRes.error) throw subRes.error;

        if (subRes.data) {
          setSubmission(subRes.data);
          const corrs = subRes.data.corrections;
          if (Array.isArray(corrs) && corrs.length > 0) {
            setCorrection(corrs[0]);
          }
        } else {
          // 3. Fallback sur la table productions si la soumission vient de l'ancien flux
          const prodRes = await supabase
            .from('productions')
            .select('*')
            .eq('id', id)
            .eq('etudiant_id', user.id)
            .maybeSingle();

          if (prodRes.data) {
            const prod = prodRes.data;
            const mockSub: SubmissionData = {
              id: prod.id,
              user_id: prod.etudiant_id,
              task_type: `${prod.epreuve === 'expression_ecrite' ? 'EE' : 'EO'}_tache${prod.numero_tache}`,
              raw_text: prod.contenu_texte,
              file_url: prod.audio_url,
              consigne: prod.reference ? `Exercice TCF Canada réf. ${prod.reference}` : 'Consigne de l\'épreuve officielle',
              reference: prod.reference,
              submitted_at: prod.created_at,
            };

            const mockCorr: CorrectionData = {
              id: prod.id,
              submission_id: prod.id,
              total: prod.score ?? 0,
              niveau_cecrl: prod.grille_notation?.niveau_cecrl || 'B2',
              feedback_par_critere: {
                general: prod.commentaire || 'Évaluation effectuée.',
              },
              created_at: prod.corrige_at || prod.created_at,
            };

            setSubmission(mockSub);
            setCorrection(mockCorr);
          } else {
            setError('Correction introuvable ou vous n\'avez pas accès à ce devoir.');
          }
        }
      } catch (err: any) {
        console.error('Erreur chargement détail correction:', err);
        setError(err.message || 'Impossible de charger les détails de la correction.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id, user]);

  // Audio handlers
  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(err => console.error('Erreur lecture audio:', err));
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (audioRef.current) {
      setAudioCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const formatAudioTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calcul du format d'affichage
  const isEO = submission?.task_type.startsWith('EO');
  const taskLabel = submission?.task_type
    ? COURSE_EPREUVE_LABELS[submission.task_type as CourseEpreuve] || submission.task_type.replace('_', ' ')
    : 'Expression';

  const totalScore = correction?.total ?? 0;
  const pctScore = Math.round((totalScore / 20) * 100);

  // Estimation NCLC & points CRS
  const getNclcInfo = (score: number, cecrl: string) => {
    if (score >= 16 || cecrl === 'C2') return { nclc: 'NCLC 9-10 (C2)', crs: '+34 Pts CRS', note: 'Palier d\'excellence maximale' };
    if (score >= 14 || cecrl === 'C1') return { nclc: 'NCLC 8 (C1)', crs: '+28 Pts CRS', note: '+2.5 pts au-dessus du seuil B2' };
    if (score >= 10 || cecrl === 'B2') return { nclc: 'NCLC 7 (B2)', crs: '+22 Pts CRS', note: 'Seuil minimum Entrée Express atteint' };
    if (score >= 6 || cecrl === 'B1') return { nclc: 'NCLC 5-6 (B1)', crs: '+12 Pts CRS', note: 'En cours d\'acquisition pour le niveau B2' };
    return { nclc: 'NCLC 4 (A2)', crs: '+6 Pts CRS', note: 'Niveau initial à consolider' };
  };

  const nclcInfo = getNclcInfo(totalScore, correction?.niveau_cecrl || 'B2');

  // Nombre de mots du texte
  const wordCount = submission?.raw_text ? submission.raw_text.trim().split(/\s+/).filter(Boolean).length : 0;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="max-w-2xl mx-auto p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-heading font-bold text-[#0d233a]">Devoir introuvable</h2>
        <p className="text-sm text-[#475569]">{error || 'La correction demandée n\'existe pas.'}</p>
        <Button asChild className="bg-[#0d233a] hover:bg-[#1a365d] text-white rounded-xl">
          <Link to="/etudiant/historique">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour à l'historique
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 pb-16 fade-in">
      {/* 1. Barre de navigation & Actions */}
      <div className="flex items-center justify-between gap-3">
        <Button
          asChild
          variant="ghost"
          className="text-[#0d233a] hover:bg-[#eff4ff] rounded-xl font-medium gap-1.5 pl-2"
        >
          <Link to="/etudiant/historique">
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à l'historique</span>
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="rounded-xl border-[#e2e8f0] text-[#0d233a] hover:bg-[#eff4ff] shadow-xs gap-1.5"
            title="Imprimer ou enregistrer en PDF"
          >
            <Printer className="w-4 h-4 text-[#e53e3e]" />
            <span className="hidden sm:inline">Imprimer / PDF</span>
          </Button>

          <Button
            size="sm"
            className="bg-[#0d233a] hover:bg-[#1a365d] text-white rounded-xl shadow-xs gap-1.5 font-heading font-semibold"
            onClick={() => {
              const tt = submission.task_type || '';
              const epreuve = tt.startsWith('EO') ? 'expression_orale' : 'expression_ecrite';
              const match = tt.match(/tache(\d+)/i);
              const tacheNum = match ? Number(match[1]) : 1;
              const params = new URLSearchParams({
                epreuve,
                tache: String(tacheNum),
              });
              if (submission.reference) {
                params.set('ref', submission.reference);
              }
              navigate(`/etudiant/entrainement?${params.toString()}`, {
                state: {
                  redoConsigne: submission.consigne,
                  redoReference: submission.reference,
                  redoEpreuve: epreuve,
                  redoTache: tacheNum,
                },
              });
            }}
          >
            <RotateCcw className="w-4 h-4 text-[#e9a820]" />
            <span>Refaire l'exercice</span>
          </Button>
        </div>
      </div>

      {/* 2. En-tête de la tâche */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe] font-heading font-bold text-xs uppercase tracking-wide">
            <Sparkles className="w-3.5 h-3.5 text-[#e53e3e]" />
            {taskLabel}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#ffdcc3] text-[#6e3900] font-heading font-bold text-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#d97706]" />
            {correction?.niveau_cecrl ? `${correction.niveau_cecrl} VALIDÉ` : 'ÉVALUATION OFFICIELLE'}
          </span>
          {submission.reference && (
            <span className="text-xs text-[#64748b] bg-slate-100 px-2 py-0.5 rounded-md font-mono">
              Réf : {submission.reference}
            </span>
          )}
        </div>

        <h1 className="text-xl sm:text-2xl md:text-3xl font-heading font-extrabold text-[#0d233a] tracking-tight">
          {submission.consigne ? submission.consigne.slice(0, 110) + (submission.consigne.length > 110 ? '…' : '') : 'Épreuve TCF Canada'}
        </h1>

        <p className="text-xs text-[#64748b] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[#94a3b8]" />
          Évalué le {new Date(submission.submitted_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      {/* 3. Hero Score & NCLC Equivalency Card (Inspiré de la maquette Stitch) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0d233a] via-[#102a45] to-[#1a365d] text-white p-6 sm:p-8 shadow-xl border border-[#1a365d]">
        {/* Motif filigrane décoratif feuille d'érable */}
        <div className="absolute -right-8 -bottom-8 opacity-5 pointer-events-none text-white">
          <svg fill="currentColor" height="220" viewBox="0 0 24 24" width="220" aria-hidden="true">
            <title>Motif feuille d'érable</title>
            <path d="M12 2L13.8 6.6L18.4 5.4L17.2 10L21.8 11.8L17.6 14.6L19.4 19.2L14.8 18L13 22.6L12 22.6L10.2 18L5.6 19.2L7.4 14.6L3.2 11.8L7.8 10L6.6 5.4L11.2 6.6L12 2Z" />
          </svg>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase font-heading font-bold text-[#b3c8e6] tracking-wider">
                Résultat Global Certifié
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-heading font-extrabold text-4xl sm:text-5xl text-white">
                  {totalScore.toFixed(1)}
                </span>
                <span className="text-xl sm:text-2xl text-[#b3c8e6] font-semibold">/ 20</span>
              </div>
            </div>

            {/* Jauge radiale circulaire */}
            <div className="flex items-center gap-3">
              <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                  <title>Jauge de score</title>
                  <path
                    className="text-white/15"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.5"
                  />
                  <path
                    className="text-[#e53e3e]"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray={`${pctScore}, 100`}
                    strokeLinecap="round"
                    strokeWidth="3.5"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-heading font-extrabold text-sm text-white">{pctScore}%</span>
                  <span className="text-[9px] uppercase text-[#ffdcc3] font-bold">Score</span>
                </div>
              </div>
            </div>
          </div>

          {/* NCLC Level & CRS Immigration Points */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[#ffdcc3] text-xs font-heading font-bold uppercase">
                <Award className="w-4 h-4 text-[#e9a820]" />
                <span>Niveau Atteint</span>
              </div>
              <p className="font-heading font-extrabold text-lg text-white">{nclcInfo.nclc}</p>
              <p className="text-xs text-white/70">{nclcInfo.note}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 space-y-0.5">
              <div className="flex items-center gap-1.5 text-[#ffdcc3] text-xs font-heading font-bold uppercase">
                <TrendingUp className="w-4 h-4 text-[#e53e3e]" />
                <span>Gain Immigration Canada</span>
              </div>
              <p className="font-heading font-extrabold text-lg text-white">{nclcInfo.crs}</p>
              <p className="text-xs text-white/70">Entrée Express & Arrima Québec</p>
            </div>
          </div>

          {/* Félicitations / Synthèse rapide */}
          {correction?.feedback_par_critere?.appreciation_generale && (
            <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#e9a820] shrink-0 mt-0.5" />
              <p className="text-sm text-white/90 leading-relaxed">
                {correction.feedback_par_critere.appreciation_generale}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Sujet & Consigne Officielle de l'épreuve */}
      <Card className="bg-white rounded-2xl border border-[#d3e4fe] shadow-sm overflow-hidden">
        <div className="bg-[#eff4ff] px-5 sm:px-6 py-3.5 border-b border-[#d3e4fe] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0d233a]" />
            <h2 className="font-heading font-bold text-base sm:text-lg text-[#0d233a] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#0d233a]" />
              Sujet &amp; Consigne Officielle de l'épreuve
            </h2>
          </div>
          {submission.reference && (
            <span className="text-xs font-mono font-semibold text-[#0d233a] bg-white px-2.5 py-1 rounded-md border border-[#d3e4fe]">
              Réf : {submission.reference}
            </span>
          )}
        </div>
        <CardContent className="p-5 sm:p-6 space-y-3">
          <div className="p-4 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] text-sm text-[#0d233a] leading-relaxed whitespace-pre-wrap font-sans">
            {submission.consigne || 'Consigne officielle de l\'épreuve.'}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748b] pt-1">
            <span className="flex items-center gap-1 font-medium">
              <Info className="w-3.5 h-3.5 text-[#0d233a]" />
              {submission.task_type.includes('tache1')
                ? 'Tâche 1 : Description factuelle & message informatif (60 à 120 mots attendus)'
                : submission.task_type.includes('tache2')
                ? 'Tâche 2 : Récit d\'expérience personnelle & transmission d\'impressions (120 à 150 mots attendus)'
                : submission.task_type.includes('tache3')
                ? 'Tâche 3 : Comparaison de points de vue & prise de position argumentée (120 à 180 mots attendus)'
                : 'Critères officiels France Éducation International (FEI)'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 5. Rédaction transmise par le candidat / Lecteur Audio */}
      <Card className="bg-white rounded-2xl border border-[#e2e8f0] shadow-sm overflow-hidden">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#e53e3e]" />
              <h2 className="font-heading font-bold text-base sm:text-lg text-[#0d233a]">
                {isEO ? 'Enregistrement audio et transcription' : '✍️ Rédaction rédigée par le candidat'}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRawText(!showRawText)}
              className="text-xs text-[#64748b] hover:text-[#0d233a] gap-1"
            >
              <span>{showRawText ? 'Réduire' : 'Afficher'}</span>
              {showRawText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>

          {/* Audio Player si expression orale */}
          {isEO && submission.file_url && (
            <div className="p-4 rounded-xl bg-[#0d233a] text-white space-y-3 shadow-md">
              <div className="flex items-center justify-between text-xs text-[#b3c8e6]">
                <div className="flex items-center gap-2 font-medium">
                  <Volume2 className="w-4 h-4 text-[#e9a820]" />
                  <span>Enregistrement original du candidat</span>
                </div>
                <span>
                  {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration || 0)}
                </span>
              </div>

              <audio
                ref={audioRef}
                src={submission.file_url}
                onTimeUpdate={handleAudioTimeUpdate}
                onLoadedMetadata={handleAudioLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
                onError={async (e) => {
                  const target = e.currentTarget;
                  if (target.dataset.retried === 'true' || !submission.file_url) return;
                  target.dataset.retried = 'true';
                  const blobUrl = await fetchAudioBlobUrl(submission.file_url);
                  if (blobUrl) {
                    target.src = blobUrl;
                    target.load();
                  }
                }}
                className="hidden"
              >
                <track kind="captions" />
              </audio>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlayAudio}
                  className="w-12 h-12 rounded-full bg-white text-[#0d233a] flex items-center justify-center shrink-0 hover:bg-[#ffdcc3] transition-colors shadow-md"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6 fill-[#0d233a]" />
                  ) : (
                    <Play className="w-6 h-6 fill-[#0d233a] ml-0.5" />
                  )}
                </button>

                {/* Barre de progression waveform simulée */}
                <div className="flex-1 space-y-1">
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#e53e3e] transition-all"
                      style={{
                        width: audioDuration > 0 ? `${(audioCurrentTime / audioDuration) * 100}%` : '0%',
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-[#b3c8e6]">
                    Audio analysé mot à mot par l'IA de transcription spécialisée TCF
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Métadonnées de volume de texte */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748b]">
            <span className="flex items-center gap-1 font-medium">
              <BookOpen className="w-3.5 h-3.5 text-[#0d233a]" />
              {wordCount} mots rédigés
            </span>
            <span className="flex items-center gap-1 text-[#0d233a] font-semibold bg-[#eff4ff] px-2.5 py-0.5 rounded-full">
              <Check className="w-3.5 h-3.5 text-[#16a34a]" />
              Consigne officielle respectée
            </span>
          </div>

          {/* Boîte de texte / Transcription */}
          {showRawText && (
            <div className="p-4 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] text-sm text-[#0d233a] leading-relaxed whitespace-pre-wrap font-sans">
              {submission.raw_text || 'Aucun contenu textuel disponible pour cette épreuve.'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 6. Ce qui est bon */}
      <Card className="bg-white rounded-2xl border border-emerald-200/80 shadow-sm overflow-hidden">
        <div className="bg-emerald-50/80 px-5 sm:px-6 py-3.5 border-b border-emerald-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h2 className="font-heading font-bold text-base sm:text-lg text-emerald-950">
              Ce qui est bon dans votre prestation
            </h2>
          </div>
          <Badge className="bg-emerald-100 text-emerald-800 border-0 text-xs font-bold">
            Points forts validés
          </Badge>
        </div>
        <CardContent className="p-5 sm:p-6 space-y-3">
          <ul className="text-sm text-emerald-950 space-y-2 list-disc list-inside leading-relaxed">
            {((correction as any)?.points_forts || correction?.feedback_par_critere?.points_forts || [
              'Le sujet a été compris et les attentes principales de la consigne sont traitées.',
              'La communication globale est claire et assure la transmission du message.',
              correction?.feedback_par_critere?.developpement_consigne || 'La situation de communication est bien respectée.'
            ]).map((pf: string) => (
              <li key={pf} className="leading-relaxed">{pf}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* 7. Ce qui n'est pas bon */}
      <Card className="bg-white rounded-2xl border border-amber-200/80 shadow-sm overflow-hidden">
        <div className="bg-amber-50/80 px-5 sm:px-6 py-3.5 border-b border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="font-heading font-bold text-base sm:text-lg text-amber-950">
              Ce qui n'est pas bon &amp; Axes d'amélioration
            </h2>
          </div>
          {Array.isArray(correction?.erreurs_et_corrections) && correction.erreurs_et_corrections.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              {correction.erreurs_et_corrections.length} points relevés
            </span>
          )}
        </div>
        <CardContent className="p-5 sm:p-6 space-y-4">
          {/* Points faibles globaux */}
          <ul className="text-sm text-amber-950 space-y-2 list-disc list-inside leading-relaxed">
            {((correction as any)?.points_faibles || correction?.feedback_par_critere?.points_faibles || [
              correction?.feedback_par_critere?.grammaire ? `Grammaire : ${correction.feedback_par_critere.grammaire}` : 'Des maladresses grammaticales et d\'accords ont été relevées.',
              correction?.feedback_par_critere?.coherence_structuration ? `Organisation : ${correction.feedback_par_critere.coherence_structuration}` : 'Le développement de certains paragraphes peut être plus nuancé et étayé.',
              'Certains connecteurs et registres de langue méritent d\'être renforcés pour le palier C1.'
            ]).map((pf: string) => (
              <li key={pf} className="leading-relaxed">{pf}</li>
            ))}
          </ul>

          {/* Erreurs ciblées avec citations de la copie */}
          {Array.isArray(correction?.erreurs_et_corrections) && correction.erreurs_et_corrections.length > 0 && (
            <div className="pt-3 border-t border-amber-200/60 space-y-3">
              <p className="text-xs font-heading font-bold text-amber-950 uppercase tracking-wider">
                Exemples relevés dans votre texte avec corrections :
              </p>
              <div className="space-y-3">
                {correction.erreurs_et_corrections.map((errItem, idx) => (
                  <div
                    key={`${errItem.citation}-${errItem.correction}`}
                    className="p-4 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] space-y-2 hover:border-[#cbd5e1] transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-bold">
                        <span>{idx + 1}.</span> {errItem.categorie || 'Correction'}
                      </span>
                      <span className="text-xs text-red-600 font-medium">À corriger</span>
                    </div>

                    {/* Citation fautive */}
                    <div className="p-2.5 rounded-lg bg-red-50/70 border border-red-200/50 text-xs text-red-900 font-medium">
                      <span className="line-through decoration-red-500 decoration-2">« {errItem.citation} »</span>
                    </div>

                    {/* Suggestion valorisante */}
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>« {errItem.correction} »</span>
                    </div>

                    {/* Règle et explication */}
                    {errItem.explication && (
                      <div className="flex items-start gap-1.5 text-xs text-[#475569] pt-1">
                        <Info className="w-3.5 h-3.5 text-[#0d233a] shrink-0 mt-0.5" />
                        <span><strong>Règle :</strong> {errItem.explication}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 8. Marge de progression */}
      <Card className="bg-[#eff4ff] rounded-2xl border border-[#d3e4fe] shadow-sm overflow-hidden">
        <div className="bg-white/60 px-5 sm:px-6 py-3.5 border-b border-[#d3e4fe] flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#0d233a]" />
          <h2 className="font-heading font-bold text-base sm:text-lg text-[#0d233a]">
            Marge de progression &amp; Priorités d'entraînement
          </h2>
        </div>
        <CardContent className="p-5 sm:p-6 space-y-3">
          <div className="space-y-2">
            <span className="text-xs font-heading font-bold uppercase text-[#0d233a]">Priorités recommandées :</span>
            <ul className="list-disc list-inside text-xs sm:text-sm text-[#475569] space-y-1.5 leading-relaxed">
              {(correction?.plan_progression?.priorites && correction.plan_progression.priorites.length > 0
                ? correction.plan_progression.priorites
                : [
                    'Enrichir les connecteurs logiques pour structurer les paragraphes.',
                    'Varier les temps et modes verbaux pour viser le niveau C1/C2.',
                    'Relire attentivement les accords en genre et en nombre.'
                  ]
              ).map((p: string) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>

          {correction?.plan_progression?.objectif_prochaine_seance && (
            <div className="p-3 bg-white rounded-xl border border-[#d3e4fe] text-xs sm:text-sm text-[#0d233a]">
              🎯 <strong>Objectif séance suivante :</strong> {correction.plan_progression.objectif_prochaine_seance}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 9. La version corrigée et modèle */}
      {correction?.version_amelioree && (
        <Card className="bg-white rounded-2xl border border-purple-200 shadow-sm overflow-hidden bg-gradient-to-b from-purple-50/20 to-white">
          <div className="bg-purple-50/80 px-5 sm:px-6 py-3.5 border-b border-purple-200 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-600" />
            <h2 className="font-heading font-bold text-base sm:text-lg text-purple-950">
              La version corrigée (Modèle idéal C1/C2)
            </h2>
          </div>
          <CardContent className="p-5 sm:p-6 space-y-3">
            <p className="text-xs text-[#475569]">
              Voici une proposition rédigée complète démontrant le niveau attendu au TCF Canada :
            </p>
            <div className="p-4 rounded-xl bg-white border border-purple-200 text-sm text-[#0d233a] leading-relaxed whitespace-pre-wrap font-sans shadow-xs">
              {correction.version_amelioree}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 9. Boutons d'action finaux */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-[#e2e8f0]">
        <Button
          asChild
          variant="outline"
          className="w-full sm:w-auto rounded-xl border-[#e2e8f0] text-[#0d233a] hover:bg-[#eff4ff] font-heading font-semibold"
        >
          <Link to="/etudiant/historique">
            <ArrowLeft className="w-4 h-4 mr-2" /> Retour à la liste
          </Link>
        </Button>

        <Button
          className="w-full sm:w-auto bg-[#e53e3e] hover:bg-[#c53030] text-white rounded-xl shadow-md font-heading font-bold px-8 py-5"
          onClick={() => navigate('/etudiant/entrainement')}
        >
          <RotateCcw className="w-4 h-4 mr-2" /> Refaire un entraînement
        </Button>
      </div>
    </div>
  );
}
