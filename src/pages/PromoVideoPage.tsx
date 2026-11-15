import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, 
  Download, Sparkles, Smartphone, Monitor, CheckCircle, 
  Clock, ArrowRight, ShieldCheck, Flame, BookOpen, Headphones,
  PenTool, Mic, Award, CreditCard, ChevronRight
} from 'lucide-react';

interface Shot {
  id: number;
  timeRange: string;
  startSec: number;
  endSec: number;
  title: string;
  tagline: string;
  voiceover: string;
  visualDescription: string;
  keyFeature: string;
  category: 'Accroche' | 'Solution' | 'Fonctionnalité' | 'Preuve' | 'CTA';
}

const SHOTS: Shot[] = [
  {
    id: 1,
    timeRange: '0s - 5s',
    startSec: 0,
    endSec: 5,
    title: "Le Défi TCF Canada",
    tagline: "Votre projet d'immigration au Canada se joue ici.",
    voiceover: "Vous visez la résidence permanente au Canada ? Le TCF Canada est l'examen décisif qui conditionne votre dossier Entrée Express.",
    visualDescription: "Fond sombre #0D233A texturé. Typographie cinétique blanche et rouge percutante. Icônes d'exigence (NCLC 7+, visa Canada, chronomètre d'examen qui tourne).",
    keyFeature: "Objectif NCLC 7+ pour l'immigration canadienne",
    category: 'Accroche'
  },
  {
    id: 2,
    timeRange: '5s - 11s',
    startSec: 5,
    endSec: 11,
    title: "Révélation Mon TCF Canada",
    tagline: "La plateforme N°1 d'entraînement au TCF Canada.",
    voiceover: "Ne laissez rien au hasard. Découvrez Mon TCF Canada, la première plateforme tout-en-un conçue pour maximiser votre score.",
    visualDescription: "Animation 3D du logo officiel (livre ouvert stylisé + feuille d'érable rouge + étoile dorée). Transition lumineuse vers l'interface épurée de la plateforme.",
    keyFeature: "Plateforme 100% dédiée au TCF Canada officiel",
    category: 'Solution'
  },
  {
    id: 3,
    timeRange: '11s - 19s',
    startSec: 11,
    endSec: 19,
    title: "Les 4 Épreuves Officielles",
    tagline: "4 320 questions réelles réparties sur les 4 épreuves.",
    voiceover: "Maîtrisez les 4 épreuves : Compréhension Orale, Compréhension Écrite, Expression Écrite et Expression Orale. Avec plus de 4 300 questions conformes aux exigences officielles.",
    visualDescription: "Écran d'entraînement animé montrant les 4 modules interactifs avec leurs badges de temps et jauges de complétion réelles.",
    keyFeature: "Banque de 4 320 questions et 4 épreuves officielles",
    category: 'Fonctionnalité'
  },
  {
    id: 4,
    timeRange: '19s - 27s',
    startSec: 19,
    endSec: 27,
    title: "Correction Instantanée par IA",
    tagline: "Note officielle sur 20 et grille France Éducation International.",
    voiceover: "Rédigez ou enregistrez vos réponses : notre intelligence artificielle analyse votre copie selon la grille officielle FEI et vous attribue une note sur 20 avec conseils personnalisés.",
    visualDescription: "Affichage animé de la carte de résultat d'IA : score 17.5/20, niveau C1 / NCLC 8, décomposition par critères (Lexique, Syntaxe, Cohérence, Argumentation).",
    keyFeature: "Correction IA sur 20 avec feedback détaillé par critères",
    category: 'Fonctionnalité'
  },
  {
    id: 5,
    timeRange: '27s - 35s',
    startSec: 27,
    endSec: 35,
    title: "Examens Blancs en Conditions Réelles",
    tagline: "Simulations chronométrées et suivi de progression en temps réel.",
    voiceover: "Entraînez-vous dans les conditions exactes du jour J : compte à rebours officiel, enchaînement des épreuves et graphique de suivi de votre progression.",
    visualDescription: "Mockup d'ordinateur portable affichant l'interface d'examen blanc en plein écran avec compte à rebours, puis vue du graphique de progression du candidat.",
    keyFeature: "Chronomètre officiel et simulateur d'examen blanc",
    category: 'Fonctionnalité'
  },
  {
    id: 6,
    timeRange: '35s - 40s',
    startSec: 35,
    endSec: 40,
    title: "Paiement Mobile Money Simplifié",
    tagline: "Accessible partout en Afrique de l'Ouest & diaspora.",
    voiceover: "Souscrivez en un clic avec vos moyens de paiement locaux : Wave, Orange Money, MTN, Moov et cartes bancaires via Paystack sécurisé.",
    visualDescription: "Affichage des badges de paiement Mobile Money avec animation de validation verte instantanée et déverrouillage immédiat des accès.",
    keyFeature: "Paiement Mobile Money (Wave, Orange, MTN, Moov) & CB sécurisé",
    category: 'Preuve'
  },
  {
    id: 7,
    timeRange: '40s - 44s',
    startSec: 40,
    endSec: 44,
    title: "Passez à l'Action",
    tagline: "Rejoignez Mon TCF Canada dès aujourd'hui.",
    voiceover: "Préparez votre avenir au Canada dès aujourd'hui. Rendez-vous sur mon-tcfca.com !",
    visualDescription: "Plan final majestueux : logo officiel Mon TCF Canada, bouton dynamique 'Commencer mon entraînement', adresse web 'mon-tcfca.com' en très gros plan.",
    keyFeature: "mon-tcfca.com — Inscription immédiate",
    category: 'CTA'
  }
];

export default function PromoVideoPage() {
  const [activeTab, setActiveTab] = useState<'higgsfield' | 'motionStudio'>('motionStudio');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('9:16');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [enableVoiceover, setEnableVoiceover] = useState<boolean>(true);
  const [activeShotIndex, setActiveShotIndex] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const TOTAL_DURATION = 44; // 44 seconds total

  // Synthesize soft transition audio cues when muted is false
  const playSoundEffect = useCallback((type: 'whoosh' | 'pop' | 'success') => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'whoosh') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.15);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch {
      // AudioContext not allowed before user gesture
    }
  }, [isMuted]);

  // Synchronize active shot with current time and voiceover
  useEffect(() => {
    const shotIdx = SHOTS.findIndex(s => currentTime >= s.startSec && currentTime < s.endSec);
    if (shotIdx !== -1 && shotIdx !== activeShotIndex) {
      setActiveShotIndex(shotIdx);
      playSoundEffect('whoosh');

      if (isPlaying && enableVoiceover && !isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(SHOTS[shotIdx].voiceover);
          utter.lang = 'fr-FR';
          utter.rate = 1.1;
          window.speechSynthesis.speak(utter);
        } catch {
          // Ignore speech synthesis errors if blocked
        }
      }
    }
  }, [currentTime, activeShotIndex, isPlaying, enableVoiceover, isMuted, playSoundEffect]);

  // Motion Studio auto-play timer
  useEffect(() => {
    if (activeTab === 'motionStudio') {
      if (isPlaying) {
        timerRef.current = window.setInterval(() => {
          setCurrentTime((prev) => {
            if (prev >= TOTAL_DURATION) {
              setIsPlaying(false);
              return 0;
            }
            return +(prev + 0.1).toFixed(1);
          });
        }, 100);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, activeTab]);

  const jumpToShot = (shot: Shot) => {
    setCurrentTime(shot.startSec);
    setActiveShotIndex(shot.id - 1);
    playSoundEffect('whoosh');
    if (isPlaying && enableVoiceover && !isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(shot.voiceover);
      utter.lang = 'fr-FR';
      utter.rate = 1.1;
      window.speechSynthesis.speak(utter);
    }
  };

  const togglePlay = () => {
    if (activeTab === 'higgsfield') {
      if (videoRef.current) {
        if (isPlaying) videoRef.current.pause();
        else videoRef.current.play();
        setIsPlaying(!isPlaying);
      }
    } else {
      if (isPlaying) {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      } else {
        if (enableVoiceover && !isMuted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(currentShot.voiceover);
          utter.lang = 'fr-FR';
          utter.rate = 1.1;
          window.speechSynthesis.speak(utter);
        }
      }
      setIsPlaying(!isPlaying);
      playSoundEffect('whoosh');
    }
  };

  const resetPlay = () => {
    setCurrentTime(0);
    setActiveShotIndex(0);
    setIsPlaying(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const currentShot = SHOTS[activeShotIndex] || SHOTS[0];
  const progressPercent = Math.min(100, (currentTime / TOTAL_DURATION) * 100);

  return (
    <div className="min-h-screen bg-[#07121E] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-[#0D233A]/90 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 p-1.5 flex items-center justify-center border border-white/20 shadow-lg shadow-red-500/10">
              <img 
                src="/images/logo/mon-tcfca-logo.png" 
                alt="Logo Mon TCF Canada" 
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">Mon TCF Canada</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-red-600/20 text-red-400 border border-red-500/30">
                  Motion Design Studio
                </span>
              </div>
              <p className="text-xs text-slate-400">Vidéo publicitaire officielle de 44 secondes • Connexion Higgsfield AI</p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center bg-slate-900/90 rounded-xl p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => { setActiveTab('motionStudio'); setIsPlaying(false); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'motionStudio' 
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/30' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Vidéo 44s Complète (Motion Design)
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('higgsfield'); setIsPlaying(false); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'higgsfield' 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="h-3.5 w-3.5" />
              Rendu Higgsfield AI (Seedance 1.5 Pro)
            </button>
          </div>

          {/* Action Links */}
          <div className="flex items-center gap-3">
            <a
              href="/videos/mon-tcfca-promo-higgsfield.mp4"
              download="mon-tcfca-promo-higgsfield.mp4"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              Télécharger MP4 (8.3 Mo)
            </a>
            <Link
              to="/"
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-all shadow-md shadow-red-600/20"
            >
              Retour au site
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Video Screen & Player Controls */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Format Toggle Bar */}
          <div className="flex items-center justify-between bg-slate-900/60 backdrop-blur-sm rounded-xl px-4 py-2.5 border border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Format d'affichage :</span>
              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  aspectRatio === '16:9'
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                16:9 Paysage (Web / YouTube)
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  aspectRatio === '9:16'
                    ? 'bg-white/20 text-white border border-white/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                9:16 Vertical (TikTok / Reels / Status)
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-red-400" />
                Durée max : <strong className="text-white">44s</strong> (&le; 45s)
              </span>
            </div>
          </div>

          {/* Video Container Box */}
          <div 
            className={`relative mx-auto w-full bg-gradient-to-b from-[#0D233A] via-[#091726] to-[#040B13] rounded-2xl overflow-hidden shadow-2xl border border-slate-800 flex items-center justify-center transition-all duration-300 ${
              aspectRatio === '16:9' 
                ? 'aspect-video max-h-[520px]' 
                : 'max-w-[340px] aspect-[9/16] max-h-[640px]'
            }`}
          >
            {/* VIEW 1: HIGGSFIELD AI RENDERED VIDEO */}
            {activeTab === 'higgsfield' ? (
              <div className="relative w-full h-full flex items-center justify-center bg-black">
                <video
                  ref={videoRef}
                  src="/videos/mon-tcfca-promo-higgsfield.mp4"
                  className={`w-full h-full ${aspectRatio === '9:16' ? 'object-cover scale-105' : 'object-contain'}`}
                  playsInline
                  loop
                  controls={false}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={(e) => setCurrentTime(+e.currentTarget.currentTime.toFixed(1))}
                >
                  <track kind="captions" srcLang="fr" label="Français" />
                </video>
                
                {/* Overlay Badge */}
                <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-white tracking-wide">Higgsfield AI • Seedance 1.5 Pro</span>
                </div>
              </div>
            ) : (
              /* VIEW 2: MOTION DESIGN STUDIO ANIMATOR (44s Synchronized Sequence) */
              <div className="relative w-full h-full flex flex-col justify-between p-6 sm:p-8 select-none overflow-hidden">
                
                {/* Background Ambient Glowing Shapes */}
                <div className="absolute -top-24 -left-24 w-80 h-80 bg-red-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
                <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

                {/* Top Info Header in Video */}
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/15">
                    <img 
                      src="/images/logo/mon-tcfca-logo.png" 
                      alt="Logo" 
                      className="h-5 w-5 object-contain"
                    />
                    <span className="text-xs font-bold tracking-wider uppercase text-white">Mon TCF Canada</span>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-slate-700/60 text-[11px]">
                    <span className="text-slate-400">Plan {activeShotIndex + 1}/7</span>
                    <span className="text-red-400 font-bold">{currentShot.timeRange}</span>
                  </div>
                </div>

                {/* Center Dynamic Stage with Kinetic Animations */}
                <div className="relative z-10 my-auto text-center flex flex-col items-center justify-center px-2 py-4">
                  
                  {/* SHOT 1: ACCROCHE LE DÉFI (0-5s) */}
                  {activeShotIndex === 0 && (
                    <div className="animate-fadeIn flex flex-col items-center gap-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30">
                        <Flame className="h-3.5 w-3.5 text-red-400" />
                        IMMIGRATION CANADA • ENTRÉE EXPRESS
                      </div>
                      <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight max-w-lg">
                        Votre projet de vie dépend de votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-400">score TCF Canada</span>
                      </h2>
                      <p className="text-slate-300 text-sm sm:text-base max-w-md">
                        Le niveau <strong>NCLC 7+</strong> est obligatoire pour maximiser vos points. Ne prenez aucun risque.
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                        <Clock className="h-3.5 w-3.5" />
                        Chronomètre serré • 4 épreuves décisives
                      </div>
                    </div>
                  )}

                  {/* SHOT 2: SOLUTION MON TCF CANADA (5-11s) */}
                  {activeShotIndex === 1 && (
                    <div className="animate-fadeIn flex flex-col items-center gap-4">
                      <div className="h-20 w-20 rounded-2xl bg-white p-2.5 shadow-2xl shadow-red-500/30 transform hover:scale-105 transition-transform border border-slate-200">
                        <img 
                          src="/images/logo/mon-tcfca-logo.png" 
                          alt="Logo Mon TCF Canada" 
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                          Mon TCF Canada
                        </h2>
                        <p className="text-red-400 font-semibold text-sm sm:text-base tracking-wide">
                          La plateforme officielle d'entraînement intensif
                        </p>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 max-w-md">
                        Conçue pour les candidats francophones préparant leur immigration canadienne.
                      </p>
                    </div>
                  )}

                  {/* SHOT 3: 4 ÉPREUVES & 4320 QUESTIONS (11-19s) */}
                  {activeShotIndex === 2 && (
                    <div className="animate-fadeIn flex flex-col items-center gap-3 w-full max-w-md">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                        Couverture Intégrale 100% Conforme
                      </span>
                      <h2 className="text-xl sm:text-3xl font-extrabold text-white">
                        Les 4 Épreuves Officielles du TCF
                      </h2>
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full mt-2">
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 text-left flex items-center gap-2.5">
                          <Headphones className="h-5 w-5 text-blue-400 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-bold text-white">Compréhension Orale</div>
                            <div className="text-[10px] text-slate-400">39 questions • 35 min</div>
                          </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 text-left flex items-center gap-2.5">
                          <BookOpen className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-bold text-white">Compréhension Écrite</div>
                            <div className="text-[10px] text-slate-400">39 questions • 60 min</div>
                          </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 text-left flex items-center gap-2.5">
                          <PenTool className="h-5 w-5 text-amber-400 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-bold text-white">Expression Écrite</div>
                            <div className="text-[10px] text-slate-400">3 tâches • 60 min</div>
                          </div>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/15 text-left flex items-center gap-2.5">
                          <Mic className="h-5 w-5 text-purple-400 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-bold text-white">Expression Orale</div>
                            <div className="text-[10px] text-slate-400">3 tâches • 12 min</div>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-slate-200 mt-1 bg-red-600/30 px-3 py-1 rounded-full border border-red-500/40">
                        ⭐ Plus de 4 320 questions vérifiées en banque
                      </div>
                    </div>
                  )}

                  {/* SHOT 4: CORRECTION INSTANTANÉE PAR IA (19-27s) */}
                  {activeShotIndex === 3 && (
                    <div className="animate-fadeIn flex flex-col items-center gap-3 w-full max-w-sm">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                        <Sparkles className="h-3 w-3" />
                        INTELLIGENCE ARTIFICIELLE INTÉGRÉE
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white">
                        Correction Instantanée sur 20
                      </h2>
                      {/* AI Card Preview */}
                      <div className="w-full bg-[#0D233A] rounded-xl p-4 border border-emerald-500/40 shadow-xl text-left space-y-2.5">
                        <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
                          <span className="text-xs text-slate-300 font-medium">Évaluation Expression Écrite</span>
                          <span className="text-lg font-black text-emerald-400">17.5 / 20</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Niveau estimé :</span>
                          <span className="font-bold text-white bg-blue-600/30 px-2 py-0.5 rounded border border-blue-500/30">C1 (NCLC 8)</span>
                        </div>
                        <div className="text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                          &ldquo;Excellente structure argumentative, connecteurs logiques précis. Richesse lexicale démontrée.&rdquo;
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400">Conforme à la grille officielle France Éducation International (FEI)</span>
                    </div>
                  )}

                  {/* SHOT 5: EXAMENS BLANCS EN CONDITIONS RÉELLES (27-35s) */}
                  {activeShotIndex === 4 && (
                    <div className="animate-fadeIn flex flex-col items-center gap-3 w-full max-w-md">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        SIMULATION JOUR J
                      </div>
                      <h2 className="text-xl sm:text-3xl font-extrabold text-white">
                        Examens Blancs Chronométrés
                      </h2>
                      <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/80 w-full text-left space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-300">Simulation Complète TCF</span>
                          <span className="text-xs font-mono bg-red-600/30 text-red-300 px-2 py-0.5 rounded font-bold">Temps restant : 58:24</span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-red-600 to-amber-500 h-full w-3/4 rounded-full" />
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>39/39 questions répondues</span>
                          <span className="text-emerald-400 font-bold">Progression continue</span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300">Repérez vos points faibles avant l'examen officiel.</p>
                    </div>
                  )}

                  {/* SHOT 6: PAIEMENT MOBILE MONEY (35-40s) */}
                  {activeShotIndex === 5 && (
                    <div className="animate-fadeIn flex flex-col items-center gap-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                        <CreditCard className="h-3.5 w-3.5" />
                        PAIEMENT SÉCURISÉ &amp; IMMÉDIAT
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-white">
                        Payez par Mobile Money
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-300 max-w-sm">
                        Accessible directement en Afrique de l'Ouest et dans la diaspora :
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                        <span className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 font-bold text-xs border border-blue-500/30">Wave</span>
                        <span className="px-3 py-1.5 rounded-lg bg-orange-500/20 text-orange-300 font-bold text-xs border border-orange-500/30">Orange Money</span>
                        <span className="px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-300 font-bold text-xs border border-yellow-500/30">MTN MoMo</span>
                        <span className="px-3 py-1.5 rounded-lg bg-blue-700/20 text-cyan-300 font-bold text-xs border border-blue-700/30">Moov</span>
                        <span className="px-3 py-1.5 rounded-lg bg-slate-700/30 text-slate-200 font-bold text-xs border border-slate-600/40">Cartes Bancaires</span>
                      </div>
                      <div className="text-[11px] text-emerald-400 font-medium mt-1">
                        ✓ Activation instantanée de votre abonnement
                      </div>
                    </div>
                  )}

                  {/* SHOT 7: APPEL À L'ACTION FINAL (40-44s) */}
                  {activeShotIndex === 6 && (
                    <div className="animate-fadeIn flex flex-col items-center gap-4">
                      <div className="h-16 w-16 rounded-2xl bg-white p-2 shadow-xl shadow-red-500/30 border border-slate-200">
                        <img 
                          src="/images/logo/mon-tcfca-logo.png" 
                          alt="Logo Mon TCF Canada" 
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="space-y-1">
                        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                          Réussissez votre TCF Canada
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300">
                          Rejoignez dès maintenant les candidats qui s'entraînent chaque jour.
                        </p>
                      </div>
                      
                      <div className="bg-red-600 text-white font-black text-lg sm:text-2xl px-6 py-2.5 rounded-xl shadow-xl shadow-red-600/40 border border-red-500/50 animate-bounce">
                        mon-tcfca.com
                      </div>

                      <Link
                        to="/inscription"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-white text-slate-900 hover:bg-slate-100 transition-all shadow-lg"
                      >
                        Commencer mon entraînement
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  )}

                </div>

                {/* Bottom Timeline Indicator inside the video */}
                <div className="relative z-10 w-full bg-slate-900/80 backdrop-blur-sm rounded-xl p-3 border border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                    <span className="font-medium text-slate-200">{currentShot.title}</span>
                    <span className="font-mono text-red-400 font-bold">{currentTime}s / {TOTAL_DURATION}s</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-red-600 via-amber-500 to-red-600 h-full transition-all duration-100 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Master Player Controls Bar */}
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="h-11 w-11 rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-lg shadow-red-600/30"
                title={isPlaying ? "Mettre en pause" : "Lancer la lecture"}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={resetPlay}
                className="h-10 w-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
                title="Revenir au début"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="h-10 w-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-all"
                title={isMuted ? "Activer les effets sonores" : "Couper le son"}
              >
                {isMuted ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  const nextVal = !enableVoiceover;
                  setEnableVoiceover(nextVal);
                  if (!nextVal && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                  }
                }}
                className={`h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold transition-all ${
                  enableVoiceover 
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' 
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
                title={enableVoiceover ? "Voix off activée" : "Voix off désactivée"}
              >
                <Mic className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{enableVoiceover ? "Voix off ON" : "Voix off OFF"}</span>
              </button>
            </div>

            {/* Scrub Slider */}
            <div className="flex-1 min-w-[200px] flex items-center gap-3">
              <span className="font-mono text-xs text-slate-400 w-10 text-right">{currentTime}s</span>
              <input
                type="range"
                min="0"
                max={TOTAL_DURATION}
                step="0.5"
                value={currentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTime(val);
                  if (videoRef.current) videoRef.current.currentTime = val;
                }}
                className="w-full accent-red-600 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <span className="font-mono text-xs text-slate-400 w-10">{TOTAL_DURATION}s</span>
            </div>

            {/* Current Shot Badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Plan actif :</span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white/10 text-white border border-white/10">
                {currentShot.id}. {currentShot.title}
              </span>
            </div>
          </div>

          {/* Technical Specs & Brand Guidelines */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Durée totale</div>
              <div className="text-sm font-bold text-white">44s (Max &le; 45s)</div>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Charte de couleurs</div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-3.5 w-3.5 rounded-full bg-[#0D233A] border border-white/20" title="#0D233A Marine" />
                <span className="h-3.5 w-3.5 rounded-full bg-[#E53E3E] border border-white/20" title="#E53E3E Érable Rouge" />
                <span className="h-3.5 w-3.5 rounded-full bg-[#D97706] border border-white/20" title="#D97706 Ambre" />
                <span className="text-xs font-mono text-slate-300">#0D233A / #E53E3E</span>
              </div>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Typographie</div>
              <div className="text-sm font-bold text-white">Plus Jakarta Sans</div>
            </div>
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="text-[11px] text-slate-400">Moteur IA Higgsfield</div>
              <div className="text-sm font-bold text-emerald-400">Seedance 1.5 Pro</div>
            </div>
          </div>

        </section>

        {/* Right Column: Storyboard Plan-par-Plan & Script */}
        <aside className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-red-500" />
                Storyboard Plan par Plan
              </h3>
              <span className="text-xs text-slate-400">7 plans synchronisés</span>
            </div>

            <p className="text-xs text-slate-400">
              Cliquez sur un plan pour y téléporter le lecteur et écouter la transition sonore.
            </p>

            {/* Shots List */}
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {SHOTS.map((shot, idx) => {
                const isActive = activeShotIndex === idx;
                return (
                  <button
                    type="button"
                    key={shot.id}
                    onClick={() => jumpToShot(shot)}
                    className={`w-full text-left p-3 rounded-xl border transition-all flex flex-col gap-1.5 ${
                      isActive
                        ? 'bg-red-950/40 border-red-500/60 shadow-lg shadow-red-900/20'
                        : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          isActive ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-300'
                        }`}>
                          Plan {shot.id}
                        </span>
                        <span className="text-xs font-bold text-white tracking-tight">{shot.title}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 font-semibold">{shot.timeRange}</span>
                    </div>

                    <p className="text-xs text-slate-300 leading-snug">
                      &ldquo;{shot.tagline}&rdquo;
                    </p>

                    <div className="text-[10px] text-slate-400 bg-slate-900/80 p-2 rounded-lg border border-slate-800/80">
                      <strong className="text-slate-300">Voix off : </strong>
                      {shot.voiceover}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 pt-0.5">
                      <CheckCircle className="h-3 w-3 flex-shrink-0" />
                      <span>{shot.keyFeature}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

      </main>
    </div>
  );
}
