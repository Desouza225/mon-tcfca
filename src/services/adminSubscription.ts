import { supabase } from '@/db/supabase';
import type { Profile, UserRole } from '@/types/index';
import { PLANS_CONFIG } from '@/types/index';

export type AdminPlanKey = 'essentiel' | 'standard' | 'intensif' | 'express';
export const ADMIN_PLAN_KEYS: AdminPlanKey[] = ['essentiel', 'standard', 'intensif', 'express'];

export type SubscriptionFilter = 'tous' | 'abonnes' | 'non_abonnes' | 'expires';

export interface UserSubscriptionInfo {
  id: string;
  userId: string;
  plan: AdminPlanKey;
  rawPlanId: string;
  isActive: boolean;
  isExpired: boolean;
  statusLabel: 'actif' | 'expire' | 'annule';
  quotaEe: number;
  quotaEo: number;
  quotaExamenBlanc: number;
  startAt: string | null;
  endAt: string | null;
  daysRemaining: number | null;
  provider: string | null;
  methode: string | null;
  autoRenew: boolean;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizePlanKey(planId?: string | null): AdminPlanKey {
  const raw = String(planId || '').trim().toLowerCase();
  if (raw === 'pack_express' || raw === 'express') return 'express';
  if (raw === 'basic' || raw === 'essentiel') return 'essentiel';
  if (raw === 'premium' || raw === 'standard') return 'standard';
  if (raw === 'intensif') return 'intensif';
  return 'standard';
}

export function sanitizePostgrestToken(raw: string): string {
  return raw.replace(/[(),%*\\]/g, '').trim();
}

export function parseSubscriptionRow(row: Record<string, unknown>): UserSubscriptionInfo {
  const userId = String(row.user_id || row.etudiant_id || '');
  const rawPlanId = String(row.plan_id || row.plan || 'standard');
  const plan = normalizePlanKey(rawPlanId);

  const statusVal = String(row.status || '').toLowerCase();
  const statutVal = String(row.statut || '').toLowerCase();
  const hasActiveFlag =
    statusVal === 'active' || statusVal === 'actif' || statutVal === 'actif' || statutVal === 'active';
  const isCancelledFlag =
    statusVal === 'cancelled' || statusVal === 'canceled' || statutVal === 'annule' || statutVal === 'annulé' ||
    statutVal === 'annule' || statutVal === 'annulé' || statutVal === 'cancelled';

  const startAt = (row.current_period_start as string | null) || (row.date_debut as string | null) || (row.created_at as string | null) || null;
  const endAt = (row.current_period_end as string | null) || (row.date_fin as string | null) || null;

  const endMs = endAt ? new Date(endAt).getTime() : null;
  const isDateExpired = endMs !== null && !Number.isNaN(endMs) && endMs <= Date.now();
  const daysRemaining =
    endMs !== null && !Number.isNaN(endMs)
      ? Math.ceil((endMs - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

  const isActive = hasActiveFlag && !isCancelledFlag && !isDateExpired;
  const isExpired = !isActive && !isCancelledFlag;
  const statusLabel: 'actif' | 'expire' | 'annule' = isActive
    ? 'actif'
    : isCancelledFlag
      ? 'annule'
      : 'expire';

  return {
    id: String(row.id || ''),
    userId,
    plan,
    rawPlanId,
    isActive,
    isExpired,
    statusLabel,
    quotaEe: Number(row.quota_ee_restant ?? 0),
    quotaEo: Number(row.quota_eo_restant ?? 0),
    quotaExamenBlanc: Number(row.quota_examen_blanc_restant ?? 0),
    startAt,
    endAt,
    daysRemaining,
    provider: (row.provider as string | null) ?? null,
    methode: (row.methode as string | null) ?? null,
    autoRenew: Boolean(row.auto_renew),
  };
}

function pickPreferredSubscription(rows: Record<string, unknown>[]): Record<string, unknown> | null {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => {
    const aTime = new Date(String(a.created_at || 0)).getTime();
    const bTime = new Date(String(b.created_at || 0)).getTime();
    return bTime - aTime;
  });
  const active = sorted.find(r => parseSubscriptionRow(r).isActive);
  return active || sorted[0];
}

export async function fetchSubscriptionsForUsers(
  userIds: string[]
): Promise<Record<string, UserSubscriptionInfo>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (!uniqueIds.length) return {};

  const rowsByUser = new Map<string, Record<string, unknown>[]>();
  const CHUNK_SIZE = 100;

  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
    const [byUserIdRes, byEtudiantIdRes] = await Promise.all([
      supabase
        .from('abonnements')
        .select('*')
        .in('user_id', chunk)
        .order('created_at', { ascending: false }),
      supabase
        .from('abonnements')
        .select('*')
        .in('etudiant_id', chunk)
        .order('created_at', { ascending: false }),
    ]);

    const seenRowIds = new Set<string>();
    const combined = [...(byUserIdRes.data || []), ...(byEtudiantIdRes.data || [])] as Record<string, unknown>[];
    for (const row of combined) {
      const rowId = String(row.id || '');
      if (rowId && seenRowIds.has(rowId)) continue;
      if (rowId) seenRowIds.add(rowId);

      const uid = String(row.user_id || row.etudiant_id || '');
      if (!uid) continue;
      const list = rowsByUser.get(uid) || [];
      list.push(row);
      rowsByUser.set(uid, list);
    }
  }

  const result: Record<string, UserSubscriptionInfo> = {};
  for (const [uid, rows] of rowsByUser.entries()) {
    const chosen = pickPreferredSubscription(rows);
    if (chosen) {
      result[uid] = parseSubscriptionRow(chosen);
    }
  }
  return result;
}

export async function fetchUserLatestSubscription(userId: string): Promise<UserSubscriptionInfo | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('abonnements')
    .select('*')
    .or(`user_id.eq.${userId},etudiant_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error || !Array.isArray(data) || data.length === 0) return null;
  const chosen = pickPreferredSubscription(data as Record<string, unknown>[]);
  return chosen ? parseSubscriptionRow(chosen) : null;
}

export interface SearchAdminUsersParams {
  search: string;
  role: UserRole | 'tous';
  subscriptionFilter: SubscriptionFilter;
  page: number;
  pageSize: number;
}

export interface SearchAdminUsersResult {
  users: Profile[];
  total: number;
  subscriptionsMap: Record<string, UserSubscriptionInfo>;
}

function buildSearchTokens(search: string): string[] {
  return search
    .trim()
    .split(/\s+/)
    .map(sanitizePostgrestToken)
    .filter(Boolean)
    .slice(0, 4);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyProfileFilters(query: any, role: UserRole | 'tous', tokens: string[]) {
  let q = query;
  if (role !== 'tous') {
    q = q.eq('role', role);
  }
  for (const token of tokens) {
    if (UUID_REGEX.test(token)) {
      q = q.or(
        `id.eq.${token},nom.ilike.%${token}%,prenom.ilike.%${token}%,email.ilike.%${token}%,telephone.ilike.%${token}%,pays.ilike.%${token}%`
      );
    } else {
      q = q.or(
        `nom.ilike.%${token}%,prenom.ilike.%${token}%,email.ilike.%${token}%,telephone.ilike.%${token}%,pays.ilike.%${token}%`
      );
    }
  }
  return q;
}

async function classifySubscriptionUsers(): Promise<{
  activeSet: Set<string>;
  activeUserIds: string[];
  expiredOnlyIds: string[];
}> {
  const activeSet = new Set<string>();
  const anySubSet = new Set<string>();
  const BATCH = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('abonnements')
      .select('id, user_id, etudiant_id, status, statut, current_period_end, date_fin, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + BATCH - 1);

    if (error) throw error;
    const rows = (data || []) as Record<string, unknown>[];
    for (const row of rows) {
      const parsed = parseSubscriptionRow(row);
      if (!parsed.userId) continue;
      anySubSet.add(parsed.userId);
      if (parsed.isActive) {
        activeSet.add(parsed.userId);
      }
    }
    if (rows.length < BATCH) break;
    offset += BATCH;
  }

  const activeUserIds = Array.from(activeSet);
  const expiredOnlyIds = Array.from(anySubSet).filter(uid => !activeSet.has(uid));
  return { activeSet, activeUserIds, expiredOnlyIds };
}

export async function searchAdminUsers(
  params: SearchAdminUsersParams
): Promise<SearchAdminUsersResult> {
  const { search, role, subscriptionFilter, page, pageSize } = params;
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  const to = from + pageSize - 1;
  const tokens = buildSearchTokens(search);

  let pageUsers: Profile[] = [];
  let total = 0;

  if (subscriptionFilter === 'tous') {
    let q = supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });
    q = applyProfileFilters(q, role, tokens);

    const { data, count, error } = await q.range(from, to);
    if (error) throw error;
    pageUsers = Array.isArray(data) ? (data as Profile[]) : [];
    total = count ?? pageUsers.length;
  } else {
    const { activeSet, activeUserIds, expiredOnlyIds } = await classifySubscriptionUsers();

    if (subscriptionFilter === 'abonnes' || subscriptionFilter === 'expires') {
      const targetIds = subscriptionFilter === 'abonnes' ? activeUserIds : expiredOnlyIds;
      if (targetIds.length === 0) {
        return { users: [], total: 0, subscriptionsMap: {} };
      }

      const matched: Profile[] = [];
      const CHUNK = 150;
      for (let i = 0; i < targetIds.length; i += CHUNK) {
        const chunk = targetIds.slice(i, i + CHUNK);
        let q = supabase.from('profiles').select('*').in('id', chunk);
        q = applyProfileFilters(q, role, tokens);
        const { data, error } = await q;
        if (error) throw error;
        if (Array.isArray(data)) matched.push(...(data as Profile[]));
      }

      matched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      total = matched.length;
      pageUsers = matched.slice(from, to + 1);
    } else {
      // 'non_abonnes'
      if (activeUserIds.length === 0) {
        let q = supabase
          .from('profiles')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false });
        q = applyProfileFilters(q, role, tokens);
        const { data, count, error } = await q.range(from, to);
        if (error) throw error;
        pageUsers = Array.isArray(data) ? (data as Profile[]) : [];
        total = count ?? pageUsers.length;
      } else if (activeUserIds.length <= 150) {
        let q = supabase
          .from('profiles')
          .select('*', { count: 'exact' })
          .not('id', 'in', `(${activeUserIds.join(',')})`)
          .order('created_at', { ascending: false });
        q = applyProfileFilters(q, role, tokens);
        const { data, count, error } = await q.range(from, to);
        if (error) throw error;
        pageUsers = Array.isArray(data) ? (data as Profile[]) : [];
        total = count ?? pageUsers.length;
      } else {
        const allFiltered: Profile[] = [];
        const BATCH = 1000;
        let offset = 0;
        while (true) {
          let q = supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
          q = applyProfileFilters(q, role, tokens);
          const { data, error } = await q.range(offset, offset + BATCH - 1);
          if (error) throw error;
          const rows = Array.isArray(data) ? (data as Profile[]) : [];
          for (const u of rows) {
            if (!activeSet.has(u.id)) allFiltered.push(u);
          }
          if (rows.length < BATCH) break;
          offset += BATCH;
        }
        total = allFiltered.length;
        pageUsers = allFiltered.slice(from, to + 1);
      }
    }
  }

  const subscriptionsMap = await fetchSubscriptionsForUsers(pageUsers.map(u => u.id));
  return { users: pageUsers, total, subscriptionsMap };
}

async function writeAbonnementRow(
  existingId: string | null,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const attempt = async (body: Record<string, unknown>) => {
    if (existingId) {
      return await supabase.from('abonnements').update(body).eq('id', existingId).select('*').single();
    }
    return await supabase.from('abonnements').insert(body).select('*').single();
  };

  let currentPayload = { ...payload };
  let res = await attempt(currentPayload);

  // Fallback 1 : si plan_id='express' viole la FK public.plans(id), utiliser 'pack_express'
  if (res.error) {
    const errMsg = String(res.error.message || '').toLowerCase();
    const errCode = String((res.error as { code?: string }).code || '');
    if (
      currentPayload.plan_id === 'express' &&
      (errCode === '23503' || errMsg.includes('plan_id') || errMsg.includes('plans'))
    ) {
      currentPayload = { ...currentPayload, plan_id: 'pack_express' };
      res = await attempt(currentPayload);
    }
  }

  // Fallback 2 : si la colonne legacy `plan` n'existe pas dans le schéma courant
  if (res.error) {
    const errMsg = String(res.error.message || '').toLowerCase();
    const errCode = String((res.error as { code?: string }).code || '');
    if (
      'plan' in currentPayload &&
      (errCode === '42703' || (errMsg.includes('plan') && errMsg.includes('column')))
    ) {
      const { plan: _omitted, ...withoutPlan } = currentPayload;
      currentPayload = withoutPlan;
      res = await attempt(currentPayload);
    }
  }

  if (res.error) throw res.error;
  return (res.data || {}) as Record<string, unknown>;
}

async function fetchUserAbonnementRows(userId: string): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from('abonnements')
    .select('*')
    .or(`user_id.eq.${userId},etudiant_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Record<string, unknown>[];
}

async function sendStudentNotification(userId: string, titre: string, message: string) {
  try {
    await supabase.from('notifications').insert({
      utilisateur_id: userId,
      titre,
      message,
      lien: '/etudiant/abonnement',
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-bloquant
  }
}

export interface ActivateManualSubscriptionParams {
  userId: string;
  plan: AdminPlanKey;
  dureeJours: number;
  customEndDate?: string;
  quotaEe: number;
  quotaEo: number;
  quotaExamenBlanc: number;
  cumulateQuotas?: boolean;
  enableExamenBlancProfile?: boolean;
  notifyUser?: boolean;
}

export async function activateManualSubscription(
  params: ActivateManualSubscriptionParams
): Promise<UserSubscriptionInfo> {
  const {
    userId,
    plan,
    dureeJours,
    customEndDate,
    quotaEe,
    quotaEo,
    quotaExamenBlanc,
    cumulateQuotas = false,
    enableExamenBlancProfile = true,
    notifyUser = false,
  } = params;

  const now = new Date();
  const nowIso = now.toISOString();
  const endIso =
    customEndDate && customEndDate.trim().length > 0
      ? new Date(`${customEndDate.trim()}T23:59:59.999Z`).toISOString()
      : new Date(now.getTime() + Math.max(1, Math.round(dureeJours)) * 24 * 60 * 60 * 1000).toISOString();

  const existingRows = await fetchUserAbonnementRows(userId);
  const activeRow = existingRows.find(r => parseSubscriptionRow(r).isActive);

  let finalEe = Math.max(0, Math.round(quotaEe));
  let finalEo = Math.max(0, Math.round(quotaEo));
  let finalEb = Math.max(0, Math.round(quotaExamenBlanc));

  if (cumulateQuotas && activeRow) {
    const parsedActive = parseSubscriptionRow(activeRow);
    finalEe += Math.max(0, parsedActive.quotaEe);
    finalEo += Math.max(0, parsedActive.quotaEo);
    finalEb += Math.max(0, parsedActive.quotaExamenBlanc);
  }

  const targetRowId = existingRows[0]?.id ? String(existingRows[0].id) : null;

  const payload: Record<string, unknown> = {
    user_id: userId,
    etudiant_id: userId,
    plan: plan === 'essentiel' ? 'basic' : 'premium',
    plan_id: plan,
    status: 'active',
    statut: 'actif',
    provider: 'manuel',
    methode: 'manuel',
    auto_renew: false,
    quota_ee_restant: finalEe,
    quota_eo_restant: finalEo,
    quota_examen_blanc_restant: finalEb,
    current_period_start: nowIso,
    date_debut: nowIso,
    current_period_end: endIso,
    date_fin: endIso,
    updated_at: nowIso,
  };

  const savedRow = await writeAbonnementRow(targetRowId, payload);

  // Expirer d'éventuelles lignes supplémentaires historiques pour éviter tout doublon actif
  const extraIds = existingRows
    .slice(1)
    .map(r => String(r.id || ''))
    .filter(Boolean);
  if (extraIds.length > 0) {
    await supabase
      .from('abonnements')
      .update({ status: 'expired', statut: 'expire', updated_at: nowIso })
      .in('id', extraIds);
  }

  if (enableExamenBlancProfile !== false) {
    await supabase
      .from('profiles')
      .update({ examen_blanc_actif: finalEb > 0 })
      .eq('id', userId);
  }

  if (notifyUser) {
    const planLabel = PLANS_CONFIG[plan]?.nom || plan;
    const endFormatted = new Date(endIso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    await sendStudentNotification(
      userId,
      `Abonnement ${planLabel} activé`,
      `Votre formule ${planLabel} a été activée jusqu'au ${endFormatted} avec ${finalEe} correction(s) EE, ${finalEo} correction(s) EO et ${finalEb} examen(s) blanc(s).`
    );
  }

  return parseSubscriptionRow(savedRow);
}

export interface UpdateManualQuotasParams {
  userId: string;
  mode: 'add' | 'set';
  quotaEe: number;
  quotaEo: number;
  quotaExamenBlanc: number;
  extendDays?: number;
  customEndDate?: string;
  fallbackPlan?: AdminPlanKey;
  fallbackDureeJours?: number;
  enableExamenBlancProfile?: boolean;
  notifyUser?: boolean;
}

export async function updateManualQuotas(
  params: UpdateManualQuotasParams
): Promise<UserSubscriptionInfo> {
  const {
    userId,
    mode,
    quotaEe,
    quotaEo,
    quotaExamenBlanc,
    extendDays = 0,
    customEndDate,
    fallbackPlan,
    fallbackDureeJours = 30,
    enableExamenBlancProfile = true,
    notifyUser = false,
  } = params;

  const existingRows = await fetchUserAbonnementRows(userId);
  const activeRow = existingRows.find(r => parseSubscriptionRow(r).isActive);

  if (!activeRow) {
    const latestPlan = existingRows[0]
      ? normalizePlanKey(String(existingRows[0].plan_id || existingRows[0].plan || ''))
      : 'essentiel';
    return await activateManualSubscription({
      userId,
      plan: fallbackPlan ?? latestPlan,
      dureeJours: fallbackDureeJours,
      customEndDate,
      quotaEe: Math.max(0, Math.round(quotaEe)),
      quotaEo: Math.max(0, Math.round(quotaEo)),
      quotaExamenBlanc: Math.max(0, Math.round(quotaExamenBlanc)),
      cumulateQuotas: false,
      enableExamenBlancProfile,
      notifyUser,
    });
  }

  const parsedActive = parseSubscriptionRow(activeRow);
  const now = new Date();
  const nowIso = now.toISOString();

  const finalEe =
    mode === 'add'
      ? Math.max(0, parsedActive.quotaEe + Math.round(quotaEe))
      : Math.max(0, Math.round(quotaEe));
  const finalEo =
    mode === 'add'
      ? Math.max(0, parsedActive.quotaEo + Math.round(quotaEo))
      : Math.max(0, Math.round(quotaEo));
  const finalEb =
    mode === 'add'
      ? Math.max(0, parsedActive.quotaExamenBlanc + Math.round(quotaExamenBlanc))
      : Math.max(0, Math.round(quotaExamenBlanc));

  let endIso = parsedActive.endAt;
  if (customEndDate && customEndDate.trim().length > 0) {
    endIso = new Date(`${customEndDate.trim()}T23:59:59.999Z`).toISOString();
  } else if (extendDays && extendDays !== 0) {
    const baseMs = parsedActive.endAt
      ? Math.max(now.getTime(), new Date(parsedActive.endAt).getTime())
      : now.getTime();
    endIso = new Date(baseMs + Math.round(extendDays) * 24 * 60 * 60 * 1000).toISOString();
  }

  const updatePayload: Record<string, unknown> = {
    status: 'active',
    statut: 'actif',
    quota_ee_restant: finalEe,
    quota_eo_restant: finalEo,
    quota_examen_blanc_restant: finalEb,
    updated_at: nowIso,
  };
  if (endIso) {
    updatePayload.current_period_end = endIso;
    updatePayload.date_fin = endIso;
  }

  const savedRow = await writeAbonnementRow(parsedActive.id, updatePayload);

  if (enableExamenBlancProfile !== false && finalEb > 0) {
    await supabase
      .from('profiles')
      .update({ examen_blanc_actif: true })
      .eq('id', userId);
  }

  if (notifyUser) {
    await sendStudentNotification(
      userId,
      'Vos quotas ont été mis à jour',
      `Vos quotas disponibles sont désormais : ${finalEe} correction(s) EE, ${finalEo} correction(s) EO et ${finalEb} examen(s) blanc(s).`
    );
  }

  return parseSubscriptionRow(savedRow);
}

export async function deactivateManualSubscription(userId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('abonnements')
    .update({ status: 'expired', statut: 'expire', updated_at: nowIso })
    .or(`user_id.eq.${userId},etudiant_id.eq.${userId}`);

  if (error) throw error;

  await supabase
    .from('profiles')
    .update({ examen_blanc_actif: false })
    .eq('id', userId);
}
