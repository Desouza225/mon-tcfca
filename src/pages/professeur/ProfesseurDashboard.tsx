import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, ClipboardList, CheckCircle, RefreshCw, Sparkles, Clock, ChevronRight } from 'lucide-react';
import type { Profile, Production } from '@/types/index';
import { EPREUVE_LABELS } from '@/types/index';

type ProductionWithEtudiant = Production & {
  etudiant?: {
    id: string;
    prenom: string | null;
    nom: string | null;
    email: string | null;
  } | null;
};

export default function ProfesseurDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [etudiants, setEtudiants] = useState<Profile[]>([]);
  const [corrections, setCorrections] = useState<ProductionWithEtudiant[]>([]);
  const [totalPendingCount, setTotalPendingCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isSilent = false) => {
    if (!user) return;
    if (!isSilent) setRefreshing(true);

    try {
      // 1. Récupérer les étudiants attribués
      const { data: rawAttr } = await supabase
        .from('attributions')
        .select('etudiant_id')
        .eq('professeur_id', user.id);
      const ids = (rawAttr || []).map(a => a.etudiant_id).filter(Boolean);

      let etudiantsList: Profile[] = [];
      if (ids.length > 0) {
        const { data: stdProfiles } = await supabase.from('profiles').select('*').in('id', ids);
        etudiantsList = Array.isArray(stdProfiles) ? stdProfiles : [];
      }

      // 2. Compter le total exact de corrections en attente
      const { count: exactPendingCount } = await supabase
        .from('productions')
        .select('id', { count: 'exact', head: true })
        .eq('statut_correction', 'en_attente');

      // 3. Charger les corrections prioritaires (les plus anciennes en premier)
      const { data: corrData, error: corrErr } = await supabase
        .from('productions')
        .select('*, etudiant:profiles!etudiant_id(id, prenom, nom, email)')
        .eq('statut_correction', 'en_attente')
        .order('created_at', { ascending: true })
        .limit(10);

      let recentCorrections: ProductionWithEtudiant[] = [];
      if (!corrErr && Array.isArray(corrData)) {
        recentCorrections = corrData;
      } else {
        // Fallback sans jointure
        const { data: fbData } = await supabase
          .from('productions')
          .select('*')
          .eq('statut_correction', 'en_attente')
          .order('created_at', { ascending: true })
          .limit(10);

        if (Array.isArray(fbData) && fbData.length > 0) {
          const uIds = [...new Set(fbData.map(p => p.etudiant_id).filter(Boolean))];
          const { data: pData } = await supabase.from('profiles').select('id, prenom, nom, email').in('id', uIds);
          const pMap = new Map((pData || []).map(p => [p.id, p]));
          recentCorrections = fbData.map(p => ({ ...p, etudiant: pMap.get(p.etudiant_id) || null }));
        }
      }

      setEtudiants(etudiantsList);
      setTotalPendingCount(exactPendingCount ?? recentCorrections.length);
      setCorrections(recentCorrections);
    } catch (err) {
      console.error('Erreur chargement dashboard professeur:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    load();

    // Écoute temps réel des nouvelles soumissions
    const channel = supabase
      .channel('prof-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productions' }, () => {
        load(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attributions' }, () => {
        load(true);
      })
      .subscribe();

    // Rafraîchissement automatique toutes les 15 secondes
    const interval = setInterval(() => {
      load(true);
    }, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [user, load]);

  const stats = [
    { label: 'Étudiants attribués', value: etudiants.length, icon: Users, color: 'text-[#0d233a]', href: '/professeur/etudiants' },
    {
      label: 'Corrections en attente',
      value: totalPendingCount,
      icon: ClipboardList,
      color: totalPendingCount > 0 ? 'text-[#e53e3e]' : 'text-[#d97706]',
      href: '/professeur/corrections',
      badge: totalPendingCount > 0 ? `${totalPendingCount} à traiter` : null,
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe] text-xs font-heading font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#e53e3e]" />
            <span>Pédagogie &amp; Corrections Certifiées TCF</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a] tracking-tight">
            Bonjour, {profile?.prenom || 'Professeur'} 👋
          </h1>
          <p className="text-xs sm:text-sm text-[#475569]">
            Espace Enseignant — Suivi des soumissions et corrections des expressions
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => load()}
          disabled={refreshing}
          className="self-start sm:self-center gap-2 rounded-xl border-[#e2e8f0] text-[#0d233a] hover:bg-[#eff4ff]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {stats.map(stat => (
          <Card
            key={stat.label}
            className="h-full cursor-pointer hover:border-[#0d233a]/40 hover:shadow-md transition-all rounded-2xl border border-[#e2e8f0] bg-white"
            onClick={() => navigate(stat.href)}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#eff4ff] flex items-center justify-center shrink-0 shadow-xs">
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a]">{loading ? '—' : stat.value}</p>
                  {stat.badge && (
                    <Badge className="bg-[#ffdad7] text-[#930013] text-[10px] font-bold py-0.5 px-2 rounded-full border-0">
                      {stat.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-[#475569] font-medium">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Corrections urgentes */}
      <Card className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 px-6 pt-6">
          <div>
            <CardTitle className="text-base sm:text-lg font-heading font-bold text-[#0d233a] flex items-center gap-2">
              <span>Corrections en attente</span>
              {totalPendingCount > 0 && (
                <Badge className="bg-[#ffdcc3] text-[#6e3900] text-xs font-bold px-2.5 py-0.5 rounded-full border-0">
                  {totalPendingCount} au total
                </Badge>
              )}
            </CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-xs font-heading font-bold text-[#0d233a] hover:text-[#e53e3e]">
            <Link to="/professeur/corrections" className="gap-1">
              Voir tout <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-2">
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full bg-[#eff4ff] rounded-xl" />)}</div>
          ) : corrections.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-10 h-10 text-emerald-500/50 mx-auto mb-2" />
              <p className="text-sm text-[#475569] font-medium">Toutes les productions ont été corrigées !</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {corrections.map(prod => (
                <div key={prod.id} className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] hover:border-[#0d233a]/30 transition-all">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-heading font-bold text-[#0d233a] truncate">
                        {prod.etudiant?.prenom ? `${prod.etudiant.prenom} ${prod.etudiant.nom || ''}` : 'Étudiant'}
                      </p>
                      <Badge className="text-[10px] font-semibold py-0.5 px-2 bg-[#dce9ff] text-[#0d233a] rounded-full border-0">
                        {EPREUVE_LABELS[prod.epreuve as keyof typeof EPREUVE_LABELS] || prod.epreuve} · Tâche {prod.numero_tache}
                      </Badge>
                      {prod.reference && (
                        <span className="text-[10px] font-mono text-[#475569]">({prod.reference})</span>
                      )}
                    </div>
                    <p className="text-xs text-[#475569] flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-[#475569]" />
                      Reçu le {new Date(prod.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <Button size="sm" asChild className="shrink-0 bg-[#0d233a] hover:bg-[#1a365d] text-white font-heading font-semibold rounded-xl text-xs px-4">
                    <Link to={`/professeur/corrections/${prod.id}`}>Corriger</Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Étudiants récents */}
      <Card className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3 px-6 pt-6">
          <CardTitle className="text-base sm:text-lg font-heading font-bold text-[#0d233a]">
            Mes étudiants ({etudiants.length})
          </CardTitle>
          <Button variant="ghost" size="sm" asChild className="text-xs font-heading font-bold text-[#0d233a] hover:text-[#e53e3e]">
            <Link to="/professeur/etudiants" className="gap-1">
              Voir tout <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="px-6 pb-6 pt-2">
          {loading ? (
            <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-14 w-full bg-[#eff4ff] rounded-xl" />)}</div>
          ) : etudiants.length === 0 ? (
            <p className="text-sm text-[#475569] text-center py-6">Aucun étudiant attribué pour l'instant.</p>
          ) : (
            <div className="space-y-2.5">
              {etudiants.slice(0, 4).map(etudiant => (
                <button
                  type="button"
                  key={etudiant.id}
                  className="w-full text-left flex items-center gap-3 p-3.5 rounded-xl bg-[#f8f9ff] border border-[#e2e8f0] cursor-pointer hover:border-[#0d233a]/30 hover:bg-white transition-all"
                  onClick={() => navigate('/professeur/etudiants')}
                >
                  <div className="w-9 h-9 rounded-xl bg-[#0d233a] text-white flex items-center justify-center font-heading font-bold text-xs shrink-0 shadow-xs">
                    {etudiant.prenom?.[0]}{etudiant.nom?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-heading font-bold text-[#0d233a] truncate">{etudiant.prenom} {etudiant.nom}</p>
                    <p className="text-xs text-[#475569] truncate">{etudiant.email}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#475569] shrink-0" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
