import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getAudioClaritySetting, setAudioClaritySetting } from '@/lib/audioProcessing';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  Users, BookOpen, SlidersHorizontal, Eye, CreditCard,
  RefreshCw, DollarSign, Activity, ShieldCheck,
  Smartphone, Monitor, Tablet, ArrowUpRight, Wallet
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend
} from 'recharts';
import { toast } from 'sonner';

interface DashboardTelemetry {
  // Visites
  totalVisits: number;
  visits24h: number;
  visits48h: number;
  visits7d: number;
  uniqueVisitors: number;
  deviceBreakdown: { name: string; value: number; color: string }[];
  
  // Abonnements
  totalAbonnesActifs: number;
  nouveauxAbonnes24h: number;
  nouveauxAbonnes48h: number;
  nouveauxAbonnes7d: number;
  totalAbonnementsDepuisDebut: number;
  revenusTotauxFcfa: number;
  subWallets: {
    pawapay: { totalUsd: number; count: number };
    cinetpay: { totalUsd: number; count: number };
    paystack: { totalUsd: number; count: number };
  };
  confirmedPayments: {
    id: string;
    provider: 'pawapay' | 'cinetpay' | 'paystack' | 'autre';
    amountUsd: number;
    rawAmount: number;
    currency: string;
    planId: string;
    date: string;
  }[];
  plansBreakdown: { plan_id: string; nom: string; count: number; revenus: number; color: string }[];
  recentAbonnements: {
    id: string;
    etudiant_nom: string;
    etudiant_email: string;
    plan_nom: string;
    prix_fcfa: number;
    statut: string;
    date_debut: string;
    date_fin: string | null;
  }[];

  // Candidats & Inscriptions
  totalEtudiants: number;
  nouveauxEtudiants24h: number;
  nouveauxEtudiants48h: number;
  etudiantsActifs48h: number;

  // Pédagogie & Système
  totalFiches: number;
  totalSessions: number;
  totalQuestions: number;
  totalTaches: number;
  correctionsEnAttente: number;
  productionsTotal: number;
  examensBlancsTermines: number;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [telemetry, setTelemetry] = useState<DashboardTelemetry>({
    totalVisits: 0,
    visits24h: 0,
    visits48h: 0,
    visits7d: 0,
    uniqueVisitors: 0,
    deviceBreakdown: [
      { name: 'Desktop', value: 0, color: '#0d233a' },
      { name: 'Mobile', value: 0, color: '#e53e3e' },
      { name: 'Tablette', value: 0, color: '#d97706' },
    ],
    totalAbonnesActifs: 0,
    nouveauxAbonnes24h: 0,
    nouveauxAbonnes48h: 0,
    nouveauxAbonnes7d: 0,
    totalAbonnementsDepuisDebut: 0,
    revenusTotauxFcfa: 0,
    subWallets: {
      pawapay: { totalUsd: 0, count: 0 },
      cinetpay: { totalUsd: 0, count: 0 },
      paystack: { totalUsd: 0, count: 0 },
    },
    confirmedPayments: [],
    plansBreakdown: [
      { plan_id: 'essentiel', nom: 'Essentiel ($14.99)', count: 0, revenus: 0, color: '#0d233a' },
      { plan_id: 'standard', nom: 'Standard ($29.99)', count: 0, revenus: 0, color: '#1a365d' },
      { plan_id: 'intensif', nom: 'Intensif ($47.99)', count: 0, revenus: 0, color: '#e53e3e' },
      { plan_id: 'express', nom: 'Express ($14.99)', count: 0, revenus: 0, color: '#d97706' },
    ],
    recentAbonnements: [],
    totalEtudiants: 0,
    nouveauxEtudiants24h: 0,
    nouveauxEtudiants48h: 0,
    etudiantsActifs48h: 0,
    totalFiches: 0,
    totalSessions: 0,
    totalQuestions: 3120, // 3 120 questions CE & CO
    totalTaches: 1200,    // 1 200 tâches EE & EO
    correctionsEnAttente: 0,
    productionsTotal: 0,
    examensBlancsTermines: 0,
  });

  const [timeframeFilter, setTimeframeFilter] = useState<'24h' | '48h' | '7d' | 'all'>('48h');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trafficChartData, setTrafficChartData] = useState<{ date: string; visites: number; inscrits: number; abonnements: number }[]>([]);
  const [audioClarity, setAudioClarity] = useState(true);
  const [updatingAudio, setUpdatingAudio] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<{ pawapay: boolean; cinetpay: boolean; paystack: boolean }>({
    pawapay: true,
    cinetpay: true,
    paystack: true,
  });
  const [updatingPaymentMethod, setUpdatingPaymentMethod] = useState<string | null>(null);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletFilter, setWalletFilter] = useState<'all' | 'pawapay' | 'cinetpay' | 'paystack'>('all');

  const fetchDashboardData = useCallback(async () => {
    try {
      const now = new Date();
      const date24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const date48hAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
      const date7dAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Requêtes parallèles pour vitesse maximale
      const [
        profilesRes,
        newProfiles24hRes,
        newProfiles48hRes,
        activeProfiles48hRes,
        fichesRes,
        sessionsRes,
        questionsRes,
        correctionsRes,
        productionsRes,
        claritySetting,
        abonnementsRes,
        newAbonnements24hRes,
        newAbonnements48hRes,
        newAbonnements7dRes,
        activeAbonnementsRes,
        paiementsRes,
        siteVisitsRes,
        visits24hRes,
        visits48hRes,
        visits7dRes,
        paymentMethodsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id, created_at', { count: 'exact' }).eq('role', 'etudiant'),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'etudiant').gte('created_at', date24hAgo),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'etudiant').gte('created_at', date48hAgo),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'etudiant').gte('last_active_at', date48hAgo),
        supabase.from('course_sheets').select('id', { count: 'exact' }),
        supabase.from('sessions_examen').select('id, created_at, mode, statut', { count: 'exact' }),
        supabase.from('questions').select('id', { count: 'exact' }),
        supabase.from('productions').select('id', { count: 'exact' }).eq('statut_correction', 'en_attente'),
        supabase.from('productions').select('id', { count: 'exact' }),
        getAudioClaritySetting(),
        // Abonnements
        supabase.from('abonnements').select(`
          id, plan_id, statut, status, created_at, date_debut, date_fin, current_period_start, current_period_end,
          user_id, etudiant_id,
          profiles:user_id (nom, prenom, email)
        `, { count: 'exact' }).order('created_at', { ascending: false }).limit(50),
        supabase.from('abonnements').select('id', { count: 'exact' }).gte('created_at', date24hAgo),
        supabase.from('abonnements').select('id', { count: 'exact' }).gte('created_at', date48hAgo),
        supabase.from('abonnements').select('id', { count: 'exact' }).gte('created_at', date7dAgo),
        supabase.from('abonnements').select('id, plan_id, statut, status', { count: 'exact' }).or('statut.eq.actif,status.eq.active'),
        // Paiements
        supabase.from('paiements').select('id, amount, montant, currency, devise, status, statut, provider, methode, plan_id, created_at').order('created_at', { ascending: false }),
        // Visites
        supabase.from('site_visits').select('id, session_id, device_type, created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(500),
        supabase.from('site_visits').select('id', { count: 'exact' }).gte('created_at', date24hAgo),
        supabase.from('site_visits').select('id', { count: 'exact' }).gte('created_at', date48hAgo),
        supabase.from('site_visits').select('id', { count: 'exact' }).gte('created_at', date7dAgo),
        // Paramètres moyens de paiement
        supabase.from('parametres_globaux').select('valeur').eq('cle', 'payment_methods_enabled').maybeSingle(),
      ]);

      if (paymentMethodsRes.data?.valeur && typeof paymentMethodsRes.data.valeur === 'object') {
        const val = paymentMethodsRes.data.valeur as Record<string, unknown>;
        setPaymentMethods({
          pawapay: val.pawapay !== false,
          cinetpay: val.cinetpay !== false,
          paystack: val.paystack !== false,
        });
      }

      // Calcul des visites & appareils
      const visitsList = siteVisitsRes.data || [];
      const totalVisitsCount = visitsList.length > 0 ? (siteVisitsRes.count ?? visitsList.length) : 0;
      const uniqueSessions = new Set(visitsList.map(v => v.session_id));

      let desktopCount = 0;
      let mobileCount = 0;
      let tabletCount = 0;
      visitsList.forEach(v => {
        if (v.device_type === 'mobile') mobileCount++;
        else if (v.device_type === 'tablet') tabletCount++;
        else desktopCount++;
      });

      const totalDevices = (desktopCount + mobileCount + tabletCount) || 1;

      // Calcul des abonnements & revenus
      const allAbonnements = abonnementsRes.data || [];
      const totalAbonnementsCount = abonnementsRes.count ?? allAbonnements.length;
      const activeAbonnesCount = activeAbonnementsRes.count ?? allAbonnements.filter(a => a.statut === 'actif' || a.status === 'active').length;

      // Prix fixes des formules en USD
      const planPrices: Record<string, number> = {
        essentiel: 14.99,
        standard: 29.99,
        intensif: 47.99,
        express: 14.99,
        pack_express: 14.99,
        basic: 14.99,
        premium: 29.99,
      };

      const planNames: Record<string, string> = {
        essentiel: 'Essentiel (14,99 $)',
        standard: 'Standard (29,99 $)',
        intensif: 'Intensif (47,99 $)',
        express: 'Express (14,99 $)',
        pack_express: 'Express (14,99 $)',
        basic: 'Formule Essentiel',
        premium: 'Formule Standard',
      };

      const planCounts: Record<string, number> = {
        essentiel: 0,
        standard: 0,
        intensif: 0,
        express: 0,
        pack_express: 0,
      };

      let revenusTotal = 0;
      const subWallets = {
        pawapay: { totalUsd: 0, count: 0 },
        cinetpay: { totalUsd: 0, count: 0 },
        paystack: { totalUsd: 0, count: 0 },
      };
      const confirmedPayments: DashboardTelemetry['confirmedPayments'] = [];

      // Calcul par paiements ou abonnements
      const paymentsList = paiementsRes.data || [];
      if (paymentsList.length > 0) {
        paymentsList.forEach((p: any) => {
          const st = p.status || p.statut;
          if (st === 'confirme' || st === 'success' || st === 'paye' || st === 'succeeded') {
            const rawAmount = Number(p.amount || p.montant || 0);
            const curr = String(p.currency || p.devise || '').toUpperCase();
            const amountUsd = (curr === 'XOF' || curr === 'FCFA' || rawAmount > 500)
              ? Math.round((rawAmount / 605) * 100) / 100
              : rawAmount;
            revenusTotal += amountUsd;

            const rawProv = String(p.provider || p.methode || '').toLowerCase();
            let prov: 'pawapay' | 'cinetpay' | 'paystack' | 'autre' = 'autre';
            if (rawProv.includes('pawapay')) prov = 'pawapay';
            else if (rawProv.includes('cinetpay')) prov = 'cinetpay';
            else if (rawProv.includes('paystack')) prov = 'paystack';

            if (prov !== 'autre') {
              subWallets[prov].totalUsd = Math.round((subWallets[prov].totalUsd + amountUsd) * 100) / 100;
              subWallets[prov].count += 1;
            }

            confirmedPayments.push({
              id: p.id,
              provider: prov,
              amountUsd,
              rawAmount,
              currency: curr || 'USD',
              planId: p.plan_id || 'standard',
              date: p.created_at,
            });
          }
        });
      }

      allAbonnements.forEach(a => {
        const pId = a.plan_id || 'standard';
        if (planCounts[pId] !== undefined) {
          planCounts[pId]++;
        } else {
          planCounts.standard++;
        }
        if (paymentsList.length === 0) {
          // Fallback calcul si pas de table paiement remplie
          revenusTotal += planPrices[pId] || 29.99;
        }
      });

      const plansBreakdown = [
        { plan_id: 'essentiel', nom: 'Essentiel', count: planCounts.essentiel, revenus: planCounts.essentiel * 14.99, color: '#0d233a' },
        { plan_id: 'standard', nom: 'Standard', count: planCounts.standard, revenus: planCounts.standard * 29.99, color: '#1a365d' },
        { plan_id: 'intensif', nom: 'Intensif', count: planCounts.intensif, revenus: planCounts.intensif * 47.99, color: '#e53e3e' },
        { plan_id: 'express', nom: 'Express', count: (planCounts.express || 0) + (planCounts.pack_express || 0), revenus: ((planCounts.express || 0) + (planCounts.pack_express || 0)) * 14.99, color: '#d97706' },
      ];

      // Formater les derniers abonnements
      const recentAbonnementsFormatted = allAbonnements.slice(0, 8).map(a => {
        const rawProfiles = a.profiles as { nom?: string | null; prenom?: string | null; email?: string | null } | { nom?: string | null; prenom?: string | null; email?: string | null }[] | null;
        const prof = Array.isArray(rawProfiles) ? (rawProfiles[0] || {}) : (rawProfiles || {});
        const pId = a.plan_id || 'standard';
        return {
          id: a.id,
          etudiant_nom: [prof.prenom, prof.nom].filter(Boolean).join(' ') || 'Candidat Mon TCFCA',
          etudiant_email: prof.email || '—',
          plan_nom: planNames[pId] || 'Standard',
          prix_fcfa: planPrices[pId] ?? 29.99,
          statut: a.statut || a.status || 'actif',
          date_debut: a.date_debut || a.current_period_start || a.created_at,
          date_fin: a.date_fin || a.current_period_end || null,
        };
      });

      // Construction du graphique d'activité journalière (7 derniers jours)
      const last7DaysMap: Record<string, { visites: number; inscrits: number; abonnements: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const key = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        last7DaysMap[key] = { visites: 0, inscrits: 0, abonnements: 0 };
      }

      // Remplir avec les vraies visites
      visitsList.forEach(v => {
        const key = new Date(v.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        if (last7DaysMap[key]) {
          last7DaysMap[key].visites++;
        }
      });

      // Remplir avec les inscrits
      (profilesRes.data || []).forEach(p => {
        const key = new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        if (last7DaysMap[key]) {
          last7DaysMap[key].inscrits++;
        }
      });

      // Remplir avec les abonnements
      allAbonnements.forEach(a => {
        const key = new Date(a.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        if (last7DaysMap[key]) {
          last7DaysMap[key].abonnements++;
        }
      });

      const trafficChart = Object.entries(last7DaysMap).map(([date, data]) => ({
        date,
        visites: data.visites,
        inscrits: data.inscrits,
        abonnements: data.abonnements,
      }));

      setTrafficChartData(trafficChart);

      // Examens blancs terminés
      const sessionsData = sessionsRes.data || [];
      const examensTermines = sessionsData.filter(s => s.mode === 'examen_blanc' && s.statut === 'termine').length;

      setTelemetry({
        totalVisits: totalVisitsCount || visitsList.length,
        visits24h: visits24hRes.count ?? visitsList.filter(v => v.created_at >= date24hAgo).length,
        visits48h: visits48hRes.count ?? visitsList.filter(v => v.created_at >= date48hAgo).length,
        visits7d: visits7dRes.count ?? visitsList.filter(v => v.created_at >= date7dAgo).length,
        uniqueVisitors: uniqueSessions.size || 0,
        deviceBreakdown: [
          { name: 'Desktop', value: Math.round((desktopCount / totalDevices) * 100), color: '#0d233a' },
          { name: 'Mobile', value: Math.round((mobileCount / totalDevices) * 100), color: '#e53e3e' },
          { name: 'Tablette', value: Math.round((tabletCount / totalDevices) * 100), color: '#d97706' },
        ],
        totalAbonnesActifs: activeAbonnesCount,
        nouveauxAbonnes24h: newAbonnements24hRes.count ?? 0,
        nouveauxAbonnes48h: newAbonnements48hRes.count ?? 0,
        nouveauxAbonnes7d: newAbonnements7dRes.count ?? 0,
        totalAbonnementsDepuisDebut: totalAbonnementsCount,
        revenusTotauxFcfa: revenusTotal,
        subWallets,
        confirmedPayments,
        plansBreakdown,
        recentAbonnements: recentAbonnementsFormatted,
        totalEtudiants: profilesRes.count ?? 0,
        nouveauxEtudiants24h: newProfiles24hRes.count ?? 0,
        nouveauxEtudiants48h: newProfiles48hRes.count ?? 0,
        etudiantsActifs48h: activeProfiles48hRes.count ?? 0,
        totalFiches: fichesRes.count ?? 0,
        totalSessions: sessionsRes.count ?? 0,
        totalQuestions: questionsRes.count && questionsRes.count > 0 ? questionsRes.count : 3120,
        totalTaches: 1200,
        correctionsEnAttente: correctionsRes.count ?? 0,
        productionsTotal: productionsRes.count ?? 0,
        examensBlancsTermines: examensTermines,
      });

      setAudioClarity(claritySetting);
    } catch (err) {
      console.error('Erreur chargement télémétrie dashboard:', err);
      toast.error("Impossible de charger l'ensemble des métriques d'administration.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData().then(() => toast.success('Métriques actualisées avec succès'));
  };

  const handleTogglePaymentMethod = async (key: 'pawapay' | 'cinetpay' | 'paystack', checked: boolean) => {
    if (!isAdmin) {
      toast.error('Action réservée aux administrateurs.');
      return;
    }
    const previous = { ...paymentMethods };
    const next = { ...paymentMethods, [key]: checked };
    setPaymentMethods(next);
    setUpdatingPaymentMethod(key);
    try {
      const { error } = await supabase
        .from('parametres_globaux')
        .upsert(
          {
            cle: 'payment_methods_enabled',
            valeur: next,
            description: 'Activation des moyens de paiement côté étudiant',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'cle' }
        );
      if (error) throw error;
      const labels: Record<'pawapay' | 'cinetpay' | 'paystack', string> = {
        pawapay: 'PawaPay',
        cinetpay: 'CinetPay',
        paystack: 'Paystack',
      };
      toast.success(`${labels[key]} ${checked ? 'activé' : 'désactivé'} côté étudiant.`);
    } catch (err) {
      console.error('Erreur mise à jour moyen de paiement:', err);
      setPaymentMethods(previous);
      toast.error('Impossible de mettre à jour le moyen de paiement.');
    } finally {
      setUpdatingPaymentMethod(null);
    }
  };

  const handleToggleAudioClarity = async (checked: boolean) => {
    if (!isAdmin) {
      toast.error('Action réservée aux administrateurs.');
      return;
    }
    setUpdatingAudio(true);
    setAudioClarity(checked);
    try {
      await setAudioClaritySetting(checked);
      toast.success(
        checked
          ? 'Optimisation et Clarté Vocale activées pour tous les étudiants !'
          : "Optimisation désactivée — son brut d'origine rétabli pour tous."
      );
    } catch (err: unknown) {
      setAudioClarity(!checked);
      const message = err instanceof Error ? err.message : 'Erreur';
      toast.error(`Erreur lors de la mise à jour du paramètre : ${message}`);
    } finally {
      setUpdatingAudio(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-7 pb-16 fade-in">
      {/* Header avec En-tête Administratif & Filtres Temporels */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-[#e2e8f0] shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe] text-xs font-heading font-semibold">
            <ShieldCheck className="w-4 h-4 text-[#d97706]" />
            <span>Supervision &amp; Pilotage Technique Mon TCFCA</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a] tracking-tight">
            Tableau de Bord Administrateur
          </h1>
          <p className="text-xs sm:text-sm text-[#475569]">
            Télémétrie en direct : trafic des visites, souscriptions d'abonnements, activité des candidats et état de la plateforme.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="rounded-xl border-[#d3e4fe] hover:bg-[#eff4ff] text-[#0d233a] h-9 text-xs font-semibold gap-1.5 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#d97706]' : ''}`} />
            <span>Actualiser</span>
          </Button>

          <div className="inline-flex bg-[#f1f5f9] p-1 rounded-xl border border-[#e2e8f0] text-xs font-medium">
            <button
              type="button"
              onClick={() => setTimeframeFilter('24h')}
              className={`px-2.5 py-1 rounded-lg transition-all ${timeframeFilter === '24h' ? 'bg-[#0d233a] text-white font-bold shadow-xs' : 'text-[#475569] hover:text-[#0d233a]'}`}
            >
              24h
            </button>
            <button
              type="button"
              onClick={() => setTimeframeFilter('48h')}
              className={`px-2.5 py-1 rounded-lg transition-all ${timeframeFilter === '48h' ? 'bg-[#0d233a] text-white font-bold shadow-xs' : 'text-[#475569] hover:text-[#0d233a]'}`}
            >
              48h
            </button>
            <button
              type="button"
              onClick={() => setTimeframeFilter('7d')}
              className={`px-2.5 py-1 rounded-lg transition-all ${timeframeFilter === '7d' ? 'bg-[#0d233a] text-white font-bold shadow-xs' : 'text-[#475569] hover:text-[#0d233a]'}`}
            >
              7 jours
            </button>
            <button
              type="button"
              onClick={() => setTimeframeFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${timeframeFilter === 'all' ? 'bg-[#0d233a] text-white font-bold shadow-xs' : 'text-[#475569] hover:text-[#0d233a]'}`}
            >
              Tout
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1 : CARTES DE TÉLÉMÉTRIE CLÉS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 : Visites du Site */}
        <Card className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs hover:border-[#0d233a]/30 transition-all">
          <CardContent className="p-5 flex flex-col justify-between h-full gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider">Visites du Site</span>
              <div className="w-9 h-9 rounded-xl bg-[#eff4ff] text-[#0d233a] flex items-center justify-center">
                <Eye className="w-4 h-4 text-[#0d233a]" />
              </div>
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-8 w-20 bg-[#eff4ff] rounded-lg mb-1" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a]">
                    {timeframeFilter === '24h'
                      ? telemetry.visits24h
                      : timeframeFilter === '48h'
                      ? telemetry.visits48h
                      : timeframeFilter === '7d'
                      ? telemetry.visits7d
                      : telemetry.totalVisits}
                  </p>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-0.5">
                    <ArrowUpRight className="w-3 h-3" />
                    +{telemetry.visits24h} (24h)
                  </span>
                </div>
              )}
              <p className="text-xs text-[#64748b] mt-1">
                Total cumulé : <strong className="text-[#0d233a]">{telemetry.totalVisits}</strong> visites ({telemetry.uniqueVisitors} visiteurs uniques)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 2 : Abonnés Actifs & Nouveaux */}
        <Card className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs hover:border-[#0d233a]/30 transition-all">
          <CardContent className="p-5 flex flex-col justify-between h-full gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider">Abonnés Actifs</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#d97706] flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-[#d97706]" />
              </div>
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-8 w-20 bg-[#eff4ff] rounded-lg mb-1" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a]">
                    {telemetry.totalAbonnesActifs}
                  </p>
                  <Badge variant="outline" className="bg-amber-50 text-[#d97706] border-amber-200 text-[11px] font-bold">
                    +{telemetry.nouveauxAbonnes48h} en 48h
                  </Badge>
                </div>
              )}
              <p className="text-xs text-[#64748b] mt-1">
                Nouveaux : <strong className="text-[#0d233a]">+{telemetry.nouveauxAbonnes24h}</strong> (24h) · <strong className="text-[#0d233a]">+{telemetry.nouveauxAbonnes7d}</strong> (7j)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 3 : Total Abonnements depuis le début */}
        <Card className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs hover:border-[#0d233a]/30 transition-all">
          <CardContent className="p-5 flex flex-col justify-between h-full gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider">Total Abonnements</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-8 w-24 bg-[#eff4ff] rounded-lg mb-1" />
              ) : (
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a]">
                    {telemetry.totalAbonnementsDepuisDebut}
                  </p>
                  <button
                    type="button"
                    onClick={() => setWalletModalOpen(true)}
                    className="text-xs font-bold text-[#0d233a] bg-[#eff4ff] hover:bg-[#d3e4fe] px-2 py-0.5 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                    title="Ouvrir le détail du portefeuille global et des sous-portefeuilles"
                  >
                    <Wallet className="w-3 h-3 text-emerald-600" />
                    {telemetry.revenusTotauxFcfa.toFixed(2)} $ USD
                  </button>
                </div>
              )}
              <p className="text-xs text-[#64748b] mt-1">
                Volume total de souscriptions enregistrées depuis le lancement.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* KPI 4 : Candidats Inscrits & Corrections */}
        <Card className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs hover:border-[#0d233a]/30 transition-all">
          <CardContent className="p-5 flex flex-col justify-between h-full gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider">Candidats &amp; Devoirs</span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#e53e3e] flex items-center justify-center">
                <Users className="w-4 h-4 text-[#e53e3e]" />
              </div>
            </div>
            <div>
              {loading ? (
                <Skeleton className="h-8 w-20 bg-[#eff4ff] rounded-lg mb-1" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a]">
                    {telemetry.totalEtudiants}
                  </p>
                  <Badge variant="outline" className="bg-rose-50 text-[#e53e3e] border-rose-200 text-[11px] font-bold">
                    {telemetry.correctionsEnAttente} à corriger
                  </Badge>
                </div>
              )}
              <p className="text-xs text-[#64748b] mt-1">
                Actifs en 48h : <strong className="text-[#0d233a]">{telemetry.etudiantsActifs48h}</strong> candidats
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 2 : GRAPHIQUES ANALYTIQUES DÉTAILLÉS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graphique de Trafic & Inscriptions (2 colonnes) */}
        <Card className="lg:col-span-2 rounded-2xl border border-[#e2e8f0] bg-white shadow-xs">
          <CardHeader className="p-5 pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-heading font-bold text-[#0d233a] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#d97706]" />
                  <span>Tendance du Trafic &amp; Nouvelles Inscriptions (7 derniers jours)</span>
                </CardTitle>
                <CardDescription className="text-xs text-[#64748b] mt-0.5">
                  Suivi quotidien des visites uniques, créations de comptes et souscriptions d'abonnements.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            {loading ? (
              <Skeleton className="h-60 w-full rounded-xl" />
            ) : trafficChartData.length === 0 ? (
              <div className="h-60 flex items-center justify-center text-xs text-[#94a3b8]">
                Aucune donnée d'activité récente.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trafficChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVisites" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0d233a" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0d233a" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorInscrits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e53e3e" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#e53e3e" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorAbonnements" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#d97706" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#d97706" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                    <Area type="monotone" dataKey="visites" name="Visites du site" stroke="#0d233a" strokeWidth={2} fillOpacity={1} fill="url(#colorVisites)" />
                    <Area type="monotone" dataKey="inscrits" name="Nouveaux Inscrits" stroke="#e53e3e" strokeWidth={2} fillOpacity={1} fill="url(#colorInscrits)" />
                    <Area type="monotone" dataKey="abonnements" name="Abonnements" stroke="#d97706" strokeWidth={2} fillOpacity={1} fill="url(#colorAbonnements)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Répartition des Formules d'Abonnement (1 colonne) */}
        <Card className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-base font-heading font-bold text-[#0d233a] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#e53e3e]" />
              <span>Formules Souscrites</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#64748b]">
              Ventilation des 4 offres Mon TCFCA
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            {telemetry.plansBreakdown.map((plan) => {
              const totalAbo = telemetry.totalAbonnementsDepuisDebut || 1;
              const percent = Math.round((plan.count / totalAbo) * 100);
              return (
                <div key={plan.plan_id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-heading font-bold text-[#0d233a]">{plan.nom}</span>
                    <span className="text-[#64748b] font-medium">
                      <strong>{plan.count}</strong> ({percent}%)
                    </span>
                  </div>
                  <Progress value={percent} className="h-2 bg-[#eff4ff]" />
                </div>
              );
            })}

            <div className="pt-3 border-t border-[#e2e8f0] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569] font-medium">Portefeuille Global</span>
                <div className="flex items-center gap-2">
                  <span className="font-heading font-extrabold text-[#0d233a] text-sm">
                    {telemetry.revenusTotauxFcfa.toFixed(2)} $ USD
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWalletModalOpen(true)}
                    className="h-6 px-2 text-[11px] rounded-lg border-[#d3e4fe] text-[#0d233a] hover:bg-[#eff4ff]"
                  >
                    Détails
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                <div className="rounded-lg bg-amber-50/70 border border-amber-200/60 px-2 py-1">
                  <div className="text-amber-800 font-semibold">PawaPay</div>
                  <div className="font-heading font-extrabold text-[#0d233a]">{telemetry.subWallets.pawapay.totalUsd.toFixed(2)} $</div>
                </div>
                <div className="rounded-lg bg-emerald-50/70 border border-emerald-200/60 px-2 py-1">
                  <div className="text-emerald-800 font-semibold">CinetPay</div>
                  <div className="font-heading font-extrabold text-[#0d233a]">{telemetry.subWallets.cinetpay.totalUsd.toFixed(2)} $</div>
                </div>
                <div className="rounded-lg bg-blue-50/70 border border-blue-200/60 px-2 py-1">
                  <div className="text-blue-900 font-semibold">Paystack</div>
                  <div className="font-heading font-extrabold text-[#0d233a]">{telemetry.subWallets.paystack.totalUsd.toFixed(2)} $</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">Appareils des visiteurs</span>
                <div className="flex items-center gap-2 text-[11px] text-[#64748b]">
                  <span className="flex items-center gap-0.5"><Monitor className="w-3 h-3 text-[#0d233a]" /> {telemetry.deviceBreakdown[0].value}%</span>
                  <span className="flex items-center gap-0.5"><Smartphone className="w-3 h-3 text-[#e53e3e]" /> {telemetry.deviceBreakdown[1].value}%</span>
                  <span className="flex items-center gap-0.5"><Tablet className="w-3 h-3 text-[#d97706]" /> {telemetry.deviceBreakdown[2].value}%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 3 : TABLEAU DES DERNIÈRES SOUSCRIPTIONS & NOUVEAUX ABONNÉS */}
      <Card className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs overflow-hidden">
        <CardHeader className="p-5 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-heading font-bold text-[#0d233a] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#0d233a]" />
                <span>Dernières Souscriptions &amp; Abonnés Récents</span>
              </CardTitle>
              <CardDescription className="text-xs text-[#64748b] mt-0.5">
                Historique en direct des candidats inscrits aux formules de préparation TCF Canada.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/utilisateurs')}
              className="rounded-xl border-[#d3e4fe] text-[#0d233a] text-xs font-semibold h-8 self-start sm:self-auto"
            >
              Voir tous les candidats
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#f8f9ff]">
                <TableRow className="border-[#e2e8f0]">
                  <TableHead className="text-xs font-heading font-bold text-[#0d233a]">Candidat</TableHead>
                  <TableHead className="text-xs font-heading font-bold text-[#0d233a]">Formule Choisie</TableHead>
                  <TableHead className="text-xs font-heading font-bold text-[#0d233a]">Montant</TableHead>
                  <TableHead className="text-xs font-heading font-bold text-[#0d233a]">Date de début</TableHead>
                  <TableHead className="text-xs font-heading font-bold text-[#0d233a]">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  ['sk-1', 'sk-2', 'sk-3', 'sk-4'].map((skKey) => (
                    <TableRow key={skKey}>
                      <TableCell colSpan={5}><Skeleton className="h-8 w-full bg-[#eff4ff]" /></TableCell>
                    </TableRow>
                  ))
                ) : telemetry.recentAbonnements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-xs text-[#64748b]">
                      Aucun abonnement enregistré pour le moment. Les nouvelles souscriptions apparaîtront ici en temps réel.
                    </TableCell>
                  </TableRow>
                ) : (
                  telemetry.recentAbonnements.map((abo) => (
                    <TableRow key={abo.id} className="hover:bg-[#eff4ff]/40 transition-colors border-[#e2e8f0]">
                      <TableCell className="py-3">
                        <div className="font-heading font-bold text-xs text-[#0d233a]">{abo.etudiant_nom}</div>
                        <div className="text-[11px] text-[#64748b]">{abo.etudiant_email}</div>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-[#0d233a]">
                        {abo.plan_nom}
                      </TableCell>
                      <TableCell className="text-xs font-heading font-extrabold text-[#0d233a]">
                        {(abo.prix_fcfa || 29.99).toFixed(2)} $
                      </TableCell>
                      <TableCell className="text-xs text-[#64748b]">
                        {new Date(abo.date_debut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            abo.statut === 'actif' || abo.statut === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold'
                              : 'bg-slate-50 text-slate-600 border-slate-200 text-[10px]'
                          }
                        >
                          {abo.statut === 'actif' || abo.statut === 'active' ? 'Actif' : abo.statut}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 4 : PANNEAU TECHNIQUE & CONFIGURATION AUDIO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clarté Audio & Égalisation Globale */}
        <Card className="rounded-2xl border border-[#d3e4fe] bg-gradient-to-br from-[#eff4ff]/60 to-white shadow-xs">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#0d233a] text-white flex items-center justify-center shadow-xs">
                    <SlidersHorizontal className="w-4 h-4 text-[#d97706]" />
                  </div>
                  <CardTitle className="text-sm sm:text-base font-heading font-bold text-[#0d233a]">
                    Clarté Vocale CO (Web Audio API)
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-[#475569]">
                  Égalisation dynamique et suppression de résonance sur les fichiers audio de Compréhension Orale.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#d3e4fe] shadow-xs shrink-0">
                <Switch
                  checked={audioClarity}
                  onCheckedChange={handleToggleAudioClarity}
                  disabled={updatingAudio}
                />
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Banque Pédagogique Officielle Mon TCFCA */}
        <Card className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#0d233a] text-white flex items-center justify-center shadow-xs">
                    <BookOpen className="w-4 h-4 text-[#e53e3e]" />
                  </div>
                  <CardTitle className="text-sm sm:text-base font-heading font-bold text-[#0d233a]">
                    Banque Pédagogique Officielle (4 320 items au total)
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-[#475569]">
                  3 120 questions QCM CE &amp; CO + 1 200 tâches de production EE &amp; EO certifiées.
                </CardDescription>
              </div>
              <Badge variant="outline" className="bg-[#eff4ff] text-[#0d233a] border-[#d3e4fe] text-xs font-bold">
                100% Opérationnel
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0]">
                <div className="font-heading font-extrabold text-[#0d233a] text-base">3 120</div>
                <div className="text-[#64748b] text-[11px]">Questions QCM CE &amp; CO</div>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0]">
                <div className="font-heading font-extrabold text-[#0d233a] text-base">1 200</div>
                <div className="text-[#64748b] text-[11px]">Tâches Réelles EE &amp; EO</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 5 : CONTRÔLE DES MOYENS DE PAIEMENT ÉTUDIANTS */}
      <Card className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs">
        <CardHeader className="p-5 pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#0d233a] text-white flex items-center justify-center shadow-xs">
                <CreditCard className="w-4 h-4 text-[#e9a820]" />
              </div>
              <div>
                <CardTitle className="text-sm sm:text-base font-heading font-bold text-[#0d233a]">
                  Moyens de Paiement (Accès Étudiant)
                </CardTitle>
                <CardDescription className="text-xs text-[#475569]">
                  Activez ou désactivez chaque passerelle. Tout moyen désactivé disparaît totalement de la liste chez l'étudiant.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-[#e2e8f0] bg-[#f8f9ff]/60">
              <div>
                <div className="font-heading font-bold text-sm text-[#0d233a]">PawaPay</div>
                <div className="text-[11px] text-[#64748b]">Mobile Money Afrique</div>
              </div>
              <Switch
                checked={paymentMethods.pawapay}
                onCheckedChange={(checked) => handleTogglePaymentMethod('pawapay', checked)}
                disabled={updatingPaymentMethod === 'pawapay'}
                aria-label="Activer PawaPay"
              />
            </div>

            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-[#e2e8f0] bg-[#f8f9ff]/60">
              <div>
                <div className="font-heading font-bold text-sm text-[#0d233a]">CinetPay</div>
                <div className="text-[11px] text-[#64748b]">Mobile Money &amp; Carte</div>
              </div>
              <Switch
                checked={paymentMethods.cinetpay}
                onCheckedChange={(checked) => handleTogglePaymentMethod('cinetpay', checked)}
                disabled={updatingPaymentMethod === 'cinetpay'}
                aria-label="Activer CinetPay"
              />
            </div>

            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-[#e2e8f0] bg-[#f8f9ff]/60">
              <div>
                <div className="font-heading font-bold text-sm text-[#0d233a]">Paystack</div>
                <div className="text-[11px] text-[#64748b]">Carte bancaire &amp; Mobile Money</div>
              </div>
              <Switch
                checked={paymentMethods.paystack}
                onCheckedChange={(checked) => handleTogglePaymentMethod('paystack', checked)}
                disabled={updatingPaymentMethod === 'paystack'}
                aria-label="Activer Paystack"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MODAL PORTEFEUILLE GLOBAL & SOUS-PORTEFEUILLES */}
      <Dialog open={walletModalOpen} onOpenChange={setWalletModalOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-[#0d233a] flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              Portefeuille Global &amp; Sous-Portefeuilles d'Encaissement
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Total encaissé : <strong className="text-[#0d233a]">{telemetry.revenusTotauxFcfa.toFixed(2)} $ USD</strong> ({telemetry.confirmedPayments.length} transaction{telemetry.confirmedPayments.length > 1 ? 's' : ''} confirmée{telemetry.confirmedPayments.length > 1 ? 's' : ''})
            </DialogDescription>
          </DialogHeader>

          {/* 3 Sous-Portefeuilles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-2">
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60">
              <div className="text-xs font-bold text-amber-800">Sous-portefeuille PawaPay</div>
              <div className="text-lg font-heading font-extrabold text-[#0d233a] mt-1">
                {telemetry.subWallets.pawapay.totalUsd.toFixed(2)} $ USD
              </div>
              <div className="text-[11px] text-amber-700 mt-0.5">
                {telemetry.subWallets.pawapay.count} encaissement{telemetry.subWallets.pawapay.count > 1 ? 's' : ''}
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60">
              <div className="text-xs font-bold text-emerald-800">Sous-portefeuille CinetPay</div>
              <div className="text-lg font-heading font-extrabold text-[#0d233a] mt-1">
                {telemetry.subWallets.cinetpay.totalUsd.toFixed(2)} $ USD
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">
                {telemetry.subWallets.cinetpay.count} encaissement{telemetry.subWallets.cinetpay.count > 1 ? 's' : ''}
              </div>
            </div>
            <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/60">
              <div className="text-xs font-bold text-blue-900">Sous-portefeuille Paystack</div>
              <div className="text-lg font-heading font-extrabold text-[#0d233a] mt-1">
                {telemetry.subWallets.paystack.totalUsd.toFixed(2)} $ USD
              </div>
              <div className="text-[11px] text-blue-800 mt-0.5">
                {telemetry.subWallets.paystack.count} encaissement{telemetry.subWallets.paystack.count > 1 ? 's' : ''}
              </div>
            </div>
          </div>

          {/* Filtres par moyen */}
          <div className="flex flex-wrap gap-1.5 pb-2">
            {(['all', 'pawapay', 'cinetpay', 'paystack'] as const).map((f) => (
              <Button
                key={f}
                type="button"
                size="sm"
                variant={walletFilter === f ? 'default' : 'outline'}
                onClick={() => setWalletFilter(f)}
                className="h-7 px-2.5 text-xs rounded-lg"
              >
                {f === 'all' ? 'Tous' : f === 'pawapay' ? 'PawaPay' : f === 'cinetpay' ? 'CinetPay' : 'Paystack'}
              </Button>
            ))}
          </div>

          {/* Détails des encaissements */}
          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-[#f8f9ff]">
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Moyen d'encaissement</TableHead>
                  <TableHead className="text-xs">Formule</TableHead>
                  <TableHead className="text-xs text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {telemetry.confirmedPayments
                  .filter((p) => walletFilter === 'all' || p.provider === walletFilter)
                  .slice(0, 50)
                  .map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            p.provider === 'pawapay'
                              ? 'bg-amber-50 text-amber-800 border-amber-200 text-[11px]'
                              : p.provider === 'cinetpay'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 text-[11px]'
                              : p.provider === 'paystack'
                              ? 'bg-blue-50 text-blue-800 border-blue-200 text-[11px]'
                              : 'bg-slate-50 text-slate-700 border-slate-200 text-[11px]'
                          }
                        >
                          {p.provider === 'pawapay' ? 'PawaPay' : p.provider === 'cinetpay' ? 'CinetPay' : p.provider === 'paystack' ? 'Paystack' : 'Autre'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-medium capitalize">{p.planId}</TableCell>
                      <TableCell className="text-xs font-bold text-right text-[#0d233a]">
                        {p.amountUsd.toFixed(2)} $ USD
                      </TableCell>
                    </TableRow>
                  ))}
                {telemetry.confirmedPayments.filter((p) => walletFilter === 'all' || p.provider === walletFilter).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-xs text-muted-foreground">
                      Aucun encaissement confirmé pour ce filtre.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
