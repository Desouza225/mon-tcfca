import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BookOpen, BookMarked, Search, CheckCircle2, Clock, Sparkles,
  FileText, ArrowRight, Check, Compass, ChevronRight, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MarkdownViewer } from '@/components/common/MarkdownViewer';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionGate } from '@/components/common/SubscriptionGate';
import type { CourseSheet, CourseEpreuve } from '@/types/index';
import { COURSE_EPREUVE_LABELS, COURSE_EPREUVE_GROUPS } from '@/types/index';
import { DEFAULT_COURSE_SHEETS } from '@/data/defaultCourseSheets';
import { useContentProtection } from '@/hooks/useContentProtection';

const EPREUVE_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  DEROULEMENT_TCF: { bg: 'bg-red-50 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
  CE: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  CO: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  EE: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-800 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  EO: { bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800' },
  OUTILS_CONNECTEURS: { bg: 'bg-teal-50 dark:bg-teal-950/40', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-800' },
  OUTILS_EXPRESSIONS: { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-700 dark:text-sky-300', border: 'border-sky-200 dark:border-sky-800' },
  OUTILS_TEMPS: { bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-800' },
  OUTILS_ACCORDS: { bg: 'bg-rose-50 dark:bg-rose-950/40', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800' },
};

function getEpreuveBadgeStyle(epreuve: CourseEpreuve) {
  if (EPREUVE_COLOR_MAP[epreuve]) return EPREUVE_COLOR_MAP[epreuve];
  if (epreuve === 'DEROULEMENT_TCF') return EPREUVE_COLOR_MAP.DEROULEMENT_TCF;
  if (epreuve === 'CE') return EPREUVE_COLOR_MAP.CE;
  if (epreuve === 'CO') return EPREUVE_COLOR_MAP.CO;
  if (epreuve.startsWith('EE')) return EPREUVE_COLOR_MAP.EE;
  if (epreuve.startsWith('EO')) return EPREUVE_COLOR_MAP.EO;
  return { bg: 'bg-slate-50 dark:bg-slate-900', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-200 dark:border-slate-800' };
}

export default function CoursPage() {
  const { user } = useAuth();
  const { hasActiveSubscription, isAdmin, loading: subLoading } = useSubscription();
  const canReadAllCourses = isAdmin || hasActiveSubscription;
  const [searchParams, setSearchParams] = useSearchParams();
  const [sheets, setSheets] = useState<CourseSheet[]>([]);
  const [readsSet, setReadsSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Filtres
  const [search, setSearch] = useState('');
  const tabFromUrl = searchParams.get('tab') || searchParams.get('group');
  const initialGroup = COURSE_EPREUVE_GROUPS.some((g) => g.key === tabFromUrl)
    ? (tabFromUrl as string)
    : 'deroulement';
  const [selectedGroup, setSelectedGroup] = useState<string>(initialGroup);
  const [selectedReadFilter, setSelectedReadFilter] = useState<'all' | 'unread' | 'read'>('all');

  // Protection anti-copie du cours TCF Canada lorsqu'il est affiché sur cette page
  useContentProtection({ enabled: selectedGroup === 'deroulement' });

  useEffect(() => {
    const tab = searchParams.get('tab') || searchParams.get('group');
    if (tab && COURSE_EPREUVE_GROUPS.some((g) => g.key === tab)) {
      setSelectedGroup(tab);
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        setLoading(true);
        // 1. Récupérer toutes les fiches ordonnées
        const { data: sheetsData, error: sheetsError } = await supabase
          .from('course_sheets')
          .select('*')
          .order('ordre_affichage', { ascending: true })
          .order('created_at', { ascending: true });

        // 2. Fusionner avec les fiches de cours intégrées par défaut
        // RÈGLE ABSOLUE POUR DÉROULEMENT DU TCF, CE, CO, EE, EO ET LES OUTILS & GRAMMAIRE :
        // Toujours utiliser les fiches officielles de référence intégrées.
        const isOfficialCategory = (epreuve: string) =>
          epreuve === 'DEROULEMENT_TCF' ||
          epreuve === 'CE' || epreuve.startsWith('CE') ||
          epreuve === 'CO' || epreuve.startsWith('CO') ||
          epreuve === 'EE' || epreuve.startsWith('EE') ||
          epreuve === 'EO' || epreuve.startsWith('EO') ||
          epreuve.startsWith('OUTILS');

        const officialPrioritySheets = DEFAULT_COURSE_SHEETS.filter(
          (s) => isOfficialCategory(s.epreuve)
        );

        const otherSheetsFromDb = (sheetsData || []).filter(
          (s) => !isOfficialCategory(s.epreuve)
        );

        const otherDefaultSheets = DEFAULT_COURSE_SHEETS.filter(
          (s) => !isOfficialCategory(s.epreuve)
        );

        const baseOtherSheets = otherSheetsFromDb.length > 0 ? [...otherSheetsFromDb] : [...otherDefaultSheets];
        const existingIds = new Set(baseOtherSheets.map((s) => s.id));
        for (const def of otherDefaultSheets) {
          if (!existingIds.has(def.id)) {
            baseOtherSheets.push(def);
          }
        }

        const combinedSheets: CourseSheet[] = [...officialPrioritySheets, ...baseOtherSheets];
        combinedSheets.sort((a, b) => (a.ordre_affichage ?? 0) - (b.ordre_affichage ?? 0));

        // 3. Récupérer les lectures de l'utilisateur
        const { data: readsData, error: readsError } = await supabase
          .from('course_sheet_reads')
          .select('sheet_id')
          .eq('user_id', user.id);

        if (readsError) console.warn('Lectures non disponibles:', readsError);

        const readIds = new Set((readsData || []).map((r) => r.sheet_id));
        setReadsSet(readIds);
        setSheets(combinedSheets);
      } catch (err) {
        console.error('Erreur chargement des fiches de cours:', err);
        setSheets(DEFAULT_COURSE_SHEETS);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user]);

  // Filtrage
  const filteredSheets = useMemo(() => {
    return sheets.filter((sheet) => {
      if (!canReadAllCourses && sheet.epreuve !== 'DEROULEMENT_TCF') {
        return false;
      }

      // 1. Recherche texte
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = sheet.titre.toLowerCase().includes(q);
        const matchContent = sheet.contenu.toLowerCase().includes(q);
        if (!matchTitle && !matchContent) return false;
      }

      // 2. Groupe d'épreuve
      if (selectedGroup !== 'all') {
        const group = COURSE_EPREUVE_GROUPS.find((g) => g.key === selectedGroup);
        if (group && group.epreuves.length > 0 && !group.epreuves.includes(sheet.epreuve)) {
          return false;
        }
      }

      // 3. Statut de lecture
      const isRead = readsSet.has(sheet.id);
      if (selectedReadFilter === 'read' && !isRead) return false;
      if (selectedReadFilter === 'unread' && isRead) return false;

      return true;
    });
  }, [sheets, readsSet, search, selectedGroup, selectedReadFilter, canReadAllCourses]);

  const totalCount = sheets.length;
  const readCount = sheets.filter((s) => readsSet.has(s.id)).length;
  const progressPercent = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;

  const handleToggleReadSheet = async (sheetId: string) => {
    if (!user) return;
    const isCurrentlyRead = readsSet.has(sheetId);
    const newSet = new Set(readsSet);
    if (isCurrentlyRead) {
      newSet.delete(sheetId);
    } else {
      newSet.add(sheetId);
    }
    setReadsSet(newSet);

    try {
      if (!isCurrentlyRead) {
        await supabase
          .from('course_sheet_reads')
          .insert({ user_id: user.id, sheet_id: sheetId });
        toast.success('Fiche marquée comme validée !');
      } else {
        await supabase
          .from('course_sheet_reads')
          .delete()
          .eq('user_id', user.id)
          .eq('sheet_id', sheetId);
        toast.info('Marquage de lecture retiré');
      }
    } catch (e) {
      console.warn('Erreur toggle lecture:', e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 fade-in">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe] text-xs font-heading font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#d97706]" />
            <span>Fiches Pédagogiques &amp; Méthodologie TCF</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a] tracking-tight">
            Fiches de Cours &amp; Stratégies
          </h1>
          <p className="text-xs sm:text-sm text-[#475569] mt-0.5 max-w-2xl">
            Règles officielles, grilles de notation FEI, pièges à éviter et plans types pour réussir les 4 épreuves du TCF Canada.
          </p>
        </div>

        {/* Bouton raccourci */}
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline" className="rounded-xl border-[#d3e4fe] text-[#0d233a] hover:bg-[#eff4ff]">
            <Link to="/etudiant/entrainement" className="gap-2">
              <BookOpen className="w-4 h-4 text-[#e53e3e]" />
              <span>Passer aux exercices</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* ═══ Progression de Lecture ═══ */}
      <Card className="rounded-2xl border border-[#e2e8f0] shadow-sm bg-gradient-to-br from-white to-[#f8fafc] overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-[#0d233a] text-white flex items-center justify-center font-heading font-bold shadow-sm shrink-0">
                <BookMarked className="w-6 h-6 text-[#d97706]" />
              </div>
              <div>
                <p className="font-heading font-bold text-base text-[#0d233a]">
                  Votre progression de lecture
                </p>
                <p className="text-xs sm:text-sm text-slate-500">
                  {readCount} sur {totalCount} fiche{totalCount > 1 ? 's' : ''} validée{readCount > 1 ? 's' : ''} ({progressPercent}%)
                </p>
              </div>
            </div>

            <div className="w-full sm:w-64 space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-slate-600">
                <span>Maîtrise méthodologique</span>
                <span className="text-[#d97706] font-bold">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2.5 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-[#d97706] [&>div]:to-[#e53e3e]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Barre de Filtres & Recherche ═══ */}
      <div className="space-y-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        {/* Recherche et Filtre Statut */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par titre, mot-clé, connecteur, consigne..."
              className="pl-10 h-10 rounded-xl bg-slate-50/70 border-slate-200 text-sm focus-visible:ring-[#0d233a]"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSelectedReadFilter('all')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                selectedReadFilter === 'all'
                  ? 'bg-white text-[#0d233a] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Toutes ({sheets.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedReadFilter('unread')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                selectedReadFilter === 'unread'
                  ? 'bg-white text-[#0d233a] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              À lire ({sheets.length - readCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedReadFilter('read')}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                selectedReadFilter === 'read'
                  ? 'bg-white text-[#0d233a] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              Lues ({readCount})
            </button>
          </div>
        </div>

        {/* Filtres par Épreuve */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 scrollbar-none">
          {COURSE_EPREUVE_GROUPS.map((group) => {
            const isActive = selectedGroup === group.key;
            const isLockedGroup = !subLoading && !canReadAllCourses && group.key !== 'deroulement';
            return (
              <button
                type="button"
                key={group.key}
                onClick={() => {
                  setSelectedGroup(group.key);
                  setSearchParams(
                    (prev) => {
                      const next = new URLSearchParams(prev);
                      next.set('tab', group.key);
                      return next;
                    },
                    { replace: true }
                  );
                }}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-heading font-semibold whitespace-nowrap transition-all border inline-flex items-center gap-1.5',
                  isActive
                    ? 'bg-[#0d233a] text-white border-[#0d233a] shadow-xs'
                    : isLockedGroup
                    ? 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900'
                )}
              >
                {isLockedGroup && <Lock className="w-3 h-3 shrink-0" />}
                <span>{group.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ Contenu : Vue Directe TCF Canada ou Grille de Fiches ═══ */}
      {!subLoading && !canReadAllCourses && selectedGroup !== 'deroulement' ? (
        <SubscriptionGate
          fallbackTitle="Fiches réservées aux abonnés"
          fallbackDescription="Sans abonnement actif, seule la fiche de présentation du TCF Canada est accessible. Souscrivez à une formule pour débloquer toutes les fiches (Compréhension, Expression Écrite, Expression Orale, Outils & Grammaire)."
        >
          <></>
        </SubscriptionGate>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : filteredSheets.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2 border-slate-200 p-8 text-center bg-slate-50/50">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="font-heading font-bold text-base text-slate-700">Aucune fiche trouvée</p>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Essayez de réinitialiser vos filtres ou de modifier votre recherche.
          </p>
          <Button
            variant="outline"
            className="mt-4 rounded-xl text-xs"
            onClick={() => {
              setSearch('');
              setSelectedGroup('deroulement');
              setSelectedReadFilter('all');
            }}
          >
            Réinitialiser les filtres
          </Button>
        </Card>
      ) : selectedGroup === 'deroulement' ? (
        /* VUE DIRECTE DU COURS TCF CANADA (SANS APERÇU) */
        (() => {
          const tcfSheet = filteredSheets[0];
          const isRead = readsSet.has(tcfSheet.id);
          // Nettoyage absolu des barres verticales
          const sanitizedContent = tcfSheet.contenu
            .replace(/\r\n/g, '\n')
            .replace(/^\|(\s*:?-+:?\s*\|)+$/gm, '')
            .replace(/^\s*\|\s*/gm, '* ')
            .replace(/\s*\|\s*$/gm, '')
            .replace(/\s*\|\s*/g, ' — ')
            .replace(/\|/g, ' ');

          return (
            <Card className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden protected-course-content select-none">
              <CardHeader className="p-6 sm:p-8 bg-gradient-to-br from-red-50/60 via-white to-slate-50/50 border-b border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full text-xs font-heading font-bold bg-red-100 text-red-800 border border-red-200">
                      TCF Canada
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      ~6 min de lecture
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant={isRead ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => handleToggleReadSheet(tcfSheet.id)}
                      className={cn(
                        'rounded-xl text-xs font-heading font-semibold gap-1.5 transition-all',
                        isRead
                          ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                          : 'bg-[#0d233a] hover:bg-[#1a365d] text-white shadow-xs'
                      )}
                    >
                      {isRead ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Fiche validée</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Marquer comme lu</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 sm:p-10">
                <div className="max-w-4xl mx-auto">
                  <MarkdownViewer content={sanitizedContent} />
                </div>
              </CardContent>
            </Card>
          );
        })()
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSheets.map((sheet) => {
            const isRead = readsSet.has(sheet.id);
            const badgeStyle = getEpreuveBadgeStyle(sheet.epreuve);
            const epreuveLabel = COURSE_EPREUVE_LABELS[sheet.epreuve] || sheet.epreuve;
            // Extrait de texte épuré sans balises Markdown ni barres verticales de tableau
            const cleanExcerpt = sheet.contenu
              .replace(/\r\n/g, '\n')
              .replace(/^#+\s+/gm, '')
              .replace(/^>\s*/gm, '')
              .replace(/^\|(\s*:?-+:?\s*\|)+$/gm, '') // Lignes de délimitation de tableau
              .replace(/^\s*\|\s*/gm, '')             // Débuts de ligne tableau
              .replace(/\s*\|\s*$/gm, '')             // Fins de ligne tableau
              .replace(/\s*\|\s*/g, ' — ')            // Séparateurs de colonnes
              .replace(/\|/g, ' ')                   // Barres verticales restantes
              .replace(/[-:]{3,}/g, '')
              .replace(/\*\*|__|\*/g, '')
              .replace(/`.*?`/g, '')
              .replace(/\[\s*\]/g, '')
              .replace(/\[x\]/g, '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 140) + '...';

            return (
              <Card
                key={sheet.id}
                className={cn(
                  'rounded-2xl border transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden group',
                  isRead
                    ? 'bg-white border-emerald-100 hover:border-emerald-300'
                    : 'bg-white border-slate-200 hover:border-[#0d233a]/30'
                )}
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={cn('px-2.5 py-0.5 rounded-md text-[11px] font-heading font-bold border', badgeStyle.bg, badgeStyle.text, badgeStyle.border)}>
                        {epreuveLabel}
                      </span>
                    </div>

                    {isRead ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Lu</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>À lire</span>
                      </span>
                    )}
                  </div>

                  <CardTitle className="font-heading font-bold text-base sm:text-lg text-[#0d233a] leading-snug group-hover:text-[#e53e3e] transition-colors">
                    <Link to={`/etudiant/cours/${sheet.id}?tab=${selectedGroup}`}>{sheet.titre}</Link>
                  </CardTitle>

                  <CardDescription className="text-xs sm:text-sm text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">
                    {cleanExcerpt}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 pt-0 flex items-center justify-between border-t border-slate-100 mt-3 pt-3 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>~4 min de lecture</span>
                    {sheet.fichier_pdf_url && (
                      <span className="inline-flex items-center gap-1 ml-2 text-blue-600 font-medium">
                        <FileText className="w-3.5 h-3.5" />
                        PDF inclus
                      </span>
                    )}
                  </div>

                  <Button asChild size="sm" className="rounded-xl bg-[#0d233a] hover:bg-[#1a365d] text-white gap-1 text-xs font-heading font-semibold shadow-xs">
                    <Link to={`/etudiant/cours/${sheet.id}?tab=${selectedGroup}`}>
                      <span>Lire la fiche</span>
                      <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
