import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import BrandLogo from '@/components/common/BrandLogo';
import {
  CheckCircle2, Sparkles, ArrowRight, BookOpen, PenLine,
  Mic, Award, ShieldCheck
} from 'lucide-react';
import { PLANS_CONFIG } from '@/types/index';

export default function AbonnementSuccessPage() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref') || searchParams.get('session_id');
  const depositId = searchParams.get('deposit_id') || searchParams.get('depositId');
  const cinetpayTxId = searchParams.get('transaction_id') || searchParams.get('cpm_trans_id');
  const providerParam = searchParams.get('provider');
  const { abonnement, refreshSubscription } = useSubscription();

  const isPawaPay = providerParam === 'pawapay' || !!depositId || abonnement?.provider === 'pawapay';
  const isCinetPay = providerParam === 'cinetpay' || !!cinetpayTxId || abonnement?.provider === 'cinetpay';

  useEffect(() => {
    let isMounted = true;

    async function checkTransaction() {
      if (depositId) {
        try {
          const { verifyPawaPayTransaction } = await import('@/services/pawapay');
          await verifyPawaPayTransaction(depositId);
        } catch (e) {
          console.warn('PawaPay verification attempt done:', e);
        }
      } else if (cinetpayTxId) {
        try {
          const { verifyCinetPayTransaction } = await import('@/services/cinetpay');
          await verifyCinetPayTransaction(cinetpayTxId);
        } catch (e) {
          console.warn('CinetPay verification attempt done:', e);
        }
      } else if (reference) {
        try {
          const { verifyPaystackTransaction } = await import('@/services/paystack');
          await verifyPaystackTransaction(reference);
        } catch (e) {
          console.warn('Paystack verification attempt done:', e);
        }
      }
      if (isMounted) {
        refreshSubscription?.();
      }
    }

    checkTransaction();

    const timer = setTimeout(() => {
      if (isMounted) {
        refreshSubscription?.();
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [reference, depositId, cinetpayTxId, refreshSubscription]);

  const activePlanId = abonnement?.plan_id || 'standard';
  const plan = PLANS_CONFIG[activePlanId] || PLANS_CONFIG.standard;

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      <div className="w-full max-w-2xl space-y-6">
        {/* Brand Header */}
        <div className="flex justify-center">
          <Link to="/" className="hover:scale-105 transition-transform">
            <BrandLogo size="lg" showSubtitle />
          </Link>
        </div>

        {/* Success Card */}
        <Card className="rounded-3xl border border-[#d3e4fe] shadow-xl bg-white overflow-hidden">
          {/* Header Gradient */}
          <div className="bg-gradient-to-r from-[#0d233a] via-[#1a365d] to-[#0d233a] p-8 sm:p-10 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />

            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-400/40 text-emerald-300 flex items-center justify-center mx-auto mb-4 shadow-lg animate-bounce">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#d97706]" />
              <span>
                {isPawaPay
                  ? 'Paiement Validé & Sécurisé par PawaPay (Mobile Money)'
                  : isCinetPay
                  ? 'Paiement Validé & Sécurisé par CinetPay'
                  : 'Paiement Validé & Sécurisé par Paystack'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight">
              Bienvenue dans la préparation Mon TCFCA !
            </h1>

            <p className="text-xs sm:text-sm text-white/80 mt-2 max-w-md mx-auto leading-relaxed">
              Votre formule <strong>{plan.nom}</strong> est désormais active. Vos quotas de corrections personnalisées et l'accès illimité à la banque ont été débloqués.
            </p>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Quotas Reçus */}
            <div className="space-y-3">
              <h2 className="text-xs font-heading font-bold text-[#475569] uppercase tracking-wider text-center">
                Vos avantages et quotas activés
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-[#f8f9ff] border border-[#e2e8f0] text-center space-y-1">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#d97706] flex items-center justify-center mx-auto">
                    <PenLine className="w-4 h-4 text-[#d97706]" />
                  </div>
                  <div className="text-lg font-heading font-extrabold text-[#0d233a]">
                    {plan.quota_ee} devoirs
                  </div>
                  <div className="text-[11px] text-[#64748b]">Corrections écrites (EE)</div>
                </div>

                <div className="p-4 rounded-2xl bg-[#f8f9ff] border border-[#e2e8f0] text-center space-y-1">
                  <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#e53e3e] flex items-center justify-center mx-auto">
                    <Mic className="w-4 h-4 text-[#e53e3e]" />
                  </div>
                  <div className="text-lg font-heading font-extrabold text-[#0d233a]">
                    {plan.quota_eo} oraux
                  </div>
                  <div className="text-[11px] text-[#64748b]">Corrections orales (EO)</div>
                </div>

                <div className="p-4 rounded-2xl bg-[#f8f9ff] border border-[#e2e8f0] text-center space-y-1">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0d233a] flex items-center justify-center mx-auto">
                    <Award className="w-4 h-4 text-[#0d233a]" />
                  </div>
                  <div className="text-lg font-heading font-extrabold text-[#0d233a]">
                    {plan.quota_examen_blanc} examens
                  </div>
                  <div className="text-[11px] text-[#64748b]">Examens blancs complets</div>
                </div>
              </div>
            </div>

            {/* Banque Complète */}
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/60 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-900 leading-relaxed">
                Accès complet aux <strong>4 320 items officiels</strong> (3 120 questions QCM CE/CO + 1 200 tâches réelles EE/EO) et à toutes les fiches pédagogiques.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto rounded-xl bg-[#0d233a] hover:bg-[#1a365d] text-white font-heading font-bold px-8 shadow-md gap-2"
              >
                <Link to="/etudiant/entrainement">
                  <span>Démarrer un entraînement</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto rounded-xl border-[#e2e8f0] text-[#0d233a] hover:bg-[#eff4ff] font-semibold text-xs"
              >
                <Link to="/etudiant/cours">
                  <BookOpen className="w-4 h-4 mr-1.5" />
                  <span>Consulter les cours</span>
                </Link>
              </Button>
            </div>

            <div className="text-center pt-2">
              <Link to="/etudiant/abonnement" className="text-xs text-[#64748b] hover:text-[#0d233a] underline">
                Accéder au suivi de mes quotas et de mon abonnement
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
