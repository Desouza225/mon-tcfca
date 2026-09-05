import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, Bell } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface TCFAudioPlayerProps {
  url: string;
  autoPlay?: boolean;
  jingleUrl?: string;
  className?: string;
}

const JINGLE_VOLUME = 0.45; // Volume atténué plus doux pour le jingle
const MAIN_AUDIO_VOLUME = 1.0;

export default function TCFAudioPlayer({
  url,
  autoPlay = true,
  jingleUrl = '/media/audios/jingle_tcf.mp3',
  className = '',
}: TCFAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [phase, setPhase] = useState<'jingle' | 'main' | 'ended'>('jingle');
  const [playing, setPlaying] = useState(autoPlay);
  const [progress, setProgress] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(jingleUrl || url);

  // Synchroniser le volume selon la phase (jingle doux vs audio question clair)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = phase === 'jingle' ? JINGLE_VOLUME : MAIN_AUDIO_VOLUME;
    }
  }, [phase]);

  // À chaque changement de question (url)
  useEffect(() => {
    let active = true;
    const hasJingle = Boolean(jingleUrl);
    const initialPhase = hasJingle ? 'jingle' : 'main';
    setPhase(initialPhase);
    const startSrc = hasJingle ? jingleUrl : url;
    setCurrentSrc(startSrc);
    setProgress(0);
    setPlaying(autoPlay);

    if (audioRef.current) {
      audioRef.current.volume = initialPhase === 'jingle' ? JINGLE_VOLUME : MAIN_AUDIO_VOLUME;
      audioRef.current.src = startSrc;
      audioRef.current.currentTime = 0;
      if (autoPlay) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              if (active) setPlaying(true);
            })
            .catch(() => {
              // Si le navigateur restreint l'autoplay sans interaction préalable
              if (active) setPlaying(false);
            });
        }
      }
    }

    return () => {
      active = false;
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [url, jingleUrl, autoPlay]);

  const handleEnded = () => {
    if (phase === 'jingle') {
      // Transition automatique : Jingle terminé -> Lancement immédiat de l'audio de la question
      setPhase('main');
      setCurrentSrc(url);
      setProgress(0);
      if (audioRef.current) {
        audioRef.current.volume = MAIN_AUDIO_VOLUME;
        audioRef.current.src = url;
        audioRef.current.currentTime = 0;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setPlaying(true))
            .catch(() => setPlaying(false));
        }
      }
    } else {
      setPhase('ended');
      setPlaying(false);
      setProgress(100);
    }
  };

  const handleError = () => {
    // Si le jingle ne peut pas être lu (ex. erreur de format ou 404), basculer immédiatement sur l'audio de la question
    if (phase === 'jingle') {
      setPhase('main');
      setCurrentSrc(url);
      setProgress(0);
      if (audioRef.current) {
        audioRef.current.volume = MAIN_AUDIO_VOLUME;
        audioRef.current.src = url;
        audioRef.current.currentTime = 0;
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => setPlaying(true))
            .catch(() => setPlaying(false));
        }
      }
    } else {
      setPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current || !audioRef.current.duration) return;
    const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setProgress(p);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      if (phase === 'ended') {
        // Rejouer depuis le début (avec le jingle)
        const hasJingle = Boolean(jingleUrl);
        setPhase(hasJingle ? 'jingle' : 'main');
        const startSrc = hasJingle ? jingleUrl : url;
        setCurrentSrc(startSrc);
        audioRef.current.src = startSrc;
        audioRef.current.currentTime = 0;
      }
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
    }
  };

  const handleRestart = () => {
    if (!audioRef.current) return;
    const hasJingle = Boolean(jingleUrl);
    setPhase(hasJingle ? 'jingle' : 'main');
    const startSrc = hasJingle ? jingleUrl : url;
    setCurrentSrc(startSrc);
    setProgress(0);
    audioRef.current.src = startSrc;
    audioRef.current.currentTime = 0;
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise.then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  return (
    <div className={`flex flex-col gap-2 p-3.5 bg-muted/60 border border-border/80 rounded-xl shadow-xs ${className}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-primary hover:bg-primary/90 transition-transform active:scale-95 flex items-center justify-center text-primary-foreground shrink-0 shadow-sm cursor-pointer"
          title={playing ? 'Mettre en pause' : 'Lancer la lecture'}
        >
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-medium">
              {phase === 'jingle' ? (
                <span className="text-primary flex items-center gap-1 animate-pulse font-semibold">
                  <Bell className="w-3.5 h-3.5" /> Jingle officiel TCF...
                </span>
              ) : (
                <span className="text-foreground flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 text-primary" /> Audio de la question
                </span>
              )}
            </span>
            <span className="font-mono text-[11px]">
              {phase === 'jingle' ? 'Jingle' : playing ? 'En lecture' : phase === 'ended' ? 'Terminé' : 'En pause'}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <button
          type="button"
          onClick={handleRestart}
          className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer"
          title="Réécouter depuis le début (avec le jingle)"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      <audio
        ref={audioRef}
        src={currentSrc}
        autoPlay={autoPlay}
        playsInline
        onEnded={handleEnded}
        onError={handleError}
        onTimeUpdate={handleTimeUpdate}
        preload="auto"
      />
    </div>
  );
}
