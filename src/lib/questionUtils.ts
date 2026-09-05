import type { Question } from '@/types/index';

/**
 * Extrait ou génère le numéro de référencement unique et standardisé d'une question
 * (Ex: CO_T01_Q01, CE_T05_Q18, etc.)
 */
export function getQuestionRef(question?: Partial<Question> | null): string {
  if (!question) return '';

  // 1. Extraire depuis le nom de fichier audio (ex: /media/audios/CO_T01_Q01.mp3)
  if (question.audio_url) {
    const filename = question.audio_url.split('/').pop()?.split('?')[0] || '';
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const match = nameWithoutExt.match(/(CO_[A-Za-z0-9_-]+|CE_[A-Za-z0-9_-]+)/i);
    if (match) return match[1].toUpperCase();
    if (nameWithoutExt && !nameWithoutExt.includes('sample')) {
      return nameWithoutExt.toUpperCase();
    }
  }

  // 2. Extraire depuis le nom de fichier image (ex: /media/images/CE_T01_Q01.jpg)
  if (question.image_url) {
    const filename = question.image_url.split('/').pop()?.split('?')[0] || '';
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
    const match = nameWithoutExt.match(/(CE_[A-Za-z0-9_-]+|CO_[A-Za-z0-9_-]+)/i);
    if (match) return match[1].toUpperCase();
    if (nameWithoutExt && !nameWithoutExt.includes('sample')) {
      return nameWithoutExt.toUpperCase();
    }
  }

  // 3. Extraire depuis le texte de la consigne si préfixé
  if (question.texte) {
    const match = question.texte.match(/^\[([A-Za-z0-9_-]+)\]/);
    if (match) return match[1].toUpperCase();
  }

  // 4. Fallback avec préfixe d'épreuve et identifiant court
  if (question.id) {
    const prefix = question.epreuve === 'comprehension_oral'
      ? 'CO'
      : question.epreuve === 'comprehension_ecrit'
        ? 'CE'
        : 'Q';
    const cleanId = question.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    return `${prefix}_${cleanId}`;
  }

  return '';
}

/**
 * Vérifie si une question correspond à un terme de recherche
 * (par texte, par code de référence ou par épreuve/niveau)
 */
export function matchesQuestionSearch(question: Partial<Question>, search: string): boolean {
  if (!search.trim()) return true;
  const term = search.trim().toLowerCase();
  const ref = getQuestionRef(question).toLowerCase();
  const normalizedRef = ref.replace(/[-_]/g, '');
  const normalizedTerm = term.replace(/[-_]/g, '');

  return (
    ref.includes(term) ||
    normalizedRef.includes(normalizedTerm) ||
    (question.texte?.toLowerCase().includes(term) ?? false) ||
    (question.audio_url?.toLowerCase().includes(term) ?? false) ||
    (question.image_url?.toLowerCase().includes(term) ?? false) ||
    (question.niveau?.toLowerCase() === term)
  );
}
