import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MarkdownViewer } from '@/components/common/MarkdownViewer';
import {
  ChevronLeft, ChevronRight, CheckCircle2, Clock,
  BookOpen, BookMarked, ArrowLeft, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { CourseSheet } from '@/types/index';
import { COURSE_EPREUVE_LABELS, COURSE_EPREUVE_GROUPS } from '@/types/index';
import { DEFAULT_COURSE_SHEETS } from '@/data/defaultCourseSheets';
import { useContentProtection } from '@/hooks/useContentProtection';
import { useSubscription } from '@/hooks/useSubscription';
import { SubscriptionGate } from '@/components/common/SubscriptionGate';

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasActiveSubscription, isAdmin, loading: subLoading } = useSubscription();
  const canReadAllCourses = isAdmin || hasActiveSubscription;

  // Empêchement complet et absolu de copier le contenu de la fiche de cours
  useContentProtection();

  const [searchParams] = useSearchParams();

  const [sheet, setSheet] = useState<CourseSheet | null>(null);
  const [allSheets, setAllSheets] = useState<{ id: string; titre: string }[]>([]);
  const [isRead, setIsRead] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingRead, setUpdatingRead] = useState(false);

  // Déterminer le sélecteur / groupe d'origine de la fiche
  const fromTab = searchParams.get('tab') || searchParams.get('group');
  const parentGroup = sheet
    ? COURSE_EPREUVE_GROUPS.find((g) => g.epreuves.includes(sheet.epreuve))
    : null;

  const targetGroupKey = (fromTab && COURSE_EPREUVE_GROUPS.some((g) => g.key === fromTab))
    ? fromTab
    : (parentGroup ? parentGroup.key : 'deroulement');

  const targetGroup = COURSE_EPREUVE_GROUPS.find((g) => g.key === targetGroupKey);
  const targetGroupLabel = targetGroup ? targetGroup.label : 'TCF Canada';

  useEffect(() => {
    async function loadSheet() {
      if (!id || !user) return;
      try {
        setLoading(true);
        // Résolution d'alias (anciens slugs vers UUIDs officiels)
        const ID_ALIASES: Record<string, string> = {
          'cours-tcf-canada-deroulement': 'tcf-canada-deroulement-officiel',
          'cours-ee-epreuve-totale': 'ee000000-0000-0000-0000-000000000001',
          'cours-ee-tache1': 'ee000000-0000-0000-0000-000000000002',
          'cours-ee-tache2': 'ee000000-0000-0000-0000-000000000003',
          'cours-ee-tache3': 'ee000000-0000-0000-0000-000000000004',
          'cours-connecteurs-logiques': 'og000000-0000-0000-0000-000000000001',
          'ee000000-0000-0000-0000-000000000005': 'og000000-0000-0000-0000-000000000001',
          'cours-expressions-utiles': 'og000000-0000-0000-0000-000000000002',
          'ee000000-0000-0000-0000-000000000006': 'og000000-0000-0000-0000-000000000002',
          'cours-passe-compose-imparfait': 'og000000-0000-0000-0000-000000000003',
          'ee000000-0000-0000-0000-000000000007': 'og000000-0000-0000-0000-000000000003',
          'cours-accords-essentiels': 'og000000-0000-0000-0000-000000000004',
          'ee000000-0000-0000-0000-000000000008': 'og000000-0000-0000-0000-000000000004',
          'cours-eo-epreuve-totale': 'e0000000-0000-0000-0000-000000000001',
          'eo000000-0000-0000-0000-000000000001': 'e0000000-0000-0000-0000-000000000001',
          'cours-eo-tache1': 'e0000000-0000-0000-0000-000000000002',
          'cours-eo-tache1-guide': 'e0000000-0000-0000-0000-000000000002',
          'eo000000-0000-0000-0000-000000000002': 'e0000000-0000-0000-0000-000000000002',
          'cours-eo-tache2': 'e0000000-0000-0000-0000-000000000003',
          'cours-eo-tache2-guide': 'e0000000-0000-0000-0000-000000000003',
          'eo000000-0000-0000-0000-000000000003': 'e0000000-0000-0000-0000-000000000003',
          'cours-eo-tache3': 'e0000000-0000-0000-0000-000000000004',
          'cours-eo-tache3-guide': 'e0000000-0000-0000-0000-000000000004',
          'eo000000-0000-0000-0000-000000000004': 'e0000000-0000-0000-0000-000000000004',
          'cours-ce-lecture-rapide': 'ce000000-0000-0000-0000-000000000001',
          'cours-ce-methode': 'ce000000-0000-0000-0000-000000000001',
          'cours-ce-pieges': 'ce000000-0000-0000-0000-000000000002',
          'cours-co-ecoute-active': 'c0000000-0000-0000-0000-000000000001',
          'cours-co-methode': 'c0000000-0000-0000-0000-000000000001',
        };
        const targetId = ID_ALIASES[id] || id;

        // 1. Récupérer la fiche depuis les fiches intégrées ou Supabase
        // Règle absolue pour Déroulement TCF, CE, CO, EE, EO et les fiches d'Outils & Grammaire :
        // Toujours utiliser la version officielle épurée et sans aucune barre verticale.
        const isOfficialCategory = (epreuve: string) =>
          epreuve === 'DEROULEMENT_TCF' ||
          epreuve === 'CE' || epreuve.startsWith('CE') ||
          epreuve === 'CO' || epreuve.startsWith('CO') ||
          epreuve === 'EE' || epreuve.startsWith('EE') ||
          epreuve === 'EO' || epreuve.startsWith('EO') ||
          epreuve.startsWith('OUTILS');

        const officialPrioritySheet = DEFAULT_COURSE_SHEETS.find(
          (s) => (s.id === targetId || s.id === id) && isOfficialCategory(s.epreuve)
        );

        let foundSheet: CourseSheet | null = officialPrioritySheet || null;

        if (!foundSheet) {
          try {
            const { data: sheetData } = await supabase
              .from('course_sheets')
              .select('*')
              .eq('id', targetId)
              .maybeSingle();
            if (sheetData) foundSheet = sheetData;
          } catch (e) {
            console.warn('Erreur lecture supabase course_sheets:', e);
          }
        }

        if (!foundSheet) {
          const fallback = DEFAULT_COURSE_SHEETS.find(
            (s) => s.id === targetId || s.id === id
          );
          if (fallback) foundSheet = fallback;
        }

        if (!foundSheet) {
          toast.error('Fiche pédagogique introuvable');
          navigate('/etudiant/cours');
          return;
        }

        // Nettoyage absolu : transformer toute barre verticale ou syntaxe de tableau résiduelle en liste fluide épurée
        const sanitizedContent = foundSheet.contenu
          .replace(/\r\n/g, '\n')
          .replace(/^\|(\s*:?-+:?\s*\|)+$/gm, '') // Supprime les délimiteurs de tableau |---|---|
          .replace(/^\s*\|\s*/gm, '* ')           // Remplace début de ligne tableau par puce
          .replace(/\s*\|\s*$/gm, '')             // Supprime la fin de ligne tableau
          .replace(/\s*\|\s*/g, ' — ')            // Remplace les séparateurs internes par tiret cadratin
          .replace(/\|/g, ' ');                   // Supprime toute barre verticale isolée restante

        setSheet({
          ...foundSheet,
          contenu: sanitizedContent,
        });

        // 2. Vérifier si lue
        try {
          const { data: readData } = await supabase
            .from('course_sheet_reads')
            .select('id')
            .eq('user_id', user.id)
            .eq('sheet_id', foundSheet.id)
            .maybeSingle();

          setIsRead(!!readData);
        } catch (e) {
          // Mode déconnecté ou id local
          const localReads = JSON.parse(localStorage.getItem('mon_tcfca_read_sheets') || '[]');
          setIsRead(localReads.includes(foundSheet.id) || localReads.includes(id));
        }

        // 3. Charger la liste globale pour la pagination suivante/précédente
        let fullList: { id: string; titre: string }[] = [];
        try {
          const { data: allList } = await supabase
            .from('course_sheets')
            .select('id, titre, epreuve')
            .order('ordre_affichage', { ascending: true })
            .order('created_at', { ascending: true });
          if (Array.isArray(allList)) {
            // Exclure les anciennes fiches officielles résiduelles en DB
            fullList = allList.filter(
              (s: any) => !isOfficialCategory(s.epreuve || '')
            );
          }
        } catch (e) {}

        const priorityOfficialSheets = DEFAULT_COURSE_SHEETS.filter(
          (s) => isOfficialCategory(s.epreuve)
        );

        // Ajouter les fiches par défaut nécessaires
        for (const def of DEFAULT_COURSE_SHEETS) {
          if (
            !fullList.some((s) => s.id === def.id) &&
            !isOfficialCategory(def.epreuve)
          ) {
            fullList.push({ id: def.id, titre: def.titre });
          }
        }

        // Placer les fiches officielles EE, EO et OUTILS en tête
        const finalNavList = [
          ...priorityOfficialSheets.map((s) => ({ id: s.id, titre: s.titre })),
          ...fullList
        ];

        setAllSheets(finalNavList);
      } catch (err) {
        console.error('Erreur chargement fiche:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSheet();
  }, [id, user, navigate]);

  const handleToggleRead = async () => {
    if (!sheet || !user || updatingRead) return;
    setUpdatingRead(true);
    const newStatus = !isRead;
    setIsRead(newStatus);

    try {
      if (newStatus) {
        // Marquer comme lu
        const { error } = await supabase
          .from('course_sheet_reads')
          .insert({ user_id: user.id, sheet_id: sheet.id });
        if (error && error.code !== '23505') throw error;
        toast.success('Fiche marquée comme validée !');
      } else {
        // Retirer la lecture
        const { error } = await supabase
          .from('course_sheet_reads')
          .delete()
          .eq('user_id', user.id)
          .eq('sheet_id', sheet.id);
        if (error) throw error;
        toast.info('Fiche marquée comme non lue.');
      }
    } catch (err: any) {
      setIsRead(!newStatus);
      toast.error('Erreur lors de la mise à jour: ' + (err?.message || 'Erreur'));
    } finally {
      setUpdatingRead(false);
    }
  };

  // Pagination suivante / précédente
  const currentIndex = allSheets.findIndex((s) => s.id === (sheet?.id || id));
  const prevSheet = currentIndex > 0 ? allSheets[currentIndex - 1] : null;
  const nextSheet = currentIndex >= 0 && currentIndex < allSheets.length - 1 ? allSheets[currentIndex + 1] : null;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 pb-16">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!sheet) return null;

  if (!subLoading && !canReadAllCourses && sheet.epreuve !== 'DEROULEMENT_TCF') {
    return (
      <SubscriptionGate
        fallbackTitle="Fiche de cours réservée aux abonnés"
        fallbackDescription="Sans abonnement actif, seule la fiche de présentation TCF Canada est accessible. Souscrivez ou renouvelez votre abonnement pour consulter cette fiche."
      >
        <></>
      </SubscriptionGate>
    );
  }

  const epreuveLabel = COURSE_EPREUVE_LABELS[sheet.epreuve] || sheet.epreuve;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 fade-in">
      {/* ═══ Fil d'Ariane & Retour ═══ */}
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" className="rounded-xl gap-2 text-slate-600 hover:text-[#0d233a] hover:bg-slate-100">
          <Link to={`/etudiant/cours?tab=${targetGroupKey}`}>
            <ArrowLeft className="w-4 h-4" />
            <span>Retour à {targetGroupLabel}</span>
          </Link>
        </Button>

        {/* Bouton Marquer comme lu */}
        <Button
          onClick={handleToggleRead}
          disabled={updatingRead}
          variant={isRead ? 'outline' : 'default'}
          className={cn(
            'rounded-xl text-xs sm:text-sm font-heading font-semibold gap-2 shadow-xs transition-all',
            isRead
              ? 'border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
              : 'bg-[#0d233a] hover:bg-[#1a365d] text-white'
          )}
        >
          <CheckCircle2 className={cn('w-4 h-4', isRead ? 'text-emerald-600' : 'text-[#d97706]')} />
          <span>{isRead ? 'Fiche lue et validée' : 'Marquer comme lu'}</span>
        </Button>
      </div>

      {/* ═══ En-tête de la Fiche ═══ */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white overflow-hidden protected-course-content select-none">
        <CardHeader className="p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-lg text-xs font-heading font-bold bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe]">
              {epreuveLabel}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 ml-auto">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>~4 minutes de lecture</span>
            </span>
          </div>

          <CardTitle className="text-xl sm:text-3xl font-heading font-extrabold text-[#0d233a] leading-tight">
            {sheet.titre}
          </CardTitle>
        </CardHeader>
      </Card>

      {/* ═══ Contenu Markdown Riche ═══ */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white protected-course-content select-none">
        <CardContent className="p-6 sm:p-10">
          <MarkdownViewer content={sheet.contenu} />

          {/* Pièce jointe PDF si présente */}
          {sheet.fichier_pdf_url && (
            <div className="mt-10 p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
                  PDF
                </div>
                <div>
                  <p className="font-heading font-bold text-sm text-[#0d233a]">Document ressource complémentaire</p>
                  <p className="text-xs text-slate-500">Guide ou grille officielle téléchargeable</p>
                </div>
              </div>
              <Button asChild variant="outline" className="rounded-xl border-slate-300 gap-2 text-xs">
                <a href={sheet.fichier_pdf_url} target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4 text-[#0d233a]" />
                  <span>Télécharger le PDF</span>
                </a>
              </Button>
            </div>
          )}

          {/* Validation de fin de page */}
          <div className="mt-12 pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 p-4 rounded-xl">
            <div>
              <p className="font-heading font-bold text-sm text-[#0d233a]">Avez-vous assimilé cette méthode ?</p>
              <p className="text-xs text-slate-500">Validez votre lecture pour suivre votre progression.</p>
            </div>
            <Button
              onClick={handleToggleRead}
              disabled={updatingRead}
              className={cn(
                'rounded-xl text-xs sm:text-sm font-heading font-semibold gap-2 shadow-xs',
                isRead
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-[#0d233a] hover:bg-[#1a365d] text-white'
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isRead ? 'Fiche déjà validée' : 'Marquer comme lu & compris'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Navigation Fiche Précédente / Suivante ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
        {prevSheet ? (
          <Link
            to={`/etudiant/cours/${prevSheet.id}?tab=${targetGroupKey}`}
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#0d233a] transition-all flex items-center gap-3 group"
          >
            <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-[#0d233a] transition-transform group-hover:-translate-x-1 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Fiche précédente</span>
              <p className="font-heading font-bold text-sm text-[#0d233a] truncate">{prevSheet.titre}</p>
            </div>
          </Link>
        ) : <div />}

        {nextSheet && (
          <Link
            to={`/etudiant/cours/${nextSheet.id}?tab=${targetGroupKey}`}
            className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-[#0d233a] transition-all flex items-center justify-between gap-3 group text-right sm:col-start-2"
          >
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Fiche suivante</span>
              <p className="font-heading font-bold text-sm text-[#0d233a] truncate">{nextSheet.titre}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#0d233a] transition-transform group-hover:translate-x-1 shrink-0" />
          </Link>
        )}
      </div>
    </div>
  );
}
