import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Clock,
  Compass,
  Copy,
  Download,
  ExternalLink,
  Flame,
  Globe2,
  Link2,
  Megaphone,
  Monitor,
  ShoppingCart,
  Sliders,
  Smartphone,
  Sparkles,
  Tablet,
  TrendingUp,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { CountryFlag } from '@/components/ui/CountryFlag';
import type { AdminManagedUser } from '@/components/admin/AdminSubscriptionQuotaModal';

export interface FunnelMetrics {
  visitors: number;
  newVisitors: number;
  returningVisitors: number;
  retentionRatePct: number;
  pagesPerVisitor: number;
  signups: number;
  pricingViewers: number;
  paymentAttempts: number;
  confirmedPayments: number;
  abandonedPaymentsCount: number;
  activeSubscribers: number;
  visitorToSignupPct: number;
  signupToSubPct: number;
  visitorToSubPct: number;
  paymentSuccessPct: number;
  avgOrderValueUsd: number;
}

export interface TrafficSourceItem {
  key: string;
  label: string;
  category: 'utm' | 'social' | 'search' | 'direct' | 'other';
  visits: number;
  visitors: number;
  sharePct: number;
}

export interface TopPageItem {
  path: string;
  label: string;
  views: number;
  visitors: number;
  sharePct: number;
}

export interface TimeSlotItem {
  label: string;
  range: string;
  visits: number;
  sharePct: number;
}

export interface CountryBreakdownItem {
  pays: string;
  inscrits: number;
  abonnes: number;
  conversionPct: number;
  sharePct: number;
}

export interface AbandonedPaymentLead {
  userId: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  pays: string | null;
  provider: string;
  planId: string;
  amountLabel: string;
  createdAt: string;
}

export interface ExpiringOrLowQuotaSubscriber {
  userId: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  pays: string | null;
  planNom: string;
  daysRemaining: number | null;
  endAt: string | null;
  quotaEe: number;
  quotaEo: number;
  quotaEb: number;
  reason: 'expiring' | 'low_quota' | 'both';
}

export interface HotLeadItem {
  userId: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  pays: string | null;
  createdAt: string;
  viewedPricing: boolean;
}

export interface PedagogyHealthMetrics {
  fichesLues: number;
  totalFiches: number;
  totalSessions: number;
  examensBlancsTermines: number;
  productionsTotal: number;
  correctionsEnAttente: number;
  avgSessionsPerActiveSub: number;
}

export interface GrowthInsightsData {
  timeframeLabel: string;
  funnel: FunnelMetrics;
  sources: TrafficSourceItem[];
  topPages: TopPageItem[];
  timeSlots: TimeSlotItem[];
  countries: CountryBreakdownItem[];
  abandonedPayments: AbandonedPaymentLead[];
  expiringOrLowQuota: ExpiringOrLowQuotaSubscriber[];
  hotLeads: HotLeadItem[];
  pedagogy: PedagogyHealthMetrics;
  deviceVisitors: { desktop: number; mobile: number; tablet: number };
}

interface AdminGrowthInsightsSectionProps {
  data: GrowthInsightsData;
  loading: boolean;
  onManageUser: (user: AdminManagedUser) => void;
}

function escapeCsvCell(raw: string | number | null | undefined): string {
  let str = String(raw ?? '').replace(/\r?\n/g, ' ').trim();
  if (/^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function downloadCsvFile(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const lines = [
    headers.map(escapeCsvCell).join(';'),
    ...rows.map((r) => r.map(escapeCsvCell).join(';')),
  ];
  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatDateShort(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function AdminGrowthInsightsSection({
  data,
  loading,
  onManageUser,
}: AdminGrowthInsightsSectionProps) {
  const [countrySort, setCountrySort] = useState<'inscrits' | 'abonnes' | 'conversionPct'>('inscrits');

  // Générateur de liens UTM
  const [utmPage, setUtmPage] = useState<string>('/');
  const [utmSource, setUtmSource] = useState<string>('facebook');
  const [utmCampaign, setUtmCampaign] = useState<string>('promo_tcf_2026');
  const [copiedUtm, setCopiedUtm] = useState(false);

  const generatedUtmUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://montcfca.com';
    const cleanSource = utmSource.trim().toLowerCase() || 'facebook';
    const cleanCampaign = utmCampaign.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    const params = new URLSearchParams({ utm_source: cleanSource });
    if (cleanCampaign) params.set('utm_campaign', cleanCampaign);
    return `${origin}${utmPage}?${params.toString()}`;
  }, [utmPage, utmSource, utmCampaign]);

  const handleCopyUtm = async () => {
    try {
      await navigator.clipboard.writeText(generatedUtmUrl);
      setCopiedUtm(true);
      toast.success('Lien de campagne copié dans le presse-papiers !');
      setTimeout(() => setCopiedUtm(false), 2000);
    } catch {
      toast.error('Impossible de copier automatiquement. Copiez le lien manuellement.');
    }
  };

  const sortedCountries = useMemo(() => {
    return [...data.countries].sort((a, b) => b[countrySort] - a[countrySort]);
  }, [data.countries, countrySort]);

  const bestTimeSlot = useMemo(() => {
    if (!data.timeSlots.length) return null;
    return [...data.timeSlots].sort((a, b) => b.visits - a.visits)[0];
  }, [data.timeSlots]);

  const topCountry = data.countries[0] ?? null;

  const totalDeviceVisitors =
    data.deviceVisitors.desktop + data.deviceVisitors.mobile + data.deviceVisitors.tablet || 1;
  const mobilePct = Math.round((data.deviceVisitors.mobile / totalDeviceVisitors) * 100);

  const funnelStages = useMemo(() => {
    const base = Math.max(1, data.funnel.visitors);
    return [
      {
        label: '1. Visiteurs uniques (hors admin)',
        value: data.funnel.visitors,
        pct: 100,
        color: 'bg-[#0d233a]',
      },
      {
        label: '2. Comptes inscrits',
        value: data.funnel.signups,
        pct: Math.min(100, Math.round((data.funnel.signups / base) * 100)),
        color: 'bg-[#1a365d]',
      },
      {
        label: '3. Visiteurs ayant consulté les tarifs',
        value: data.funnel.pricingViewers,
        pct: Math.min(100, Math.round((data.funnel.pricingViewers / base) * 100)),
        color: 'bg-[#d97706]',
      },
      {
        label: '4. Paiements initiés',
        value: data.funnel.paymentAttempts,
        pct: Math.min(100, Math.round((data.funnel.paymentAttempts / base) * 100)),
        color: 'bg-[#e53e3e]',
      },
      {
        label: '5. Paiements confirmés',
        value: data.funnel.confirmedPayments,
        pct: Math.min(100, Math.round((data.funnel.confirmedPayments / base) * 100)),
        color: 'bg-emerald-600',
      },
    ];
  }, [data.funnel]);

  const openManageFromLead = (lead: {
    userId: string;
    prenom: string | null;
    nom: string | null;
    email: string | null;
    telephone: string | null;
    pays: string | null;
  }) => {
    onManageUser({
      id: lead.userId,
      prenom: lead.prenom,
      nom: lead.nom,
      email: lead.email,
      telephone: lead.telephone,
      pays: lead.pays,
      role: 'etudiant',
    });
  };

  const categoryBadgeClass: Record<TrafficSourceItem['category'], string> = {
    utm: 'bg-purple-50 text-purple-700 border-purple-200',
    social: 'bg-rose-50 text-rose-700 border-rose-200',
    search: 'bg-blue-50 text-blue-700 border-blue-200',
    direct: 'bg-slate-50 text-slate-700 border-slate-200',
    other: 'bg-amber-50 text-amber-800 border-amber-200',
  };

  const categoryLabel: Record<TrafficSourceItem['category'], string> = {
    utm: 'Campagne UTM',
    social: 'Réseau social',
    search: 'Moteur de recherche',
    direct: 'Direct',
    other: 'Référent externe',
  };

  return (
    <Card className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-[#f1f5f9] bg-gradient-to-r from-[#f8f9ff] to-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <CardTitle className="text-base sm:text-lg font-heading font-extrabold text-[#0d233a] flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-[#e53e3e]" />
              <span>Pilotage, Acquisition &amp; Promotion</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#64748b]">
              Entonnoir de conversion, sources d'acquisition, répartition géographique et listes de relance actionnables ({data.timeframeLabel}).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {data.abandonedPayments.length > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 text-[11px] font-semibold">
                {data.abandonedPayments.length} panier{data.abandonedPayments.length > 1 ? 's' : ''} à relancer
              </Badge>
            )}
            {data.expiringOrLowQuota.length > 0 && (
              <Badge variant="outline" className="bg-rose-50 text-[#e53e3e] border-rose-200 text-[11px] font-semibold">
                {data.expiringOrLowQuota.length} renouvellement{data.expiringOrLowQuota.length > 1 ? 's' : ''} imminent{data.expiringOrLowQuota.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        ) : (
          <Tabs defaultValue="funnel" className="w-full space-y-4">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto gap-1 bg-[#f1f5f9] p-1 rounded-xl">
              <TabsTrigger value="funnel" className="gap-1.5 text-xs py-2 rounded-lg">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Entonnoir &amp; Conversion</span>
              </TabsTrigger>
              <TabsTrigger value="acquisition" className="gap-1.5 text-xs py-2 rounded-lg">
                <Compass className="w-3.5 h-3.5" />
                <span>Sources, Pages &amp; UTM</span>
              </TabsTrigger>
              <TabsTrigger value="audience" className="gap-1.5 text-xs py-2 rounded-lg">
                <Globe2 className="w-3.5 h-3.5" />
                <span>Pays &amp; Ciblage</span>
              </TabsTrigger>
              <TabsTrigger value="actions" className="gap-1.5 text-xs py-2 rounded-lg">
                <Flame className="w-3.5 h-3.5" />
                <span>Relances &amp; Rétention</span>
              </TabsTrigger>
            </TabsList>

            {/* ═══ TAB 1 : ENTONNOIR & CONVERSION ═══ */}
            <TabsContent value="funnel" className="space-y-5 mt-0">
              {/* KPI Conversion Badges */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-[#d3e4fe] bg-[#eff4ff]/50 p-3">
                  <span className="text-[11px] font-medium text-[#475569]">Visiteur → Inscrit</span>
                  <div className="text-xl font-heading font-extrabold text-[#0d233a] mt-0.5">
                    {data.funnel.visitorToSignupPct.toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-[#64748b]">
                    {data.funnel.signups} inscrits / {data.funnel.visitors} visiteurs
                  </span>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                  <span className="text-[11px] font-medium text-amber-900">Inscrit → Abonné</span>
                  <div className="text-xl font-heading font-extrabold text-[#d97706] mt-0.5">
                    {data.funnel.signupToSubPct.toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-amber-800/80">
                    {data.funnel.activeSubscribers} abonnés actifs au total
                  </span>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                  <span className="text-[11px] font-medium text-emerald-900">Taux de succès paiement</span>
                  <div className="text-xl font-heading font-extrabold text-emerald-700 mt-0.5">
                    {data.funnel.paymentSuccessPct.toFixed(1)}%
                  </div>
                  <span className="text-[10px] text-emerald-800/80">
                    {data.funnel.confirmedPayments} confirmés / {data.funnel.paymentAttempts} initiés
                  </span>
                </div>
                <div className="rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] p-3">
                  <span className="text-[11px] font-medium text-[#475569]">Panier moyen (ARPU)</span>
                  <div className="text-xl font-heading font-extrabold text-[#0d233a] mt-0.5">
                    {data.funnel.avgOrderValueUsd.toFixed(2)} $ USD
                  </div>
                  <span className="text-[10px] text-[#64748b]">
                    Conversion globale : {data.funnel.visitorToSubPct.toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Barres d'entonnoir */}
                <div className="lg:col-span-7 rounded-xl border border-[#e2e8f0] p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-heading font-bold text-[#0d233a]">
                      Parcours de conversion ({data.timeframeLabel})
                    </h4>
                    <span className="text-[11px] text-[#64748b]">Base 100% = visiteurs uniques</span>
                  </div>
                  <div className="space-y-3">
                    {funnelStages.map((stage) => (
                      <div key={stage.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[#0d233a]">{stage.label}</span>
                          <span className="font-heading font-bold text-[#0d233a]">
                            {stage.value}{' '}
                            <span className="text-[11px] font-normal text-[#64748b]">({stage.pct}%)</span>
                          </span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-[#f1f5f9] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${stage.color} transition-all duration-500`}
                            style={{ width: `${Math.max(stage.value > 0 ? 3 : 0, stage.pct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Engagement & Créneaux horaires */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-[#e2e8f0] p-3 text-center">
                      <span className="text-[10px] text-[#64748b] block">Taux de retour</span>
                      <strong className="text-base font-heading font-extrabold text-[#0d233a]">
                        {data.funnel.retentionRatePct.toFixed(0)}%
                      </strong>
                      <span className="text-[10px] text-[#64748b] block">
                        {data.funnel.returningVisitors} fidèles
                      </span>
                    </div>
                    <div className="rounded-xl border border-[#e2e8f0] p-3 text-center">
                      <span className="text-[10px] text-[#64748b] block">Pages / visiteur</span>
                      <strong className="text-base font-heading font-extrabold text-[#0d233a]">
                        {data.funnel.pagesPerVisitor.toFixed(1)}
                      </strong>
                      <span className="text-[10px] text-[#64748b] block">Profondeur</span>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 text-center">
                      <span className="text-[10px] text-amber-800 block">Paniers échoués</span>
                      <strong className="text-base font-heading font-extrabold text-amber-700">
                        {data.funnel.abandonedPaymentsCount}
                      </strong>
                      <span className="text-[10px] text-amber-700/80 block">À relancer</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#e2e8f0] p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-heading font-bold text-[#0d233a] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#d97706]" />
                        Créneaux horaires d'affluence
                      </span>
                      {bestTimeSlot && bestTimeSlot.visits > 0 && (
                        <Badge className="bg-[#eff4ff] text-[#0d233a] border-[#d3e4fe] text-[10px]">
                          Pic : {bestTimeSlot.label}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-2">
                      {data.timeSlots.map((slot) => (
                        <div key={slot.label} className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-[#475569]">
                              <strong className="text-[#0d233a]">{slot.label}</strong> ({slot.range})
                            </span>
                            <span className="font-semibold text-[#0d233a]">
                              {slot.visits} ({slot.sharePct}%)
                            </span>
                          </div>
                          <Progress value={slot.sharePct} className="h-1.5 bg-[#f1f5f9]" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Synthèse & Recommandations marketing */}
              <div className="rounded-xl border border-[#d3e4fe] bg-gradient-to-r from-[#eff4ff]/80 to-white p-4">
                <div className="flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#d97706] shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs text-[#334155]">
                    <p className="font-heading font-bold text-[#0d233a]">
                      Synthèse &amp; Leviers de Promotion
                    </p>
                    <p>
                      {topCountry ? (
                        <>
                          Votre premier marché est <strong className="text-[#0d233a]">{topCountry.pays}</strong> ({topCountry.inscrits} inscrits, {topCountry.conversionPct.toFixed(1)}% de conversion).{' '}
                        </>
                      ) : null}
                      {mobilePct >= 50 ? (
                        <>
                          <strong className="text-[#0d233a]">{mobilePct}%</strong> du trafic vient du mobile : privilégiez des visuels verticaux/carrés et des liens directs vers <code className="text-[11px] bg-white px-1 rounded">/inscription</code> pour vos publicités WhatsApp, TikTok et Facebook.{' '}
                        </>
                      ) : (
                        <>
                          Le trafic desktop représente <strong className="text-[#0d233a]">{100 - mobilePct}%</strong> : mettez en avant les examens blancs chronométrés dans vos campagnes.{' '}
                        </>
                      )}
                      {bestTimeSlot && bestTimeSlot.visits > 0 ? (
                        <>
                          Publiez vos posts et relances sur le créneau <strong className="text-[#0d233a]">{bestTimeSlot.label} ({bestTimeSlot.range})</strong> où l'affluence est maximale ({bestTimeSlot.sharePct}%).{' '}
                        </>
                      ) : null}
                      {data.abandonedPayments.length > 0 ? (
                        <>
                          Vous avez <strong className="text-[#e53e3e]">{data.abandonedPayments.length} paiement(s) non finalisé(s)</strong> récupérables dans l'onglet <em>Relances &amp; Rétention</em>.
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ═══ TAB 2 : SOURCES, PAGES & UTM ═══ */}
            <TabsContent value="acquisition" className="space-y-5 mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Sources de trafic */}
                <div className="rounded-xl border border-[#e2e8f0] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-heading font-bold text-[#0d233a]">
                      Sources de trafic &amp; Campagnes ({data.timeframeLabel})
                    </h4>
                    <span className="text-[11px] text-[#64748b]">{data.sources.length} source(s)</span>
                  </div>
                  {data.sources.length === 0 ? (
                    <p className="text-xs text-[#64748b] py-6 text-center">
                      Aucune donnée de source sur cette période. Utilisez le générateur UTM ci-dessous pour tracer vos campagnes.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                      {data.sources.map((src) => (
                        <div key={src.key} className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-semibold text-[#0d233a] truncate">{src.label}</span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 shrink-0 ${categoryBadgeClass[src.category]}`}>
                                {categoryLabel[src.category]}
                              </Badge>
                            </div>
                            <span className="text-[#475569] shrink-0">
                              <strong className="text-[#0d233a]">{src.visitors}</strong> vis. · {src.visits} vues ({src.sharePct}%)
                            </span>
                          </div>
                          <Progress value={src.sharePct} className="h-1.5 bg-[#f1f5f9]" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top pages */}
                <div className="rounded-xl border border-[#e2e8f0] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-heading font-bold text-[#0d233a]">
                      Pages les plus consultées ({data.timeframeLabel})
                    </h4>
                    <span className="text-[11px] text-[#64748b]">Top {data.topPages.length}</span>
                  </div>
                  {data.topPages.length === 0 ? (
                    <p className="text-xs text-[#64748b] py-6 text-center">
                      Aucune page consultée sur cette période.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[11px] h-8">Page</TableHead>
                            <TableHead className="text-[11px] h-8 text-right">Vues</TableHead>
                            <TableHead className="text-[11px] h-8 text-right">Visiteurs</TableHead>
                            <TableHead className="text-[11px] h-8 text-right">Part</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.topPages.map((pg) => (
                            <TableRow key={pg.path}>
                              <TableCell className="py-2">
                                <div className="text-xs font-semibold text-[#0d233a]">{pg.label}</div>
                                <div className="text-[10px] text-[#64748b]">{pg.path}</div>
                              </TableCell>
                              <TableCell className="py-2 text-right text-xs font-bold text-[#0d233a]">
                                {pg.views}
                              </TableCell>
                              <TableCell className="py-2 text-right text-xs text-[#475569]">
                                {pg.visitors}
                              </TableCell>
                              <TableCell className="py-2 text-right text-xs text-[#64748b]">
                                {pg.sharePct}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>

              {/* Générateur de liens de campagne UTM */}
              <div className="rounded-xl border border-[#d3e4fe] bg-[#f8f9ff] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h4 className="text-sm font-heading font-bold text-[#0d233a] flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-[#e53e3e]" />
                      Générateur de liens de campagne (UTM)
                    </h4>
                    <p className="text-[11px] text-[#64748b]">
                      Créez des liens trackés pour vos publicités Facebook, TikTok, Instagram, WhatsApp ou influenceurs : les clics apparaîtront automatiquement ci-dessus.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Page de destination</Label>
                    <Select value={utmPage} onValueChange={setUtmPage}>
                      <SelectTrigger className="bg-white h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="/">Page d'accueil (/)</SelectItem>
                        <SelectItem value="/inscription">Page d'inscription (/inscription)</SelectItem>
                        <SelectItem value="/promo-video">Vidéo promotionnelle (/promo-video)</SelectItem>
                        <SelectItem value="/etudiant/abonnement">Tarifs &amp; Abonnements (/etudiant/abonnement)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Canal / Source</Label>
                    <Select value={utmSource} onValueChange={setUtmSource}>
                      <SelectTrigger className="bg-white h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="facebook">Facebook Ads / Page</SelectItem>
                        <SelectItem value="tiktok">TikTok</SelectItem>
                        <SelectItem value="instagram">Instagram</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp / Groupes</SelectItem>
                        <SelectItem value="youtube">YouTube</SelectItem>
                        <SelectItem value="google">Google Ads</SelectItem>
                        <SelectItem value="influenceur">Partenaire / Influenceur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px]">Nom de campagne</Label>
                    <Input
                      value={utmCampaign}
                      onChange={(e) => setUtmCampaign(e.target.value)}
                      placeholder="ex: rentree_canada_mai"
                      className="bg-white h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Input
                    readOnly
                    value={generatedUtmUrl}
                    className="bg-white text-xs font-mono text-[#0d233a] flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCopyUtm}
                    className="bg-[#0d233a] hover:bg-[#1a365d] text-white gap-1.5 shrink-0 h-9"
                  >
                    {copiedUtm ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedUtm ? 'Copié !' : 'Copier le lien'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-9 gap-1 shrink-0"
                  >
                    <a href={generatedUtmUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="w-3.5 h-3.5" />
                      Tester
                    </a>
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* ═══ TAB 3 : PAYS & CIBLAGE ═══ */}
            <TabsContent value="audience" className="space-y-5 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-[#e2e8f0] p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-[#eff4ff] flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-[#e53e3e]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0d233a]">Visiteurs Mobile</div>
                      <div className="text-[11px] text-[#64748b]">{data.deviceVisitors.mobile} visiteurs</div>
                    </div>
                  </div>
                  <strong className="text-lg font-heading font-extrabold text-[#0d233a]">
                    {Math.round((data.deviceVisitors.mobile / totalDeviceVisitors) * 100)}%
                  </strong>
                </div>

                <div className="rounded-xl border border-[#e2e8f0] p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-[#eff4ff] flex items-center justify-center">
                      <Monitor className="w-4 h-4 text-[#0d233a]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0d233a]">Visiteurs Ordinateur</div>
                      <div className="text-[11px] text-[#64748b]">{data.deviceVisitors.desktop} visiteurs</div>
                    </div>
                  </div>
                  <strong className="text-lg font-heading font-extrabold text-[#0d233a]">
                    {Math.round((data.deviceVisitors.desktop / totalDeviceVisitors) * 100)}%
                  </strong>
                </div>

                <div className="rounded-xl border border-[#e2e8f0] p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-[#eff4ff] flex items-center justify-center">
                      <Tablet className="w-4 h-4 text-[#d97706]" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#0d233a]">Visiteurs Tablette</div>
                      <div className="text-[11px] text-[#64748b]">{data.deviceVisitors.tablet} visiteurs</div>
                    </div>
                  </div>
                  <strong className="text-lg font-heading font-extrabold text-[#0d233a]">
                    {Math.round((data.deviceVisitors.tablet / totalDeviceVisitors) * 100)}%
                  </strong>
                </div>
              </div>

              <div className="rounded-xl border border-[#e2e8f0] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-heading font-bold text-[#0d233a]">
                      Répartition géographique des candidats &amp; taux de conversion
                    </h4>
                    <p className="text-[11px] text-[#64748b]">
                      Identifiez les pays les plus rentables pour optimiser votre ciblage publicitaire (Meta / TikTok / Google Ads).
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {([
                      { key: 'inscrits', label: 'Trier: Inscrits' },
                      { key: 'abonnes', label: 'Trier: Abonnés' },
                      { key: 'conversionPct', label: 'Trier: Conversion %' },
                    ] as const).map((opt) => (
                      <Button
                        key={opt.key}
                        type="button"
                        size="sm"
                        variant={countrySort === opt.key ? 'default' : 'outline'}
                        onClick={() => setCountrySort(opt.key)}
                        className="h-7 px-2.5 text-[11px] rounded-lg"
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {sortedCountries.length === 0 ? (
                  <p className="text-xs text-[#64748b] py-6 text-center">Aucun pays renseigné.</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Pays</TableHead>
                          <TableHead className="text-xs text-right">Inscrits</TableHead>
                          <TableHead className="text-xs text-right">Abonnés actifs</TableHead>
                          <TableHead className="text-xs text-right">Conversion</TableHead>
                          <TableHead className="text-xs text-right">Part d'audience</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedCountries.map((c) => (
                          <TableRow key={c.pays}>
                            <TableCell className="py-2.5 text-xs font-semibold text-[#0d233a]">
                              {c.pays === 'Non renseigné' ? (
                                <span className="text-[#64748b] font-normal">Non renseigné</span>
                              ) : (
                                <CountryFlag country={c.pays} showName />
                              )}
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-xs font-bold text-[#0d233a]">
                              {c.inscrits}
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-xs font-bold text-emerald-700">
                              {c.abonnes}
                            </TableCell>
                            <TableCell className="py-2.5 text-right">
                              <Badge
                                variant="outline"
                                className={
                                  c.conversionPct >= 20
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px]'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 text-[11px]'
                                }
                              >
                                {c.conversionPct.toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2.5 text-right text-xs text-[#64748b]">
                              {c.sharePct}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ═══ TAB 4 : RELANCES & RÉTENTION ═══ */}
            <TabsContent value="actions" className="space-y-5 mt-0">
              {/* 1. Paniers abandonnés */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-heading font-bold text-[#0d233a] flex items-center gap-1.5">
                      <ShoppingCart className="w-4 h-4 text-[#d97706]" />
                      Paiements initiés non finalisés / échoués ({data.abandonedPayments.length})
                    </h4>
                    <p className="text-[11px] text-[#64748b]">
                      Candidats ayant tenté de payer sans finaliser la transaction et n'ayant pas encore d'abonnement actif.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={data.abandonedPayments.length === 0}
                    onClick={() => {
                      downloadCsvFile(
                        'paniers_abandonnes_tcfca.csv',
                        ['Prénom', 'Nom', 'Email', 'Téléphone', 'Pays', 'Passerelle', 'Formule', 'Montant', 'Date'],
                        data.abandonedPayments.map((p) => [
                          p.prenom,
                          p.nom,
                          p.email,
                          p.telephone,
                          p.pays,
                          p.provider,
                          p.planId,
                          p.amountLabel,
                          formatDateShort(p.createdAt),
                        ])
                      );
                      toast.success('Export CSV téléchargé.');
                    }}
                    className="h-7 px-2.5 text-xs gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exporter CSV
                  </Button>
                </div>

                {data.abandonedPayments.length === 0 ? (
                  <p className="text-xs text-[#64748b]">Aucun panier abandonné détecté.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto bg-white rounded-lg border border-[#e2e8f0]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[11px]">Candidat</TableHead>
                          <TableHead className="text-[11px]">Contact / Pays</TableHead>
                          <TableHead className="text-[11px]">Tentative</TableHead>
                          <TableHead className="text-[11px] text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.abandonedPayments.slice(0, 20).map((lead) => (
                          <TableRow key={`${lead.userId}-${lead.createdAt}`}>
                            <TableCell className="py-2 text-xs font-semibold text-[#0d233a]">
                              {[lead.prenom, lead.nom].filter(Boolean).join(' ') || 'Candidat'}
                            </TableCell>
                            <TableCell className="py-2 text-[11px] text-[#475569]">
                              <div>{lead.email || '—'}</div>
                              <div>{lead.telephone || ''} {lead.pays ? `• ${lead.pays}` : ''}</div>
                            </TableCell>
                            <TableCell className="py-2 text-[11px]">
                              <span className="font-semibold capitalize">{lead.planId}</span> ({lead.amountLabel})
                              <div className="text-[#64748b] capitalize">{lead.provider} • {formatDateShort(lead.createdAt)}</div>
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openManageFromLead(lead)}
                                className="h-7 px-2.5 text-[11px] gap-1"
                              >
                                <Sliders className="w-3 h-3 text-[#e53e3e]" />
                                Activer
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* 2. Abonnés expirant bientôt / quotas faibles */}
              <div className="rounded-xl border border-rose-200 bg-rose-50/20 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-heading font-bold text-[#0d233a] flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-[#e53e3e]" />
                      Abonnements expirant bientôt (≤ 5j) &amp; Quotas presque épuisés ({data.expiringOrLowQuota.length})
                    </h4>
                    <p className="text-[11px] text-[#64748b]">
                      Ciblez ces abonnés en priorité pour un renouvellement ou une recharge de quotas.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={data.expiringOrLowQuota.length === 0}
                    onClick={() => {
                      downloadCsvFile(
                        'renouvellements_tcfca.csv',
                        ['Prénom', 'Nom', 'Email', 'Téléphone', 'Pays', 'Formule', 'Jours restants', 'EE restant', 'EO restant', 'EB restant'],
                        data.expiringOrLowQuota.map((s) => [
                          s.prenom,
                          s.nom,
                          s.email,
                          s.telephone,
                          s.pays,
                          s.planNom,
                          s.daysRemaining ?? '—',
                          s.quotaEe,
                          s.quotaEo,
                          s.quotaEb,
                        ])
                      );
                      toast.success('Export CSV téléchargé.');
                    }}
                    className="h-7 px-2.5 text-xs gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exporter CSV
                  </Button>
                </div>

                {data.expiringOrLowQuota.length === 0 ? (
                  <p className="text-xs text-[#64748b]">Aucun abonné à échéance imminente ou à quota critique.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto bg-white rounded-lg border border-[#e2e8f0]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[11px]">Abonné</TableHead>
                          <TableHead className="text-[11px]">Formule &amp; Échéance</TableHead>
                          <TableHead className="text-[11px]">Quotas restants</TableHead>
                          <TableHead className="text-[11px] text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.expiringOrLowQuota.slice(0, 20).map((sub) => (
                          <TableRow key={sub.userId}>
                            <TableCell className="py-2 text-xs">
                              <div className="font-semibold text-[#0d233a]">
                                {[sub.prenom, sub.nom].filter(Boolean).join(' ') || 'Abonné'}
                              </div>
                              <div className="text-[11px] text-[#64748b]">{sub.email || '—'}</div>
                            </TableCell>
                            <TableCell className="py-2 text-[11px]">
                              <div className="font-semibold text-[#0d233a]">{sub.planNom}</div>
                              <div className="text-[#e53e3e]">
                                {sub.daysRemaining !== null
                                  ? `Expire dans ${sub.daysRemaining}j (${formatDateShort(sub.endAt)})`
                                  : 'Sans échéance'}
                              </div>
                            </TableCell>
                            <TableCell className="py-2 text-[11px]">
                              <span>EE: <strong>{sub.quotaEe}</strong> · EO: <strong>{sub.quotaEo}</strong> · EB: <strong>{sub.quotaEb}</strong></span>
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openManageFromLead(sub)}
                                className="h-7 px-2.5 text-[11px] gap-1"
                              >
                                <Sliders className="w-3 h-3 text-[#e53e3e]" />
                                Prolonger / Quotas
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* 3. Leads chauds (inscrits sans abonnement) */}
              <div className="rounded-xl border border-[#d3e4fe] bg-[#eff4ff]/30 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-heading font-bold text-[#0d233a] flex items-center gap-1.5">
                      <UserPlus className="w-4 h-4 text-[#0d233a]" />
                      Inscrits récents sans abonnement — Leads chauds ({data.hotLeads.length})
                    </h4>
                    <p className="text-[11px] text-[#64748b]">
                      Nouveaux inscrits des 14 derniers jours sans formule active (priorisés s'ils ont visité la page Tarifs).
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={data.hotLeads.length === 0}
                    onClick={() => {
                      downloadCsvFile(
                        'leads_chauds_tcfca.csv',
                        ['Prénom', 'Nom', 'Email', 'Téléphone', 'Pays', 'A vu les tarifs', 'Date inscription'],
                        data.hotLeads.map((l) => [
                          l.prenom,
                          l.nom,
                          l.email,
                          l.telephone,
                          l.pays,
                          l.viewedPricing ? 'Oui' : 'Non',
                          formatDateShort(l.createdAt),
                        ])
                      );
                      toast.success('Export CSV téléchargé.');
                    }}
                    className="h-7 px-2.5 text-xs gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exporter CSV
                  </Button>
                </div>

                {data.hotLeads.length === 0 ? (
                  <p className="text-xs text-[#64748b]">Aucun inscrit récent sans abonnement.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto bg-white rounded-lg border border-[#e2e8f0]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[11px]">Inscrit</TableHead>
                          <TableHead className="text-[11px]">Contact / Pays</TableHead>
                          <TableHead className="text-[11px]">Signal d'achat</TableHead>
                          <TableHead className="text-[11px] text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.hotLeads.slice(0, 20).map((lead) => (
                          <TableRow key={lead.userId}>
                            <TableCell className="py-2 text-xs font-semibold text-[#0d233a]">
                              {[lead.prenom, lead.nom].filter(Boolean).join(' ') || 'Candidat'}
                            </TableCell>
                            <TableCell className="py-2 text-[11px] text-[#475569]">
                              <div>{lead.email || '—'}</div>
                              <div>{lead.telephone || ''} {lead.pays ? `• ${lead.pays}` : ''}</div>
                            </TableCell>
                            <TableCell className="py-2 text-[11px]">
                              {lead.viewedPricing ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                                  A consulté les tarifs
                                </Badge>
                              ) : (
                                <span className="text-[#64748b]">Inscrit le {formatDateShort(lead.createdAt)}</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openManageFromLead(lead)}
                                className="h-7 px-2.5 text-[11px] gap-1"
                              >
                                <Sliders className="w-3 h-3 text-[#e53e3e]" />
                                Activer
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Santé Pédagogique */}
              <div className="rounded-xl border border-[#e2e8f0] bg-[#f8f9ff] p-4 space-y-2.5">
                <h4 className="text-xs font-heading font-bold text-[#0d233a] flex items-center gap-1.5 uppercase tracking-wider">
                  <BookOpen className="w-3.5 h-3.5 text-[#0d233a]" />
                  Santé Pédagogique &amp; Engagement Plateforme
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
                  <div className="rounded-lg bg-white border border-[#e2e8f0] p-2.5">
                    <div className="text-[10px] text-[#64748b]">Fiches lues</div>
                    <div className="font-heading font-extrabold text-[#0d233a] text-sm">{data.pedagogy.fichesLues}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-[#e2e8f0] p-2.5">
                    <div className="text-[10px] text-[#64748b]">Sessions lancées</div>
                    <div className="font-heading font-extrabold text-[#0d233a] text-sm">{data.pedagogy.totalSessions}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-[#e2e8f0] p-2.5">
                    <div className="text-[10px] text-[#64748b]">Examens terminés</div>
                    <div className="font-heading font-extrabold text-[#0d233a] text-sm">{data.pedagogy.examensBlancsTermines}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-[#e2e8f0] p-2.5">
                    <div className="text-[10px] text-[#64748b]">Productions EE/EO</div>
                    <div className="font-heading font-extrabold text-[#0d233a] text-sm">{data.pedagogy.productionsTotal}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-[#e2e8f0] p-2.5">
                    <div className="text-[10px] text-[#64748b]">En attente prof</div>
                    <div className="font-heading font-extrabold text-[#e53e3e] text-sm">{data.pedagogy.correctionsEnAttente}</div>
                  </div>
                  <div className="rounded-lg bg-white border border-[#e2e8f0] p-2.5">
                    <div className="text-[10px] text-[#64748b]">Sessions / abonné</div>
                    <div className="font-heading font-extrabold text-[#0d233a] text-sm">{data.pedagogy.avgSessionsPerActiveSub.toFixed(1)}</div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
