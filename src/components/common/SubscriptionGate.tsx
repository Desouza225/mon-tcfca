import type React from 'react';
import { Link } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

interface SubscriptionGateProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  moduleName?: string;
}

export function SubscriptionGate({
  children,
  fallbackTitle = 'Abonnement requis pour accéder à ce module',
  fallbackDescription = 'Accédez à l’intégralité des 4 320 items officiels (3 120 questions QCM CE & CO et 1 200 tâches EE & EO), aux fiches méthodologiques et aux corrections personnalisées avec l’une de nos 4 formules Mon TCFCA.',
  moduleName: _moduleName = 'ce module',
}: SubscriptionGateProps) {
  const { hasActiveSubscription, loading, isAdmin } = useSubscription();

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 p-6">
        <Skeleton className="h-12 w-3/4 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  // Si l'utilisateur est admin ou possède un abonnement actif -> afficher le contenu
  if (isAdmin || hasActiveSubscription) {
    return <>{children}</>;
  }

  // Écran d'invitation à s'abonner
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 fade-in">
      <Card className="rounded-3xl border-2 border-[#0d233a]/15 shadow-xl bg-white overflow-hidden text-center">
        <div className="bg-gradient-to-r from-[#0d233a] to-[#1a365d] p-8 text-white relative">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Lock className="w-8 h-8 text-[#d97706]" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#d97706]" />
            <span>Formule de coaching requise</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">
            {fallbackTitle}
          </h2>
          <p className="text-xs sm:text-sm text-white/80 mt-2 max-w-xl mx-auto leading-relaxed">
            {fallbackDescription}
          </p>
        </div>

        <CardContent className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0d233a] mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Banque officielle</span>
              </div>
              <p className="text-[11px] text-slate-500">3 120 questions CE &amp; CO + 1 200 tâches</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0d233a] mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Corrections FEI</span>
              </div>
              <p className="text-[11px] text-slate-500">Double relecture détaillée EE &amp; EO</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-xs font-bold text-[#0d233a] mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Examens blancs</span>
              </div>
              <p className="text-[11px] text-slate-500">Conditions réelles chronométrées</p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild className="w-full sm:w-auto rounded-xl bg-[#e53e3e] hover:bg-[#c53030] text-white font-heading font-bold px-8 shadow-md shadow-[#e53e3e]/20 gap-2">
              <Link to="/etudiant/abonnement">
                <span>Découvrir nos formules (Dès 14,99 $)</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" className="w-full sm:w-auto rounded-xl text-slate-600 hover:text-[#0d233a]">
              <Link to="/etudiant">
                <span>Retour au tableau de bord</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
