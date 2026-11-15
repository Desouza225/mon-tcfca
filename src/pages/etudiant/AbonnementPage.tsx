import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { initializePaystackCheckout } from '@/services/paystack';
import { initializePawaPayCheckout } from '@/services/pawapay';
import { initializeCinetPayCheckout } from '@/services/cinetpay';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sparkles, Check, ArrowRight,
  FileCheck, Mic, ClipboardList, HelpCircle,
  AlertCircle, RefreshCw, Loader2,
  Smartphone, CreditCard, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CountryFlag } from '@/components/ui/CountryFlag';
import type { Abonnement } from '@/types/index';
import { PLANS_CONFIG } from '@/types/index';

export default function AbonnementPage() {
  const { user } = useAuth();
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);
  const [subscribingPlan, setSubscribingPlan] = useState<string | null>(null);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<string | null>(null);
  const [paymentProviderLoading, setPaymentProviderLoading] = useState<'pawapay' | 'cinetpay' | 'paystack' | null>(null);
  const [enabledMethods, setEnabledMethods] = useState<{ pawapay: boolean; cinetpay: boolean; paystack: boolean }>({
    pawapay: true,
    cinetpay: true,
    paystack: true,
  });

  const loadPaymentMethods = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('parametres_globaux')
        .select('valeur')
        .eq('cle', 'payment_methods_enabled')
        .maybeSingle();
      if (data?.valeur && typeof data.valeur === 'object') {
        const val = data.valeur as Record<string, unknown>;
        setEnabledMethods({
          pawapay: val.pawapay !== false,
          cinetpay: val.cinetpay !== false,
          paystack: val.paystack !== false,
        });
      }
    } catch (err) {
      console.error('Erreur chargement moyens de paiement:', err);
    }
  }, []);

  const loadSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('abonnements')
        .select('*')
        .or(`user_id.eq.${user.id},etudiant_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const row = data as (Abonnement & { statut?: string }) | null;
      if (row && (row.status === 'active' || row.status === 'actif' || row.statut === 'actif')) {
        setAbonnement(row);
      } else {
        setAbonnement(null);
      }
    } catch (err) {
      console.error('Erreur chargement abonnement:', err);
    }
  }, [user]);

  useEffect(() => {
    loadSubscription();
    loadPaymentMethods();
  }, [loadSubscription, loadPaymentMethods]);

  const [searchParams] = useSearchParams();
  const requestedPlanParam = searchParams.get('plan') || searchParams.get('renew');
  const highlightedPlanKey =
    requestedPlanParam && PLANS_CONFIG[requestedPlanParam] ? requestedPlanParam : null;

  const isMobileMoney = abonnement?.methode === 'mobile_money' || !abonnement?.auto_renew;
  const expirationDate = abonnement?.current_period_end || abonnement?.date_fin;
  const daysRemaining = expirationDate
    ? Math.ceil((new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isExpired = daysRemaining !== null && daysRemaining <= 0;
  const isExpiringSoon = daysRemaining !== null && daysRemaining <= 5;

  const rawStatus = abonnement
    ? abonnement.status || (abonnement as { statut?: string }).statut
    : null;
  const hasActiveSub =
    !!abonnement &&
    (rawStatus === 'active' || rawStatus === 'actif') &&
    !isExpired;
  const activePlanId = hasActiveSub ? (abonnement?.plan_id || 'standard') : null;
  const activePlan = activePlanId ? PLANS_CONFIG[activePlanId] : null;

  const handleSelectPlan = (planKey: string) => {
    if (!user) {
      toast.error('Veuillez vous connecter pour souscrire à une formule.');
      return;
    }
    setSelectedPlanForPayment(planKey);
  };

  const handlePayWithPawaPay = async (planKey: string) => {
    try {
      setPaymentProviderLoading('pawapay');
      setSubscribingPlan(planKey);
      toast.loading(`Initialisation Mobile Money PawaPay (${PLANS_CONFIG[planKey]?.nom})...`, { id: 'payment-checkout' });

      const res = await initializePawaPayCheckout(planKey);

      if (res.error) {
        toast.error(res.error, { id: 'payment-checkout' });
        return;
      }

      const checkoutUrl = res.redirectUrl || res.url;
      if (checkoutUrl) {
        toast.success('Redirection vers PawaPay (Orange, MTN, Wave, Moov, Airtel)...', { id: 'payment-checkout' });
        window.location.href = checkoutUrl;
      } else {
        toast.error('Impossible de récupérer le lien de paiement PawaPay.', { id: 'payment-checkout' });
      }
    } catch (err: any) {
      console.error('Erreur souscription plan PawaPay:', err);
      toast.error(err?.message || 'Une erreur est survenue lors de la redirection PawaPay.', { id: 'payment-checkout' });
    } finally {
      setPaymentProviderLoading(null);
      setSubscribingPlan(null);
    }
  };

  const handlePayWithPaystack = async (planKey: string) => {
    try {
      setPaymentProviderLoading('paystack');
      setSubscribingPlan(planKey);
      toast.loading(`Initialisation du paiement Paystack (${PLANS_CONFIG[planKey]?.nom})...`, { id: 'payment-checkout' });

      const res = await initializePaystackCheckout(planKey);

      if (res.error) {
        toast.error(res.error, { id: 'payment-checkout' });
        return;
      }

      const checkoutUrl = res.authorization_url || res.url;
      if (checkoutUrl) {
        toast.success('Redirection vers Paystack (Carte, Wave, Orange, MTN)...', { id: 'payment-checkout' });
        window.location.href = checkoutUrl;
      } else {
        toast.error('Impossible de récupérer le lien de paiement Paystack.', { id: 'payment-checkout' });
      }
    } catch (err: any) {
      console.error('Erreur souscription plan Paystack:', err);
      toast.error(err?.message || 'Une erreur est survenue lors de la redirection Paystack.', { id: 'payment-checkout' });
    } finally {
      setPaymentProviderLoading(null);
      setSubscribingPlan(null);
    }
  };

  const handlePayWithCinetPay = async (planKey: string) => {
    try {
      setPaymentProviderLoading('cinetpay');
      setSubscribingPlan(planKey);
      toast.loading(`Initialisation du paiement CinetPay (${PLANS_CONFIG[planKey]?.nom})...`, { id: 'payment-checkout' });

      const res = await initializeCinetPayCheckout(planKey);

      if (res.error) {
        toast.error(res.error, { id: 'payment-checkout' });
        return;
      }

      const checkoutUrl = res.paymentUrl || res.url;
      if (checkoutUrl) {
        toast.success('Redirection vers CinetPay (Mobile Money & Carte)...', { id: 'payment-checkout' });
        window.location.href = checkoutUrl;
      } else {
        toast.error('Impossible de récupérer le lien de paiement CinetPay.', { id: 'payment-checkout' });
      }
    } catch (err: any) {
      console.error('Erreur souscription plan CinetPay:', err);
      toast.error(err?.message || 'Une erreur est survenue lors de la redirection CinetPay.', { id: 'payment-checkout' });
    } finally {
      setPaymentProviderLoading(null);
      setSubscribingPlan(null);
    }
  };

  const chosenPlan = selectedPlanForPayment ? PLANS_CONFIG[selectedPlanForPayment] : null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16 fade-in">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe] text-xs font-heading font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#d97706]" />
            <span>Coaching &amp; Préparation TCF Canada</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a] tracking-tight">
            Mon Abonnement &amp; Quotas
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5">
            Gérez votre formule d'entraînement, suivez vos corrections disponibles et optimisez votre préparation.
          </p>
        </div>
      </div>


      {/* ═══ État Actif ou Sans Abonnement ═══ */}
      {hasActiveSub && activePlan ? (
        <Card className="rounded-2xl border border-[#d3e4fe] shadow-sm bg-gradient-to-br from-[#0d233a] to-[#1a365d] text-white overflow-hidden">
          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs font-semibold px-2.5 py-0.5">
                    ● Abonnement Actif
                  </Badge>
                  <span className="text-xs text-white/70">
                    Formule {activePlan.nom} ({activePlan.prix_usd ? `${activePlan.prix_usd.toFixed(2)} $ USD` : ''})
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-white">
                  Formule {activePlan.nom}
                </h2>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-xs text-white/60 block">Période en cours</span>
                <span className="font-heading font-bold text-sm text-[#ffdcc3]">
                  {abonnement?.current_period_end
                    ? `Valable jusqu'au ${new Date(abonnement.current_period_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : 'Abonnement en cours'}
                </span>
              </div>
            </div>

            {/* Quotas disponibles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Quota EE */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span className="flex items-center gap-1.5 font-medium">
                    <FileCheck className="w-4 h-4 text-[#d97706]" />
                    Corrections Écrites (EE)
                  </span>
                  <span className="font-bold text-white">
                    {abonnement?.quota_ee_restant ?? activePlan.quota_ee} / {activePlan.quota_ee}
                  </span>
                </div>
                <Progress
                  value={Math.round(((abonnement?.quota_ee_restant ?? activePlan.quota_ee) / activePlan.quota_ee) * 100)}
                  className="h-2 bg-white/10 [&>div]:bg-[#d97706]"
                />
                <p className="text-[11px] text-white/60">Restantes pour vos devoirs de rédaction</p>
              </div>

              {/* Quota EO */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span className="flex items-center gap-1.5 font-medium">
                    <Mic className="w-4 h-4 text-[#e53e3e]" />
                    Corrections Orales (EO)
                  </span>
                  <span className="font-bold text-white">
                    {abonnement?.quota_eo_restant ?? activePlan.quota_eo} / {activePlan.quota_eo}
                  </span>
                </div>
                <Progress
                  value={Math.round(((abonnement?.quota_eo_restant ?? activePlan.quota_eo) / activePlan.quota_eo) * 100)}
                  className="h-2 bg-white/10 [&>div]:bg-[#e53e3e]"
                />
                <p className="text-[11px] text-white/60">Restantes pour vos enregistrements audio</p>
              </div>

              {/* Quota Examens Blancs */}
              <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs text-white/80">
                  <span className="flex items-center gap-1.5 font-medium">
                    <ClipboardList className="w-4 h-4 text-emerald-400" />
                    Examens Blancs complets
                  </span>
                  <span className="font-bold text-white">
                    {abonnement?.quota_examen_blanc_restant ?? activePlan.quota_examen_blanc} / {activePlan.quota_examen_blanc}
                  </span>
                </div>
                <Progress
                  value={Math.round(((abonnement?.quota_examen_blanc_restant ?? activePlan.quota_examen_blanc) / activePlan.quota_examen_blanc) * 100)}
                  className="h-2 bg-white/10 [&>div]:bg-emerald-400"
                />
                <p className="text-[11px] text-white/60">Simulations officielles chronométrées</p>
              </div>
            </div>

            {/* Alerte Expiration & Bouton Renouveler Mobile Money */}
            {isExpiringSoon && (
              <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-rose-500/15 to-amber-500/20 border border-amber-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-heading font-bold text-amber-200 text-sm">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      {daysRemaining !== null && daysRemaining <= 0
                        ? "Votre formule expire aujourd'hui !"
                        : `Votre formule expire dans ${daysRemaining} jour${daysRemaining && daysRemaining > 1 ? 's' : ''}.`}
                    </span>
                  </div>
                  <p className="text-white/80 text-xs">
                    {isMobileMoney
                      ? "Le paiement par Mobile Money ne se renouvelle pas automatiquement. Renouvelez dès maintenant pour conserver vos devoirs, corrections et votre accès illimité."
                      : "Pensez à renouveler votre formule pour poursuivre votre préparation sans interruption."}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleSelectPlan(activePlanId || 'standard')}
                  disabled={!!subscribingPlan}
                  className="rounded-xl bg-[#e53e3e] hover:bg-[#c53030] text-white font-heading font-bold text-xs gap-1.5 shadow-md shadow-[#e53e3e]/30 shrink-0 h-9 px-4"
                >
                  {subscribingPlan ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Renouveler ma formule</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        /* Invitation / État Sans Abonnement */
        <Card className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/70 to-orange-50/40 p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-semibold">
                <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                <span>Aucun abonnement actif</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-[#0d233a]">
                Débloquez votre préparation complète TCF Canada
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Choisissez l'une de nos formules de coaching pour accéder en illimité à la banque complète de 4 320 items officiels (3 120 questions QCM CE &amp; CO et 1 200 tâches d'expression EE &amp; EO), aux fiches méthodologiques et aux corrections personnalisées.
              </p>
            </div>

            <Button
              onClick={() => handleSelectPlan(highlightedPlanKey || 'standard')}
              disabled={!!subscribingPlan}
              className="rounded-xl bg-[#e53e3e] hover:bg-[#c53030] text-white font-heading font-bold shadow-md shadow-[#e53e3e]/20 gap-2 shrink-0"
            >
              {subscribingPlan === (highlightedPlanKey || 'standard') ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>
                    S'abonner (Formule {PLANS_CONFIG[highlightedPlanKey || 'standard']?.nom}{' '}
                    {PLANS_CONFIG[highlightedPlanKey || 'standard']?.prix_usd.toFixed(2).replace('.', ',')} $)
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* ═══ Grille des 4 Formules Mon TCFCA ═══ */}
      <div className="space-y-4">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h2 className="text-xl sm:text-2xl font-heading font-extrabold text-[#0d233a]">
            Nos Formules d'Accompagnement
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Tarifs transparents en Dollars américains (USD). Paiement sécurisé par carte bancaire (Visa / Mastercard) et moyens internationaux.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {Object.entries(PLANS_CONFIG).filter(([k]) => k !== 'pack_express').map(([key, plan]) => {
            const isPopular = highlightedPlanKey ? highlightedPlanKey === key : plan.is_popular;
            const isCurrent = hasActiveSub && activePlanId === key;
            const isSubmitting = subscribingPlan === key;

            return (
              <Card
                key={key}
                className={cn(
                  'rounded-2xl transition-all duration-200 flex flex-col justify-between relative overflow-hidden',
                  isPopular
                    ? 'border-2 border-[#0d233a] shadow-lg shadow-[#0d233a]/10 bg-white ring-1 ring-[#0d233a]/10'
                    : 'border border-slate-200 shadow-xs bg-white hover:border-slate-300'
                )}
              >
                {/* Badge en haut */}
                {plan.badge && (
                  <div className="bg-[#0d233a] text-white text-[11px] font-heading font-extrabold py-1 px-3 text-center tracking-wider">
                    {plan.badge}
                  </div>
                )}

                <CardHeader className={cn('p-5', plan.badge ? 'pt-4' : '')}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <CardTitle className="font-heading font-extrabold text-lg text-[#0d233a]">
                      {plan.nom}
                    </CardTitle>
                    {isCurrent && (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                        Formule active
                      </Badge>
                    )}
                  </div>

                  <div className="pt-2 pb-1">
                    <span className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a]">
                      {plan.prix_usd.toFixed(2)} $
                    </span>
                    <span className="text-xs text-slate-500 font-medium ml-1">
                      USD / {plan.duree_jours === 30 ? 'mois' : `${plan.duree_jours} jours`}
                    </span>
                  </div>

                  <CardDescription className="text-xs text-slate-500 leading-relaxed min-h-[36px]">
                    {plan.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4 flex-1 flex flex-col justify-between">
                  {/* Quotas clés */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between font-medium text-slate-700">
                      <span>Corrections EE :</span>
                      <strong className="text-[#0d233a]">{plan.quota_ee} incluses</strong>
                    </div>
                    <div className="flex items-center justify-between font-medium text-slate-700">
                      <span>Corrections EO :</span>
                      <strong className="text-[#0d233a]">{plan.quota_eo} incluses</strong>
                    </div>
                    <div className="flex items-center justify-between font-medium text-slate-700">
                      <span>Examens blancs :</span>
                      <strong className="text-[#0d233a]">{plan.quota_examen_blanc} inclus</strong>
                    </div>
                  </div>

                  {/* Avantages */}
                  <ul className="space-y-2 text-xs text-slate-600 flex-1">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    onClick={() => handleSelectPlan(key)}
                    disabled={!!subscribingPlan}
                    className={cn(
                      'w-full rounded-xl text-xs font-heading font-bold shadow-xs transition-all mt-4',
                      isPopular
                        ? 'bg-[#e53e3e] hover:bg-[#c53030] text-white shadow-md shadow-[#e53e3e]/20'
                        : isCurrent
                        ? 'bg-slate-100 text-[#0d233a] hover:bg-slate-200'
                        : 'bg-[#0d233a] hover:bg-[#1a365d] text-white'
                    )}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        <span>Sélection en cours...</span>
                      </>
                    ) : isCurrent ? (
                      'Renouveler ce pack'
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <span>Choisir ({plan.prix_usd.toFixed(2)} $)</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ═══ Modal de Choix du Moyen de Paiement (PawaPay Mobile Money vs Paystack) ═══ */}
      <Dialog
        open={!!selectedPlanForPayment}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPlanForPayment(null);
            setPaymentProviderLoading(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white">
          <DialogHeader className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe] text-xs font-heading font-semibold w-fit">
              <Sparkles className="w-3.5 h-3.5 text-[#d97706]" />
              <span>Finalisation de votre formule</span>
            </div>
            <DialogTitle className="text-xl font-heading font-extrabold text-[#0d233a]">
              Choisir votre moyen de paiement
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Formule{' '}
              <strong className="text-[#0d233a]">
                {chosenPlan ? chosenPlan.nom : ''}
              </strong>{' '}
              • {chosenPlan?.prix_usd.toFixed(2)} $ USD{' '}
              {chosenPlan?.prix_fcfa ? `(~${chosenPlan.prix_fcfa.toLocaleString('fr-FR')} FCFA)` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-3">
            {/* Option 1: PawaPay - Mobile Money Afrique */}
            {/* Option 1: PawaPay - Mobile Money Afrique (15+ pays) */}
            {enabledMethods.pawapay && (
            <button
              type="button"
              onClick={() => !paymentProviderLoading && selectedPlanForPayment && handlePayWithPawaPay(selectedPlanForPayment)}
              disabled={!!paymentProviderLoading}
              className={cn(
                "w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-2 relative",
                paymentProviderLoading === 'pawapay'
                  ? "border-[#0d233a] bg-blue-50/40 pointer-events-none opacity-80"
                  : "border-slate-200 hover:border-[#0d233a] hover:bg-slate-50/80 bg-white"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#d97706] border border-amber-200/60 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5 text-[#d97706]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-sm text-[#0d233a]">
                        Mobile Money (PawaPay)
                      </span>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold py-0 px-1.5">
                        Afrique (15+ pays)
                      </Badge>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Orange, MTN, Wave, Moov, Airtel, M-Pesa...
                    </span>
                  </div>
                </div>
                {paymentProviderLoading === 'pawapay' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#0d233a]" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pl-11">
                Paiement direct en FCFA / monnaies locales en Côte d'Ivoire, Sénégal, Bénin, Cameroun, RDC, Togo, Burkina, Mali, etc.
              </p>
            </button>
            )}

            {/* Option 2: CinetPay - Mobile Money & Carte Bancaire (Afrique de l'Ouest & Centrale) */}
            {enabledMethods.cinetpay && (
            <button
              type="button"
              onClick={() => !paymentProviderLoading && selectedPlanForPayment && handlePayWithCinetPay(selectedPlanForPayment)}
              disabled={!!paymentProviderLoading}
              className={cn(
                "w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-2 relative",
                paymentProviderLoading === 'cinetpay'
                  ? "border-[#0d233a] bg-blue-50/40 pointer-events-none opacity-80"
                  : "border-slate-200 hover:border-[#0d233a] hover:bg-slate-50/80 bg-white"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center justify-center shrink-0">
                    <Smartphone className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-sm text-[#0d233a]">
                        CinetPay (Mobile Money &amp; Carte)
                      </span>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold py-0 px-1.5">
                        UEMOA &amp; CEMAC
                      </Badge>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Orange Money, MTN, Moov, Wave, Visa / Mastercard
                    </span>
                  </div>
                </div>
                {paymentProviderLoading === 'cinetpay' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#0d233a]" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pl-11 flex items-center flex-wrap gap-1">
                <span>Guichet CinetPay en FCFA : Mobile Money (</span>
                {['CI', 'SN', 'ML', 'BF', 'TG', 'BJ', 'CM', 'CD', 'GN'].map((code) => (
                  <CountryFlag key={code} country={code} imgClassName="w-4 h-2.5" />
                ))}
                <span>) et cartes bancaires.</span>
              </p>
            </button>
            )}

            {/* Option 3: Paystack - Carte bancaire & Mobile Money */}
            {enabledMethods.paystack && (
            <button
              type="button"
              onClick={() => !paymentProviderLoading && selectedPlanForPayment && handlePayWithPaystack(selectedPlanForPayment)}
              disabled={!!paymentProviderLoading}
              className={cn(
                "w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col gap-2 relative",
                paymentProviderLoading === 'paystack'
                  ? "border-[#0d233a] bg-blue-50/40 pointer-events-none opacity-80"
                  : "border-slate-200 hover:border-[#0d233a] hover:bg-slate-50/80 bg-white"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0d233a] border border-blue-200/60 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-[#0d233a]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-sm text-[#0d233a]">
                        Carte bancaire &amp; Paystack
                      </span>
                      <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] font-semibold py-0 px-1.5">
                        International
                      </Badge>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Visa, Mastercard, Wave, Orange, MTN
                    </span>
                  </div>
                </div>
                {paymentProviderLoading === 'paystack' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#0d233a]" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pl-11">
                Idéal si vous disposez d'une carte Visa / Mastercard ou préférez le portail Paystack.
              </p>
            </button>
            )}

            {!enabledMethods.pawapay && !enabledMethods.cinetpay && !enabledMethods.paystack && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center text-xs text-amber-800">
                Aucun moyen de paiement n'est actuellement disponible. Veuillez réessayer ultérieurement.
              </div>
            )}
          </div>

          <div className="pt-2 text-center">
            <span className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Transactions chiffrées &amp; activation immédiate des quotas
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Section FAQ ═══ */}
      <Card className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
        <h3 className="font-heading font-bold text-lg text-[#0d233a] flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[#d97706]" />
          <span>Questions fréquentes sur les paiements</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm text-slate-600">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <h4 className="font-heading font-bold text-[#0d233a]">Quels sont les réseaux Mobile Money acceptés ?</h4>
            <p className="leading-relaxed text-slate-500">
              Nous acceptons Orange Money, MTN MoMo, Wave, Moov Money, Airtel Money et M-Pesa dans plus de 15 pays africains (Côte d'Ivoire, Sénégal, Bénin, Cameroun, RDC, Togo, Mali, Burkina Faso, etc.).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <h4 className="font-heading font-bold text-[#0d233a]">Puis-je payer par carte bancaire internationale ?</h4>
            <p className="leading-relaxed text-slate-500">
              Oui, toutes les cartes bancaires Visa et Mastercard internationales sont acceptées en toute sécurité.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <h4 className="font-heading font-bold text-[#0d233a]">Quand mes accès et quotas sont-ils activés ?</h4>
            <p className="leading-relaxed text-slate-500">
              Instantanément dès que vous validez votre code sur votre téléphone ou confirmez votre carte. Vous êtes immédiatement redirigé avec vos quotas et devoirs débloqués.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
            <h4 className="font-heading font-bold text-[#0d233a]">Y a-t-il un prélèvement automatique ?</h4>
            <p className="leading-relaxed text-slate-500">
              Non, vos paiements (Mobile Money comme carte bancaire) ne font l'objet d'aucun prélèvement automatique. Vous renouvelez votre formule uniquement lorsque vous le souhaitez.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
