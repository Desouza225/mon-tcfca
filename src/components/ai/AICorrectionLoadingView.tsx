import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Mic, Sparkles } from 'lucide-react';

interface AICorrectionLoadingViewProps {
  step?: string;
  isOral?: boolean;
  mode?: 'entrainement' | 'examen_blanc';
  externalProgress?: number;
}

/**
 * Écran d'attente affiché pendant la correction par IA.
 * Remplace le spinner circulaire par le logo officiel animé et une progression en pourcentage (%).
 */
export default function AICorrectionLoadingView({
  step,
  isOral = false,
  mode = 'entrainement',
  externalProgress,
}: AICorrectionLoadingViewProps) {
  const [imgError, setImgError] = useState(false);
  const [progress, setProgress] = useState<number>(() =>
    externalProgress !== undefined ? Math.max(1, Math.min(99, externalProgress)) : 3
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        const target =
          externalProgress !== undefined
            ? Math.min(99, Math.max(prev, externalProgress))
            : null;

        if (target !== null && prev < target) {
          const diff = target - prev;
          const increment = Math.max(1, Math.ceil(diff * 0.25));
          return Math.min(target, prev + increment);
        }

        if (prev < 35) return Math.min(35, prev + 3);
        if (prev < 75) return Math.min(75, prev + 1.5);
        if (prev < 96) return Math.min(96, prev + 0.35);
        return prev;
      });
    }, 220);

    return () => clearInterval(timer);
  }, [externalProgress]);

  const displayPct = Math.min(99, Math.max(1, Math.round(progress)));

  const phaseLabel =
    displayPct < 30
      ? 'Lecture & analyse de la consigne'
      : displayPct < 65
        ? 'Évaluation linguistique & pragmatique'
        : displayPct < 90
          ? 'Vérification de la grille officielle FEI /20'
          : 'Génération du rapport détaillé';

  const title =
    mode === 'examen_blanc'
      ? 'Correction de vos expressions par notre IA'
      : 'Correction en cours...';

  const defaultStep =
    mode === 'examen_blanc'
      ? 'Analyse de vos rédactions écrites et transcription de vos enregistrements oraux selon la grille officielle TCF Canada...'
      : isOral
        ? 'Transcription et évaluation de votre prestation orale selon les critères officiels...'
        : 'Analyse de votre production en cours selon les critères officiels...';

  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - displayPct / 100);

  return (
    <div className="max-w-xl mx-auto py-12 px-4 space-y-6 fade-in text-center">
      <Card className="rounded-3xl border border-[#d3e4fe] shadow-lg p-7 sm:p-9 space-y-6 bg-white">
        {/* Médaillon logo animé + anneau de progression SVG */}
        <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
          <div className="absolute inset-2 rounded-full bg-gradient-to-br from-[#eff4ff] via-[#dce9ff]/60 to-[#ffdcc3]/40 animate-pulse" />

          <svg
            className="w-32 h-32 -rotate-90 relative z-10"
            viewBox="0 0 112 112"
            aria-hidden="true"
          >
            <circle
              cx="56"
              cy="56"
              r={radius}
              fill="none"
              stroke="#e5eeff"
              strokeWidth="6"
            />
            <circle
              cx="56"
              cy="56"
              r={radius}
              fill="none"
              stroke="url(#tcfProgressGradient)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-300 ease-out"
            />
            <defs>
              <linearGradient id="tcfProgressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0d233a" />
                <stop offset="60%" stopColor="#1a365d" />
                <stop offset="100%" stopColor="#e53e3e" />
              </linearGradient>
            </defs>
          </svg>

          <div className="absolute inset-4 rounded-full bg-white shadow-sm border border-[#d3e4fe]/80 flex items-center justify-center z-20 overflow-hidden">
            <div className="animate-logo-float flex items-center justify-center w-16 h-16">
              {!imgError ? (
                <img
                  src="/images/logo/logo-icon.png"
                  alt="Mon TCF CA"
                  className="w-14 h-14 object-contain drop-shadow-xs select-none"
                  onError={() => setImgError(true)}
                />
              ) : (
                <svg
                  viewBox="0 0 100 100"
                  className="w-14 h-14"
                  xmlns="http://www.w3.org/2000/svg"
                  role="img"
                  aria-label="Mon TCF CA"
                >
                  <path
                    d="M50 8 L54 18 L62 16 L61 24 L70 25 L67 33 L76 37 L71 44 L77 49 L67 52 L65 60 L58 57 L54 66 L51 58 L50 68 L49 58 L46 66 L42 57 L35 60 L33 52 L23 49 L29 44 L24 37 L33 33 L30 25 L39 24 L38 16 L46 18 Z"
                    fill="#d62828"
                  />
                  <polygon
                    points="76,30 78,35 83,37 78,39 76,44 74,39 69,37 74,35"
                    fill="#e9a820"
                  />
                  <circle cx="50" cy="46" r="6" fill="#0d233a" />
                  <path
                    d="M38 42 C44 48 48 54 50 64 C52 54 56 48 62 42 C56 50 53 58 50 72 C47 58 44 50 38 42 Z"
                    fill="#0d233a"
                  />
                  <path
                    d="M26 62 C34 60 43 64 49 74 C44 70 34 68 24 70 Z"
                    fill="#0d233a"
                  />
                  <path
                    d="M74 62 C66 60 57 64 51 74 C56 70 66 68 76 70 Z"
                    fill="#0d233a"
                  />
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* Badge + Titre + Étape */}
        <div className="space-y-2">
          <Badge className="bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe] text-xs font-semibold px-3 py-1">
            <Sparkles className="w-3.5 h-3.5 text-[#d97706] mr-1.5" />
            {mode === 'examen_blanc'
              ? 'Évaluation automatisée en cours'
              : 'IA Évaluateur Expert TCF Canada'}
          </Badge>
          <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-[#0d233a]">
            {title}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed font-medium max-w-md mx-auto">
            {step || defaultStep}
          </p>
        </div>

        {/* Progression en pourcentage (%) + Barre */}
        <div className="space-y-2.5 pt-1 text-left">
          <div className="flex items-end justify-between gap-2">
            <span className="text-xs font-semibold text-[#0d233a]">{phaseLabel}</span>
            <span className="text-2xl font-heading font-extrabold text-[#0d233a] tabular-nums leading-none">
              {displayPct}%
            </span>
          </div>
          <Progress
            value={displayPct}
            className="h-3 w-full bg-[#eff4ff] border border-[#d3e4fe]/80 [&>div]:bg-gradient-to-r [&>div]:from-[#0d233a] [&>div]:via-[#1a365d] [&>div]:to-[#e53e3e] [&>div]:duration-300"
          />
          <div className="flex justify-between text-[11px] text-slate-500 font-medium">
            <span>Analyse des critères officiels</span>
            <span>Note /20 &amp; niveau CECRL</span>
          </div>
        </div>

        {/* Récapitulatif critères évalués */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 text-left space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Notation rigoureuse sur 20 points par <strong>notre IA</strong>
            </span>
          </div>
          {isOral && (
            <div className="flex items-center gap-2">
              <Mic className="w-4 h-4 text-[#e53e3e] shrink-0" />
              <span>
                Transcription audio haute précision par <strong>notre IA</strong>
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Grille officielle CECRL (critères linguistiques, pragmatiques et sociolinguistiques)
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
