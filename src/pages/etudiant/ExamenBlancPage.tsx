import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, fetchAllQuestions, deduplicateQuestions, isQuestionDuplicate, registerQuestionFingerprints } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getAudioClaritySetting, attachAudioClarityProcessor } from '@/lib/audioProcessing';
import { requestAICorrection, blobToBase64, type CorrectionResponse } from '@/services/aiCorrection';
import AICorrectionLoadingView from '@/components/ai/AICorrectionLoadingView';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Play, Pause, Mic, Square, Clock, ChevronRight,
  Headphones, FileText, PenLine, Loader2, AlertTriangle,
  Lock, CheckCircle2, XCircle, Trophy, RotateCcw, Upload, Info, Maximize2,
  Sparkles, Award, BookOpen,
  HelpCircle, Target, Lightbulb, Timer, Volume2, Laptop, Wifi, ShieldAlert, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useSubscription } from '@/hooks/useSubscription';
import type { Question, Tache, EpreuveType, NiveauCECRL } from '@/types/index';
import {
  EPREUVE_LABELS,
  CECRL_COLORS,
  CECRL_DESCRIPTIONS,
  pctToCECRL,
  scoreEeToCECRL,
  scoreEoToCECRL,
} from '@/types/index';

const EPREUVES_ORDER: EpreuveType[] = ['comprehension_oral', 'comprehension_ecrit', 'expression_ecrite', 'expression_orale'];
const DUREES: Record<EpreuveType, number> = {
  comprehension_oral: 35 * 60,
  comprehension_ecrit: 60 * 60,
  expression_ecrite: 60 * 60,
  expression_orale: 0,
};

// Ordre de difficulté croissante pour le tirage de l'examen blanc
const NIVEAU_ORDER: NiveauCECRL[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Mélange aléatoire (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Sélectionne les 39 questions de l'examen blanc avec :
 * 1. Progression strictement croissante en difficulté : A1 -> A2 -> B1 -> B2 -> C1 -> C2
 * 2. Augmentation ciblée : C1 (+2 = 8 questions) et C2 (+2 = 6 questions)
 * 3. Réduction compensatoire (-1) sur les 4 autres niveaux : A1 (3), A2 (5), B1 (8), B2 (9)
 * 4. Faisabilité temporelle garantie :
 *    - En CO (35 min) : sélection de questions avec pistes audio valides et concises
 *    - En CE (60 min) : calibration de la longueur des textes C1/C2 (<= 1600 caractères)
 * 5. En CO : limitation stricte des questions avec images à 2 questions maximum (A1 Q1-Q2)
 */
function selectExamQuestions(all: Question[], epreuve: EpreuveType, totalLimit: number = 39): Question[] {
  const isCO = epreuve === 'comprehension_oral';
  const hasImage = (q: Question) => Boolean(q.image_url && q.image_url.trim().length > 0);

  // 1. Déduplication intégrale en amont pour éliminer les doublons de la banque
  const deduplicatedAll = deduplicateQuestions(all);

  // Distribution officielle TCF Canada réajustée (Total exact = 39 questions) :
  // A1: 3 | A2: 5 | B1: 8 | B2: 9 | C1: 8 | C2: 6
  const targetQuotas: Record<NiveauCECRL, number> = {
    A1: 3,
    A2: 5,
    B1: 8,
    B2: 9,
    C1: 8,
    C2: 6,
  };

  const poolByLevel: Record<NiveauCECRL, Question[]> = {
    A1: [],
    A2: [],
    B1: [],
    B2: [],
    C1: [],
    C2: [],
  };

  for (const q of deduplicatedAll) {
    const niv = (q.niveau as NiveauCECRL) || 'B1';
    if (poolByLevel[niv]) {
      poolByLevel[niv].push(q);
    } else {
      poolByLevel['B1'].push(q);
    }
  }

  // Critère de faisabilité temporelle :
  // - En CO (35 min pour 39 questions = ~53s par question) : audio valide impératif
  // - En CE (60 min pour 39 questions = ~92s par question) : textes C1/C2 concis (<= 1600 caractères)
  const isTimeFriendly = (q: Question) => {
    if (isCO) {
      return Boolean(q.audio_url && q.audio_url.trim().length > 0);
    }
    const len = (q.texte || '').trim().length;
    if (q.niveau === 'C1' || q.niveau === 'C2') {
      return len <= 1600;
    }
    return true;
  };

  // Mélanger chaque niveau en priorisant les questions calibrées pour le temps imparti
  (Object.keys(poolByLevel) as NiveauCECRL[]).forEach(lvl => {
    const shuffled = shuffle(poolByLevel[lvl]);
    poolByLevel[lvl] = [
      ...shuffled.filter(isTimeFriendly),
      ...shuffled.filter(q => !isTimeFriendly(q)),
    ];
  });

  const selected: Question[] = [];
  const sessionFingerprints = new Set<string>();
  let currentImagesCount = 0;
  const maxImagesCO = 2;

  // Fonction sécurisée pour ajouter une question sans jamais accepter de doublon
  const tryAddQuestion = (q: Question, bypassImageLimit: boolean = false): boolean => {
    if (!q) return false;
    // Vérification absolue anti-doublon (ID, référence, audio, image, choix, texte)
    if (isQuestionDuplicate(q, sessionFingerprints)) return false;
    // En CO : limitation stricte des questions avec images à max 2
    if (isCO && !bypassImageLimit && hasImage(q) && currentImagesCount >= maxImagesCO) return false;

    registerQuestionFingerprints(q, sessionFingerprints);
    selected.push(q);
    if (isCO && hasImage(q)) currentImagesCount++;
    return true;
  };

  // 1. Traitement niveau A1 (quota = 3)
  const a1WithImg = poolByLevel.A1.filter(hasImage);
  const a1WithoutImg = poolByLevel.A1.filter(q => !hasImage(q));

  if (isCO) {
    // En CO : maximum 2 questions avec image (situations photo Q1-Q2 du TCF)
    let imgAdded = 0;
    for (const q of a1WithImg) {
      if (imgAdded >= maxImagesCO || selected.length >= targetQuotas.A1) break;
      if (tryAddQuestion(q)) imgAdded++;
    }
    // Compléter le reste des questions A1 sans image
    for (const q of a1WithoutImg) {
      if (selected.length >= targetQuotas.A1) break;
      tryAddQuestion(q);
    }
  } else {
    for (const q of poolByLevel.A1) {
      if (selected.length >= targetQuotas.A1) break;
      tryAddQuestion(q);
    }
  }

  // 2. Traitement des niveaux suivants (A2: 5, B1: 8, B2: 9, C1: 8, C2: 6)
  const otherLevels: NiveauCECRL[] = ['A2', 'B1', 'B2', 'C1', 'C2'];
  for (const lvl of otherLevels) {
    const targetCount = targetQuotas[lvl];
    const pool = poolByLevel[lvl];
    let levelAdded = 0;

    if (isCO) {
      // En CO, privilégier strictement les questions sans images
      const noImg = pool.filter(q => !hasImage(q));
      const withImg = pool.filter(hasImage);

      for (const q of noImg) {
        if (levelAdded >= targetCount) break;
        if (tryAddQuestion(q)) levelAdded++;
      }
      // Complément si manque dans le vivier sans image et quota image CO non atteint
      if (levelAdded < targetCount && currentImagesCount < maxImagesCO) {
        for (const q of withImg) {
          if (levelAdded >= targetCount || currentImagesCount >= maxImagesCO) break;
          if (tryAddQuestion(q)) levelAdded++;
        }
      }
    } else {
      for (const q of pool) {
        if (levelAdded >= targetCount) break;
        if (tryAddQuestion(q)) levelAdded++;
      }
    }
  }

  // 3. Filet de sécurité si la banque est restreinte (sans JAMAIS autoriser de doublon)
  if (selected.length < totalLimit) {
    const shuffledBank = shuffle(deduplicatedAll);
    // Première passe : respect de la contrainte d'image
    for (const q of shuffledBank) {
      if (selected.length >= totalLimit) break;
      tryAddQuestion(q, false);
    }
    // Seconde passe (si banque locale ultra-réduite) : toujours sans doublon
    if (selected.length < totalLimit) {
      for (const q of shuffledBank) {
        if (selected.length >= totalLimit) break;
        tryAddQuestion(q, true);
      }
    }
  } else if (selected.length > totalLimit) {
    selected.length = totalLimit;
  }

  // 4. Tri strict par difficulté croissante
  const levelRank: Record<string, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
  selected.sort((a, b) => {
    const diff = (levelRank[a.niveau || 'B1'] || 3) - (levelRank[b.niveau || 'B1'] || 3);
    if (diff !== 0) return diff;
    // En CO au sein de A1, placer les questions avec image en tout début (Q1 et Q2)
    if (isCO) {
      const aImg = hasImage(a) ? 0 : 1;
      const bImg = hasImage(b) ? 0 : 1;
      return aImg - bImg;
    }
    return 0;
  });

  return selected;
}

const CECRL_LEVELS_SCALE: NiveauCECRL[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function CecrlTrack({ currentNiveau }: { currentNiveau: NiveauCECRL }) {
  return (
    <div className="space-y-1 pt-1.5">
      <div className="grid grid-cols-6 gap-1 text-[11px] text-center font-bold">
        {CECRL_LEVELS_SCALE.map(lvl => {
          const isCurrent = lvl === currentNiveau;
          return (
            <div
              key={lvl}
              className={`py-1 rounded-md transition-all text-center ${
                isCurrent
                  ? 'text-white shadow-xs font-black ring-2 ring-offset-1 ring-slate-400 scale-105'
                  : 'bg-slate-100 text-slate-400 font-medium'
              }`}
              style={isCurrent ? { backgroundColor: CECRL_COLORS[lvl] } : undefined}
            >
              {lvl}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getNCLCLevel(epreuve: EpreuveType, score699: number, note20?: number | null): string {
  if (epreuve === 'comprehension_oral') {
    if (score699 >= 549) return 'NCLC 10+';
    if (score699 >= 523) return 'NCLC 9';
    if (score699 >= 503) return 'NCLC 8';
    if (score699 >= 458) return 'NCLC 7';
    if (score699 >= 398) return 'NCLC 6';
    if (score699 >= 369) return 'NCLC 5';
    if (score699 >= 331) return 'NCLC 4';
    return '< NCLC 4';
  }
  if (epreuve === 'comprehension_ecrit') {
    if (score699 >= 549) return 'NCLC 10+';
    if (score699 >= 524) return 'NCLC 9';
    if (score699 >= 499) return 'NCLC 8';
    if (score699 >= 453) return 'NCLC 7';
    if (score699 >= 406) return 'NCLC 6';
    if (score699 >= 375) return 'NCLC 5';
    if (score699 >= 342) return 'NCLC 4';
    return '< NCLC 4';
  }
  const n = note20 !== undefined && note20 !== null ? note20 : ((score699 / 699) * 20);
  if (n >= 16) return 'NCLC 10+';
  if (n >= 14) return 'NCLC 9';
  if (n >= 12) return 'NCLC 8';
  if (n >= 10) return 'NCLC 7';
  if (n >= 7) return 'NCLC 6';
  if (n >= 6) return 'NCLC 5';
  if (n >= 4) return 'NCLC 4';
  return '< NCLC 4';
}

interface ParsedTacheEO {
  titre?: string;
  sujet: string;
  consignes: string[];
  conseilExaminateur?: string;
}

function parseConsigneEO(rawConsigne: string, numeroTache: number): ParsedTacheEO {
  const conseilParDefaut = numeroTache === 1
    ? "Parlez à un rythme régulier, sans précipitation ni hésitation prolongée. Présentez des faits réels ou vos motivations avec un vocabulaire riche et des temps précis."
    : "Ne vous contentez pas d'un avis simpliste (oui/non). Adoptez une démarche équilibrée : exposez d'abord les arguments pour et contre, puis défendez votre synthèse avec des exemples concrets tirés de la vie canadienne ou quotidienne.";

  if (!rawConsigne || !rawConsigne.trim()) {
    return {
      sujet: numeroTache === 1
        ? "Présentez-vous et parlez de votre parcours, de votre quotidien ou de vos projets d'immigration au Canada."
        : "Donnez votre avis argumenté sur un thème de société contemporain.",
      consignes: [
        `Durée recommandée : ${numeroTache === 1 ? 'environ 2 minutes' : 'environ 4 minutes 30'} sans préparation.`,
        'Structurez votre discours avec des connecteurs logiques.',
        'Illustrez vos propos avec des arguments clairs.',
      ],
      conseilExaminateur: conseilParDefaut,
    };
  }

  const text = rawConsigne.trim();

  // 1. Extraire le titre éventuel du type "Tâche X — ..."
  let cleanText = text;
  let titre: string | undefined;
  const headerMatch = text.match(/^([^\n]*Tâche\s*\d[^\n]*)\n+([\s\S]*)$/i);
  if (headerMatch) {
    titre = headerMatch[1].trim();
    cleanText = headerMatch[2].trim();
  }

  // 2. Chercher les sections explicites "Sujet :" et "Consignes :"
  const sujetSectionMatch = cleanText.match(/(?:^|\n)\s*Sujet\s*:\s*([\s\S]*?)(?=(?:\n\s*Consignes?\s*:|$))/i);
  const consignesSectionMatch = cleanText.match(/(?:^|\n)\s*Consignes?\s*:\s*([\s\S]*)$/i);

  if (sujetSectionMatch && consignesSectionMatch) {
    const rawSujet = sujetSectionMatch[1].trim();
    const rawConsignes = consignesSectionMatch[1].trim();
    const parsedConsignes = rawConsignes
      .split('\n')
      .map(l => l.replace(/^[•\-\*]\s*/, '').trim())
      .filter(l => l.length > 0);

    return {
      titre,
      sujet: rawSujet,
      consignes: parsedConsignes.length > 0 ? parsedConsignes : [rawConsignes],
      conseilExaminateur: conseilParDefaut,
    };
  }

  // 3. Découpage par double saut de ligne
  const paragraphs = cleanText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length >= 2) {
    const sujet = paragraphs[0];
    const consignesList = paragraphs.slice(1).flatMap(p =>
      p.split('\n').map(l => l.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean)
    );
    return {
      titre,
      sujet,
      consignes: consignesList.length > 0 ? consignesList : [paragraphs[1]],
      conseilExaminateur: conseilParDefaut,
    };
  }

  // 4. Découpage par directive finale dans le texte
  const sentences = cleanText.split(/(?<=[.?!])\s+/);
  if (sentences.length >= 2) {
    const lastSentence = sentences[sentences.length - 1];
    const isDirective = /développez|présentez|donnez|expliquez|argumentez|comparez|parlez/i.test(lastSentence);
    if (isDirective) {
      return {
        titre,
        sujet: sentences.slice(0, -1).join(' '),
        consignes: [
          lastSentence,
          `Durée de l'exposé : ${numeroTache === 1 ? 'environ 2 minutes' : 'environ 4 minutes 30'} sans préparation.`,
        ],
        conseilExaminateur: conseilParDefaut,
      };
    }
  }

  // 5. Cas général par défaut
  return {
    titre,
    sujet: cleanText,
    consignes: numeroTache === 1
      ? [
          "Parlez de manière spontanée et naturelle pendant environ 2 minutes.",
          "Fournissez des détails précis sur vos expériences, vos choix et vos projets.",
          "Structurez vos phrases avec des temps variés (passé, présent, futur).",
        ]
      : [
          "Présentez votre point de vue de manière structurée et argumentée (environ 4 min 30).",
          "Dégagez les aspects positifs et négatifs du sujet avant de défendre votre position personnelle.",
          "Illustrez chaque argument par des exemples concrets tirés de l'actualité ou de votre expérience.",
        ],
    conseilExaminateur: conseilParDefaut,
  };
}

function TimerBig({ seconds, total }: { seconds: number; total: number }) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  const pct = total > 0 ? (seconds / total) * 100 : 100;
  const isLow = seconds < 60;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`text-4xl font-mono font-bold ${isLow ? 'text-destructive' : 'text-foreground'}`}>
        {mins}:{secs}
      </div>
      <Progress value={pct} className={`h-2 w-48 ${isLow ? '[&>div]:bg-destructive' : ''}`} />
    </div>
  );
}

function AudioPlayerSimple({ url }: { url: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!url) return;
    let isMounted = true;
    const initClarity = async () => {
      const isClarityEnabled = await getAudioClaritySetting();
      if (!isMounted || !ref.current) return;
      attachAudioClarityProcessor(ref.current, isClarityEnabled);
    };
    initClarity();
    return () => {
      isMounted = false;
    };
  }, [url]);

  const handlePlay = async () => {
    const isClarityEnabled = await getAudioClaritySetting();
    if (ref.current) {
      attachAudioClarityProcessor(ref.current, isClarityEnabled);
    }
    setPlaying(true);
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
      <button
        type="button"
        onClick={() => {
          if (ref.current) {
            if (playing) {
              ref.current.pause();
            } else {
              ref.current.play();
            }
            setPlaying(!playing);
          }
        }}
        className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground shrink-0"
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <span className="text-sm text-muted-foreground">Audio de la question</span>
      <audio
        ref={ref}
        src={url}
        autoPlay
        crossOrigin="anonymous"
        onPlay={handlePlay}
        onEnded={() => setPlaying(false)}
      >
        <track kind="captions" />
      </audio>
    </div>
  );
}

interface QcmResult {
  epreuve: EpreuveType;
  questions: Question[];
  reponses: Record<string, string>; // question.id → choix.id
  correct: number;
  total: number;
}

export default function ExamenBlancPage() {
  const { user, isAdmin } = useAuth();
  const { abonnement, hasActiveSubscription, loading: subLoading, refreshSubscription } = useSubscription();
  const navigate = useNavigate();

  // Gate : vérifier si l'examen blanc est activé pour cet étudiant
  const [gateChecking, setGateChecking] = useState(true);
  const [profileExamActif, setProfileExamActif] = useState(false);

  // Correction 4 — Reprise d'examen interrompu
  const [resumeModal, setResumeModal] = useState(false);
  const [existingSessionId, setExistingSessionId] = useState<string | null>(null);
  const [existingEpreuve, setExistingEpreuve] = useState<EpreuveType | null>(null);
  const [abandonLoading, setAbandonLoading] = useState(false);
  const [confirmStartModal, setConfirmStartModal] = useState(false);

  const [phase, setPhase] = useState<'intro' | 'exam' | 'qcm_results' | 'finished'>('intro');
  const [epreuveIdx, setEpreuveIdx] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [finalScoreGlobal, setFinalScoreGlobal] = useState<number | null>(null);
  const [finalNiveauCECRL, setFinalNiveauCECRL] = useState<NiveauCECRL | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [taches, setTaches] = useState<Tache[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [texteReponses, setTexteReponses] = useState<Record<number, string>>({});
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [loading, setLoading] = useState(false);
  // Résultats QCM pour les 2 premières épreuves
  const [qcmResults, setQcmResults] = useState<QcmResult[]>([]);
  // Audio recording — Correction 2 : blobs conservés pour retry
  const [recording, setRecording] = useState(false);
  const [audioBlobs, setAudioBlobs] = useState<Record<number, Blob>>({});
  const [taskTimer, setTaskTimer] = useState(0);
  const [taskTimerActive, setTaskTimerActive] = useState(false);
  const [currentTaskIdx, setCurrentTaskIdx] = useState(0);
  // Correction 2 — Upload progress + échecs avec retry
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [failedUploads, setFailedUploads] = useState<Record<number, boolean>>({});
  const [retrying, setRetrying] = useState<Record<number, boolean>>({});
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);

  // Suivi des épreuves d'expression & corrections IA
  const [eeTaches, setEeTaches] = useState<Tache[]>([]);
  const [eeProductionIds, setEeProductionIds] = useState<Record<number, string>>({});
  const [eoTaches, setEoTaches] = useState<Tache[]>([]);
  const [eoProductionIds, setEoProductionIds] = useState<Record<number, string>>({});
  const [eoAudioUrls, setEoAudioUrls] = useState<Record<number, string>>({});

  // Résultats des corrections IA
  const [aiEvaluating, setAiEvaluating] = useState(false);
  const [aiStep, setAiStep] = useState<string>('');
  const [aiProgressTarget, setAiProgressTarget] = useState<number>(10);
  const [eeCorrections, setEeCorrections] = useState<Record<number, CorrectionResponse>>({});
  const [eoCorrections, setEoCorrections] = useState<Record<number, CorrectionResponse>>({});

  // Notes définitives
  const [scoreCOState, setScoreCOState] = useState<number | null>(null);
  const [scoreCEState, setScoreCEState] = useState<number | null>(null);
  const [scoreEE, setScoreEE] = useState<number | null>(null);
  const [noteEE20, setNoteEE20] = useState<number | null>(null);
  const [scoreEO, setScoreEO] = useState<number | null>(null);
  const [noteEO20, setNoteEO20] = useState<number | null>(null);
  const [detailModalTask, setDetailModalTask] = useState<{
    type: 'ee' | 'eo';
    tacheNum: number;
    correction: CorrectionResponse;
    consigne?: string;
    texte?: string;
  } | null>(null);

  const currentEpreuve = EPREUVES_ORDER[epreuveIdx];
  const quotaDeductedRef = useRef(false);
  const handleEpreuveEndRef = useRef<() => void>(() => {});
  const stopRecordingRef = useRef<() => void>(() => {});

  // Quota d'examens blancs restants
  const quotaRestant = isAdmin 
    ? 999 
    : (abonnement?.quota_examen_blanc_restant ?? 0);

  const canAccessExam = isAdmin || profileExamActif || (hasActiveSubscription && quotaRestant > 0);

  // Vérification du profil et du droit d'accès
  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('examen_blanc_actif')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfileExamActif(data?.examen_blanc_actif === true);
        setGateChecking(false);
      });
  }, [user]);

  // Correction 1 : signaler qu'un examen est en cours via sessionStorage
  useEffect(() => {
    if (phase === 'exam') {
      sessionStorage.setItem('exam_en_cours', 'true');
    } else {
      sessionStorage.removeItem('exam_en_cours');
    }
    return () => { sessionStorage.removeItem('exam_en_cours'); };
  }, [phase]);

  useEffect(() => {
    if (!timerActive) return;
    if (timer <= 0) { handleEpreuveEndRef.current(); return; }
    const t = setInterval(() => setTimer(s => s > 0 ? s - 1 : 0), 1000);
    return () => clearInterval(t);
  }, [timerActive, timer]);

  useEffect(() => {
    if (!taskTimerActive) return;
    if (taskTimer <= 0) { stopRecordingRef.current(); return; }
    const t = setInterval(() => setTaskTimer(s => s > 0 ? s - 1 : 0), 1000);
    return () => clearInterval(t);
  }, [taskTimerActive, taskTimer]);

  const finalizeExam = async (
    sessId: string,
    currentEOProds?: Record<number, string>,
    currentEOUrls?: Record<number, string>,
    currentEOTachesList?: Tache[]
  ) => {
    setAiEvaluating(true);
    setAiProgressTarget(12);
    setAiStep("Initialisation de l'évaluation complète par notre IA certifiée...");

    try {
      // 1. Récupérer les productions de la session en base de données pour assurer la liaison
      const { data: dbProds } = await supabase
        .from('productions')
        .select('*')
        .eq('session_id', sessId);

      const eeResultsMap: Record<number, CorrectionResponse> = {};
      const eoResultsMap: Record<number, CorrectionResponse> = {};
      const eeNotes: number[] = [];
      const eoNotes: number[] = [];

      // 2. Correction IA pour l'Expression Écrite (Tâches 1, 2, 3)
      let effectiveEETaches = eeTaches.length > 0 ? [...eeTaches] : [];
      if (effectiveEETaches.length === 0 && dbProds) {
        const eeProds = dbProds.filter(p => p.epreuve === 'expression_ecrite');
        for (const p of eeProds) {
          const { data: tData } = await supabase
            .from('taches')
            .select('*')
            .eq('epreuve', 'expression_ecrite')
            .eq('numero_tache', p.numero_tache)
            .maybeSingle();
          if (tData) effectiveEETaches.push(tData);
        }
      }

      const activeEOTaches = (currentEOTachesList && currentEOTachesList.length > 0)
        ? currentEOTachesList
        : eoTaches;
      let effectiveEOTaches = [...activeEOTaches];
      if (effectiveEOTaches.length === 0 && dbProds) {
        const eoProds = dbProds.filter(p => p.epreuve === 'expression_orale');
        for (const p of eoProds) {
          const { data: tData } = await supabase
            .from('taches')
            .select('*')
            .eq('epreuve', 'expression_orale')
            .eq('numero_tache', p.numero_tache)
            .maybeSingle();
          if (tData) effectiveEOTaches.push(tData);
        }
      }

      const totalAiTasks = Math.max(1, effectiveEETaches.length + effectiveEOTaches.length);
      let completedAiTasks = 0;
      const bumpTaskProgress = () => {
        completedAiTasks += 1;
        setAiProgressTarget(Math.min(92, Math.round(15 + (completedAiTasks / totalAiTasks) * 77)));
      };

      setAiProgressTarget(18);

      for (const tache of effectiveEETaches) {
        const prod = dbProds?.find(p => p.epreuve === 'expression_ecrite' && p.numero_tache === tache.numero_tache);
        const text = (texteReponses[tache.numero_tache] || prod?.contenu_texte || '').trim();
        const prodId = prod?.id || eeProductionIds[tache.numero_tache];

        if (text && text.length > 5) {
          setAiStep(`Évaluation IA en cours : Expression Écrite — Tâche ${tache.numero_tache} sur 3...`);
          try {
            const resp = await requestAICorrection({
              task_type: `EE_tache${tache.numero_tache}` as any,
              consigne: tache.consigne,
              raw_text: text,
              reference: tache.reference || undefined,
              session_id: sessId,
              production_id: prodId,
            });
            if (resp?.correction) {
              eeResultsMap[tache.numero_tache] = resp;
              if (typeof resp.correction.total === 'number') {
                eeNotes.push(resp.correction.total);
              }
            }
          } catch (errEE) {
            console.error(`Erreur correction IA EE Tâche ${tache.numero_tache}:`, errEE);
          }
        }
        bumpTaskProgress();
      }

      // 3. Correction IA pour l'Expression Orale (Tâches 1, 3)
      for (const tache of effectiveEOTaches) {
        const prod = dbProds?.find(p => p.epreuve === 'expression_orale' && p.numero_tache === tache.numero_tache);
        const blob = audioBlobs[tache.numero_tache];
        const audioUrl = currentEOUrls?.[tache.numero_tache] || eoAudioUrls[tache.numero_tache] || prod?.audio_url;
        const prodId = prod?.id || currentEOProds?.[tache.numero_tache] || eoProductionIds[tache.numero_tache];

        if (blob || audioUrl) {
          setAiStep(`Transcription & notation IA : Expression Orale — Tâche ${tache.numero_tache}...`);
          try {
            let base64Audio: string | undefined = undefined;
            if (blob) {
              base64Audio = await blobToBase64(blob);
            }
            const resp = await requestAICorrection({
              task_type: `EO_tache${tache.numero_tache}` as any,
              consigne: tache.consigne,
              audio_base64: base64Audio,
              audio_url: audioUrl || undefined,
              mime_type: blob?.type || 'audio/webm',
              reference: tache.reference || undefined,
              session_id: sessId,
              production_id: prodId,
            });
            if (resp?.correction) {
              eoResultsMap[tache.numero_tache] = resp;
              if (typeof resp.correction.total === 'number') {
                eoNotes.push(resp.correction.total);
              }
            }
          } catch (errEO) {
            console.error(`Erreur correction IA EO Tâche ${tache.numero_tache}:`, errEO);
          }
        }
        bumpTaskProgress();
      }

      setAiProgressTarget(95);
      setEeCorrections(eeResultsMap);
      setEoCorrections(eoResultsMap);

      // 4. Calcul des scores définitifs sur 699 pour l'ensemble des 4 épreuves
      const coRes = qcmResults.find(r => r.epreuve === 'comprehension_oral');
      const ceRes = qcmResults.find(r => r.epreuve === 'comprehension_ecrit');

      let dbScoreOral: number | null = null;
      let dbScoreEcrit: number | null = null;
      if (!coRes || !ceRes) {
        const { data: sessScores } = await supabase
          .from('sessions_examen')
          .select('score_oral, score_ecrit')
          .eq('id', sessId)
          .maybeSingle();
        if (sessScores) {
          dbScoreOral = sessScores.score_oral;
          dbScoreEcrit = sessScores.score_ecrit;
        }
      }

      const scoreOral = coRes && coRes.total > 0
        ? Math.round((coRes.correct / coRes.total) * 699)
        : (scoreCOState ?? dbScoreOral ?? 0);
      const scoreEcrit = ceRes && ceRes.total > 0
        ? Math.round((ceRes.correct / ceRes.total) * 699)
        : (scoreCEState ?? dbScoreEcrit ?? 0);

      const expectedEECount = Math.max(effectiveEETaches.length, 3);
      const calcNoteEE = eeNotes.length > 0
        ? Number((eeNotes.reduce((a, b) => a + b, 0) / expectedEECount).toFixed(1))
        : 0;
      const calcScoreEE = Math.round((calcNoteEE / 20) * 699);

      const expectedEOCount = Math.max(effectiveEOTaches.length, 2);
      const calcNoteEO = eoNotes.length > 0
        ? Number((eoNotes.reduce((a, b) => a + b, 0) / expectedEOCount).toFixed(1))
        : 0;
      const calcScoreEO = Math.round((calcNoteEO / 20) * 699);

      const scoreGlobalCombine = Math.round((scoreOral + scoreEcrit + calcScoreEE + calcScoreEO) / 4);
      const niveauCombine = pctToCECRL(Math.round((scoreGlobalCombine / 699) * 100));

      setScoreCOState(scoreOral);
      setScoreCEState(scoreEcrit);
      setFinalScoreGlobal(scoreGlobalCombine);
      setFinalNiveauCECRL(niveauCombine);
      setScoreEE(calcScoreEE);
      setNoteEE20(calcNoteEE);
      setScoreEO(calcScoreEO);
      setNoteEO20(calcNoteEO);

      // 5. Mettre à jour sessions_examen avec tous les scores complets
      await supabase
        .from('sessions_examen')
        .update({
          statut: 'termine',
          termine_at: new Date().toISOString(),
          score_oral: scoreOral,
          score_ecrit: scoreEcrit,
          score_expression_ecrite: calcScoreEE,
          score_expression_orale: calcScoreEO,
          score_global: scoreGlobalCombine,
          niveau_cecrl: niveauCombine,
          correction_complete: true,
        })
        .eq('id', sessId);

      // 6. Décrémenter le quota si cela n'a pas encore été fait lors de cette session
      if (!isAdmin && !quotaDeductedRef.current) {
        try {
          const { data: rpcRes, error: rpcErr } = await supabase.rpc('consommer_quota_examen_blanc', {
            p_user_id: user!.id,
          });
          if (rpcErr || !rpcRes?.success) {
            if (abonnement?.id) {
              const currentQuota = abonnement.quota_examen_blanc_restant ?? 0;
              await supabase
                .from('abonnements')
                .update({ quota_examen_blanc_restant: Math.max(0, currentQuota - 1) })
                .eq('id', abonnement.id);
            }
          }
          quotaDeductedRef.current = true;
        } catch (e) {
          console.warn('Erreur décompte quota finalizeExam:', e);
        }
      }
      await refreshSubscription();

      // 7. Insérer une notification dans la table notifications
      try {
        await supabase.from('notifications').insert({
          utilisateur_id: user!.id,
          titre: 'Examen blanc terminé & corrigé par IA ! 🎉',
          message: `Félicitations, vous avez complété votre examen blanc TCF Canada. Vos 4 épreuves sont notées : ${scoreGlobalCombine} pts (${niveauCombine}).`,
          lien: '/etudiant/historique',
        });
      } catch (notifErr) {
        console.warn('Erreur notification examen blanc:', notifErr);
      }
    } catch (globalErr) {
      console.error('Erreur globale correction IA examen blanc:', globalErr);
      toast.error("La correction automatique a finalisé la session.");
    } finally {
      setAiEvaluating(false);
      setAiStep('');
      setAiProgressTarget(10);
    }
  };

  // Correction 4 — Vérifier si une session en cours existe avant de démarrer
  const handleStartExamClick = async () => {
    if (!user) return;
    if (!canAccessExam || (!isAdmin && quotaRestant <= 0 && !profileExamActif)) {
      toast.error("Votre quota d'examens blancs est épuisé. Veuillez mettre à niveau votre formule.");
      navigate('/etudiant/abonnement');
      return;
    }

    const { data: existing } = await supabase
      .from('sessions_examen')
      .select('id, epreuve_actuelle')
      .eq('etudiant_id', user.id)
      .eq('mode', 'examen_blanc')
      .eq('statut', 'en_cours')
      .maybeSingle();

    if (existing) {
      setExistingSessionId(existing.id);
      setExistingEpreuve(existing.epreuve_actuelle);
      setResumeModal(true);
    } else {
      setConfirmStartModal(true);
    }
  };

  const handleResumeExam = async () => {
    if (!existingSessionId || !existingEpreuve) return;
    setResumeModal(false);
    setLoading(true);
    quotaDeductedRef.current = true; // Déjà décompté lors de l'initialisation de la session
    const idx = EPREUVES_ORDER.indexOf(existingEpreuve);
    const resumeIdx = idx >= 0 ? idx : 0;
    setSessionId(existingSessionId);
    setEpreuveIdx(resumeIdx);
    await loadEpreuve(resumeIdx);
    setPhase('exam');
    setLoading(false);
  };

  const handleAbandonAndRestart = async () => {
    if (!existingSessionId) return;
    setAbandonLoading(true);
    await supabase
      .from('sessions_examen')
      .update({ statut: 'abandonne' })
      .eq('id', existingSessionId);
    setExistingSessionId(null);
    setExistingEpreuve(null);
    setResumeModal(false);
    setAbandonLoading(false);
    quotaDeductedRef.current = false;
    setConfirmStartModal(true);
  };

  const handleConfirmAndStartExam = async () => {
    setConfirmStartModal(false);
    await startExam();
  };

  const startExam = async () => {
    if (!user) return;
    setLoading(true);

    // 1. Décrémentation atomique et persistante du quota d'examen blanc
    if (!isAdmin) {
      try {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('consommer_quota_examen_blanc', {
          p_user_id: user.id,
        });

        if (rpcErr || !rpcRes?.success) {
          // Fallback avec decrement_user_quota
          const { error: decErr } = await supabase.rpc('decrement_user_quota', {
            p_user_id: user.id,
            p_type: 'examen_blanc',
          });

          // Fallback direct update sur abonnements
          if (decErr && abonnement?.id) {
            const currentQuota = abonnement.quota_examen_blanc_restant ?? 0;
            await supabase
              .from('abonnements')
              .update({ quota_examen_blanc_restant: Math.max(0, currentQuota - 1) })
              .eq('id', abonnement.id);
          }
        }
        quotaDeductedRef.current = true;
      } catch (err) {
        console.warn('Erreur décompte quota examen blanc:', err);
      }
      await refreshSubscription();
    }

    // 2. Création de la session d'examen
    const { data: session } = await supabase.from('sessions_examen').insert({
      etudiant_id: user.id, mode: 'examen_blanc',
      epreuve_actuelle: EPREUVES_ORDER[0], statut: 'en_cours',
    }).select().maybeSingle();
    setSessionId(session?.id || null);
    await loadEpreuve(0);
    setPhase('exam');
    setLoading(false);
  };

  const loadEpreuve = async (idx: number) => {
    const epreuve = EPREUVES_ORDER[idx];
    setCurrentQ(0);
    setReponses({});
    setTimer(DUREES[epreuve]);
    setTimerActive(epreuve !== 'expression_orale');

    if (epreuve === 'expression_ecrite' || epreuve === 'expression_orale') {
      const requiredNums = epreuve === 'expression_ecrite' ? [1, 2, 3] : [1, 3];
      const selectedTaches: Tache[] = [];

      for (const num of requiredNums) {
        const { data: pool } = await supabase
          .from('taches')
          .select('*')
          .eq('epreuve', epreuve)
          .eq('numero_tache', num)
          .eq('actif', true);

        if (Array.isArray(pool) && pool.length > 0) {
          const randomIndex = Math.floor(Math.random() * pool.length);
          selectedTaches.push(pool[randomIndex]);
        }
      }

      setTaches(selectedTaches);
      if (epreuve === 'expression_ecrite') {
        setEeTaches(selectedTaches);
      } else if (epreuve === 'expression_orale') {
        setEoTaches(selectedTaches);
      }

      if (epreuve === 'expression_orale' && selectedTaches.length > 0) {
        setCurrentTaskIdx(0);
        setTaskTimer(selectedTaches[0].duree_secondes || 120);
      }
    } else {
      // Tirage ordonné par difficulté croissante (A1->C2, C1/C2 renforcés) & max 2 images en CO
      const all = await fetchAllQuestions<Question>(epreuve);
      const limit = 39;
      setQuestions(selectExamQuestions(all, epreuve, limit));
    }
  };

  const handleEpreuveEnd = async () => {
    setTimerActive(false);
    setTaskTimerActive(false);
    if (recording) await stopRecording();

    // Si on termine l'expression orale, router vers submitOrale
    if (currentEpreuve === 'expression_orale') {
      await submitOrale();
      return;
    }

    // Sauvegarder & calculer QCM
    if ((currentEpreuve === 'comprehension_oral' || currentEpreuve === 'comprehension_ecrit') && sessionId) {
      const reps = questions.map(q => ({
        session_id: sessionId,
        question_id: q.id,
        reponse_choisie: reponses[q.id] || null,
        est_correcte: reponses[q.id] === q.bonne_reponse,
      }));
      if (reps.length > 0) await supabase.from('reponses_qcm').insert(reps);

      const correct = questions.filter(q => reponses[q.id] === q.bonne_reponse).length;
      setQcmResults(prev => [...prev, {
        epreuve: currentEpreuve,
        questions,
        reponses,
        correct,
        total: questions.length,
      }]);

      // Mettre à jour le score QCM dans la session
      const scoreField = currentEpreuve === 'comprehension_oral' ? 'score_oral' : 'score_ecrit';
      const scoreSur699 = questions.length > 0 ? Math.round((correct / questions.length) * 699) : 0;
      if (currentEpreuve === 'comprehension_oral') {
        setScoreCOState(scoreSur699);
      } else {
        setScoreCEState(scoreSur699);
      }
      if (sessionId) {
        await supabase.from('sessions_examen').update({ [scoreField]: scoreSur699 }).eq('id', sessionId);
      }
    }

    // Sauvegarder expression écrite
    if (currentEpreuve === 'expression_ecrite' && sessionId) {
      const dureeEE = DUREES['expression_ecrite'] - timer;
      const { data: attribution } = await supabase.from('attributions').select('professeur_id').eq('etudiant_id', user!.id).maybeSingle();
      const prods: Record<number, string> = {};
      for (const tache of taches) {
        if (!texteReponses[tache.numero_tache]?.trim()) continue;
        const { data: newProd } = await supabase.from('productions').insert({
          session_id: sessionId, etudiant_id: user!.id, epreuve: 'expression_ecrite',
          numero_tache: tache.numero_tache, reference: tache.reference || null,
          contenu_texte: texteReponses[tache.numero_tache],
          statut_correction: 'en_attente', professeur_id: attribution?.professeur_id || null,
        }).select().maybeSingle();
        if (newProd?.id) {
          prods[tache.numero_tache] = newProd.id;
        }
      }
      setEeProductionIds(prods);
      setEeTaches([...taches]);
      // Enregistrer la durée passée sur l'épreuve
      await supabase.from('sessions_examen')
        .update({ duree_expression_ecrite: dureeEE > 0 ? dureeEE : null })
        .eq('id', sessionId);
    }

    if (epreuveIdx < EPREUVES_ORDER.length - 1) {
      const nextIdx = epreuveIdx + 1;
      if (sessionId) {
        await supabase
          .from('sessions_examen')
          .update({ epreuve_actuelle: EPREUVES_ORDER[nextIdx] })
          .eq('id', sessionId);
      }
      setEpreuveIdx(nextIdx);
      await loadEpreuve(nextIdx);
    } else {
      if (sessionId) {
        await finalizeExam(sessionId);
      }
      setPhase('finished');
    }
  };

  const startRecording = async (tache: Tache) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Correction 2 — codec Opus 32 kbps : réduit la taille à ~2-4 MB pour 4 min
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const mr = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlobs(prev => ({ ...prev, [tache.numero_tache]: blob }));
        // Effacer l'échec précédent si l'étudiant ré-enregistre
        setFailedUploads(prev => { const n = { ...prev }; delete n[tache.numero_tache]; return n; });
        stream.getTracks().forEach(t => { t.stop(); });
      };
      mr.start(1000); // chunks d'1 seconde
      mediaRecorderRef.current = mr;
      setRecording(true);
      setTaskTimer(tache.duree_secondes || 120);
      setTaskTimerActive(true);
    } catch {
      toast.error("Impossible d'accéder au microphone.");
    }
  };

  const stopRecording = async () => {
    setRecording(false);
    setTaskTimerActive(false);
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
  };

  handleEpreuveEndRef.current = handleEpreuveEnd;
  stopRecordingRef.current = stopRecording;

  // Correction 2 — Upload d'un seul blob avec progress + retry sans redemander l'enregistrement
  const uploadAudioBlob = async (tacheNum: number, blob: Blob): Promise<string | null> => {
    if (!sessionId || !user) return null;
    const fileName = `audio/${user.id}/${sessionId}/tache_${tacheNum}.webm`;
    setUploadProgress(prev => ({ ...prev, [tacheNum]: 0 }));
    const { data: uploaded, error: uploadError } = await supabase.storage
      .from('productions-audio')
      .upload(fileName, blob, { upsert: true, contentType: 'audio/webm' });
    if (uploaded) {
      setUploadProgress(prev => ({ ...prev, [tacheNum]: 100 }));
      setFailedUploads(prev => { const n = { ...prev }; delete n[tacheNum]; return n; });
      const { data: urlData } = supabase.storage.from('productions-audio').getPublicUrl(fileName);
      return urlData.publicUrl;
    } else {
      console.error(`Erreur upload audio tâche ${tacheNum}:`, uploadError?.message);
      setFailedUploads(prev => ({ ...prev, [tacheNum]: true }));
      setUploadProgress(prev => { const n = { ...prev }; delete n[tacheNum]; return n; });
      return null;
    }
  };

  // Correction 2 — Réessayer un upload sans perdre l'enregistrement
  const retryUpload = async (tacheNum: number) => {
    const blob = audioBlobs[tacheNum];
    if (!blob) { toast.error("Enregistrement introuvable. Veuillez ré-enregistrer."); return; }
    setRetrying(prev => ({ ...prev, [tacheNum]: true }));
    const url = await uploadAudioBlob(tacheNum, blob);
    setRetrying(prev => ({ ...prev, [tacheNum]: false }));
    if (url) {
      toast.success(`Tâche ${tacheNum} : audio envoyé avec succès.`);
    } else {
      toast.error(`Tâche ${tacheNum} : échec du renvoi. Réessayez dans quelques secondes.`);
    }
  };

  const submitOrale = async () => {
    if (!sessionId || !user) return;
    setLoading(true);
    const { data: attribution } = await supabase.from('attributions').select('professeur_id').eq('etudiant_id', user.id).maybeSingle();

    const prods: Record<number, string> = {};
    const urls: Record<number, string> = {};

    for (const tache of taches) {
      const blob = audioBlobs[tache.numero_tache];
      let audioUrl: string | null = null;
      if (blob) {
        audioUrl = await uploadAudioBlob(tache.numero_tache, blob);
        if (!audioUrl) {
          toast.error(`Tâche ${tache.numero_tache} : upload échoué. Utilisez "Réessayer" pour renvoyer l'audio.`);
        } else {
          urls[tache.numero_tache] = audioUrl;
        }
      }
      const { data: newProd } = await supabase.from('productions').insert({
        session_id: sessionId, etudiant_id: user.id, epreuve: 'expression_orale',
        numero_tache: tache.numero_tache, reference: tache.reference || null, audio_url: audioUrl,
        statut_correction: 'en_attente', professeur_id: attribution?.professeur_id || null,
      }).select().maybeSingle();
      if (newProd?.id) {
        prods[tache.numero_tache] = newProd.id;
      }
    }

    setEoProductionIds(prods);
    setEoAudioUrls(urls);
    setEoTaches([...taches]);

    if (sessionId) {
      await finalizeExam(sessionId, prods, urls, taches);
    }
    setLoading(false);
    setPhase('finished');
  };

  // ─── Évaluation IA en direct (Overlay de finalisation) ──────────────────────
  if (aiEvaluating) {
    return (
      <AICorrectionLoadingView
        step={aiStep}
        isOral={true}
        mode="examen_blanc"
        externalProgress={aiProgressTarget}
      />
    );
  }

  // ─── Gate : chargement ───────────────────────────────────────────────────────
  if (gateChecking || subLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── Gate : accès refusé / quota épuisé ───────────────────────────────────────
  if (!canAccessExam) {
    return (
      <div className="max-w-lg mx-auto text-center space-y-6 py-12 fade-in">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-sm">
          <Lock className="w-8 h-8 text-amber-700" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-heading font-extrabold text-[#0d233a] tracking-tight">
            Quota d'examens blancs épuisé
          </h1>
          <p className="text-sm text-[#475569] leading-relaxed max-w-md mx-auto">
            Vous ne disposez plus de simulation d'examen blanc complète sur votre formule actuelle.
            Passez à la formule supérieure pour débloquer de nouveaux examens chronométrés avec correction certifiée FEI.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#d3e4fe] text-left text-xs space-y-2">
          <p className="font-heading font-bold text-[#0d233a]">
            Ce qu'inclut un examen blanc complet :
          </p>
          <ul className="space-y-1.5 text-[#475569]">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0d233a]" />
              Enchaînement réel des 4 épreuves : CE (60m), CO (35m), EE (60m), EO (12m)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0d233a]" />
              Double évaluation IA experte et retour formateur certifié
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0d233a]" />
              Rapport complet de points NCLC pour l'immigration canadienne (IRCC)
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button
            onClick={() => navigate('/etudiant/abonnement')}
            className="bg-[#cf7100] hover:bg-[#b05f00] text-white font-heading font-bold px-6 shadow-sm"
          >
            Mettre à niveau ma formule
          </Button>
          <Button variant="outline" onClick={() => navigate('/etudiant')}>
            Retour au tableau de bord
          </Button>
        </div>
      </div>
    );
  }

  // ─── Résultats QCM immédiats (après CO + CE) ─────────────────────────────────
  if (phase === 'qcm_results') {
    return (
      <div className="max-w-3xl mx-auto space-y-6 fade-in">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-balance">Résultats QCM</h1>
          <p className="text-muted-foreground text-pretty">
            Résultats des épreuves de compréhension — en attente de la correction des expressions par votre professeur.
          </p>
        </div>

        {qcmResults.map(result => {
          const pct = Math.round((result.correct / result.total) * 100);
          const niveau = pctToCECRL(pct);
          const niveauColor = CECRL_COLORS[niveau];
          const niveauDesc = CECRL_DESCRIPTIONS[niveau];
          return (
            <Card key={result.epreuve} className="h-full">
              <CardHeader>
                <CardTitle className="text-base text-balance flex items-center gap-2">
                  {result.epreuve === 'comprehension_oral' ? <Headphones className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  {EPREUVE_LABELS[result.epreuve]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Les 3 indicateurs */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-primary leading-tight">
                      {result.correct}<span className="text-sm text-muted-foreground font-normal">/{result.total}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Bonnes réponses</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-foreground leading-tight">
                      {pct}<span className="text-sm text-muted-foreground font-normal">%</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Taux de réussite</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold leading-tight" style={{ color: niveauColor }}>{niveau}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{niveauDesc}</p>
                  </div>
                </div>
                {/* Barre de progression CECRL */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>A1</span><span>A2</span><span>B1</span><span>B2</span><span>C1</span><span>C2</span>
                  </div>
                  <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: niveauColor }} />
                  </div>
                  <p className="text-xs font-medium text-center" style={{ color: niveauColor }}>
                    Niveau estimé : <strong>{niveau}</strong> — {niveauDesc}
                  </p>
                </div>
                {/* Détail par question */}
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {result.questions.map((q, i) => {
                    const given = result.reponses[q.id];
                    const isCorrect = given === q.bonne_reponse;
                    const correctLabel = q.choix?.find(c => c.id === q.bonne_reponse)?.texte;
                    return (
                      <div key={q.id} className={`flex items-start gap-2 p-2 rounded-md text-xs ${isCorrect ? 'bg-success/5' : 'bg-destructive/5'}`}>
                        {isCorrect
                          ? <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
                          : <XCircle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-foreground truncate">Q{i + 1}{q.niveau ? ` (${q.niveau})` : ''} — {q.texte?.slice(0, 60) || '(audio/image)'}</p>
                          {!isCorrect && (
                            <p className="text-destructive">Bonne réponse : {q.bonne_reponse}. {correctLabel}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Alert className="border-primary/30 bg-primary/5">
          <AlertTriangle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-pretty">
            Les résultats définitifs (Expression Écrite et Expression Orale) seront disponibles après correction par votre professeur.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/etudiant')} className="w-full">
          Retour au tableau de bord
        </Button>
      </div>
    );
  }

  // ─── Fin d'examen ─────────────────────────────────────────────────────────────
  if (phase === 'finished') {
    const ceRes = qcmResults.find(r => r.epreuve === 'comprehension_ecrit');
    const coRes = qcmResults.find(r => r.epreuve === 'comprehension_oral');

    const scoreCE = ceRes && ceRes.total > 0
      ? Math.round((ceRes.correct / ceRes.total) * 699)
      : (scoreCEState ?? 0);
    const cePct = ceRes && ceRes.total > 0
      ? Math.round((ceRes.correct / ceRes.total) * 100)
      : Math.round((scoreCE / 699) * 100);
    const ceNiveau = pctToCECRL(cePct);
    const ceNclc = getNCLCLevel('comprehension_ecrit', scoreCE);

    const scoreCO = coRes && coRes.total > 0
      ? Math.round((coRes.correct / coRes.total) * 699)
      : (scoreCOState ?? 0);
    const coPct = coRes && coRes.total > 0
      ? Math.round((coRes.correct / coRes.total) * 100)
      : Math.round((scoreCO / 699) * 100);
    const coNiveau = pctToCECRL(coPct);
    const coNclc = getNCLCLevel('comprehension_oral', scoreCO);

    const scoreEEPts = scoreEE ?? 0;
    const noteEE = noteEE20 !== null ? noteEE20 : Number(((scoreEEPts / 699) * 20).toFixed(1));
    const eeNiveau = scoreEeToCECRL(noteEE);
    const eeNclc = getNCLCLevel('expression_ecrite', scoreEEPts, noteEE);

    const scoreEOPts = scoreEO ?? 0;
    const noteEO = noteEO20 !== null ? noteEO20 : Number(((scoreEOPts / 699) * 20).toFixed(1));
    const eoNiveau = scoreEoToCECRL(noteEO);
    const eoNclc = getNCLCLevel('expression_orale', scoreEOPts, noteEO);

    const scoreAffiche = finalScoreGlobal ?? Math.round((scoreCE + scoreCO + scoreEEPts + scoreEOPts) / 4);
    const niveauAffiche = finalNiveauCECRL || pctToCECRL(Math.round((scoreAffiche / 699) * 100));
    const nclcAffiche = scoreAffiche >= 530 ? 'NCLC 9+' : scoreAffiche >= 450 ? 'NCLC 7-8' : scoreAffiche >= 400 ? 'NCLC 7' : 'NCLC 6';

    return (
      <div className="max-w-3xl mx-auto space-y-6 py-8 fade-in">
        {/* Hero Card Résultat Global Combiné */}
        <div className="bg-[#0d233a] rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl space-y-6">
          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center sm:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs border border-white/20 text-xs font-semibold text-white/90">
                <Trophy className="w-3.5 h-3.5 text-amber-300" />
                <span>Simulation Complète TCF Canada Validée & Notée</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold tracking-tight">
                Examen blanc terminé !
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md">
                Vos 4 épreuves officielles sont corrigées : QCM automatiques pour les compréhensions et double grille officielle par l'IA pour vos expressions.
              </p>
            </div>

            {/* Pastille Score Global */}
            <div className="shrink-0 text-center bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 min-w-[160px]">
              <span className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">
                Score Global TCF
              </span>
              <p className="font-heading font-extrabold text-3xl sm:text-4xl text-amber-300 leading-tight">
                {scoreAffiche}
              </p>
              <p className="text-xs text-slate-300">sur 699 points</p>
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                {niveauAffiche} • {nclcAffiche}
              </div>
            </div>
          </div>

          {/* Décompte du quota */}
          <div className="relative z-10 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <span>
              {isAdmin
                ? '👑 Mode Administrateur (Quota illimité)'
                : `⚡ 1 examen blanc décompté — Quota restant : ${quotaRestant}`}
            </span>
            <span className="text-emerald-300 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Toutes vos notes sont enregistrées et synchronisées avec votre espace
            </span>
          </div>
        </div>

        {/* Synthèse officielle des 4 épreuves : Niveau CECRL & Note TCF */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="font-heading font-bold text-base text-[#0d233a] flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                Niveau CECRL certifié de chaque épreuve
              </h2>
              <p className="text-xs text-slate-500">
                Synthèse officielle conforme au Cadre Européen Commun de Référence pour les Langues (CECRL) et NCLC
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold text-slate-600 shrink-0">
              Grille officielle TCF Canada
            </Badge>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. Compréhension Orale */}
            <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100 flex flex-col items-center text-center space-y-2 hover:shadow-xs transition-shadow">
              <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <Headphones className="w-3.5 h-3.5 text-purple-600" />
                Compr. Orale
              </span>
              <div
                className="w-full py-1.5 rounded-xl font-heading font-black text-white text-base shadow-xs"
                style={{ backgroundColor: CECRL_COLORS[coNiveau] }}
              >
                Niveau {coNiveau}
              </div>
              <p className="text-[11px] font-semibold text-slate-600">
                {CECRL_DESCRIPTIONS[coNiveau]} • {coNclc}
              </p>
              <div className="pt-1.5 border-t border-purple-200/60 w-full text-xs">
                <span className="font-heading font-black text-[#0d233a] text-sm">{scoreCO}</span>
                <span className="text-[10px] text-slate-500"> / 699 pts</span>
              </div>
            </div>

            {/* 2. Compréhension Écrite */}
            <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-100 flex flex-col items-center text-center space-y-2 hover:shadow-xs transition-shadow">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Compr. Écrite
              </span>
              <div
                className="w-full py-1.5 rounded-xl font-heading font-black text-white text-base shadow-xs"
                style={{ backgroundColor: CECRL_COLORS[ceNiveau] }}
              >
                Niveau {ceNiveau}
              </div>
              <p className="text-[11px] font-semibold text-slate-600">
                {CECRL_DESCRIPTIONS[ceNiveau]} • {ceNclc}
              </p>
              <div className="pt-1.5 border-t border-blue-200/60 w-full text-xs">
                <span className="font-heading font-black text-[#0d233a] text-sm">{scoreCE}</span>
                <span className="text-[10px] text-slate-500"> / 699 pts</span>
              </div>
            </div>

            {/* 3. Expression Écrite */}
            <div className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100 flex flex-col items-center text-center space-y-2 hover:shadow-xs transition-shadow">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <PenLine className="w-3.5 h-3.5 text-[#cf7100]" />
                Expr. Écrite
              </span>
              <div
                className="w-full py-1.5 rounded-xl font-heading font-black text-white text-base shadow-xs"
                style={{ backgroundColor: CECRL_COLORS[eeNiveau] }}
              >
                Niveau {eeNiveau}
              </div>
              <p className="text-[11px] font-semibold text-slate-600">
                {CECRL_DESCRIPTIONS[eeNiveau]} • {eeNclc}
              </p>
              <div className="pt-1.5 border-t border-amber-200/60 w-full text-xs">
                <span className="font-heading font-black text-[#0d233a] text-sm">{scoreEEPts}</span>
                <span className="text-[10px] text-slate-500"> / 699 ({noteEE.toFixed(1)}/20)</span>
              </div>
            </div>

            {/* 4. Expression Orale */}
            <div className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-100 flex flex-col items-center text-center space-y-2 hover:shadow-xs transition-shadow">
              <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-[#b51822]" />
                Expr. Orale
              </span>
              <div
                className="w-full py-1.5 rounded-xl font-heading font-black text-white text-base shadow-xs"
                style={{ backgroundColor: CECRL_COLORS[eoNiveau] }}
              >
                Niveau {eoNiveau}
              </div>
              <p className="text-[11px] font-semibold text-slate-600">
                {CECRL_DESCRIPTIONS[eoNiveau]} • {eoNclc}
              </p>
              <div className="pt-1.5 border-t border-rose-200/60 w-full text-xs">
                <span className="font-heading font-black text-[#0d233a] text-sm">{scoreEOPts}</span>
                <span className="text-[10px] text-slate-500"> / 699 ({noteEO.toFixed(1)}/20)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Détail des 4 épreuves avec jauge CECRL */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-base text-[#0d233a]">
              Détail & Grille d'évaluation des 4 épreuves
            </h2>
            <Badge variant="outline" className="text-xs font-medium text-slate-600">
              Barème officiel FEI sur 699 points
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Compréhension Orale */}
            <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs space-y-3.5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-sm text-[#0d233a] flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-purple-600" />
                  Compréhension Orale
                </span>
                <Badge
                  style={{ backgroundColor: CECRL_COLORS[coNiveau], color: '#ffffff' }}
                  className="font-heading font-extrabold text-xs px-2.5 py-0.5 shadow-xs border-0"
                >
                  Niveau {coNiveau} • {CECRL_DESCRIPTIONS[coNiveau]}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-[#475569] pt-0.5">
                <span>
                  Score TCF : <strong className="text-sm font-heading font-black text-[#0d233a]">{scoreCO}</strong> / 699 pts
                </span>
                <Badge variant="secondary" className="font-semibold text-slate-700">
                  {coNclc}
                </Badge>
              </div>
              <div className="text-xs text-[#475569]">
                {coRes ? (
                  <span>Réponses correctes : <strong>{coRes.correct} / {coRes.total}</strong> ({coPct}%)</span>
                ) : (
                  <span>Épreuve validée</span>
                )}
              </div>
              <Progress value={coPct} className="h-1.5" />
              <CecrlTrack currentNiveau={coNiveau} />
            </div>

            {/* 2. Compréhension Écrite */}
            <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs space-y-3.5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-sm text-[#0d233a] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Compréhension Écrite
                </span>
                <Badge
                  style={{ backgroundColor: CECRL_COLORS[ceNiveau], color: '#ffffff' }}
                  className="font-heading font-extrabold text-xs px-2.5 py-0.5 shadow-xs border-0"
                >
                  Niveau {ceNiveau} • {CECRL_DESCRIPTIONS[ceNiveau]}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-[#475569] pt-0.5">
                <span>
                  Score TCF : <strong className="text-sm font-heading font-black text-[#0d233a]">{scoreCE}</strong> / 699 pts
                </span>
                <Badge variant="secondary" className="font-semibold text-slate-700">
                  {ceNclc}
                </Badge>
              </div>
              <div className="text-xs text-[#475569]">
                {ceRes ? (
                  <span>Réponses correctes : <strong>{ceRes.correct} / {ceRes.total}</strong> ({cePct}%)</span>
                ) : (
                  <span>Épreuve validée</span>
                )}
              </div>
              <Progress value={cePct} className="h-1.5" />
              <CecrlTrack currentNiveau={ceNiveau} />
            </div>

            {/* 3. Expression Écrite */}
            <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs space-y-3.5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-sm text-[#0d233a] flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-[#cf7100]" />
                  Expression Écrite
                </span>
                <Badge
                  style={{ backgroundColor: CECRL_COLORS[eeNiveau], color: '#ffffff' }}
                  className="font-heading font-extrabold text-xs px-2.5 py-0.5 shadow-xs border-0"
                >
                  Niveau {eeNiveau} • {CECRL_DESCRIPTIONS[eeNiveau]}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-[#475569] pt-0.5">
                <span>
                  Score TCF : <strong className="text-sm font-heading font-black text-[#0d233a]">{scoreEEPts}</strong> / 699 pts
                </span>
                <Badge variant="secondary" className="font-semibold text-slate-700">
                  Note : {noteEE.toFixed(1)} / 20 • {eeNclc}
                </Badge>
              </div>
              <Progress value={((scoreEEPts) / 699) * 100} className="h-1.5" />
              <CecrlTrack currentNiveau={eeNiveau} />

              {/* Tâches corrigées par IA */}
              <div className="pt-1 space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Détail par tâche (Évalué par IA) :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3].map(num => {
                    const corr = eeCorrections[num];
                    const tache = eeTaches.find(t => t.numero_tache === num);
                    if (!corr) {
                      return (
                        <span key={num} className="text-[11px] text-slate-400 px-2 py-0.5 rounded bg-slate-50 border border-slate-200">
                          Tâche {num} (Non évaluée)
                        </span>
                      );
                    }
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setDetailModalTask({
                          type: 'ee',
                          tacheNum: num,
                          correction: corr,
                          consigne: tache?.consigne,
                          texte: texteReponses[num],
                        })}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#cf7100] bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Tâche {num} : {corr.correction?.total ?? 0}/20 ({corr.correction?.niveau_cecrl || '—'})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. Expression Orale */}
            <div className="p-5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs space-y-3.5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-sm text-[#0d233a] flex items-center gap-2">
                  <Mic className="w-4 h-4 text-[#b51822]" />
                  Expression Orale
                </span>
                <Badge
                  style={{ backgroundColor: CECRL_COLORS[eoNiveau], color: '#ffffff' }}
                  className="font-heading font-extrabold text-xs px-2.5 py-0.5 shadow-xs border-0"
                >
                  Niveau {eoNiveau} • {CECRL_DESCRIPTIONS[eoNiveau]}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-[#475569] pt-0.5">
                <span>
                  Score TCF : <strong className="text-sm font-heading font-black text-[#0d233a]">{scoreEOPts}</strong> / 699 pts
                </span>
                <Badge variant="secondary" className="font-semibold text-slate-700">
                  Note : {noteEO.toFixed(1)} / 20 • {eoNclc}
                </Badge>
              </div>
              <Progress value={((scoreEOPts) / 699) * 100} className="h-1.5" />
              <CecrlTrack currentNiveau={eoNiveau} />

              {/* Tâches corrigées par IA */}
              <div className="pt-1 space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Détail par tâche (Évalué par IA) :
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 3].map(num => {
                    const corr = eoCorrections[num];
                    const tache = eoTaches.find(t => t.numero_tache === num);
                    if (!corr) {
                      return (
                        <span key={num} className="text-[11px] text-slate-400 px-2 py-0.5 rounded bg-slate-50 border border-slate-200">
                          Tâche {num} (Non évaluée)
                        </span>
                      );
                    }
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setDetailModalTask({
                          type: 'eo',
                          tacheNum: num,
                          correction: corr,
                          consigne: tache?.consigne,
                        })}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#b51822] bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Tâche {num} : {corr.correction?.total ?? 0}/20 ({corr.correction?.niveau_cecrl || '—'})
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal de détail de correction IA */}
        <Dialog open={!!detailModalTask} onOpenChange={open => !open && setDetailModalTask(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6 space-y-4">
            {detailModalTask && (
              <>
                <DialogHeader className="space-y-1 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Badge className={detailModalTask.type === 'ee' ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-rose-100 text-rose-900 border-rose-200'}>
                      {detailModalTask.type === 'ee' ? 'Expression Écrite' : 'Expression Orale'}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium">Tâche {detailModalTask.tacheNum}</span>
                  </div>
                  <DialogTitle className="text-xl font-heading font-extrabold text-[#0d233a] flex items-center justify-between">
                    <span>Grille d'évaluation officielle IA</span>
                    <span className="text-primary text-2xl font-mono font-bold">
                      {detailModalTask.correction.correction?.total ?? 0} / 20
                    </span>
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground">
                    Niveau CECRL certifié : <strong className="text-primary font-bold">{detailModalTask.correction.correction?.niveau_cecrl || '—'}</strong>
                  </p>
                </DialogHeader>

                {/* Consigne */}
                {detailModalTask.consigne && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <p className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Consigne officielle :</p>
                    <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{detailModalTask.consigne}</p>
                  </div>
                )}

                {/* Texte ou transcription */}
                {(detailModalTask.texte || detailModalTask.correction.submission?.raw_text) && (
                  <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/60 space-y-1">
                    <p className="text-[11px] font-bold uppercase text-amber-800 tracking-wider">
                      {detailModalTask.type === 'ee' ? 'Votre rédaction soumise :' : 'Transcription de votre prestation orale :'}
                    </p>
                    <p className="text-xs text-slate-800 leading-relaxed italic">
                      "{detailModalTask.texte || detailModalTask.correction.submission?.raw_text}"
                    </p>
                  </div>
                )}

                {/* Dimensions de notation */}
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase text-slate-500 tracking-wider">Notes par dimension :</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* Linguistique */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                      <p className="text-xs font-bold text-slate-700">Linguistique</p>
                      <p className="text-lg font-bold text-primary">
                        {detailModalTask.correction.correction?.evaluation?.note_linguistique?.total ?? '—'} / 7
                      </p>
                      <p className="text-[10px] text-muted-foreground">Vocabulaire & Grammaire</p>
                    </div>
                    {/* Pragmatique */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                      <p className="text-xs font-bold text-slate-700">Pragmatique</p>
                      <p className="text-lg font-bold text-primary">
                        {detailModalTask.correction.correction?.evaluation?.note_pragmatique?.total ?? '—'} / 7
                      </p>
                      <p className="text-[10px] text-muted-foreground">Logique & Consigne</p>
                    </div>
                    {/* Sociolinguistique */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                      <p className="text-xs font-bold text-slate-700">Sociolinguistique</p>
                      <p className="text-lg font-bold text-primary">
                        {detailModalTask.correction.correction?.evaluation?.note_sociolinguistique?.total ?? '—'} / 6
                      </p>
                      <p className="text-[10px] text-muted-foreground">Registre & Situation</p>
                    </div>
                  </div>
                </div>

                {/* Feedback & Appréciation */}
                {detailModalTask.correction.correction?.evaluation?.appreciation_generale && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <p className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">Appréciation globale de l'évaluateur :</p>
                    <p className="text-xs text-slate-800 leading-relaxed">
                      {detailModalTask.correction.correction.evaluation.appreciation_generale}
                    </p>
                  </div>
                )}

                {/* Points forts & Points à améliorer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {detailModalTask.correction.correction?.evaluation?.points_forts && detailModalTask.correction.correction.evaluation.points_forts.length > 0 && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1.5 text-xs text-emerald-900">
                      <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Points forts :
                      </p>
                      <ul className="space-y-1 list-disc list-inside">
                        {detailModalTask.correction.correction.evaluation.points_forts.map((pt) => (
                          <li key={pt}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detailModalTask.correction.correction?.evaluation?.points_faibles && detailModalTask.correction.correction.evaluation.points_faibles.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5 text-xs text-amber-900">
                      <p className="font-bold flex items-center gap-1.5 text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Axes d'amélioration :
                      </p>
                      <ul className="space-y-1 list-disc list-inside">
                        {detailModalTask.correction.correction.evaluation.points_faibles.map((pt) => (
                          <li key={pt}>{pt}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Version améliorée */}
                {detailModalTask.correction.correction?.evaluation?.version_amelioree && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 space-y-1">
                    <p className="text-[11px] font-bold uppercase text-blue-800 tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-blue-600" />
                      Proposition de version améliorée (Niveau C1) :
                    </p>
                    <p className="text-xs text-slate-800 leading-relaxed italic whitespace-pre-wrap">
                      "{detailModalTask.correction.correction.evaluation.version_amelioree}"
                    </p>
                  </div>
                )}

                <DialogFooter>
                  <Button onClick={() => setDetailModalTask(null)} className="w-full sm:w-auto">
                    Fermer la fiche
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Boutons d'action */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            onClick={() => navigate('/etudiant/historique')}
            className="flex-1 bg-[#0d233a] hover:bg-[#1a365d] text-white font-heading font-bold py-5 shadow-sm cursor-pointer"
          >
            Consulter l'historique complet de mes examens
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate('/etudiant')}
            className="sm:w-auto font-heading font-semibold cursor-pointer"
          >
            Retour au tableau de bord
          </Button>
        </div>
      </div>
    );
  }

  // ─── Phase intro ─────────────────────────────────────────────────────────────
  if (phase === 'intro') return (
    <div className="max-w-3xl mx-auto space-y-6 fade-in pb-10">
      {/* Correction 4 — Modale reprise d'examen interrompu */}
      <Dialog open={resumeModal} onOpenChange={setResumeModal}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-balance">Examen blanc en cours</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-pretty">
            Tu as un examen blanc en cours
            {existingEpreuve ? ` (arrêté à l'épreuve : ${EPREUVE_LABELS[existingEpreuve]})` : ''}.
            Veux-tu le reprendre là où tu t'es arrêté ?
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleAbandonAndRestart}
              disabled={abandonLoading}
              className="w-full sm:w-auto"
            >
              {abandonLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Abandonner et recommencer
            </Button>
            <Button onClick={handleResumeExam} className="w-full sm:w-auto">
              Reprendre l'examen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modale de confirmation des dispositions avant le début de l'examen */}
      <Dialog open={confirmStartModal} onOpenChange={setConfirmStartModal}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading font-extrabold text-[#0d233a] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#e53e3e]" />
              Êtes-vous bien dans les bonnes dispositions ?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-[#475569] leading-relaxed">
              Vous allez démarrer la <strong className="text-[#0d233a]">simulation officielle complète du TCF Canada</strong>. 
              Les 4 épreuves s'enchaînent de manière continue sans pause officielle pour une durée totale d'environ <strong className="text-[#e53e3e]">2 heures et 45 minutes</strong>.
            </p>

            <div className="rounded-xl bg-[#fff8f0] border border-[#ffddb0] p-3.5 space-y-2.5">
              <p className="text-xs font-heading font-bold text-[#b55d00] uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Vérifications indispensables avant le lancement :
              </p>
              <ul className="space-y-2 text-xs text-[#6e3900]">
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 font-bold" />
                  <span><strong>Disponibilité ininterrompue :</strong> J'ai bien dégagé au moins 2h30 à 2h45 de temps libre sans aucune interruption prévue.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 font-bold" />
                  <span><strong>Environnement calme :</strong> Je suis isolé(e) dans une pièce silencieuse et mon téléphone est en silencieux.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 font-bold" />
                  <span><strong>Équipement prêt :</strong> Mon casque/mes écouteurs sont branchés (audio à écoute unique) et mon microphone est opérationnel.</span>
                </li>
              </ul>
            </div>

            <p className="text-[11px] text-[#64748b] italic">
              ⚡ Dès que vous confirmerez, le premier chronomètre (Compréhension Orale : 35 min) démarrera immédiatement et 1 crédit d'examen blanc sera activé.
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setConfirmStartModal(false)}
              className="w-full sm:w-auto font-medium"
            >
              Pas maintenant, revenir plus tard
            </Button>
            <Button
              onClick={handleConfirmAndStartExam}
              disabled={loading}
              className="w-full sm:w-auto bg-[#e53e3e] hover:bg-[#c53030] text-white font-heading font-bold shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Lancement...
                </>
              ) : (
                "Je suis prêt(e), démarrer l'épreuve 1"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* En-tête de la page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold mb-2">
            <Trophy className="w-3.5 h-3.5 text-amber-600" />
            <span>Conditions officielles TCF Canada (France Éducation International)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a] text-balance">
            Examen Blanc Complet TCF Canada
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-1">
            Simulation intégrale en 4 épreuves consécutives chronométrées avec notation officielle
          </p>
        </div>

        {/* Badge Quota Restant */}
        <Badge
          className={`shrink-0 text-xs font-bold px-3 py-1.5 border-0 ${
            isAdmin
              ? 'bg-purple-100 text-purple-900'
              : quotaRestant > 0
              ? 'bg-[#ffdcc3] text-[#6e3900]'
              : 'bg-red-100 text-red-900'
          }`}
        >
          {isAdmin
            ? '👑 Accès Illimité (Admin)'
            : `🎯 Quota restant : ${quotaRestant} examen${quotaRestant > 1 ? 's' : ''} blanc${quotaRestant > 1 ? 's' : ''}`}
        </Badge>
      </div>

      {/* BANDEAU MAJEUR : Dégager du temps & Enchaînement des 4 épreuves */}
      <div className="rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <Timer className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-heading font-extrabold text-base sm:text-lg text-[#0d233a]">
                Prévoyez au moins 2h45 de temps libre ininterrompu
              </span>
              <Badge className="bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold">
                Suite continue de 4 épreuves
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-[#475569] leading-relaxed">
              L'examen blanc est une <strong>simulation réelle en continu</strong>. Il enchaîne consécutivement les <strong>4 épreuves officielles</strong> du TCF Canada sans pause. 
              Une fois lancé, les chronomètres s'écoulent en temps réel et votre tentative est décomptée.
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-amber-200/70 text-xs text-amber-900 font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Conseil capital :</strong> Ne démarrez pas cet examen si vous ne disposez que de 30 ou 45 minutes devant vous. Dégagez un créneau complet pour aller au bout de l'évaluation.
          </span>
        </div>
      </div>

      {/* GUIDE : Se mettre dans les bonnes dispositions */}
      <Card className="border-[#e2e8f0] shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base sm:text-lg text-[#0d233a] flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            Avant de cliquer sur Commencer : Vos dispositions indispensables
          </CardTitle>
          <p className="text-xs text-[#64748b]">
            Respectez ces 4 consignes clés pour reproduire fidèlement l'ambiance d'un centre d'examen officiel et maximiser vos points NCLC.
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Disposition 1 : Temps */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center gap-2 text-[#0d233a] font-heading font-bold text-sm">
                <Clock className="w-4 h-4 text-[#e53e3e]" />
                <span>1. Bloquez ~2h45 consécutives</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                Les 4 épreuves s'enchaînent sans pause. Ne commencez pas si vous avez des obligations ou des rendez-vous imminents.
              </p>
            </div>

            {/* Disposition 2 : Calme */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center gap-2 text-[#0d233a] font-heading font-bold text-sm">
                <Volume2 className="w-4 h-4 text-[#0d233a]" />
                <span>2. Isolez-vous dans le calme</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                Pièce fermée sans passage. Mettez votre téléphone en mode silencieux et désactivez toute notification distrayante.
              </p>
            </div>

            {/* Disposition 3 : Casque & Micro */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center gap-2 text-[#0d233a] font-heading font-bold text-sm">
                <Headphones className="w-4 h-4 text-[#cf7100]" />
                <span>3. Casque audio & Microphone</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                <strong>Casque/écouteurs obligatoires</strong> pour la Compréhension Orale (écoute unique) et <strong>microphone fonctionnel</strong> pour l'Expression Orale.
              </p>
            </div>

            {/* Disposition 4 : Ordinateur & Connexion */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center gap-2 text-[#0d233a] font-heading font-bold text-sm">
                <Laptop className="w-4 h-4 text-emerald-700" />
                <span>4. Ordinateur & Connexion stable</span>
              </div>
              <p className="text-xs text-[#475569] leading-relaxed">
                Privilégiez un ordinateur avec clavier physique pour taper confortablement vos 3 rédactions écrites (60 min).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DÉROULEMENT DES 4 ÉPREUVES */}
      <Card className="border-[#e2e8f0] shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base text-[#0d233a] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              L'enchaînement des 4 épreuves officielles
            </CardTitle>
            <Badge variant="outline" className="text-xs font-mono font-semibold text-[#0d233a] bg-slate-50 border-slate-300">
              Durée totale cumulée : ~2h47
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {EPREUVES_ORDER.map((ep, i) => (
            <div key={ep} className="flex items-center gap-3 p-3 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0]/70 hover:border-primary/30 transition-colors">
              <Badge className="bg-[#0d233a] text-white w-7 h-7 rounded-full flex items-center justify-center p-0 shrink-0 font-bold text-xs shadow-xs">
                {i + 1}
              </Badge>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="font-heading font-bold text-sm text-[#0d233a]">{EPREUVE_LABELS[ep]}</p>
                  <span className="text-xs font-mono font-semibold text-[#e53e3e] bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                    {ep === 'comprehension_oral' && '35 min'}
                    {ep === 'comprehension_ecrit' && '60 min'}
                    {ep === 'expression_ecrite' && '60 min'}
                    {ep === 'expression_orale' && '~12 min'}
                  </span>
                </div>
                <p className="text-xs text-[#475569] mt-0.5">
                  {ep === 'comprehension_oral' && '39 questions QCM audio à écoute unique — Tirage par difficulté croissante'}
                  {ep === 'comprehension_ecrit' && '39 questions QCM avec documents écrits — Tirage par difficulté croissante'}
                  {ep === 'expression_ecrite' && '3 tâches de rédaction chronométrées — Évaluation par double grille officielle (IA & Professeur)'}
                  {ep === 'expression_orale' && 'Tâche 1 (2 min) + Tâche 3 (4 min 30s) enregistrées au micro (Tâche 2 interaction réservée avec professeur)'}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* BOUTON D'ACTION PRINCIPAL AVEC AVERTISSEMENT */}
      <div className="space-y-2 pt-2">
        <Button
          size="lg"
          className="w-full bg-[#e53e3e] hover:bg-[#c53030] text-white font-heading font-bold py-6 rounded-xl shadow-md text-base transition-all cursor-pointer"
          onClick={handleStartExamClick}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Préparation de votre session d'examen...
            </>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Play className="w-5 h-5 fill-current" />
              Je suis prêt(e) — Commencer l'examen blanc (~2h45)
            </span>
          )}
        </Button>
        <p className="text-center text-[11px] text-[#64748b]">
          En cliquant, vous validerez vos dispositions préalables avant le lancement immédiat du premier chronomètre (Compréhension Orale).
        </p>
      </div>
    </div>
  );

  // ─── Phase examen ─────────────────────────────────────────────────────────────
  const epreuveLabel = EPREUVE_LABELS[currentEpreuve];

  // Expression orale
  if (currentEpreuve === 'expression_orale') {
    const tache = taches[currentTaskIdx];
    const isLastTask = currentTaskIdx === taches.length - 1;
    return (
      <div className="max-w-2xl mx-auto space-y-6 fade-in">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm text-muted-foreground">Épreuve {epreuveIdx + 1}/4</p>
            <h1 className="text-xl font-bold text-foreground text-balance">{epreuveLabel}</h1>
          </div>
          {taskTimerActive && tache && <TimerBig seconds={taskTimer} total={tache.duree_secondes || 120} />}
        </div>
      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <AlertDescription className="text-pretty text-sm text-foreground">
          <span className="font-semibold">La Tâche 2 n'est pas incluse dans cet exercice.</span>{' '}
          Il s'agit d'un exercice en interaction avec un examinateur, qui ne peut pas être simulé en autonomie.
          Seules les <strong>Tâches 1 et 3</strong> sont pratiquées ici.
        </AlertDescription>
      </Alert>
      {tache && (() => {
        const parsed = parseConsigneEO(tache.consigne, tache.numero_tache);
        const dureeLabel = tache.duree_secondes
          ? `${Math.floor(tache.duree_secondes / 60)} min${tache.duree_secondes % 60 > 0 ? ` ${tache.duree_secondes % 60}s` : ''}`
          : tache.numero_tache === 1 ? 'environ 2 min' : 'environ 4 min 30';

        return (
          <Card className="h-full border border-slate-200 shadow-sm overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-[#b51822] text-white font-heading font-bold text-xs px-2.5 py-0.5 shadow-xs">
                      Tâche {tache.numero_tache}
                    </Badge>
                    <span className="font-heading font-extrabold text-base text-[#0d233a]">
                      {tache.numero_tache === 1 ? 'Entretien dirigé (sans préparation)' : 'Expression d\'un point de vue (sans préparation)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {tache.numero_tache === 1
                      ? 'L\'examinateur vous interroge sur votre parcours, vos expériences ou votre quotidien.'
                      : 'Présentez votre point de vue argumenté puis nuancez votre position.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-semibold text-slate-700 bg-white flex items-center gap-1 border-slate-300">
                    <Clock className="w-3.5 h-3.5 text-[#b51822]" />
                    {dureeLabel}
                  </Badge>
                  {tache.reference && (
                    <Badge variant="secondary" className="text-xs font-mono font-medium text-slate-600">
                      {tache.reference}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 pt-5">
              {/* BLOC 1 : LE SUJET OFFICIEL */}
              <div className="rounded-2xl border border-blue-200/90 bg-gradient-to-br from-blue-50/80 via-white to-blue-50/30 p-5 shadow-xs space-y-2.5 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600 text-white text-[11px] font-heading font-extrabold uppercase tracking-wider shadow-xs">
                    <HelpCircle className="w-3.5 h-3.5" />
                    Sujet officiel
                  </span>
                  <span className="text-xs text-blue-700 font-semibold">
                    {tache.numero_tache === 1 ? 'Thématique personnelle & professionnelle' : 'Débat & Sujet de société'}
                  </span>
                </div>
                <p className="text-base sm:text-lg font-heading font-bold text-[#0d233a] leading-relaxed">
                  {parsed.sujet}
                </p>
              </div>

              {/* BLOC 2 : LES CONSIGNES & DIRECTIVES D'EXPLICATION */}
              <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/70 via-white to-orange-50/30 p-5 shadow-xs space-y-3 transition-all">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#cf7100] text-white text-[11px] font-heading font-extrabold uppercase tracking-wider shadow-xs">
                    <Target className="w-3.5 h-3.5" />
                    Consignes & Directives d'expression
                  </span>
                  <span className="text-xs text-amber-800 font-semibold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-[#cf7100]" />
                    {dureeLabel}
                  </span>
                </div>

                <div className="space-y-2 pt-1">
                  {parsed.consignes.map((c) => (
                    <div key={c} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-800 leading-relaxed font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* BLOC 3 : CONSEIL METHODOLOGIQUE EXAMINATEUR */}
              {parsed.conseilExaminateur && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-600 leading-relaxed">
                  <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-slate-800">Conseil examinateur :</strong>{' '}
                    {parsed.conseilExaminateur}
                  </p>
                </div>
              )}

              {/* Zone enregistrement audio */}
              <div className="pt-2">
                <div className="flex gap-3">
                  {audioBlobs[tache.numero_tache] && !failedUploads[tache.numero_tache] ? (
                    // Enregistrement validé : lecture seule, pas de second enregistrement
                    <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-300">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <div className="flex-1 text-left">
                        <p className="text-sm text-emerald-900 font-bold">Enregistrement sauvegardé avec succès</p>
                        <p className="text-xs text-emerald-700">Votre prestation orale est enregistrée et sera évaluée par l'IA à la fin de la session.</p>
                      </div>
                    </div>
                  ) : !recording ? (
                    <Button
                      onClick={() => startRecording(tache)}
                      className="flex-1 gap-2.5 py-6 bg-[#b51822] hover:bg-[#92131b] text-white font-heading font-bold text-base rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      <Mic className="w-5 h-5" /> Démarrer l'enregistrement de ma réponse
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={stopRecording}
                      className="flex-1 gap-2.5 py-6 font-heading font-bold text-base rounded-xl shadow-md transition-all cursor-pointer"
                    >
                      <div className="w-3 h-3 rounded-full bg-white record-pulse" />
                      <Square className="w-5 h-5" /> Arrêter l'enregistrement
                    </Button>
                  )}
                </div>

                {/* Barre de progression upload */}
                {uploadProgress[tache.numero_tache] !== undefined && (
                  <div className="space-y-1 pt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Upload className="w-3 h-3" /> Envoi en cours…</span>
                      <span>{uploadProgress[tache.numero_tache]}%</span>
                    </div>
                    <Progress value={uploadProgress[tache.numero_tache]} className="h-1.5" />
                  </div>
                )}

                {/* Bouton Réessayer si l'upload a échoué */}
                {failedUploads[tache.numero_tache] && (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-destructive/5 border border-destructive/20 mt-3">
                    <p className="text-sm text-destructive flex-1 font-medium">Échec d'envoi — votre enregistrement est conservé sur votre appareil.</p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={retrying[tache.numero_tache]}
                      onClick={() => retryUpload(tache.numero_tache)}
                      className="shrink-0"
                    >
                      {retrying[tache.numero_tache]
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <><RotateCcw className="w-3 h-3 mr-1" />Réessayer</>}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })()}
        <div className="flex gap-3">
          {!isLastTask ? (
            <Button className="flex-1" onClick={() => { stopRecording(); setCurrentTaskIdx(i => i + 1); setTaskTimerActive(false); }}>
              Tâche suivante <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button className="flex-1" onClick={submitOrale} disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Envoi...</> : 'Terminer et soumettre'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Expression écrite
  if (currentEpreuve === 'expression_ecrite') {
    return (
      <div className="max-w-3xl mx-auto space-y-4 fade-in">
        {/* Bandeau sticky : chronomètre visible quand l'étudiant scrolle entre les tâches */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border pb-3 -mx-4 px-4 md:-mx-6 md:px-6">
          <div className="flex items-center justify-between gap-4 pt-2 flex-wrap">
            <div>
              <p className="text-sm text-muted-foreground">Épreuve {epreuveIdx + 1}/4</p>
              <h1 className="text-lg font-bold text-foreground text-balance">{epreuveLabel}</h1>
            </div>
            <TimerBig seconds={timer} total={DUREES[currentEpreuve]} />
          </div>
        </div>
        {taches.map(tache => (
          <Card key={tache.id} className="h-full">
            <CardHeader>
              <CardTitle className="text-base text-balance flex items-center justify-between gap-2 flex-wrap">
                <span>Tâche {tache.numero_tache}</span>
                {tache.reference && (
                  <Badge variant="outline" className="text-xs font-mono font-medium border-primary/40 bg-primary/5 text-primary">
                    {tache.reference}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-foreground bg-muted/50 rounded-lg p-4 text-pretty whitespace-pre-wrap leading-relaxed">{tache.consigne}</p>
              <textarea
                className="w-full min-h-28 text-base px-3 py-2 rounded-md border border-input bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Rédigez votre réponse..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={texteReponses[tache.numero_tache] || ''}
                onChange={e => setTexteReponses(prev => ({ ...prev, [tache.numero_tache]: e.target.value }))}
                onPaste={e => e.preventDefault()}
                onDrop={e => e.preventDefault()}
              />
              <p className="text-xs text-muted-foreground text-right">
                {texteReponses[tache.numero_tache]?.split(/\s+/).filter(Boolean).length || 0} mots
              </p>
            </CardContent>
          </Card>
        ))}
        <Button className="w-full" onClick={handleEpreuveEnd}>
          Soumettre et passer à l'épreuve suivante <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  }

  // QCM (compréhension orale / écrite)
  const question = questions[currentQ];
  return (
    <div className="max-w-4xl mx-auto space-y-4 fade-in">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm text-muted-foreground">Épreuve {epreuveIdx + 1}/4 — Question {currentQ + 1}/{questions.length}</p>
          <h1 className="text-xl font-bold text-foreground text-balance">{epreuveLabel}</h1>
        </div>
        <TimerBig seconds={timer} total={DUREES[currentEpreuve]} />
      </div>
      <div className="flex items-center gap-2">
        <Progress value={questions.length ? ((currentQ + 1) / questions.length) * 100 : 0} className="h-2 flex-1" />
        {/* Le niveau de difficulté est masqué pendant la simulation */}
      </div>
      {question && (
        <Card className="h-full">
          <CardContent className="p-6 space-y-5">
            {question.audio_url && <AudioPlayerSimple url={question.audio_url} />}
            {question.image_url && (
              <div className="relative group rounded-xl border border-border/80 bg-slate-50/70 dark:bg-slate-900/40 p-2 sm:p-3 overflow-hidden flex flex-col items-center justify-center">
                <button
                  type="button"
                  onClick={() => setZoomImageUrl(question.image_url)}
                  className="w-full flex items-center justify-center focus:outline-none"
                >
                  <img
                    src={question.image_url}
                    alt="Document de compréhension"
                    className="w-full h-auto max-h-[560px] md:max-h-[640px] object-contain rounded-lg shadow-xs select-none cursor-zoom-in transition-transform duration-200 hover:scale-[1.006]"
                  />
                </button>
                <div className="w-full flex items-center justify-between pt-2 px-1 text-xs text-muted-foreground border-t border-border/40 mt-2">
                  <span className="italic text-[11px]">Document support de l'épreuve</span>
                  <button
                    type="button"
                    onClick={() => setZoomImageUrl(question.image_url)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background hover:bg-muted text-foreground font-medium border border-border/70 shadow-xs transition-colors cursor-pointer text-xs"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-primary" />
                    <span>Agrandir le document</span>
                  </button>
                </div>
              </div>
            )}
            {question.texte && <p className="text-sm text-foreground leading-relaxed text-pretty whitespace-pre-wrap font-medium">{question.texte}</p>}
            <div className="space-y-2 pt-2">
              {question.choix?.map(choix => (
                <button
                  type="button"
                  key={choix.id}
                  onClick={() => setReponses(prev => ({ ...prev, [question.id]: choix.id }))}
                  className={[
                    'w-full text-left px-4 py-3 rounded-md border text-sm transition-colors flex items-start gap-3',
                    reponses[question.id] === choix.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:border-primary/50 hover:bg-primary/5',
                  ].join(' ')}
                >
                  <span className="font-semibold text-muted-foreground shrink-0 w-5">{choix.id}.</span>
                  <span className="flex-1 text-pretty">{choix.texte}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <div className="flex gap-3">
        {currentQ < questions.length - 1 ? (
          <Button className="flex-1" onClick={() => setCurrentQ(i => i + 1)}>
            Question suivante <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        ) : (
          <Button className="flex-1" onClick={handleEpreuveEnd}>
            Terminer cette épreuve <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>

      {/* Modal d'agrandissement plein écran pour les documents CE/CO */}
      <Dialog open={!!zoomImageUrl} onOpenChange={open => !open && setZoomImageUrl(null)}>
        <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] p-3 sm:p-5 bg-background/98 backdrop-blur-md flex flex-col">
          <DialogHeader className="pb-2 border-b">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Document officiel en taille réelle
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto flex items-center justify-center p-2 bg-muted/20 rounded-lg min-h-[300px]">
            <img
              src={zoomImageUrl || ''}
              alt="Document agrandi"
              className="max-w-full max-h-[78vh] w-auto h-auto object-contain rounded-md shadow-md select-none"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
