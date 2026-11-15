import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { MarkdownViewer } from '@/components/common/MarkdownViewer';
import {
  BookMarked, Plus, Pencil, Trash2, Search, Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import type { CourseSheet, CourseEpreuve, NiveauCECRL } from '@/types/index';
import { COURSE_EPREUVE_LABELS } from '@/types/index';

const EPREUVE_OPTIONS: { value: CourseEpreuve; label: string }[] = [
  { value: 'DEROULEMENT_TCF', label: 'TCF Canada — Déroulement & Barème' },
  { value: 'CE', label: 'Compréhension Écrite (CE)' },
  { value: 'CO', label: 'Compréhension Orale (CO)' },
  { value: 'EE', label: 'Expression Écrite — Méthodologie Complète (EE)' },
  { value: 'EE_tache1', label: 'Expression Écrite — Tâche 1 (Message)' },
  { value: 'EE_tache2', label: 'Expression Écrite — Tâche 2 (Récit/Article)' },
  { value: 'EE_tache3', label: 'Expression Écrite — Tâche 3 (Argumentation)' },
  { value: 'EO', label: 'Expression Orale — Méthodologie Complète (EO)' },
  { value: 'EO_tache1', label: 'Expression Orale — Tâche 1 (Entretien guidé)' },
  { value: 'EO_tache2', label: 'Expression Orale — Tâche 2 (Questions/Interaction)' },
  { value: 'EO_tache3', label: 'Expression Orale — Tâche 3 (Point de vue)' },
  { value: 'OUTILS_CONNECTEURS', label: 'Outils — Connecteurs Logiques' },
  { value: 'OUTILS_EXPRESSIONS', label: 'Outils — Expressions Utiles' },
  { value: 'OUTILS_TEMPS', label: 'Outils — Passé composé & Imparfait' },
  { value: 'OUTILS_ACCORDS', label: 'Outils — Les Accords Essentiels' },
];

const NIVEAU_OPTIONS: NiveauCECRL[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

function isSafeResourceUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('/')) return !trimmed.startsWith('//');
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export default function CoursAdminPage() {
  const { isAdmin } = useAuth();
  const [sheets, setSheets] = useState<CourseSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEpreuve, setFilterEpreuve] = useState<string>('all');

  // Modal création / édition
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSheet, setEditingSheet] = useState<CourseSheet | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewTab, setPreviewTab] = useState<'edit' | 'preview'>('edit');

  // Formulaire
  const [form, setForm] = useState({
    titre: '',
    epreuve: 'CE' as CourseEpreuve,
    niveau: 'B2' as NiveauCECRL,
    ordre_affichage: 0,
    fichier_pdf_url: '',
    contenu: '',
  });

  const fetchSheets = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('course_sheets')
        .select('*')
        .order('ordre_affichage', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSheets(data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(`Erreur chargement des fiches: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  const handleOpenAdd = () => {
    setEditingSheet(null);
    setForm({
      titre: '',
      epreuve: 'CE',
      niveau: 'B2',
      ordre_affichage: sheets.length + 1,
      fichier_pdf_url: '',
      contenu: '# Titre de la fiche\n\nIntroduction...\n\n### 1. Points clés\n* Règle 1\n* Règle 2\n\n> **Conseil du Coach** : Astuce méthodologique...',
    });
    setPreviewTab('edit');
    setDialogOpen(true);
  };

  const handleOpenEdit = (sheet: CourseSheet) => {
    setEditingSheet(sheet);
    setForm({
      titre: sheet.titre,
      epreuve: sheet.epreuve,
      niveau: sheet.niveau,
      ordre_affichage: sheet.ordre_affichage || 0,
      fichier_pdf_url: sheet.fichier_pdf_url || '',
      contenu: sheet.contenu,
    });
    setPreviewTab('edit');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error('Action réservée aux administrateurs.');
      return;
    }
    if (!form.titre.trim() || !form.contenu.trim()) {
      toast.error('Le titre et le contenu sont obligatoires.');
      return;
    }
    if (form.fichier_pdf_url.trim() && !isSafeResourceUrl(form.fichier_pdf_url)) {
      toast.error('Le lien PDF doit être une URL valide (https:// ou /media/...).');
      return;
    }

    setSaving(true);
    try {
      if (editingSheet) {
        // Mise à jour
        const { error } = await supabase
          .from('course_sheets')
          .update({
            titre: form.titre.trim(),
            epreuve: form.epreuve,
            niveau: form.niveau,
            ordre_affichage: Number(form.ordre_affichage) || 0,
            fichier_pdf_url: form.fichier_pdf_url.trim() || null,
            contenu: form.contenu,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingSheet.id);

        if (error) throw error;
        toast.success('Fiche pédagogique modifiée avec succès.');
      } else {
        // Création
        const { error } = await supabase
          .from('course_sheets')
          .insert({
            titre: form.titre.trim(),
            epreuve: form.epreuve,
            niveau: form.niveau,
            ordre_affichage: Number(form.ordre_affichage) || 0,
            fichier_pdf_url: form.fichier_pdf_url.trim() || null,
            contenu: form.contenu,
          });

        if (error) throw error;
        toast.success('Nouvelle fiche pédagogique ajoutée.');
      }

      setDialogOpen(false);
      fetchSheets();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(`Erreur lors de la sauvegarde: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sheetId: string) => {
    if (!isAdmin) {
      toast.error('Action réservée aux administrateurs.');
      return;
    }
    try {
      const { error } = await supabase
        .from('course_sheets')
        .delete()
        .eq('id', sheetId);

      if (error) throw error;
      toast.success('Fiche supprimée.');
      setSheets((prev) => prev.filter((s) => s.id !== sheetId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      toast.error(`Erreur lors de la suppression: ${msg}`);
    }
  };

  const filteredSheets = sheets.filter((sheet) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const match = sheet.titre.toLowerCase().includes(q) || sheet.contenu.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filterEpreuve !== 'all' && sheet.epreuve !== filterEpreuve) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 fade-in">
      {/* ═══ Header ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe] text-xs font-heading font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5 text-[#d97706]" />
            <span>Gestion Pédagogique Mon TCFCA</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a] tracking-tight">
            Gestion des Fiches de Cours
          </h1>
          <p className="text-xs sm:text-sm text-[#475569]">
            Créez, enrichissez et organisez les fiches de méthodologie accessibles aux étudiants.
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="rounded-xl bg-[#0d233a] hover:bg-[#1a365d] text-white gap-2 font-heading font-semibold shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Ajouter une fiche</span>
        </Button>
      </div>

      {/* ═══ Filtres ═══ */}
      <Card className="rounded-2xl border border-slate-200 shadow-xs bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une fiche..."
              className="pl-9 h-10 rounded-xl text-sm"
            />
          </div>

          <Select value={filterEpreuve} onValueChange={setFilterEpreuve}>
            <SelectTrigger className="h-10 rounded-xl">
              <SelectValue placeholder="Toutes les épreuves" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les épreuves</SelectItem>
              {EPREUVE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* ═══ Liste des Fiches ═══ */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : filteredSheets.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-2 border-slate-200 p-8 text-center bg-slate-50">
          <BookMarked className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="font-heading font-bold text-base text-slate-700">Aucune fiche de cours</p>
          <p className="text-xs text-slate-500 mt-1">Créez votre première fiche méthodologique pour vos étudiants.</p>
          <Button onClick={handleOpenAdd} className="mt-4 rounded-xl bg-[#0d233a] text-white text-xs">
            Créer une fiche
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSheets.map((sheet) => {
            const epreuveLabel = COURSE_EPREUVE_LABELS[sheet.epreuve] || sheet.epreuve;
            return (
              <div
                key={sheet.id}
                className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-[#0d233a]/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs font-semibold">
                      Ordre #{sheet.ordre_affichage || 0}
                    </Badge>
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-heading font-bold bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe]">
                      {epreuveLabel}
                    </span>
                    {sheet.fichier_pdf_url && (
                      <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px]">
                        PDF joint
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-heading font-bold text-base text-[#0d233a] truncate">
                    {sheet.titre}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs gap-1"
                    onClick={() => handleOpenEdit(sheet)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Modifier</span>
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="rounded-xl text-xs text-red-600 hover:bg-red-50 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette fiche ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Êtes-vous sûr de vouloir supprimer « {sheet.titre} » ? Cette action est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(sheet.id)}
                          className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ Modal Création / Édition ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-heading font-bold text-[#0d233a]">
              {editingSheet ? 'Modifier la fiche pédagogique' : 'Nouvelle fiche pédagogique'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Titre */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Titre de la fiche *</Label>
              <Input
                value={form.titre}
                onChange={(e) => setForm({ ...form, titre: e.target.value })}
                placeholder="Ex: Stratégies de lecture rapide et connecteurs logiques..."
                className="rounded-xl"
              />
            </div>

            {/* Épreuve, Niveau & Ordre */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Épreuve cible *</Label>
                <Select
                  value={form.epreuve}
                  onValueChange={(val: CourseEpreuve) => setForm({ ...form, epreuve: val })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EPREUVE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Niveau CECRL *</Label>
                <Select
                  value={form.niveau}
                  onValueChange={(val: NiveauCECRL) => setForm({ ...form, niveau: val })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NIVEAU_OPTIONS.map((lvl) => (
                      <SelectItem key={lvl} value={lvl}>
                        Niveau {lvl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Ordre d'affichage</Label>
                <Input
                  type="number"
                  value={form.ordre_affichage}
                  onChange={(e) => setForm({ ...form, ordre_affichage: parseInt(e.target.value, 10) || 0 })}
                  className="rounded-xl"
                />
              </div>
            </div>

            {/* Fichier PDF URL */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Lien du fichier PDF complémentaire (optionnel)</Label>
              <Input
                value={form.fichier_pdf_url}
                onChange={(e) => setForm({ ...form, fichier_pdf_url: e.target.value })}
                placeholder="https://... ou /media/documents/..."
                className="rounded-xl"
              />
            </div>

            {/* Onglets Édition / Prévisualisation Markdown */}
            <div className="space-y-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Contenu de la fiche (Markdown) *</Label>
                <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setPreviewTab('edit')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      previewTab === 'edit' ? 'bg-white text-[#0d233a] shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Éditeur
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTab('preview')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      previewTab === 'preview' ? 'bg-white text-[#0d233a] shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Aperçu en direct
                  </button>
                </div>
              </div>

              {previewTab === 'edit' ? (
                <Textarea
                  value={form.contenu}
                  onChange={(e) => setForm({ ...form, contenu: e.target.value })}
                  rows={14}
                  className="rounded-xl font-mono text-xs leading-relaxed"
                  placeholder="Rédigez en Markdown (# Titres, ## Sous-titres, * Listes, > **Conseil** : ...)"
                />
              ) : (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 min-h-[300px] max-h-[400px] overflow-y-auto">
                  <MarkdownViewer content={form.contenu} />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-[#0d233a] hover:bg-[#1a365d] text-white"
            >
              {saving ? 'Enregistrement...' : editingSheet ? 'Mettre à jour' : 'Créer la fiche'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
