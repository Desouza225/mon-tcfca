import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileCheck,
  Loader2,
  Mic,
  Plus,
  Sliders,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PLANS_CONFIG, type Profile } from '@/types/index';
import { CountryFlag } from '@/components/ui/CountryFlag';
import {
  ADMIN_PLAN_KEYS,
  type AdminPlanKey,
  type UserSubscriptionInfo,
  activateManualSubscription,
  deactivateManualSubscription,
  fetchUserLatestSubscription,
  updateManualQuotas,
} from '@/services/adminSubscription';

export interface AdminManagedUser
  extends Pick<Profile, 'id' | 'prenom' | 'nom' | 'email' | 'role'> {
  telephone?: string | null;
  pays?: string | null;
}

interface AdminSubscriptionQuotaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminManagedUser | null;
  initialSubscription?: UserSubscriptionInfo | null;
  onUpdated?: () => void;
}

const DURATION_PRESETS = [
  { label: '7j', days: 7 },
  { label: '14j', days: 14 },
  { label: '30j', days: 30 },
  { label: '40j', days: 40 },
  { label: '90j', days: 90 },
  { label: '1 an', days: 365 },
];

const EXTEND_PRESETS = [
  { label: '+0j', days: 0 },
  { label: '+7j', days: 7 },
  { label: '+14j', days: 14 },
  { label: '+30j', days: 30 },
];

function formatDateFr(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toInputDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function AdminSubscriptionQuotaModal({
  open,
  onOpenChange,
  user,
  initialSubscription = null,
  onUpdated,
}: AdminSubscriptionQuotaModalProps) {
  const [activeTab, setActiveTab] = useState<'subscription' | 'quotas'>('subscription');
  const [currentSub, setCurrentSub] = useState<UserSubscriptionInfo | null>(initialSubscription);
  const [loadingSub, setLoadingSub] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  // Onglet Abonnement
  const [selectedPlan, setSelectedPlan] = useState<AdminPlanKey>('standard');
  const [dureeJours, setDureeJours] = useState<number>(PLANS_CONFIG.standard.duree_jours);
  const [subCustomEndDate, setSubCustomEndDate] = useState<string>('');
  const [subQuotaEe, setSubQuotaEe] = useState<number>(PLANS_CONFIG.standard.quota_ee);
  const [subQuotaEo, setSubQuotaEo] = useState<number>(PLANS_CONFIG.standard.quota_eo);
  const [subQuotaEb, setSubQuotaEb] = useState<number>(PLANS_CONFIG.standard.quota_examen_blanc);
  const [cumulateQuotas, setCumulateQuotas] = useState(false);

  // Onglet Quotas
  const [quotaMode, setQuotaMode] = useState<'add' | 'set'>('add');
  const [quotaEeInput, setQuotaEeInput] = useState<number>(5);
  const [quotaEoInput, setQuotaEoInput] = useState<number>(3);
  const [quotaEbInput, setQuotaEbInput] = useState<number>(1);
  const [extendDays, setExtendDays] = useState<number>(0);
  const [quotaCustomEndDate, setQuotaCustomEndDate] = useState<string>('');
  const [fallbackPlan, setFallbackPlan] = useState<AdminPlanKey>('essentiel');
  const [fallbackDureeJours, setFallbackDureeJours] = useState<number>(30);

  // Options partagées
  const [enableExamenBlancProfile, setEnableExamenBlancProfile] = useState(true);
  const [notifyUser, setNotifyUser] = useState(true);

  const applyPlanDefaults = (plan: AdminPlanKey) => {
    const cfg = PLANS_CONFIG[plan];
    setSelectedPlan(plan);
    setDureeJours(cfg.duree_jours);
    setSubCustomEndDate('');
    setSubQuotaEe(cfg.quota_ee);
    setSubQuotaEo(cfg.quota_eo);
    setSubQuotaEb(cfg.quota_examen_blanc);
  };

  useEffect(() => {
    if (!open || !user) return;

    setCurrentSub(initialSubscription ?? null);
    setCumulateQuotas(false);
    setEnableExamenBlancProfile(true);
    setNotifyUser(true);

    if (initialSubscription?.isActive) {
      const p = initialSubscription.plan;
      setSelectedPlan(p);
      setDureeJours(PLANS_CONFIG[p]?.duree_jours ?? 30);
      setSubCustomEndDate('');
      setSubQuotaEe(PLANS_CONFIG[p]?.quota_ee ?? 20);
      setSubQuotaEo(PLANS_CONFIG[p]?.quota_eo ?? 12);
      setSubQuotaEb(PLANS_CONFIG[p]?.quota_examen_blanc ?? 2);
      setQuotaMode('add');
      setQuotaEeInput(5);
      setQuotaEoInput(3);
      setQuotaEbInput(1);
      setExtendDays(0);
      setQuotaCustomEndDate('');
    } else {
      applyPlanDefaults('standard');
      setQuotaMode('add');
      setQuotaEeInput(5);
      setQuotaEoInput(3);
      setQuotaEbInput(1);
      setExtendDays(0);
      setQuotaCustomEndDate('');
      setFallbackPlan(initialSubscription?.plan ?? 'essentiel');
      setFallbackDureeJours(30);
    }

    let cancelled = false;
    setLoadingSub(true);
    fetchUserLatestSubscription(user.id)
      .then((fresh) => {
        if (cancelled) return;
        setCurrentSub(fresh);
        if (fresh?.isActive) {
          setSelectedPlan(fresh.plan);
          setFallbackPlan(fresh.plan);
        } else if (fresh) {
          setFallbackPlan(fresh.plan);
        }
      })
      .catch(() => {
        // Garde initialSubscription en cas d'erreur silencieuse
      })
      .finally(() => {
        if (!cancelled) setLoadingSub(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, user, initialSubscription]);

  const handleQuotaModeChange = (mode: 'add' | 'set') => {
    setQuotaMode(mode);
    if (mode === 'set' && currentSub?.isActive) {
      setQuotaEeInput(currentSub.quotaEe);
      setQuotaEoInput(currentSub.quotaEo);
      setQuotaEbInput(currentSub.quotaExamenBlanc);
      setQuotaCustomEndDate(toInputDate(currentSub.endAt));
    } else if (mode === 'add') {
      setQuotaEeInput(5);
      setQuotaEoInput(3);
      setQuotaEbInput(1);
      setQuotaCustomEndDate('');
      setExtendDays(0);
    }
  };

  // Aperçu temps réel onglet Quotas
  const quotaPreview = useMemo(() => {
    const baseEe = currentSub?.isActive ? currentSub.quotaEe : 0;
    const baseEo = currentSub?.isActive ? currentSub.quotaEo : 0;
    const baseEb = currentSub?.isActive ? currentSub.quotaExamenBlanc : 0;

    const nextEe =
      !currentSub?.isActive
        ? Math.max(0, Math.round(quotaEeInput || 0))
        : quotaMode === 'add'
          ? Math.max(0, baseEe + Math.round(quotaEeInput || 0))
          : Math.max(0, Math.round(quotaEeInput || 0));

    const nextEo =
      !currentSub?.isActive
        ? Math.max(0, Math.round(quotaEoInput || 0))
        : quotaMode === 'add'
          ? Math.max(0, baseEo + Math.round(quotaEoInput || 0))
          : Math.max(0, Math.round(quotaEoInput || 0));

    const nextEb =
      !currentSub?.isActive
        ? Math.max(0, Math.round(quotaEbInput || 0))
        : quotaMode === 'add'
          ? Math.max(0, baseEb + Math.round(quotaEbInput || 0))
          : Math.max(0, Math.round(quotaEbInput || 0));

    let nextEndLabel = '—';
    if (quotaCustomEndDate) {
      nextEndLabel = formatDateFr(`${quotaCustomEndDate}T23:59:59.999Z`);
    } else if (!currentSub?.isActive) {
      const end = new Date(Date.now() + Math.max(1, fallbackDureeJours || 30) * 86400000);
      nextEndLabel = formatDateFr(end.toISOString());
    } else if (quotaMode === 'add' && extendDays > 0) {
      const baseMs = currentSub.endAt
        ? Math.max(Date.now(), new Date(currentSub.endAt).getTime())
        : Date.now();
      nextEndLabel = formatDateFr(new Date(baseMs + extendDays * 86400000).toISOString());
    } else {
      nextEndLabel = formatDateFr(currentSub.endAt);
    }

    return { nextEe, nextEo, nextEb, nextEndLabel };
  }, [
    currentSub,
    quotaMode,
    quotaEeInput,
    quotaEoInput,
    quotaEbInput,
    extendDays,
    quotaCustomEndDate,
    fallbackDureeJours,
  ]);

  const handleActivateSubscription = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await activateManualSubscription({
        userId: user.id,
        plan: selectedPlan,
        dureeJours: Math.max(1, dureeJours || 30),
        customEndDate: subCustomEndDate || undefined,
        quotaEe: subQuotaEe,
        quotaEo: subQuotaEo,
        quotaExamenBlanc: subQuotaEb,
        cumulateQuotas,
        enableExamenBlancProfile,
        notifyUser,
      });
      setCurrentSub(updated);
      toast.success(`Abonnement ${PLANS_CONFIG[updated.plan]?.nom ?? updated.plan} activé ✓`);
      onUpdated?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l\'activation de l\'abonnement.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyQuotas = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = await updateManualQuotas({
        userId: user.id,
        mode: currentSub?.isActive ? quotaMode : 'set',
        quotaEe: quotaEeInput,
        quotaEo: quotaEoInput,
        quotaExamenBlanc: quotaEbInput,
        extendDays: quotaMode === 'add' ? extendDays : 0,
        customEndDate: quotaCustomEndDate || undefined,
        fallbackPlan,
        fallbackDureeJours,
        enableExamenBlancProfile,
        notifyUser,
      });
      setCurrentSub(updated);
      toast.success('Quotas mis à jour avec succès ✓');
      onUpdated?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la mise à jour des quotas.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!user) return;
    setDeactivating(true);
    try {
      await deactivateManualSubscription(user.id);
      toast.success('Abonnement désactivé.');
      onUpdated?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la désactivation.';
      toast.error(msg);
    } finally {
      setDeactivating(false);
    }
  };

  if (!user) return null;

  const fullName = [user.prenom, user.nom].filter(Boolean).join(' ') || 'Utilisateur';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1.5rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading font-bold text-[#0d233a] flex items-center gap-2 text-lg">
            <CreditCard className="w-5 h-5 text-[#e53e3e]" />
            <span>Abonnement &amp; Quotas — {fullName}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{user.email || 'Email non renseigné'}</span>
            {user.telephone && <span>• {user.telephone}</span>}
            {user.pays && (
              <span className="inline-flex items-center gap-1">
                • <CountryFlag country={user.pays} showName />
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Résumé de la situation actuelle */}
        <div className="rounded-xl border border-[#d3e4fe] bg-[#f8f9ff] p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#0d233a]">Statut actuel :</span>
              {loadingSub ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              ) : currentSub?.isActive ? (
                <>
                  <Badge className="bg-emerald-600 text-white text-[11px] gap-1 border-0">
                    <CheckCircle2 className="w-3 h-3" />
                    Actif — {PLANS_CONFIG[currentSub.plan]?.nom ?? currentSub.plan}
                  </Badge>
                  {currentSub.provider && (
                    <Badge variant="outline" className="text-[11px] capitalize">
                      {currentSub.provider}
                    </Badge>
                  )}
                </>
              ) : currentSub ? (
                <Badge variant="outline" className="text-[11px] border-amber-400 text-amber-700 bg-amber-50">
                  Expiré ({PLANS_CONFIG[currentSub.plan]?.nom ?? currentSub.plan}) le {formatDateFr(currentSub.endAt)}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                  Aucun abonnement actif
                </Badge>
              )}
            </div>
            {currentSub?.isActive && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Expire le <strong className="text-[#0d233a]">{formatDateFr(currentSub.endAt)}</strong>
                {currentSub.daysRemaining !== null && (
                  <span>({currentSub.daysRemaining}j restant{currentSub.daysRemaining > 1 ? 's' : ''})</span>
                )}
              </span>
            )}
          </div>

          {currentSub && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg bg-white border border-[#e2e8f0] px-2.5 py-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <FileCheck className="w-3.5 h-3.5 text-[#d97706]" /> EE
                </span>
                <strong className="text-[#0d233a]">{currentSub.quotaEe}</strong>
              </div>
              <div className="rounded-lg bg-white border border-[#e2e8f0] px-2.5 py-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Mic className="w-3.5 h-3.5 text-[#e53e3e]" /> EO
                </span>
                <strong className="text-[#0d233a]">{currentSub.quotaEo}</strong>
              </div>
              <div className="rounded-lg bg-white border border-[#e2e8f0] px-2.5 py-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <ClipboardList className="w-3.5 h-3.5 text-emerald-600" /> Examens
                </span>
                <strong className="text-[#0d233a]">{currentSub.quotaExamenBlanc}</strong>
              </div>
            </div>
          )}
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'subscription' | 'quotas')}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="subscription" className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Activer un abonnement
            </TabsTrigger>
            <TabsTrigger value="quotas" className="gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              Ajuster les quotas
            </TabsTrigger>
          </TabsList>

          {/* TAB 1 : ABONNEMENT */}
          <TabsContent value="subscription" className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-[#0d233a]">Formule à activer</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {ADMIN_PLAN_KEYS.map((key) => {
                  const cfg = PLANS_CONFIG[key];
                  const isSelected = selectedPlan === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyPlanDefaults(key)}
                      className={`text-left rounded-xl p-2.5 border transition-all ${
                        isSelected
                          ? 'border-[#0d233a] bg-[#eff4ff] ring-1 ring-[#0d233a]'
                          : 'border-[#e2e8f0] bg-white hover:border-[#0d233a]/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-heading font-bold text-xs text-[#0d233a]">{cfg.nom}</span>
                        <span className="text-[10px] font-semibold text-muted-foreground">{cfg.duree_jours}j</span>
                      </div>
                      <div className="text-[11px] font-semibold text-[#e53e3e] mt-0.5">
                        {cfg.prix_usd.toFixed(2)} $
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {cfg.quota_ee} EE • {cfg.quota_eo} EO • {cfg.quota_examen_blanc} EB
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Durée & Expiration */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Durée de validité (jours)</Label>
                <Input
                  type="number"
                  min={1}
                  value={dureeJours}
                  onChange={(e) => {
                    setDureeJours(Math.max(1, Number(e.target.value) || 1));
                    setSubCustomEndDate('');
                  }}
                />
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {DURATION_PRESETS.map((p) => (
                    <Button
                      key={p.days}
                      type="button"
                      variant={dureeJours === p.days && !subCustomEndDate ? 'default' : 'outline'}
                      size="sm"
                      className="h-6 px-2 text-[11px]"
                      onClick={() => {
                        setDureeJours(p.days);
                        setSubCustomEndDate('');
                      }}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Ou date d'expiration exacte (optionnel)</Label>
                <Input
                  type="date"
                  value={subCustomEndDate}
                  onChange={(e) => setSubCustomEndDate(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  {subCustomEndDate
                    ? `Expirera le ${formatDateFr(`${subCustomEndDate}T23:59:59.999Z`)}`
                    : `Expirera le ${formatDateFr(new Date(Date.now() + Math.max(1, dureeJours) * 86400000).toISOString())}`}
                </p>
              </div>
            </div>

            {/* Quotas initiaux */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[#0d233a]">Quotas attribués</Label>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Corrections Écrites (EE)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={subQuotaEe}
                    onChange={(e) => setSubQuotaEe(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Corrections Orales (EO)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={subQuotaEo}
                    onChange={(e) => setSubQuotaEo(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Examens Blancs (EB)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={subQuotaEb}
                    onChange={(e) => setSubQuotaEb(Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2.5 rounded-xl border border-[#e2e8f0] p-3 bg-white">
              {currentSub?.isActive && (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-[#0d233a]">Cumuler avec les quotas restants actuels</p>
                    <p className="text-[11px] text-muted-foreground">
                      Ajoute ({currentSub.quotaEe} EE, {currentSub.quotaEo} EO, {currentSub.quotaExamenBlanc} EB) aux nouveaux quotas.
                    </p>
                  </div>
                  <Switch checked={cumulateQuotas} onCheckedChange={setCumulateQuotas} />
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#0d233a]">Activer l'accès Examen Blanc sur le profil</p>
                  <p className="text-[11px] text-muted-foreground">Synchronise `examen_blanc_actif` si quota EB &gt; 0.</p>
                </div>
                <Switch checked={enableExamenBlancProfile} onCheckedChange={setEnableExamenBlancProfile} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#0d233a]">Notifier l'étudiant dans son espace</p>
                  <p className="text-[11px] text-muted-foreground">Envoie une notification visible dans son tableau de bord.</p>
                </div>
                <Switch checked={notifyUser} onCheckedChange={setNotifyUser} />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              {currentSub?.isActive ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="outline" className="text-destructive border-destructive/40 hover:bg-destructive/10 gap-1.5" disabled={deactivating || saving}>
                      {deactivating ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Désactiver l'abonnement
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Désactiver l'abonnement de {fullName} ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        L'abonnement actif passera au statut expiré et l'accès aux modules payants sera immédiatement retiré.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Confirmer la désactivation
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={handleActivateSubscription}
                  disabled={saving || deactivating}
                  className="bg-[#0d233a] hover:bg-[#1a365d] text-white gap-1.5"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Activer l'abonnement
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2 : QUOTAS */}
          <TabsContent value="quotas" className="space-y-4 pt-2">
            {!currentSub?.isActive && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2.5 text-xs">
                <div className="flex items-start gap-2 text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Cet utilisateur n'a pas d'abonnement actif.</p>
                    <p className="text-amber-800">
                      L'attribution de quotas activera automatiquement un accès pour qu'il puisse les utiliser immédiatement.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-amber-900">Formule de base</Label>
                    <Select value={fallbackPlan} onValueChange={(v) => setFallbackPlan(v as AdminPlanKey)}>
                      <SelectTrigger className="h-8 bg-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADMIN_PLAN_KEYS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {PLANS_CONFIG[k].nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-amber-900">Validité (jours)</Label>
                    <Input
                      type="number"
                      min={1}
                      className="h-8 bg-white text-xs"
                      value={fallbackDureeJours}
                      onChange={(e) => setFallbackDureeJours(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                </div>
              </div>
            )}

            {currentSub?.isActive && (
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs font-semibold text-[#0d233a]">Mode de modification</Label>
                <div className="inline-flex rounded-lg border border-[#e2e8f0] p-0.5 bg-muted/40">
                  <button
                    type="button"
                    onClick={() => handleQuotaModeChange('add')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      quotaMode === 'add' ? 'bg-[#0d233a] text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Ajouter (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuotaModeChange('set')}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                      quotaMode === 'set' ? 'bg-[#0d233a] text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Définir (=)
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* EE */}
              <div className="space-y-1.5 rounded-xl border border-[#e2e8f0] p-3">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <FileCheck className="w-3.5 h-3.5 text-[#d97706]" />
                  Expression Écrite (EE)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={quotaEeInput}
                  onChange={(e) => setQuotaEeInput(Math.max(0, Number(e.target.value) || 0))}
                />
                {(!currentSub?.isActive || quotaMode === 'add') && (
                  <div className="flex gap-1 flex-wrap">
                    {[5, 10, 20].map((v) => (
                      <Button
                        key={v}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-0.5"
                        onClick={() => setQuotaEeInput((prev) => prev + v)}
                      >
                        <Plus className="w-2.5 h-2.5" />{v}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* EO */}
              <div className="space-y-1.5 rounded-xl border border-[#e2e8f0] p-3">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-[#e53e3e]" />
                  Expression Orale (EO)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={quotaEoInput}
                  onChange={(e) => setQuotaEoInput(Math.max(0, Number(e.target.value) || 0))}
                />
                {(!currentSub?.isActive || quotaMode === 'add') && (
                  <div className="flex gap-1 flex-wrap">
                    {[5, 10, 20].map((v) => (
                      <Button
                        key={v}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-0.5"
                        onClick={() => setQuotaEoInput((prev) => prev + v)}
                      >
                        <Plus className="w-2.5 h-2.5" />{v}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* EB */}
              <div className="space-y-1.5 rounded-xl border border-[#e2e8f0] p-3">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5 text-emerald-600" />
                  Examens Blancs (EB)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={quotaEbInput}
                  onChange={(e) => setQuotaEbInput(Math.max(0, Number(e.target.value) || 0))}
                />
                {(!currentSub?.isActive || quotaMode === 'add') && (
                  <div className="flex gap-1 flex-wrap">
                    {[1, 2, 5].map((v) => (
                      <Button
                        key={v}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-[11px] gap-0.5"
                        onClick={() => setQuotaEbInput((prev) => prev + v)}
                      >
                        <Plus className="w-2.5 h-2.5" />{v}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Prolongation / date d'expiration */}
            {currentSub?.isActive && quotaMode === 'add' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Prolonger la validité (jours supplémentaires)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={extendDays}
                    onChange={(e) => {
                      setExtendDays(Math.max(0, Number(e.target.value) || 0));
                      setQuotaCustomEndDate('');
                    }}
                  />
                  <div className="flex flex-wrap gap-1">
                    {EXTEND_PRESETS.map((p) => (
                      <Button
                        key={p.days}
                        type="button"
                        variant={extendDays === p.days && !quotaCustomEndDate ? 'default' : 'outline'}
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => {
                          setExtendDays(p.days);
                          setQuotaCustomEndDate('');
                        }}
                      >
                        {p.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ou définir une nouvelle date d'expiration</Label>
                  <Input
                    type="date"
                    value={quotaCustomEndDate}
                    onChange={(e) => setQuotaCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Date d'expiration (optionnel)</Label>
                <Input
                  type="date"
                  value={quotaCustomEndDate}
                  onChange={(e) => setQuotaCustomEndDate(e.target.value)}
                />
              </div>
            )}

            {/* Aperçu résultant */}
            <div className="rounded-xl bg-[#eff4ff] border border-[#d3e4fe] p-3 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-semibold text-[#0d233a]">Résultat après validation :</span>
                <span>EE : <strong>{quotaPreview.nextEe}</strong></span>
                <span>EO : <strong>{quotaPreview.nextEo}</strong></span>
                <span>Examens : <strong>{quotaPreview.nextEb}</strong></span>
              </div>
              <span className="text-muted-foreground">
                Expiration : <strong className="text-[#0d233a]">{quotaPreview.nextEndLabel}</strong>
              </span>
            </div>

            {/* Options */}
            <div className="space-y-2.5 rounded-xl border border-[#e2e8f0] p-3 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#0d233a]">Activer l'accès Examen Blanc sur le profil</p>
                  <p className="text-[11px] text-muted-foreground">Synchronise `examen_blanc_actif` si quota EB &gt; 0.</p>
                </div>
                <Switch checked={enableExamenBlancProfile} onCheckedChange={setEnableExamenBlancProfile} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[#0d233a]">Notifier l'étudiant dans son espace</p>
                  <p className="text-[11px] text-muted-foreground">Envoie une notification visible dans son tableau de bord.</p>
                </div>
                <Switch checked={notifyUser} onCheckedChange={setNotifyUser} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button
                type="button"
                onClick={handleApplyQuotas}
                disabled={saving}
                className="bg-[#0d233a] hover:bg-[#1a365d] text-white gap-1.5"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Appliquer les quotas
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
