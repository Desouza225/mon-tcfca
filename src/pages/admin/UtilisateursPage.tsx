import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useDebounce } from '@/hooks/use-debounce';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus, Pencil, Trash2, Loader2, Users, Search, ToggleLeft, ToggleRight,
  Ban, CheckCircle2, Clock, GraduationCap, UserX, CreditCard, X, ChevronLeft, ChevronRight, Sliders,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Profile, UserRole } from '@/types/index';
import { ROLE_LABELS, PLANS_CONFIG } from '@/types/index';
import { CountryFlag } from '@/components/ui/CountryFlag';
import {
  ADMIN_PLAN_KEYS,
  type AdminPlanKey,
  type SubscriptionFilter,
  type UserSubscriptionInfo,
  activateManualSubscription,
  deactivateManualSubscription,
  searchAdminUsers,
} from '@/services/adminSubscription';
import {
  AdminSubscriptionQuotaModal,
  type AdminManagedUser,
} from '@/components/admin/AdminSubscriptionQuotaModal';

type SubOverrideOption = AdminPlanKey | 'aucun';
const PAGE_SIZE = 50;

export default function UtilisateursPage() {
  const { user: currentUser, isAdmin, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [filterRole, setFilterRole] = useState<UserRole | 'tous'>('tous');
  const [filterSub, setFilterSub] = useState<SubscriptionFilter>('tous');
  const [form, setForm] = useState({
    email: '',
    password: '',
    nom: '',
    prenom: '',
    role: 'etudiant' as UserRole,
    planOverride: 'aucun' as SubOverrideOption,
  });
  const [initialPlanOverride, setInitialPlanOverride] = useState<SubOverrideOption>('aucun');
  const [editId, setEditId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<string | null>(null);

  // Modal Abonnement & Quotas
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subModalUser, setSubModalUser] = useState<AdminManagedUser | null>(null);

  // Rôles autorisés selon les privilèges de l'administrateur connecté
  const allowedRoles = (): UserRole[] => {
    if (isSuperAdmin) {
      return ['etudiant', 'professeur', 'admin', 'super_admin'];
    }
    return ['etudiant', 'professeur', 'admin'];
  };

  const canManage = (target: Profile): boolean => {
    if (!isAdmin) return false;
    if (target.role === 'super_admin' && !isSuperAdmin) return false;
    return true;
  };

  const [attributionsMap, setAttributionsMap] = useState<Record<string, { prenom: string; nom: string }>>({});
  const [abonnementsMap, setAbonnementsMap] = useState<Record<string, UserSubscriptionInfo>>({});

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const { users: fetchedUsers, total, subscriptionsMap } = await searchAdminUsers({
        search: debouncedSearch,
        role: filterRole,
        subscriptionFilter: filterSub,
        page,
        pageSize: PAGE_SIZE,
      });

      setUsers(fetchedUsers);
      setTotalCount(total);
      setAbonnementsMap(subscriptionsMap);

      // Charger uniquement les attributions des étudiants affichés sur cette page
      const studentIds = fetchedUsers.filter(u => u.role === 'etudiant').map(u => u.id);
      if (studentIds.length > 0) {
        const [attrRes, profsRes] = await Promise.all([
          supabase.from('attributions').select('etudiant_id, professeur_id').in('etudiant_id', studentIds),
          supabase.from('profiles').select('id, prenom, nom').in('role', ['professeur', 'admin', 'super_admin']),
        ]);

        if (attrRes.data && profsRes.data) {
          const profMap = new Map<string, { prenom: string; nom: string }>(
            (profsRes.data as { id: string; prenom: string | null; nom: string | null }[]).map(p => [
              p.id,
              { prenom: p.prenom || '', nom: p.nom || '' },
            ]),
          );
          const map: Record<string, { prenom: string; nom: string }> = {};
          for (const a of attrRes.data) {
            const prof = profMap.get(a.professeur_id);
            if (prof) map[a.etudiant_id] = prof;
          }
          setAttributionsMap(map);
        }
      } else {
        setAttributionsMap({});
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du chargement des utilisateurs.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterRole, filterSub, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpen = (user?: Profile) => {
    if (user) {
      if (!canManage(user)) return;
      const existingSub = abonnementsMap[user.id];
      const currentSub: SubOverrideOption = existingSub?.isActive ? existingSub.plan : 'aucun';
      setEditId(user.id);
      setInitialPlanOverride(currentSub);
      setForm({
        email: user.email || '',
        password: '',
        nom: user.nom || '',
        prenom: user.prenom || '',
        role: user.role,
        planOverride: currentSub,
      });
    } else {
      setEditId(null);
      setInitialPlanOverride('aucun');
      setForm({
        email: '',
        password: '',
        nom: '',
        prenom: '',
        role: 'etudiant',
        planOverride: 'aucun',
      });
    }
    setDialogOpen(true);
  };

  const applySubscriptionOverride = async (userId: string, planOption: SubOverrideOption) => {
    if (planOption === 'aucun') {
      await deactivateManualSubscription(userId);
      return;
    }
    const cfg = PLANS_CONFIG[planOption];
    await activateManualSubscription({
      userId,
      plan: planOption,
      dureeJours: cfg.duree_jours,
      quotaEe: cfg.quota_ee,
      quotaEo: cfg.quota_eo,
      quotaExamenBlanc: cfg.quota_examen_blanc,
      cumulateQuotas: false,
      enableExamenBlancProfile: true,
      notifyUser: false,
    });
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error('Action réservée aux administrateurs.');
      return;
    }
    if (!editId) {
      const cleanEmail = form.email.trim().toLowerCase();
      if (!cleanEmail || !form.password) {
        toast.error('Email et mot de passe requis pour un nouvel utilisateur.');
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
        toast.error('Veuillez saisir une adresse e-mail valide.');
        return;
      }
      if (form.password.length < 8) {
        toast.error('Le mot de passe doit contenir au moins 8 caractères.');
        return;
      }
    }
    if (editId && editId === currentUser?.id && form.role !== currentUser?.role) {
      toast.error('Vous ne pouvez pas modifier votre propre rôle.');
      return;
    }
    if (form.role === 'super_admin' && !isSuperAdmin) {
      toast.error('Seul un super administrateur peut attribuer le rôle Super Admin.');
      return;
    }

    setSaving(true);

    if (editId) {
      // Mise à jour du profil
      const { error } = await supabase.from('profiles').update({
        nom: form.nom.trim() || null,
        prenom: form.prenom.trim() || null,
        role: form.role,
      }).eq('id', editId);
      if (error) {
        toast.error('Erreur lors de la mise à jour.');
        setSaving(false);
        return;
      }

      if (form.role === 'etudiant' && form.planOverride !== initialPlanOverride) {
        try {
          await applySubscriptionOverride(editId, form.planOverride);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Erreur lors de la mise à jour de l\'abonnement.';
          toast.error(msg);
          setSaving(false);
          return;
        }
      }

      toast.success('Utilisateur mis à jour !');
    } else {
      // Créer via edge function (avec service role)
      const cleanEmail = form.email.trim().toLowerCase();
      try {
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: { email: cleanEmail, password: form.password, nom: form.nom.trim(), prenom: form.prenom.trim(), role: form.role },
        });
        if (error || data?.error) {
          const errMsg = data?.error || error?.message || 'Erreur lors de la création de l\'utilisateur.';
          toast.error(errMsg);
          setSaving(false);
          return;
        }
        const createdId = (data as { user?: { id?: string } } | null)?.user?.id;
        if (createdId && form.role === 'etudiant' && form.planOverride !== 'aucun') {
          try {
            await applySubscriptionOverride(createdId, form.planOverride);
          } catch {
            // Non-bloquant si l'attribution d'abonnement initiale échoue
          }
        }
        toast.success('Utilisateur créé avec succès !');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erreur lors de la création de l\'utilisateur.';
        toast.error(msg);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setDialogOpen(false);
    fetchUsers();
  };

  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (userId: string) => {
    if (!isAdmin) {
      toast.error('Action réservée aux administrateurs.');
      return;
    }
    if (userId === currentUser?.id) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte.');
      return;
    }
    const target = users.find(u => u.id === userId);
    if (target && !canManage(target)) {
      toast.error('Vous n\'avez pas les droits pour supprimer cet utilisateur.');
      return;
    }
    setDeleting(userId);

    // 1. Nettoyer les audios du storage si l'utilisateur a des productions
    try {
      const { data: prods } = await supabase
        .from('productions')
        .select('audio_url')
        .eq('etudiant_id', userId)
        .not('audio_url', 'is', null);

      if (Array.isArray(prods) && prods.length > 0) {
        const paths: string[] = [];
        for (const p of prods) {
          if (!p.audio_url) continue;
          try {
            const url = new URL(p.audio_url);
            const marker = '/productions-audio/';
            const idx = url.pathname.indexOf(marker);
            if (idx !== -1) paths.push(url.pathname.slice(idx + marker.length));
          } catch { /* URL ignorée */ }
        }
        if (paths.length > 0) {
          await supabase.storage.from('productions-audio').remove(paths);
        }
      }
    } catch {
      // Ignorer l'erreur storage non-bloquante
    }

    // 2. Tenter la suppression via Edge Function
    let deleted = false;
    let lastErrorMsg = '';

    try {
      const { data, error } = await supabase.functions.invoke('delete-user', { body: { userId } });
      if (!error && !data?.error) {
        deleted = true;
      } else {
        lastErrorMsg = data?.error || error?.message || '';
      }
    } catch (e: unknown) {
      lastErrorMsg = e instanceof Error ? e.message : '';
    }

    // 3. Si l'Edge Function a échoué ou n'est pas déployée, repli sur la RPC admin_delete_user
    if (!deleted) {
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('admin_delete_user', {
          target_user_id: userId,
        });
        const rpcSuccess = (rpcData as { success?: boolean } | null)?.success;
        if (!rpcError && rpcSuccess) {
          deleted = true;
        } else {
          lastErrorMsg = rpcError?.message || lastErrorMsg || 'Erreur lors de la suppression.';
        }
      } catch (e: unknown) {
        lastErrorMsg = e instanceof Error ? e.message : (lastErrorMsg || 'Erreur lors de la suppression.');
      }
    }

    setDeleting(null);

    if (deleted) {
      toast.success('Utilisateur supprimé avec succès !');
      setUsers(prev => prev.filter(u => u.id !== userId));
      setTotalCount(prev => Math.max(0, prev - 1));
      setAttributionsMap(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } else {
      toast.error(lastErrorMsg || 'Erreur lors de la suppression de l\'utilisateur.');
    }
  };

  const toggleExamenBlanc = async (userId: string, current: boolean) => {
    if (!isAdmin) return;
    setToggling(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ examen_blanc_actif: !current })
      .eq('id', userId);
    if (error) {
      toast.error('Erreur lors de la mise à jour de l\'examen blanc.');
    } else {
      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, examen_blanc_actif: !current } : u)
      );
      toast.success(!current ? 'Examen blanc activé ✓' : 'Examen blanc désactivé');
    }
    setToggling(null);
  };

  const toggleBloque = async (userId: string, current: boolean) => {
    if (!isAdmin) return;
    if (userId === currentUser?.id) {
      toast.error('Vous ne pouvez pas bloquer votre propre compte.');
      return;
    }
    setBlocking(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ bloque: !current })
      .eq('id', userId);
    if (error) {
      toast.error('Erreur lors de la mise à jour du statut de blocage.');
    } else {
      setUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, bloque: !current } : u)
      );
      toast.success(!current ? 'Compte bloqué.' : 'Compte débloqué ✓');
    }
    setBlocking(null);
  };

  const openSubscriptionModal = (user: Profile) => {
    setSubModalUser({
      id: user.id,
      prenom: user.prenom,
      nom: user.nom,
      email: user.email,
      telephone: user.telephone,
      pays: user.pays,
      role: user.role,
    });
    setSubModalOpen(true);
  };

  const roleColors: Record<UserRole, string> = {
    super_admin: 'bg-destructive text-destructive-foreground',
    admin: 'bg-primary text-primary-foreground',
    professeur: 'bg-secondary text-secondary-foreground',
    etudiant: 'bg-muted text-muted-foreground',
  };

  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const fmtShortDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="max-w-6xl mx-auto space-y-6 fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground text-balance">Gestion des utilisateurs</h1>
          <p className="text-muted-foreground mt-1">
            {totalCount} utilisateur{totalCount !== 1 ? 's' : ''} trouvé{totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpen()} className="gap-2 shrink-0">
              <Plus className="w-4 h-4" /> Nouvel utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-balance">{editId ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-normal">Prénom</Label>
                  <Input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} placeholder="Prénom" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-normal">Nom</Label>
                  <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Nom" />
                </div>
              </div>
              {!editId && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-normal">Adresse e-mail *</Label>
                    <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemple.com" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-normal">Mot de passe *</Label>
                    <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Minimum 8 caractères" />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label className="text-sm font-normal">Rôle *</Label>
                <Select
                  value={form.role}
                  onValueChange={v => setForm(f => ({ ...f, role: v as UserRole }))}
                  disabled={editId === currentUser?.id}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allowedRoles().map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.role === 'etudiant' && (
                <div className="space-y-2">
                  <Label className="text-sm font-normal">Abonnement actif (attribution manuelle)</Label>
                  <Select
                    value={form.planOverride}
                    onValueChange={v => setForm(f => ({ ...f, planOverride: v as SubOverrideOption }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aucun">Aucun abonnement actif</SelectItem>
                      {ADMIN_PLAN_KEYS.map(p => (
                        <SelectItem key={p} value={p}>
                          {PLANS_CONFIG[p].nom} ({PLANS_CONFIG[p].duree_jours}j — {PLANS_CONFIG[p].prix_usd} $)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sauvegarde...</> : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Recherche serveur & Filtres */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher par nom, prénom, email, téléphone, pays ou ID..."
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              aria-label="Effacer la recherche"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Select
          value={filterSub}
          onValueChange={v => {
            setFilterSub(v as SubscriptionFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full md:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous (inscrits &amp; abonnés)</SelectItem>
            <SelectItem value="abonnes">Abonnés actifs</SelectItem>
            <SelectItem value="non_abonnes">Sans abonnement</SelectItem>
            <SelectItem value="expires">Abonnements expirés</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={filterRole}
          onValueChange={v => {
            setFilterRole(v as UserRole | 'tous');
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full md:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous les rôles</SelectItem>
            {isSuperAdmin && <SelectItem value="admin">Admin</SelectItem>}
            <SelectItem value="professeur">Professeur</SelectItem>
            <SelectItem value="etudiant">Étudiant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-16 w-full bg-muted" />)}</div>
      ) : users.length === 0 ? (
        <Card className="h-full">
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">Aucun utilisateur trouvé.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground whitespace-nowrap px-3 py-2">NOM</th>
                  <th className="text-left text-xs font-medium text-muted-foreground whitespace-nowrap px-3 py-2">EMAIL</th>
                  <th className="text-left text-xs font-medium text-muted-foreground whitespace-nowrap px-3 py-2">PAYS / TÉLÉPHONE</th>
                  <th className="text-left text-xs font-medium text-muted-foreground whitespace-nowrap px-3 py-2">RÔLE</th>
                  <th className="text-left text-xs font-medium text-muted-foreground whitespace-nowrap px-3 py-2">ABONNEMENT &amp; QUOTAS</th>
                  <th className="text-left text-xs font-medium text-muted-foreground whitespace-nowrap px-3 py-2">PROFESSEUR</th>
                  <th className="text-left text-xs font-medium text-muted-foreground whitespace-nowrap px-3 py-2">STATUT</th>
                  <th className="text-left text-xs font-medium text-muted-foreground whitespace-nowrap px-3 py-2">DERNIÈRE CONNEXION</th>
                  <th className="text-left text-xs font-medium text-muted-foreground whitespace-nowrap px-3 py-2">EXAMEN BLANC</th>
                  <th className="text-left text-xs font-medium text-muted-foreground whitespace-nowrap px-3 py-2">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const sub = abonnementsMap[user.id];
                  return (
                    <tr key={user.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-primary">{user.prenom?.[0]}{user.nom?.[0]}</span>
                          </div>
                          <span className="text-sm font-medium text-foreground">{user.prenom} {user.nom}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-sm text-muted-foreground">{user.email}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {user.pays || user.telephone ? (
                          <div className="flex flex-col text-xs">
                            {user.pays && (
                              <span className="font-medium text-foreground">
                                <CountryFlag country={user.pays} showName />
                              </span>
                            )}
                            {user.telephone && <span className="text-muted-foreground">{user.telephone}</span>}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Badge className={`text-xs ${roleColors[user.role]}`}>{ROLE_LABELS[user.role]}</Badge>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {sub ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5">
                              {sub.isActive ? (
                                <Badge variant="outline" className="text-[11px] gap-1 border-primary/40 text-primary bg-primary/5">
                                  <CreditCard className="w-3 h-3" />
                                  {PLANS_CONFIG[sub.plan]?.nom ?? sub.plan}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[11px] border-amber-400 text-amber-700 bg-amber-50">
                                  Expiré ({PLANS_CONFIG[sub.plan]?.nom ?? sub.plan})
                                </Badge>
                              )}
                              <span className="text-[11px] text-muted-foreground">
                                {sub.endAt ? fmtShortDate(sub.endAt) : 'Sans fin'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-medium">
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                EE: {sub.quotaEe}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                                EO: {sub.quotaEo}
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                EB: {sub.quotaExamenBlanc}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Sans abonnement</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {user.role === 'etudiant' ? (
                          attributionsMap[user.id] ? (
                            <Badge variant="outline" className="text-xs gap-1 border-primary/30 text-primary bg-primary/5 font-normal">
                              <GraduationCap className="w-3 h-3 text-primary" />
                              <span>{attributionsMap[user.id].prenom} {attributionsMap[user.id].nom}</span>
                            </Badge>
                          ) : (
                            <Link to="/admin/attributions">
                              <Badge variant="outline" className="text-xs gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/15 cursor-pointer transition-colors font-normal">
                                <UserX className="w-3 h-3 text-amber-500" />
                                <span>Non attribué</span>
                              </Badge>
                            </Link>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {user.bloque ? (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <Ban className="w-3 h-3" /> Bloqué
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs gap-1 border-success/50 text-success">
                            <CheckCircle2 className="w-3 h-3" /> Actif
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-xs">{fmtDate(user.last_active_at)}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {user.role === 'etudiant' ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className={`gap-1.5 text-xs h-8 ${
                              user.examen_blanc_actif
                                ? 'border-success/50 text-success hover:bg-success/10'
                                : 'border-muted-foreground/30 text-muted-foreground hover:bg-muted'
                            }`}
                            onClick={() => toggleExamenBlanc(user.id, !!user.examen_blanc_actif)}
                            disabled={toggling === user.id}
                          >
                            {user.examen_blanc_actif
                              ? <ToggleRight className="w-3.5 h-3.5" />
                              : <ToggleLeft className="w-3.5 h-3.5" />
                            }
                            {user.examen_blanc_actif ? 'Activé' : 'Désactivé'}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {canManage(user) && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openSubscriptionModal(user)}
                              className="h-8 px-2.5 text-xs gap-1.5 border-[#d3e4fe] text-[#0d233a] hover:bg-[#eff4ff]"
                              title="Activer ou modifier l'abonnement et les quotas"
                            >
                              <Sliders className="w-3.5 h-3.5 text-[#e53e3e]" />
                              <span>Abonnement / Quotas</span>
                            </Button>

                            {/* Bouton Bloquer / Débloquer */}
                            {user.id !== currentUser?.id && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    disabled={blocking === user.id}
                                    className={user.bloque ? 'text-success hover:text-success' : 'text-destructive hover:text-destructive'}
                                    title={user.bloque ? 'Débloquer' : 'Bloquer'}
                                  >
                                    {user.bloque ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-balance">
                                      {user.bloque ? 'Débloquer' : 'Bloquer'} {user.prenom} {user.nom} ?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription className="text-pretty">
                                      {user.bloque
                                        ? 'L\'utilisateur pourra de nouveau se connecter à la plateforme.'
                                        : 'L\'utilisateur sera immédiatement déconnecté et ne pourra plus accéder à la plateforme.'}
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => toggleBloque(user.id, !!user.bloque)}
                                      className={user.bloque
                                        ? 'bg-success text-white hover:bg-success/90'
                                        : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'}
                                    >
                                      {user.bloque ? 'Débloquer' : 'Bloquer'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleOpen(user)} title="Modifier">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            {user.id !== currentUser?.id && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" disabled={deleting === user.id} title="Supprimer">
                                    {deleting === user.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle className="text-balance">Supprimer {user.prenom} {user.nom} ?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-pretty">Cette action est irréversible. Toutes les données associées seront supprimées.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={deleting === user.id}>Annuler</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => handleDelete(user.id)}
                                      disabled={deleting === user.id}
                                    >
                                      {deleting === user.id ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Suppression...</> : 'Supprimer'}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalCount > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Affichage {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} sur {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Précédent
                </Button>
                <span className="text-xs font-medium text-foreground px-2">
                  Page {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="gap-1"
                >
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <AdminSubscriptionQuotaModal
        open={subModalOpen}
        onOpenChange={setSubModalOpen}
        user={subModalUser}
        initialSubscription={subModalUser ? abonnementsMap[subModalUser.id] ?? null : null}
        onUpdated={fetchUsers}
      />
    </div>
  );
}
