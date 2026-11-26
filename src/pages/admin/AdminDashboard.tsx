import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getAudioClaritySetting, setAudioClaritySetting } from '@/lib/audioProcessing';
import { PLANS_CONFIG } from '@/types/index';
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
  Smartphone, Monitor, Tablet, ArrowUpRight, Wallet, Sliders, Search
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, Legend
} from 'recharts';
import { toast } from 'sonner';
import {
  AdminSubscriptionQuotaModal,
  type AdminManagedUser,
} from '@/components/admin/AdminSubscriptionQuotaModal';
import {
  AdminGrowthInsightsSection,
  type AbandonedPaymentLead,
  type CountryBreakdownItem,
  type ExpiringOrLowQuotaSubscriber,
  type GrowthInsightsData,
  type HotLeadItem,
  type TimeSlotItem,
  type TopPageItem,
  type TrafficSourceItem,
} from '@/components/admin/AdminGrowthInsightsSection';

interface SiteVisitRow {
  id: string;
  session_id: string;
  page_path: string | null;
  referrer: string | null;
  device_type: string | null;
  user_id: string | null;
  created_at: string;
}

interface StudentProfileRow {
  id: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  pays: string | null;
  telephone: string | null;
  created_at: string;
  last_active_at: string | null;
}

interface AbonnementRawRow {
  id: string;
  user_id: string | null;
  etudiant_id: string | null;
  plan_id: string | null;
  statut: string | null;
  status: string | null;
  provider: string | null;
  methode: string | null;
  quota_ee_restant: number | null;
  quota_eo_restant: number | null;
  quota_examen_blanc_restant: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  date_debut: string | null;
  date_fin: string | null;
  created_at: string;
}

interface PaiementRawRow {
  id: string;
  user_id: string | null;
  etudiant_id: string | null;
  amount: number | null;
  montant: number | null;
  currency: string | null;
  devise: string | null;
  status: string | null;
  statut: string | null;
  provider: string | null;
  methode: string | null;
  plan_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

function toLocalDateKey(dateInput: string | Date): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchAllSiteVisits(): Promise<SiteVisitRow[]> {
  const allRows: SiteVisitRow[] = [];
  const BATCH_SIZE = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('site_visits')
      .select('id, session_id, page_path, referrer, device_type, user_id, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;
    const rows = Array.isArray(data) ? (data as SiteVisitRow[]) : [];
    allRows.push(...rows);
    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return allRows;
}

async function fetchAllStudentProfiles(): Promise<StudentProfileRow[]> {
  const allRows: StudentProfileRow[] = [];
  const BATCH_SIZE = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, prenom, nom, email, pays, telephone, created_at, last_active_at')
      .eq('role', 'etudiant')
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;
    const rows = Array.isArray(data) ? (data as StudentProfileRow[]) : [];
    allRows.push(...rows);
    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return allRows;
}

async function fetchAllAbonnements(): Promise<AbonnementRawRow[]> {
  const allRows: AbonnementRawRow[] = [];
  const BATCH_SIZE = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('abonnements')
      .select(
        'id, user_id, etudiant_id, plan_id, statut, status, provider, methode, quota_ee_restant, quota_eo_restant, quota_examen_blanc_restant, current_period_start, current_period_end, date_debut, date_fin, created_at'
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) throw error;
    const rows = Array.isArray(data) ? (data as AbonnementRawRow[]) : [];
    allRows.push(...rows);
    if (rows.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }

  return allRows;
}

function isAbonnementCurrentlyActive(a: AbonnementRawRow, nowMs: number): boolean {
  const st = String(a.status || a.statut || '').toLowerCase();
  const statut = String(a.statut || '').toLowerCase();
  const hasActive = st === 'active' || st === 'actif' || statut === 'actif';
  if (!hasActive) return false;
  const endStr = a.current_period_end || a.date_fin;
  if (!endStr) return true;
  const endMs = new Date(endStr).getTime();
  return Number.isNaN(endMs) || endMs > nowMs;
}

function normalizeTrafficSource(
  rawReferrer: string | null | undefined
): { key: string; label: string; category: TrafficSourceItem['category'] } {
  const raw = String(rawReferrer || 'direct').trim().toLowerCase();
  if (!raw || raw === 'direct') {
    return { key: 'direct', label: 'Accès direct', category: 'direct' };
  }
  if (raw.startsWith('utm:')) {
    const rest = raw.slice(4);
    const [srcPart, campPart] = rest.split('|');
    const srcLabel = srcPart ? srcPart.charAt(0).toUpperCase() + srcPart.slice(1) : 'Campagne';
    const label = campPart ? `Campagne ${srcLabel} (${campPart})` : `Campagne ${srcLabel}`;
    return { key: raw, label, category: 'utm' };
  }
  if (raw.includes('facebook') || raw.includes('fb.com')) {
    return { key: 'facebook', label: 'Facebook', category: 'social' };
  }
  if (raw.includes('instagram')) {
    return { key: 'instagram', label: 'Instagram', category: 'social' };
  }
  if (raw.includes('tiktok')) {
    return { key: 'tiktok', label: 'TikTok', category: 'social' };
  }
  if (raw.includes('youtube') || raw.includes('youtu.be')) {
    return { key: 'youtube', label: 'YouTube', category: 'social' };
  }
  if (raw.includes('whatsapp') || raw.includes('wa.me')) {
    return { key: 'whatsapp', label: 'WhatsApp', category: 'social' };
  }
  if (raw.includes('linkedin')) {
    return { key: 'linkedin', label: 'LinkedIn', category: 'social' };
  }
  if (raw.includes('google.')) {
    return { key: 'google', label: 'Google', category: 'search' };
  }
  if (raw.includes('bing.') || raw.includes('yahoo.') || raw.includes('duckduckgo.')) {
    return { key: 'search_other', label: raw, category: 'search' };
  }
  return { key: raw, label: raw, category: 'other' };
}

function formatFriendlyPageLabel(rawPath: string | null | undefined): { path: string; label: string } {
  const path = String(rawPath || '/').split('?')[0] || '/';
  if (path === '/') return { path, label: "Page d'accueil" };
  if (path === '/inscription') return { path, label: 'Inscription' };
  if (path === '/connexion') return { path, label: 'Connexion' };
  if (path === '/promo-video') return { path, label: 'Vidéo Promo' };
  if (path === '/etudiant') return { path, label: 'Tableau de bord étudiant' };
  if (path.startsWith('/etudiant/abonnement')) return { path: '/etudiant/abonnement', label: 'Tarifs & Abonnement' };
  if (path.startsWith('/etudiant/entrainement')) return { path: '/etudiant/entrainement', label: 'Entraînement Ciblé' };
  if (path.startsWith('/etudiant/examen-blanc')) return { path: '/etudiant/examen-blanc', label: 'Examen Blanc' };
  if (path.startsWith('/etudiant/cours')) return { path: '/etudiant/cours', label: 'Fiches de Cours' };
  if (path.startsWith('/etudiant/bilan-hebdomadaire')) return { path: '/etudiant/bilan-hebdomadaire', label: 'Bilan Professeur' };
  if (path.startsWith('/etudiant/historique')) return { path: '/etudiant/historique', label: 'Historique & Scores' };
  return { path, label: path };
}

interface DashboardTelemetry {
  // Visites (hors administrateurs)
  totalVisits: number;
  visits24h: number;
  visits48h: number;
  visits7d: number;
  totalVisitors: number;
  visitors24h: number;
  visitors48h: number;
  visitors7d: number;
  newVisitors24h: number;
  newVisitors48h: number;
  newVisitors7d: number;
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
    user_id: string | null;
    etudiant_prenom: string | null;
    etudiant_nom_famille: string | null;
    etudiant_nom: string;
    etudiant_email: string;
    plan_nom: string;
    prix_fcfa: number;
    statut: string;
    date_debut: string;
    date_fin: string | null;
    quota_ee_restant: number | null;
    quota_eo_restant: number | null;
    quota_examen_blanc_restant: number | null;
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
    totalVisitors: 0,
    visitors24h: 0,
    visitors48h: 0,
    visitors7d: 0,
    newVisitors24h: 0,
    newVisitors48h: 0,
    newVisitors7d: 0,
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
  const [trafficChartData, setTrafficChartData] = useState<{ date: string; visiteursTotaux: number; nouveauxVisiteurs: number; inscrits: number; abonnements: number }[]>([]);
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
  const [managedSubUser, setManagedSubUser] = useState<AdminManagedUser | null>(null);
  const [rawDatasets, setRawDatasets] = useState<{
    cleanVisits: SiteVisitRow[];
    students: StudentProfileRow[];
    abonnements: AbonnementRawRow[];
    payments: PaiementRawRow[];
    fichesLues: number;
    totalFiches: number;
    totalSessions: number;
    examensBlancsTermines: number;
    productionsTotal: number;
    correctionsEnAttente: number;
  }>({
    cleanVisits: [],
    students: [],
    abonnements: [],
    payments: [],
    fichesLues: 0,
    totalFiches: 0,
    totalSessions: 0,
    examensBlancsTermines: 0,
    productionsTotal: 0,
    correctionsEnAttente: 0,
  });

  const fetchDashboardData = useCallback(async () => {
    try {
      const now = new Date();
      const nowMs = now.getTime();
      const date24hAgoMs = nowMs - 24 * 60 * 60 * 1000;
      const date48hAgoMs = nowMs - 48 * 60 * 60 * 1000;
      const date7dAgoMs = nowMs - 7 * 24 * 60 * 60 * 1000;
      const date24hAgo = new Date(date24hAgoMs).toISOString();
      const date48hAgo = new Date(date48hAgoMs).toISOString();
      const date7dAgo = new Date(date7dAgoMs).toISOString();

      // Requêtes parallèles pour vitesse maximale
      const [
        allStudents,
        newProfiles24hRes,
        newProfiles48hRes,
        activeProfiles48hRes,
        fichesRes,
        readsRes,
        sessionsRes,
        questionsRes,
        correctionsRes,
        productionsRes,
        claritySetting,
        recentAbonnementsRes,
        allAbonnementsList,
        newAbonnements24hRes,
        newAbonnements48hRes,
        newAbonnements7dRes,
        paiementsRes,
        allSiteVisits,
        adminProfilesRes,
        paymentMethodsRes,
      ] = await Promise.all([
        fetchAllStudentProfiles(),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'etudiant').gte('created_at', date24hAgo),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'etudiant').gte('created_at', date48hAgo),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'etudiant').gte('last_active_at', date48hAgo),
        supabase.from('course_sheets').select('id', { count: 'exact' }),
        supabase.from('course_sheet_reads').select('id', { count: 'exact', head: true }),
        supabase.from('sessions_examen').select('id, created_at, mode, statut', { count: 'exact' }),
        supabase.from('questions').select('id', { count: 'exact' }),
        supabase.from('productions').select('id', { count: 'exact' }).eq('statut_correction', 'en_attente'),
        supabase.from('productions').select('id', { count: 'exact' }),
        getAudioClaritySetting(),
        // Dernières souscriptions avec profil joint
        supabase.from('abonnements').select(`
          id, plan_id, statut, status, created_at, date_debut, date_fin, current_period_start, current_period_end,
          quota_ee_restant, quota_eo_restant, quota_examen_blanc_restant,
          user_id, etudiant_id,
          profiles:user_id (nom, prenom, email)
        `, { count: 'exact' }).order('created_at', { ascending: false }).limit(50),
        fetchAllAbonnements(),
        supabase.from('abonnements').select('id', { count: 'exact' }).gte('created_at', date24hAgo),
        supabase.from('abonnements').select('id', { count: 'exact' }).gte('created_at', date48hAgo),
        supabase.from('abonnements').select('id', { count: 'exact' }).gte('created_at', date7dAgo),
        // Paiements
        supabase.from('paiements').select('id, user_id, etudiant_id, amount, montant, currency, devise, status, statut, provider, methode, plan_id, metadata, created_at').order('created_at', { ascending: false }),
        // Visites complètes (hors administrateurs filtrées ci-dessous)
        fetchAllSiteVisits(),
        supabase.from('profiles').select('id').in('role', ['admin', 'super_admin']),
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

      // Calcul des visites & appareils (exclusion stricte et rétroactive des visites administrateurs)
      const adminUserIds = new Set<string>(
        ((adminProfilesRes.data || []) as { id: string }[]).map(p => p.id)
      );
      const adminSessionIds = new Set<string>();
      for (const v of allSiteVisits) {
        const isAdminUser = Boolean(v.user_id && adminUserIds.has(v.user_id));
        const isAdminRoute = String(v.page_path || '').startsWith('/admin');
        if ((isAdminUser || isAdminRoute) && v.session_id) {
          adminSessionIds.add(v.session_id);
        }
      }

      const cleanVisits = allSiteVisits.filter(v => {
        if (v.user_id && adminUserIds.has(v.user_id)) return false;
        if (String(v.page_path || '').startsWith('/admin')) return false;
        if (v.session_id && adminSessionIds.has(v.session_id)) return false;
        return true;
      });

      const sessionToUser = new Map<string, string>();
      for (const v of cleanVisits) {
        if (v.user_id && v.session_id && !sessionToUser.has(v.session_id)) {
          sessionToUser.set(v.session_id, v.user_id);
        }
      }

      const getVisitorKey = (v: SiteVisitRow): string => {
        if (v.user_id) return `u:${v.user_id}`;
        if (v.session_id && sessionToUser.has(v.session_id)) {
          return `u:${sessionToUser.get(v.session_id)}`;
        }
        return `s:${v.session_id || v.id}`;
      };

      const firstSeenByVisitor = new Map<string, number>();
      const visitors24hSet = new Set<string>();
      const visitors48hSet = new Set<string>();
      const visitors7dSet = new Set<string>();

      let visits24hCount = 0;
      let visits48hCount = 0;
      let visits7dCount = 0;
      let desktopCount = 0;
      let mobileCount = 0;
      let tabletCount = 0;

      for (const v of cleanVisits) {
        const createdMs = new Date(v.created_at).getTime();
        const visitorKey = getVisitorKey(v);

        if (!Number.isNaN(createdMs)) {
          const prevFirst = firstSeenByVisitor.get(visitorKey);
          if (prevFirst === undefined || createdMs < prevFirst) {
            firstSeenByVisitor.set(visitorKey, createdMs);
          }
          if (createdMs >= date24hAgoMs) {
            visits24hCount++;
            visitors24hSet.add(visitorKey);
          }
          if (createdMs >= date48hAgoMs) {
            visits48hCount++;
            visitors48hSet.add(visitorKey);
          }
          if (createdMs >= date7dAgoMs) {
            visits7dCount++;
            visitors7dSet.add(visitorKey);
          }
        }

        if (v.device_type === 'mobile') mobileCount++;
        else if (v.device_type === 'tablet') tabletCount++;
        else desktopCount++;
      }

      let newVisitors24hCount = 0;
      let newVisitors48hCount = 0;
      let newVisitors7dCount = 0;
      for (const firstMs of firstSeenByVisitor.values()) {
        if (firstMs >= date24hAgoMs) newVisitors24hCount++;
        if (firstMs >= date48hAgoMs) newVisitors48hCount++;
        if (firstMs >= date7dAgoMs) newVisitors7dCount++;
      }

      const totalVisitorsCount = firstSeenByVisitor.size;
      const totalVisitsCount = cleanVisits.length;
      const totalDevices = (desktopCount + mobileCount + tabletCount) || 1;

      // Calcul des abonnements & revenus
      const recentAbonnementsRaw = recentAbonnementsRes.data || [];
      const activeUserIdsSet = new Set<string>();
      for (const a of allAbonnementsList) {
        if (isAbonnementCurrentlyActive(a, nowMs)) {
          const uid = a.user_id || a.etudiant_id;
          if (uid) activeUserIdsSet.add(uid);
        }
      }
      const totalAbonnementsCount = recentAbonnementsRes.count ?? allAbonnementsList.length;
      const activeAbonnesCount = activeUserIdsSet.size;

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

      allAbonnementsList.forEach(a => {
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
      const recentAbonnementsFormatted = recentAbonnementsRaw.slice(0, 8).map(a => {
        const rawProfiles = a.profiles as { nom?: string | null; prenom?: string | null; email?: string | null } | { nom?: string | null; prenom?: string | null; email?: string | null }[] | null;
        const prof = Array.isArray(rawProfiles) ? (rawProfiles[0] || {}) : (rawProfiles || {});
        const pId = a.plan_id || 'standard';
        const uid = (a.user_id || a.etudiant_id || null) as string | null;
        return {
          id: a.id,
          user_id: uid,
          etudiant_prenom: prof.prenom || null,
          etudiant_nom_famille: prof.nom || null,
          etudiant_nom: [prof.prenom, prof.nom].filter(Boolean).join(' ') || 'Candidat Mon TCFCA',
          etudiant_email: prof.email || '—',
          plan_nom: planNames[pId] || 'Standard',
          prix_fcfa: planPrices[pId] ?? 29.99,
          statut: a.statut || a.status || 'actif',
          date_debut: a.date_debut || a.current_period_start || a.created_at,
          date_fin: a.date_fin || a.current_period_end || null,
          quota_ee_restant: (a as { quota_ee_restant?: number | null }).quota_ee_restant ?? null,
          quota_eo_restant: (a as { quota_eo_restant?: number | null }).quota_eo_restant ?? null,
          quota_examen_blanc_restant: (a as { quota_examen_blanc_restant?: number | null }).quota_examen_blanc_restant ?? null,
        };
      });

      // Construction du graphique d'activité journalière (7 derniers jours, hors visites admin)
      const last7DaysMap: Record<
        string,
        { label: string; visitorKeys: Set<string>; nouveauxVisiteurs: number; inscrits: number; abonnements: number }
      > = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayKey = toLocalDateKey(d);
        const label = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
        last7DaysMap[dayKey] = {
          label,
          visitorKeys: new Set<string>(),
          nouveauxVisiteurs: 0,
          inscrits: 0,
          abonnements: 0,
        };
      }

      // Remplir les visiteurs uniques quotidiens (hors admin)
      cleanVisits.forEach(v => {
        const dayKey = toLocalDateKey(v.created_at);
        if (last7DaysMap[dayKey]) {
          last7DaysMap[dayKey].visitorKeys.add(getVisitorKey(v));
        }
      });

      // Remplir les nouveaux visiteurs quotidiens (première visite enregistrée)
      for (const firstMs of firstSeenByVisitor.values()) {
        const dayKey = toLocalDateKey(new Date(firstMs));
        if (last7DaysMap[dayKey]) {
          last7DaysMap[dayKey].nouveauxVisiteurs++;
        }
      }

      // Remplir avec les inscrits
      allStudents.forEach(p => {
        const dayKey = toLocalDateKey(p.created_at);
        if (last7DaysMap[dayKey]) {
          last7DaysMap[dayKey].inscrits++;
        }
      });

      // Remplir avec les abonnements
      allAbonnementsList.forEach(a => {
        const dayKey = toLocalDateKey(a.created_at);
        if (last7DaysMap[dayKey]) {
          last7DaysMap[dayKey].abonnements++;
        }
      });

      const trafficChart = Object.values(last7DaysMap).map((data) => ({
        date: data.label,
        visiteursTotaux: data.visitorKeys.size,
        nouveauxVisiteurs: data.nouveauxVisiteurs,
        inscrits: data.inscrits,
        abonnements: data.abonnements,
      }));

      setTrafficChartData(trafficChart);

      // Examens blancs terminés
      const sessionsData = sessionsRes.data || [];
      const examensTermines = sessionsData.filter(s => s.mode === 'examen_blanc' && s.statut === 'termine').length;

      setRawDatasets({
        cleanVisits,
        students: allStudents,
        abonnements: allAbonnementsList,
        payments: paymentsList as PaiementRawRow[],
        fichesLues: readsRes.count ?? 0,
        totalFiches: fichesRes.count ?? 0,
        totalSessions: sessionsRes.count ?? 0,
        examensBlancsTermines: examensTermines,
        productionsTotal: productionsRes.count ?? 0,
        correctionsEnAttente: correctionsRes.count ?? 0,
      });

      setTelemetry({
        totalVisits: totalVisitsCount,
        visits24h: visits24hCount,
        visits48h: visits48hCount,
        visits7d: visits7dCount,
        totalVisitors: totalVisitorsCount,
        visitors24h: visitors24hSet.size,
        visitors48h: visitors48hSet.size,
        visitors7d: visitors7dSet.size,
        newVisitors24h: newVisitors24hCount,
        newVisitors48h: newVisitors48hCount,
        newVisitors7d: newVisitors7dCount,
        uniqueVisitors: totalVisitorsCount,
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
        totalEtudiants: allStudents.length,
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

  const growthInsights = useMemo<GrowthInsightsData>(() => {
    const nowMs = Date.now();
    const cutoffMs =
      timeframeFilter === '24h'
        ? nowMs - 24 * 60 * 60 * 1000
        : timeframeFilter === '48h'
        ? nowMs - 48 * 60 * 60 * 1000
        : timeframeFilter === '7d'
        ? nowMs - 7 * 24 * 60 * 60 * 1000
        : 0;

    const timeframeLabel =
      timeframeFilter === '24h'
        ? '24 dernières heures'
        : timeframeFilter === '48h'
        ? '48 dernières heures'
        : timeframeFilter === '7d'
        ? '7 derniers jours'
        : 'Depuis le lancement';

    const { cleanVisits, students, abonnements, payments } = rawDatasets;

    // 1. Canonical visitor keys & first-seen map across all cleanVisits
    const sessionToUser = new Map<string, string>();
    for (const v of cleanVisits) {
      if (v.user_id && v.session_id && !sessionToUser.has(v.session_id)) {
        sessionToUser.set(v.session_id, v.user_id);
      }
    }
    const getVisitorKey = (v: SiteVisitRow): string => {
      if (v.user_id) return `u:${v.user_id}`;
      if (v.session_id && sessionToUser.has(v.session_id)) {
        return `u:${sessionToUser.get(v.session_id)}`;
      }
      return `s:${v.session_id || v.id}`;
    };

    const firstSeenByVisitor = new Map<string, number>();
    const pricingViewedUsers = new Set<string>();
    for (const v of cleanVisits) {
      const ms = new Date(v.created_at).getTime();
      const key = getVisitorKey(v);
      if (!Number.isNaN(ms)) {
        const prev = firstSeenByVisitor.get(key);
        if (prev === undefined || ms < prev) firstSeenByVisitor.set(key, ms);
      }
      if (String(v.page_path || '').startsWith('/etudiant/abonnement')) {
        const uid = v.user_id || (v.session_id ? sessionToUser.get(v.session_id) : undefined);
        if (uid) pricingViewedUsers.add(uid);
      }
    }

    const periodVisits =
      cutoffMs > 0
        ? cleanVisits.filter(v => {
            const ms = new Date(v.created_at).getTime();
            return !Number.isNaN(ms) && ms >= cutoffMs;
          })
        : cleanVisits;

    const periodVisitorsSet = new Set<string>();
    const periodPricingVisitorsSet = new Set<string>();
    const deviceVisitorSets = {
      desktop: new Set<string>(),
      mobile: new Set<string>(),
      tablet: new Set<string>(),
    };

    const sourceAgg = new Map<
      string,
      { key: string; label: string; category: TrafficSourceItem['category']; visits: number; visitors: Set<string> }
    >();
    const pageAgg = new Map<string, { path: string; label: string; views: number; visitors: Set<string> }>();
    const slotCounts = [0, 0, 0, 0]; // Matin, Après-midi, Soirée, Nuit

    for (const v of periodVisits) {
      const vKey = getVisitorKey(v);
      periodVisitorsSet.add(vKey);

      const dev = v.device_type === 'mobile' ? 'mobile' : v.device_type === 'tablet' ? 'tablet' : 'desktop';
      deviceVisitorSets[dev].add(vKey);

      const pInfo = formatFriendlyPageLabel(v.page_path);
      if (pInfo.path === '/etudiant/abonnement') {
        periodPricingVisitorsSet.add(vKey);
      }

      const existingPage = pageAgg.get(pInfo.path);
      if (existingPage) {
        existingPage.views++;
        existingPage.visitors.add(vKey);
      } else {
        pageAgg.set(pInfo.path, { path: pInfo.path, label: pInfo.label, views: 1, visitors: new Set([vKey]) });
      }

      const srcInfo = normalizeTrafficSource(v.referrer);
      const existingSrc = sourceAgg.get(srcInfo.key);
      if (existingSrc) {
        existingSrc.visits++;
        existingSrc.visitors.add(vKey);
      } else {
        sourceAgg.set(srcInfo.key, {
          ...srcInfo,
          visits: 1,
          visitors: new Set([vKey]),
        });
      }

      const d = new Date(v.created_at);
      if (!Number.isNaN(d.getTime())) {
        const h = d.getHours();
        if (h >= 6 && h < 12) slotCounts[0]++;
        else if (h >= 12 && h < 18) slotCounts[1]++;
        else if (h >= 18 && h < 24) slotCounts[2]++;
        else slotCounts[3]++;
      }
    }

    let newVisitorsCount = 0;
    for (const vk of periodVisitorsSet) {
      const firstMs = firstSeenByVisitor.get(vk);
      if (firstMs !== undefined && (cutoffMs === 0 || firstMs >= cutoffMs)) {
        newVisitorsCount++;
      }
    }
    const totalPeriodVisitors = periodVisitorsSet.size;
    const returningVisitors = Math.max(0, totalPeriodVisitors - newVisitorsCount);
    const retentionRatePct = totalPeriodVisitors > 0 ? (returningVisitors / totalPeriodVisitors) * 100 : 0;
    const pagesPerVisitor = totalPeriodVisitors > 0 ? periodVisits.length / totalPeriodVisitors : 0;

    // 2. Period signups & payments
    const periodStudents =
      cutoffMs > 0
        ? students.filter(s => {
            const ms = new Date(s.created_at).getTime();
            return !Number.isNaN(ms) && ms >= cutoffMs;
          })
        : students;

    const periodPayments =
      cutoffMs > 0
        ? payments.filter(p => {
            const ms = new Date(p.created_at).getTime();
            return !Number.isNaN(ms) && ms >= cutoffMs;
          })
        : payments;

    const isConfirmedStatus = (stRaw: string) =>
      stRaw === 'confirme' || stRaw === 'success' || stRaw === 'paye' || stRaw === 'succeeded';

    const confirmedPeriodPayments = periodPayments.filter(p =>
      isConfirmedStatus(String(p.status || p.statut || '').toLowerCase())
    );
    const confirmedUsdSum = confirmedPeriodPayments.reduce((acc, p) => {
      const rawAmount = Number(p.amount || p.montant || 0);
      const curr = String(p.currency || p.devise || '').toUpperCase();
      const usd = curr === 'XOF' || curr === 'FCFA' || rawAmount > 500 ? rawAmount / 605 : rawAmount;
      return acc + usd;
    }, 0);

    // 3. Active subscribers & student index
    const studentById = new Map<string, StudentProfileRow>(students.map(s => [s.id, s]));
    const activeSubsByUser = new Map<string, AbonnementRawRow>();
    for (const a of abonnements) {
      if (isAbonnementCurrentlyActive(a, nowMs)) {
        const uid = a.user_id || a.etudiant_id;
        if (uid && !activeSubsByUser.has(uid)) {
          activeSubsByUser.set(uid, a);
        }
      }
    }
    const activeSubscribersCount = activeSubsByUser.size;

    const periodAbandonedCount = periodPayments.filter(
      p => !isConfirmedStatus(String(p.status || p.statut || '').toLowerCase())
    ).length;

    const visitorToSignupPct = totalPeriodVisitors > 0 ? (periodStudents.length / totalPeriodVisitors) * 100 : 0;
    const signupToSubPct = students.length > 0 ? (activeSubscribersCount / students.length) * 100 : 0;
    const visitorToSubPct = totalPeriodVisitors > 0 ? (confirmedPeriodPayments.length / totalPeriodVisitors) * 100 : 0;
    const paymentSuccessPct =
      periodPayments.length > 0 ? (confirmedPeriodPayments.length / periodPayments.length) * 100 : 0;
    const avgOrderValueUsd =
      confirmedPeriodPayments.length > 0 ? confirmedUsdSum / confirmedPeriodPayments.length : 0;

    // 4. Sources, Top pages, Time slots
    const totalSrcVisits = periodVisits.length || 1;
    const sources: TrafficSourceItem[] = Array.from(sourceAgg.values())
      .map(s => ({
        key: s.key,
        label: s.label,
        category: s.category,
        visits: s.visits,
        visitors: s.visitors.size,
        sharePct: Math.round((s.visits / totalSrcVisits) * 100),
      }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10);

    const topPages: TopPageItem[] = Array.from(pageAgg.values())
      .map(p => ({
        path: p.path,
        label: p.label,
        views: p.views,
        visitors: p.visitors.size,
        sharePct: Math.round((p.views / totalSrcVisits) * 100),
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const slotMeta = [
      { label: 'Matin', range: '06h – 12h' },
      { label: 'Après-midi', range: '12h – 18h' },
      { label: 'Soirée', range: '18h – 00h' },
      { label: 'Nuit', range: '00h – 06h' },
    ];
    const timeSlots: TimeSlotItem[] = slotMeta.map((m, idx) => ({
      label: m.label,
      range: m.range,
      visits: slotCounts[idx],
      sharePct: periodVisits.length > 0 ? Math.round((slotCounts[idx] / periodVisits.length) * 100) : 0,
    }));

    // 5. Countries breakdown (all students)
    const countryMap = new Map<string, { inscrits: number; abonnes: number }>();
    for (const s of students) {
      const pays = (s.pays || '').trim() || 'Non renseigné';
      const entry = countryMap.get(pays) || { inscrits: 0, abonnes: 0 };
      entry.inscrits++;
      if (activeSubsByUser.has(s.id)) entry.abonnes++;
      countryMap.set(pays, entry);
    }
    const totalStudentsForShare = students.length || 1;
    const countries: CountryBreakdownItem[] = Array.from(countryMap.entries())
      .map(([pays, c]) => ({
        pays,
        inscrits: c.inscrits,
        abonnes: c.abonnes,
        conversionPct: c.inscrits > 0 ? (c.abonnes / c.inscrits) * 100 : 0,
        sharePct: Math.round((c.inscrits / totalStudentsForShare) * 100),
      }))
      .sort((a, b) => b.inscrits - a.inscrits);

    // 6. Actionable lists
    // 6a. Abandoned payments (pending/failed without active subscription)
    const abandonedByUser = new Map<string, AbandonedPaymentLead>();
    for (const p of payments) {
      const st = String(p.status || p.statut || '').toLowerCase();
      if (isConfirmedStatus(st)) continue;
      const uid = p.user_id || p.etudiant_id;
      if (!uid || activeSubsByUser.has(uid) || abandonedByUser.has(uid)) continue;
      const stProfile = studentById.get(uid);
      if (!stProfile) continue;
      const rawAmt = Number(p.amount || p.montant || 0);
      const curr = String(p.currency || p.devise || 'USD').toUpperCase();
      const metaPlan =
        p.metadata && typeof p.metadata === 'object' && 'planId' in p.metadata
          ? String((p.metadata as { planId?: unknown }).planId || '')
          : '';
      abandonedByUser.set(uid, {
        userId: uid,
        prenom: stProfile.prenom,
        nom: stProfile.nom,
        email: stProfile.email,
        telephone: stProfile.telephone,
        pays: stProfile.pays,
        provider: String(p.provider || p.methode || '—'),
        planId: p.plan_id || metaPlan || 'standard',
        amountLabel: rawAmt > 0 ? `${rawAmt} ${curr}` : '—',
        createdAt: p.created_at,
      });
    }

    // 6b. Expiring (<= 5d) or low quota (EE <= 1 or EO <= 1) active subscribers
    const expiringOrLowQuota: ExpiringOrLowQuotaSubscriber[] = [];
    for (const [uid, sub] of activeSubsByUser.entries()) {
      const stProfile = studentById.get(uid);
      if (!stProfile) continue;
      const endAt = sub.current_period_end || sub.date_fin || null;
      const daysRemaining = endAt
        ? Math.ceil((new Date(endAt).getTime() - nowMs) / (1000 * 60 * 60 * 24))
        : null;
      const quotaEe = Number(sub.quota_ee_restant ?? 0);
      const quotaEo = Number(sub.quota_eo_restant ?? 0);
      const quotaEb = Number(sub.quota_examen_blanc_restant ?? 0);

      const isExpiring = daysRemaining !== null && daysRemaining <= 5;
      const isLowQuota = quotaEe <= 1 || quotaEo <= 1;
      if (!isExpiring && !isLowQuota) continue;

      const rawPlan = String(sub.plan_id || 'standard');
      const normalizedPlan = rawPlan === 'pack_express' ? 'express' : rawPlan;
      const planNom = PLANS_CONFIG[normalizedPlan]?.nom || rawPlan;

      expiringOrLowQuota.push({
        userId: uid,
        prenom: stProfile.prenom,
        nom: stProfile.nom,
        email: stProfile.email,
        telephone: stProfile.telephone,
        pays: stProfile.pays,
        planNom,
        daysRemaining,
        endAt,
        quotaEe,
        quotaEo,
        quotaEb,
        reason: isExpiring && isLowQuota ? 'both' : isExpiring ? 'expiring' : 'low_quota',
      });
    }
    expiringOrLowQuota.sort((a, b) => (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999));

    // 6c. Hot leads (last 14 days signups without active subscription)
    const fourteenDaysAgoMs = nowMs - 14 * 24 * 60 * 60 * 1000;
    const hotLeads: HotLeadItem[] = students
      .filter(s => {
        if (activeSubsByUser.has(s.id)) return false;
        const ms = new Date(s.created_at).getTime();
        return !Number.isNaN(ms) && ms >= fourteenDaysAgoMs;
      })
      .map(s => ({
        userId: s.id,
        prenom: s.prenom,
        nom: s.nom,
        email: s.email,
        telephone: s.telephone,
        pays: s.pays,
        createdAt: s.created_at,
        viewedPricing: pricingViewedUsers.has(s.id),
      }))
      .sort((a, b) => {
        if (a.viewedPricing !== b.viewedPricing) return a.viewedPricing ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    const pedagogy: PedagogyHealthMetrics = {
      fichesLues: rawDatasets.fichesLues,
      totalFiches: rawDatasets.totalFiches,
      totalSessions: rawDatasets.totalSessions,
      examensBlancsTermines: rawDatasets.examensBlancsTermines,
      productionsTotal: rawDatasets.productionsTotal,
      correctionsEnAttente: rawDatasets.correctionsEnAttente,
      avgSessionsPerActiveSub:
        activeSubscribersCount > 0 ? rawDatasets.totalSessions / activeSubscribersCount : 0,
    };

    return {
      timeframeLabel,
      funnel: {
        visitors: totalPeriodVisitors,
        newVisitors: newVisitorsCount,
        returningVisitors,
        retentionRatePct,
        pagesPerVisitor,
        signups: periodStudents.length,
        pricingViewers: periodPricingVisitorsSet.size,
        paymentAttempts: periodPayments.length,
        confirmedPayments: confirmedPeriodPayments.length,
        abandonedPaymentsCount: periodAbandonedCount,
        activeSubscribers: activeSubscribersCount,
        visitorToSignupPct,
        signupToSubPct,
        visitorToSubPct,
        paymentSuccessPct,
        avgOrderValueUsd,
      },
      sources,
      topPages,
      timeSlots,
      countries,
      abandonedPayments: Array.from(abandonedByUser.values()),
      expiringOrLowQuota,
      hotLeads,
      pedagogy,
      deviceVisitors: {
        desktop: deviceVisitorSets.desktop.size,
        mobile: deviceVisitorSets.mobile.size,
        tablet: deviceVisitorSets.tablet.size,
      },
    };
  }, [rawDatasets, timeframeFilter]);

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
        {/* KPI 1 : Visites du Site (hors admin, Nouveaux vs Totaux) */}
        <Card className="rounded-2xl border border-[#e2e8f0] bg-white shadow-xs hover:border-[#0d233a]/30 transition-all">
          <CardContent className="p-5 flex flex-col justify-between h-full gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-[#475569] uppercase tracking-wider">Visites du Site</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#d3e4fe] bg-[#eff4ff] text-[#0d233a] font-semibold">
                  Hors admin
                </Badge>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#eff4ff] text-[#0d233a] flex items-center justify-center shrink-0">
                <Eye className="w-4 h-4 text-[#0d233a]" />
              </div>
            </div>
            <div className="space-y-2">
              {loading ? (
                <Skeleton className="h-16 w-full bg-[#eff4ff] rounded-xl" />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/70 px-2.5 py-2">
                    <span className="text-[10px] font-semibold text-emerald-800 block leading-tight">
                      Nouveaux visiteurs
                    </span>
                    <p className="text-xl sm:text-2xl font-heading font-extrabold text-emerald-700 leading-tight mt-0.5">
                      {timeframeFilter === '24h'
                        ? telemetry.newVisitors24h
                        : timeframeFilter === '48h'
                        ? telemetry.newVisitors48h
                        : telemetry.newVisitors7d}
                    </p>
                    <span className="text-[10px] text-emerald-700/80 block mt-0.5">
                      {timeframeFilter === '24h'
                        ? 'Sur 24h'
                        : timeframeFilter === '48h'
                        ? 'Sur 48h'
                        : timeframeFilter === '7d'
                        ? 'Sur 7 jours'
                        : `+${telemetry.newVisitors24h} (24h)`}
                    </span>
                  </div>
                  <div className="rounded-xl bg-[#eff4ff]/80 border border-[#d3e4fe] px-2.5 py-2">
                    <span className="text-[10px] font-semibold text-[#0d233a] block leading-tight">
                      Visiteurs totaux
                    </span>
                    <p className="text-xl sm:text-2xl font-heading font-extrabold text-[#0d233a] leading-tight mt-0.5">
                      {telemetry.totalVisitors}
                    </p>
                    <span className="text-[10px] text-[#475569] block mt-0.5">
                      {timeframeFilter === '24h'
                        ? `${telemetry.visitors24h} actifs (24h)`
                        : timeframeFilter === '48h'
                        ? `${telemetry.visitors48h} actifs (48h)`
                        : timeframeFilter === '7d'
                        ? `${telemetry.visitors7d} actifs (7j)`
                        : 'Depuis le début'}
                    </span>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-[#64748b]">
                Pages vues :{' '}
                <strong className="text-[#0d233a]">
                  {timeframeFilter === '24h'
                    ? telemetry.visits24h
                    : timeframeFilter === '48h'
                    ? telemetry.visits48h
                    : timeframeFilter === '7d'
                    ? telemetry.visits7d
                    : telemetry.totalVisits}
                </strong>{' '}
                ({timeframeFilter === '24h' ? '24h' : timeframeFilter === '48h' ? '48h' : timeframeFilter === '7d' ? '7j' : 'total'}) ·{' '}
                <strong className="text-[#0d233a]">{telemetry.totalVisits}</strong> au total
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
                  Suivi quotidien (hors visites admin) des visiteurs totaux, nouveaux visiteurs, créations de comptes et abonnements.
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
                        <stop offset="5%" stopColor="#0d233a" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#0d233a" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorNouveauxVisiteurs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
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
                    <Area type="monotone" dataKey="visiteursTotaux" name="Visiteurs totaux" stroke="#0d233a" strokeWidth={2} fillOpacity={1} fill="url(#colorVisites)" />
                    <Area type="monotone" dataKey="nouveauxVisiteurs" name="Nouveaux visiteurs" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorNouveauxVisiteurs)" />
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

      {/* SECTION 2B : PILOTAGE, ACQUISITION, CONVERSION & PROMOTION */}
      <AdminGrowthInsightsSection
        data={growthInsights}
        loading={loading}
        onManageUser={setManagedSubUser}
      />

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
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                size="sm"
                onClick={() => navigate('/admin/utilisateurs')}
                className="rounded-xl bg-[#0d233a] hover:bg-[#1a365d] text-white text-xs font-semibold h-8 gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                Rechercher &amp; Activer
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin/utilisateurs')}
                className="rounded-xl border-[#d3e4fe] text-[#0d233a] text-xs font-semibold h-8"
              >
                Voir tous les candidats
              </Button>
            </div>
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
                  <TableHead className="text-xs font-heading font-bold text-[#0d233a] text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  ['sk-1', 'sk-2', 'sk-3', 'sk-4'].map((skKey) => (
                    <TableRow key={skKey}>
                      <TableCell colSpan={6}><Skeleton className="h-8 w-full bg-[#eff4ff]" /></TableCell>
                    </TableRow>
                  ))
                ) : telemetry.recentAbonnements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-xs text-[#64748b]">
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
                        <div>{abo.plan_nom}</div>
                        {abo.quota_ee_restant !== null && (
                          <div className="text-[10px] font-normal text-[#64748b]">
                            EE: {abo.quota_ee_restant ?? 0} • EO: {abo.quota_eo_restant ?? 0} • EB: {abo.quota_examen_blanc_restant ?? 0}
                          </div>
                        )}
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
                      <TableCell className="text-right">
                        {abo.user_id && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setManagedSubUser({
                                id: abo.user_id as string,
                                prenom: abo.etudiant_prenom,
                                nom: abo.etudiant_nom_famille,
                                email: abo.etudiant_email === '—' ? null : abo.etudiant_email,
                                role: 'etudiant',
                              })
                            }
                            className="h-7 px-2.5 text-[11px] rounded-lg border-[#d3e4fe] text-[#0d233a] hover:bg-[#eff4ff] gap-1"
                          >
                            <Sliders className="w-3 h-3 text-[#e53e3e]" />
                            Gérer
                          </Button>
                        )}
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

      <AdminSubscriptionQuotaModal
        open={!!managedSubUser}
        onOpenChange={(open) => {
          if (!open) setManagedSubUser(null);
        }}
        user={managedSubUser}
        onUpdated={fetchDashboardData}
      />
    </div>
  );
}
