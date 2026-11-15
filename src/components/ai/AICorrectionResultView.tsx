import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, AlertTriangle, Sparkles, RefreshCw,
  Mic, Volume2, TrendingUp, BookOpen
} from 'lucide-react';
import type { AICorrectionResult, CorrectionResponse } from '@/services/aiCorrection';

interface AICorrectionResultViewProps {
  data: CorrectionResponse;
  onNewAttempt?: () => void;
  onBackToList?: () => void;
}

const CECRL_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  'A1 non atteint': { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300' },
  'A1': { bg: 'bg-red-50 text-red-700', text: 'text-red-700', border: 'border-red-200' },
  'A2': { bg: 'bg-orange-50 text-orange-700', text: 'text-orange-700', border: 'border-orange-200' },
  'B1': { bg: 'bg-amber-50 text-amber-700', text: 'text-amber-700', border: 'border-amber-200' },
  'B2': { bg: 'bg-blue-50 text-blue-700', text: 'text-blue-700', border: 'border-blue-200' },
  'C1': { bg: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-700', border: 'border-emerald-300' },
  'C2': { bg: 'bg-purple-50 text-purple-700', text: 'text-purple-700', border: 'border-purple-300' },
};

export default function AICorrectionResultView({
  data,
  onNewAttempt,
  onBackToList,
}: AICorrectionResultViewProps) {
  const { submission, correction, quota_restant } = data;
  const evalData: AICorrectionResult =
    correction.evaluation || (correction as unknown as AICorrectionResult);

  const isEO = submission.task_type.startsWith('EO');
  const cecrl = correction.niveau_cecrl || evalData.niveau_cecrl || 'B2';
  const badgeColors = CECRL_BADGES[cecrl] || CECRL_BADGES.B2;

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* ═══ Header Bilan Note Globale & CECRL (Sans sous-totaux) ═══ */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 border-b border-slate-100 pb-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="bg-[#eff4ff] text-[#0d233a] border-[#d3e4fe] font-semibold text-xs px-2.5 py-0.5">
                <Sparkles className="w-3.5 h-3.5 text-[#d97706] mr-1" />
                Correction par notre IA
              </Badge>
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5">
                {isEO ? 'Expression Orale' : 'Expression Écrite'} · {submission.task_type.replace('_', ' ')}
              </Badge>
              {quota_restant !== undefined && (
                <Badge variant="secondary" className="text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
                  Quota restant : {quota_restant}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a]">
              Résultat de votre évaluation
            </h1>
          </div>

          {/* Note Totale Uniquement */}
          <div className="flex items-center gap-4 self-start sm:self-auto bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="text-center pr-4 border-r border-slate-200">
              <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">Note totale</span>
              <span className="text-3xl sm:text-4xl font-extrabold text-[#0d233a] tracking-tight">
                {correction.total}
                <span className="text-base text-slate-400 font-normal">/20</span>
              </span>
            </div>
            <div className="text-center pl-1">
              <span className="text-xs font-medium text-slate-500 block uppercase tracking-wider">Niveau indicatif</span>
              <span className={`inline-block px-3 py-1 mt-1 rounded-xl font-bold text-lg border ${badgeColors.bg} ${badgeColors.text} ${badgeColors.border}`}>
                {cecrl}
              </span>
            </div>
          </div>
        </div>

        {/* ═══ Appréciation générale ═══ */}
        {evalData.appreciation_generale && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 text-sm text-slate-800 leading-relaxed font-medium">
            {evalData.appreciation_generale}
          </div>
        )}

        {/* ═══ Commentaire global structuré : Ce qui est bon / Ce qui n'est pas bon / Marge de progression ═══ */}
        <div className="space-y-4 pt-2">
          {/* Ce qui est bon */}
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
            <h3 className="text-xs font-bold text-emerald-900 uppercase tracking-wide flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Ce qui est bon
            </h3>
            <ul className="text-xs sm:text-sm text-emerald-950 space-y-1.5 list-disc list-inside">
              {evalData.points_forts && evalData.points_forts.length > 0 ? (
                evalData.points_forts.map((pf) => <li key={pf}>{pf}</li>)
              ) : (
                <li>Le sujet a été compris et la communication est assurée.</li>
              )}
            </ul>
          </div>

          {/* Ce qui n'est pas bon */}
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2">
            <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              Ce qui n'est pas bon
            </h3>
            <ul className="text-xs sm:text-sm text-amber-950 space-y-1.5 list-disc list-inside">
              {evalData.points_faibles && evalData.points_faibles.length > 0 ? (
                evalData.points_faibles.map((pf) => <li key={pf}>{pf}</li>)
              ) : (
                <li>Quelques maladresses lexicales et des structures de phrases à diversifier.</li>
              )}
            </ul>
          </div>

          {/* Marge de progression */}
          <div className="p-4 rounded-xl bg-[#eff4ff] border border-[#d3e4fe] space-y-2">
            <h3 className="text-xs font-bold text-[#0d233a] uppercase tracking-wide flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary shrink-0" />
              Marge de progression
            </h3>
            <div className="text-xs sm:text-sm text-slate-800 space-y-1.5">
              {evalData.plan_progression?.priorites && evalData.plan_progression.priorites.length > 0 ? (
                <ul className="space-y-1 list-disc list-inside">
                  {evalData.plan_progression.priorites.map((prio) => (
                    <li key={prio}>{prio}</li>
                  ))}
                </ul>
              ) : (
                <p>Enrichissez vos connecteurs logiques et soignez les accords grammaticaux lors de vos prochaines rédactions.</p>
              )}

              {evalData.plan_progression?.objectif_prochaine_seance && (
                <p className="pt-1 font-semibold text-primary">
                  🎯 Objectif pour la prochaine séance : {evalData.plan_progression.objectif_prochaine_seance}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Si Oral : Transcription audio et lecteur ═══ */}
      {isEO && submission.raw_text && (
        <Card className="rounded-2xl border border-[#d3e4fe] shadow-xs bg-[#f8fbff]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-heading font-bold text-[#0d233a] flex items-center gap-2">
                <Mic className="w-4 h-4 text-[#e53e3e]" />
                Transcription de votre enregistrement
              </CardTitle>
              {submission.file_url && (
                <a
                  href={submission.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Réécouter mon audio
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="p-3.5 rounded-xl bg-white border border-[#d3e4fe]/60 text-xs sm:text-sm text-slate-800 leading-relaxed italic">
              « {submission.raw_text} »
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Version corrigée et améliorée ═══ */}
      {evalData.version_amelioree && (
        <Card className="rounded-2xl border border-purple-200 bg-purple-50/30 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-purple-950 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-600" />
              Version corrigée et améliorée
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs sm:text-sm">
            <div className="p-4 rounded-xl bg-white border border-purple-200 text-slate-900 leading-relaxed whitespace-pre-wrap font-sans">
              {evalData.version_amelioree}
            </div>

            {evalData.explications_amelioration && (
              <div className="p-3 bg-white/80 rounded-xl border border-purple-100 text-xs text-slate-700 space-y-1">
                <span className="font-bold text-purple-900 block">Pourquoi cette version est meilleure :</span>
                {evalData.explications_amelioration.contenu && (
                  <p><strong>Contenu :</strong> {evalData.explications_amelioration.contenu}</p>
                )}
                {evalData.explications_amelioration.organisation && (
                  <p><strong>Organisation :</strong> {evalData.explications_amelioration.organisation}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ Actions de fin ═══ */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {onNewAttempt && (
          <Button onClick={onNewAttempt} className="flex-1 gap-2 shadow-xs bg-[#0d233a] hover:bg-[#1a365d] text-white">
            <RefreshCw className="w-4 h-4" />
            S'entraîner sur un autre sujet
          </Button>
        )}
        {onBackToList && (
          <Button onClick={onBackToList} variant="outline" className="flex-1">
            Retour aux épreuves
          </Button>
        )}
      </div>
    </div>
  );
}
