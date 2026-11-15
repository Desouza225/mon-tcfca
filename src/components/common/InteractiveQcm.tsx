import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle, Lightbulb, RotateCcw, Trophy, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface QcmQuestion {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface InteractiveQcmProps {
  title?: string;
  subtitle?: string;
  questions: QcmQuestion[];
}

export function InteractiveQcm({
  title = "Exercice pratique : Validez vos acquis",
  subtitle = "Cliquez sur la bonne réponse pour chaque situation. L'explication détaillée apparaît instantanément.",
  questions
}: InteractiveQcmProps) {
  // Enregistre pour chaque index de question l'index de l'option choisie par l'utilisateur
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});

  if (!questions || questions.length === 0) return null;

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(selectedAnswers).length;
  const correctCount = Object.entries(selectedAnswers).filter(([qIdxStr, optIdx]) => {
    const qIdx = parseInt(qIdxStr, 10);
    return questions[qIdx]?.answer === optIdx;
  }).length;

  const isComplete = answeredCount === totalQuestions;

  const handleSelectOption = (questionIndex: number, optionIndex: number) => {
    // Si la question a déjà été répondue, on ne bloque pas : on laisse l'utilisateur tester ou changer
    setSelectedAnswers(prev => ({
      ...prev,
      [questionIndex]: optionIndex
    }));
  };

  const handleReset = () => {
    setSelectedAnswers({});
  };

  return (
    <div className="my-8 rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50/70 to-white p-5 sm:p-7 shadow-xs not-prose">
      {/* ═══ En-tête de l'exercice ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-200/80">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-heading font-bold bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe] mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#2563eb]" />
            <span>Quiz Interactif d'Application</span>
          </div>
          <h3 className="font-heading font-extrabold text-lg sm:text-xl text-[#0d233a]">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Compteur & Score */}
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs font-heading font-bold text-slate-700">
            Score : <span className={correctCount > 0 ? "text-emerald-600 font-extrabold" : "text-slate-700"}>{correctCount}</span> / {totalQuestions}
          </div>
          {answeredCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8 rounded-xl text-xs gap-1 text-slate-500 hover:text-[#0d233a] hover:bg-slate-100"
              title="Réinitialiser l'exercice"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Recommencer</span>
            </Button>
          )}
        </div>
      </div>

      {/* ═══ Liste des Questions ═══ */}
      <div className="space-y-6 pt-6">
        {questions.map((q, qIdx) => {
          const userChoice = selectedAnswers[qIdx];
          const hasAnswered = userChoice !== undefined;
          const isCorrect = hasAnswered && userChoice === q.answer;

          return (
            <div
              key={q.question}
              className={cn(
                "p-4 sm:p-5 rounded-2xl border transition-all bg-white shadow-2xs",
                hasAnswered
                  ? isCorrect
                    ? "border-emerald-200/90 ring-1 ring-emerald-100"
                    : "border-rose-200/90 ring-1 ring-rose-100"
                  : "border-slate-200/80 hover:border-slate-300"
              )}
            >
              {/* Énoncé de la question */}
              <div className="flex items-start gap-3 mb-3.5">
                <span className={cn(
                  "w-6 h-6 rounded-lg text-xs font-heading font-bold flex items-center justify-center shrink-0 mt-0.5 border",
                  hasAnswered
                    ? isCorrect
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-slate-100 text-slate-700 border-slate-200"
                )}>
                  {qIdx + 1}
                </span>
                <p className="font-heading font-bold text-sm sm:text-base text-[#0d233a] leading-snug">
                  {q.question}
                </p>
              </div>

              {/* Options sous forme de boutons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-0 sm:pl-9">
                {q.options.map((option, optIdx) => {
                  const isSelected = userChoice === optIdx;
                  const isThisCorrect = optIdx === q.answer;

                  let optionStyle = "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300";

                  if (hasAnswered) {
                    if (isSelected && isThisCorrect) {
                      // Choix de l'utilisateur qui est BON
                      optionStyle = "border-emerald-500 bg-emerald-50/90 text-emerald-900 font-semibold shadow-xs ring-1 ring-emerald-400";
                    } else if (isSelected && !isThisCorrect) {
                      // Choix de l'utilisateur qui est FAUX
                      optionStyle = "border-rose-400 bg-rose-50/90 text-rose-950 font-medium shadow-xs";
                    } else if (!isSelected && isThisCorrect) {
                      // La bonne réponse révélée quand l'utilisateur s'est trompé
                      optionStyle = "border-emerald-400 bg-emerald-50/50 text-emerald-800 font-medium dashed border-2";
                    } else {
                      optionStyle = "border-slate-200 bg-slate-50/50 text-slate-400 opacity-60";
                    }
                  }

                  return (
                    <button
                      key={`${q.question}-${option}`}
                      type="button"
                      onClick={() => handleSelectOption(qIdx, optIdx)}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border text-xs sm:text-sm transition-all flex items-center justify-between gap-2 cursor-pointer",
                        optionStyle
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md text-[11px] font-bold flex items-center justify-center bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                          {String.fromCharCode(65 + optIdx)}
                        </span>
                        <span className="leading-snug">{option}</span>
                      </span>

                      {/* Indicateur d'état */}
                      {hasAnswered && (
                        isSelected ? (
                          isThisCorrect ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          )
                        ) : isThisCorrect ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                            Bonne réponse
                          </span>
                        ) : null
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Révélateur d'explication pédagogique */}
              {hasAnswered && (
                <div
                  className={cn(
                    "mt-3.5 pl-0 sm:ml-9 p-3 sm:p-3.5 rounded-xl text-xs sm:text-sm leading-relaxed border flex items-start gap-2.5 transition-all",
                    isCorrect
                      ? "bg-emerald-50/60 border-emerald-200/80 text-emerald-900"
                      : "bg-blue-50/60 border-blue-200/80 text-slate-800"
                  )}
                >
                  <Lightbulb className={cn(
                    "w-4 h-4 shrink-0 mt-0.5",
                    isCorrect ? "text-emerald-600" : "text-blue-600"
                  )} />
                  <div className="flex-1">
                    <span className="font-bold mr-1">
                      {isCorrect ? "Excellent réflexe !" : "À retenir pour le TCF :"}
                    </span>
                    <span>{q.explanation}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══ Bilan final après complétion ═══ */}
      {isComplete && (
        <div className="mt-8 p-5 sm:p-6 rounded-2xl bg-[#0d233a] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="font-heading font-extrabold text-base sm:text-lg">
                Exercice terminé : {correctCount} / {totalQuestions} bonne{correctCount > 1 ? 's' : ''} réponse{correctCount > 1 ? 's' : ''}
              </p>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                {correctCount === totalQuestions
                  ? "Bravo ! Vous maîtrisez parfaitement l'alternance Passé Composé / Imparfait."
                  : correctCount >= 3
                  ? "Très bon résultat ! Relisez les quelques explications pour perfectionner vos écrits."
                  : "Entraînez-vous encore ! Relisez attentivement les règles et repères temporels ci-dessus."}
              </p>
            </div>
          </div>

          <Button
            onClick={handleReset}
            className="rounded-xl bg-white text-[#0d233a] hover:bg-slate-100 font-heading font-bold text-xs shrink-0 gap-1.5 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refaire le test</span>
          </Button>
        </div>
      )}
    </div>
  );
}
