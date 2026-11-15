import { useEffect } from 'react';
import { toast } from 'sonner';

interface ContentProtectionOptions {
  /**
   * Sélecteur CSS de la zone à protéger (par défaut '.protected-course-content')
   */
  containerSelector?: string;
  /**
   * Activer ou désactiver la protection (par défaut true)
   */
  enabled?: boolean;
}

/**
 * Hook garantissant l'empêchement complet et absolu de copier le contenu
 * des fiches de cours, même si du texte a été sélectionné ou surligné.
 */
export function useContentProtection(options: ContentProtectionOptions = {}) {
  const { containerSelector = '.protected-course-content', enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    // Détermine si un noeud ou une sélection est dans la zone protégée
    const isInsideProtected = (node: Node | null): boolean => {
      if (!node) return false;
      const el = node instanceof HTMLElement ? node : node.parentElement;
      return !!el?.closest(containerSelector);
    };

    const hasProtectedSelection = (): boolean => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return false;
      }
      return (
        isInsideProtected(selection.anchorNode) ||
        isInsideProtected(selection.focusNode)
      );
    };

    // 1. Interception absolue de l'événement COPY (phase de capture)
    const handleCopy = (e: ClipboardEvent) => {
      // Si la copie concerne la sélection dans le cours ou si la page contient la zone protégée
      const selection = window.getSelection();
      const inProtected = hasProtectedSelection() || (document.activeElement && isInsideProtected(document.activeElement));

      if (inProtected || isInsideProtected(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Vider intégralement le presse-papier
        if (e.clipboardData) {
          e.clipboardData.clearData();
          e.clipboardData.setData('text/plain', '');
        }

        // Dissoudre immédiatement la sélection à l'écran
        if (selection) {
          selection.removeAllRanges();
        }

        toast.error('La copie du contenu des fiches de cours officielles est strictement désactivée.', {
          id: 'anti-copy-toast',
          duration: 3000,
        });
      }
    };

    // 2. Interception de l'événement CUT (phase de capture)
    const handleCut = (e: ClipboardEvent) => {
      if (hasProtectedSelection() || isInsideProtected(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (e.clipboardData) {
          e.clipboardData.clearData();
          e.clipboardData.setData('text/plain', '');
        }
        window.getSelection()?.removeAllRanges();
      }
    };

    // 3. Interception des raccourcis clavier (Ctrl+C, Cmd+C, etc.)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.ctrlKey || e.metaKey;
      if (!isModifier) return;

      const key = e.key.toLowerCase();

      // Raccourcis sensibles : c (copier), x (couper), a (tout sélectionner), p (imprimer), s (sauvegarder), u (code source)
      if (['c', 'x', 'a', 'p', 's', 'u'].includes(key)) {
        const inProtected = hasProtectedSelection() || isInsideProtected(e.target as Node) || isInsideProtected(document.activeElement);

        if (inProtected || key === 'c' || key === 'x' || key === 'p') {
          // Si une sélection touche la zone protégée ou qu'on est sur la fiche
          if (hasProtectedSelection() || isInsideProtected(document.querySelector(containerSelector))) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Purger toute sélection
            window.getSelection()?.removeAllRanges();

            if (key === 'c' || key === 'x') {
              toast.error('La copie de ce cours officiel est protégée et désactivée.', {
                id: 'anti-copy-toast',
                duration: 3000,
              });
            } else if (key === 'p') {
              toast.error("L'impression des fiches de cours officielles est désactivée.", {
                id: 'anti-print-toast',
                duration: 3000,
              });
            }
          }
        }
      }
    };

    // 4. Interception du clic droit / menu contextuel sur la zone protégée
    const handleContextMenu = (e: MouseEvent) => {
      if (isInsideProtected(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
        window.getSelection()?.removeAllRanges();
        toast.error('Le menu contextuel et la copie sont désactivés sur cette fiche.', {
          id: 'anti-context-toast',
          duration: 2500,
        });
      }
    };

    // 5. Interception du glisser-déposer de texte (Drag & Drop)
    const handleDragStart = (e: DragEvent) => {
      if (isInsideProtected(e.target as Node) || hasProtectedSelection()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 6. Dissolution automatique de toute tentative de sélection dans la zone protégée
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;

      if (isInsideProtected(selection.anchorNode) || isInsideProtected(selection.focusNode)) {
        // Dès qu'on tente de sélectionner du texte dans la zone protégée, on dissout la sélection
        selection.removeAllRanges();
      }
    };

    // Attachement des écouteurs en phase de capture (true) pour avoir la priorité absolue
    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCut, true);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('dragstart', handleDragStart, true);
    document.addEventListener('selectionchange', handleSelectionChange, true);

    return () => {
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('dragstart', handleDragStart, true);
      document.removeEventListener('selectionchange', handleSelectionChange, true);
    };
  }, [containerSelector, enabled]);
}
