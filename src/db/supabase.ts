import { createClient } from "@supabase/supabase-js";
import type { ChoixReponse, Question } from "@/types/index";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Décode les entités HTML courantes (notamment &#8217; pour l'apostrophe typographique,
 * &#8230; pour les points de suspension, &#160; pour l'espace insécable, etc.)
 */
export function decodeHtmlEntities(str: string | null | undefined): string {
  if (!str || typeof str !== 'string') return '';
  return str
    // Entités numériques décimales
    .replace(/&#(\d+);/g, (_match, dec) => {
      const code = parseInt(dec, 10);
      if (code === 8217 || code === 8216) return "'"; // Apostrophes typographiques -> apostrophe standard
      if (code === 8220 || code === 8221) return '"'; // Guillemets doubles
      if (code === 8230) return '…'; // Points de suspension
      if (code === 160) return ' '; // Espace insécable
      try {
        return String.fromCharCode(code);
      } catch {
        return _match;
      }
    })
    // Entités numériques hexadécimales
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => {
      const code = parseInt(hex, 16);
      if (code === 0x2019 || code === 0x2018) return "'";
      if (code === 0x201c || code === 0x201d) return '"';
      if (code === 0x2026) return '…';
      if (code === 0xa0) return ' ';
      try {
        return String.fromCharCode(code);
      } catch {
        return _match;
      }
    })
    // Entités nommées courantes
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#039;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Normalise le champ `choix` d'une question et décode les entités HTML des propositions.
 * La base stocke un objet JSONB {"A":"texte","B":"texte",...}
 * mais le frontend attend un tableau [{id:"A",texte:"texte"},...]
 */
function normalizeChoix(raw: unknown): ChoixReponse[] | null {
  if (!raw) return null;
  // Déjà un tableau correctement formé
  if (Array.isArray(raw)) {
    if (raw.length > 0 && typeof raw[0] === 'object' && 'id' in raw[0]) {
      return (raw as ChoixReponse[]).map(c => ({
        id: c.id,
        texte: decodeHtmlEntities(c.texte),
      }));
    }
  }
  // Objet JSONB {"A":"texte","B":"texte",...}
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return Object.entries(raw as Record<string, string>).map(([id, texte]) => ({
      id,
      texte: decodeHtmlEntities(texte),
    }));
  }
  return null;
}

/**
 * Extrait l'ensemble des empreintes canoniques discriminantes d'une question :
 * 1. ID unique
 * 2. Référence normalisée (ex: "CE_T01_Q01" -> "ref:cet01q01")
 * 3. Nom de fichier audio normalisé (ex: "audio:co_t01_q01.mp3")
 * 4. Nom de fichier image normalisé (ex: "image:ce_t01_q01.jpg")
 * 5. Empreinte ordonnée et nettoyée des choix de réponses
 * 6. Empreinte du texte substantiel ou consigne + choix
 */
export function getQuestionFingerprints(q: Partial<Question>): string[] {
  const fps: string[] = [];
  if (!q) return fps;

  // 1. ID unique
  if (q.id && typeof q.id === 'string' && q.id.trim().length > 0) {
    fps.push(`id:${q.id.trim().toLowerCase()}`);
  }

  // 2. Référence canonique (ex: CE_T01_Q01, CO_T01_Q01)
  if (q.reference && typeof q.reference === 'string' && q.reference.trim().length > 0) {
    const cleanRef = q.reference.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanRef.length > 2) {
      fps.push(`ref:${cleanRef}`);
    }
  }

  // 3. Fichier audio canonique (Compréhension Orale)
  // Extrait le nom de fichier sans dossier ni querystring (ex: "/media/audio/CO_T01_Q01.mp3" -> "co_t01_q01.mp3")
  if (q.audio_url && typeof q.audio_url === 'string' && q.audio_url.trim().length > 0) {
    const rawAudio = q.audio_url.trim().toLowerCase().split('?')[0].split('#')[0];
    const filename = rawAudio.split('/').pop()?.trim();
    if (filename && filename.length > 3 && !filename.includes('sample') && !filename.includes('test')) {
      fps.push(`audio:${filename}`);
    }
  }

  // 4. Fichier image canonique (Compréhension Écrite)
  // Extrait le nom de fichier sans dossier ni querystring (ex: "/media/images/CE_T01_Q01.jpg" -> "ce_t01_q01.jpg")
  if (q.image_url && typeof q.image_url === 'string' && q.image_url.trim().length > 0) {
    const rawImage = q.image_url.trim().toLowerCase().split('?')[0].split('#')[0];
    const filename = rawImage.split('/').pop()?.trim();
    if (filename && filename.length > 3 && !filename.includes('sample') && !filename.includes('test') && !filename.includes('placeholder')) {
      fps.push(`image:${filename}`);
    }
  }

  // 5. Empreinte des propositions de réponses (choix triés et nettoyés)
  const rawChoices = Array.isArray(q.choix) ? q.choix : [];
  const normalizedChoices = rawChoices
    .map(c => {
      const txt = typeof c === 'string' ? c : (c && typeof c === 'object' && 'texte' in c ? (c as { texte: string }).texte : '');
      return decodeHtmlEntities(txt)
        .trim()
        .toLowerCase()
        .replace(/[.,!?;:'"«»()—\-–]/g, '')
        .replace(/\s+/g, ' ');
    })
    .filter(t => t.length > 0)
    .sort();

  const choicesSig = normalizedChoices.join('###');
  const isGenericChoiceLabels =
    choicesSig === 'a###b###c###d' ||
    normalizedChoices.every((c) => c.length <= 2);

  // Si au moins 2 choix substantiels sont présents
  if (normalizedChoices.length >= 2 && choicesSig.length >= 8 && !isGenericChoiceLabels) {
    fps.push(`choices:${choicesSig}`);
  }

  // 6. Empreinte du texte de la question
  if (q.texte && typeof q.texte === 'string') {
    const cleanText = decodeHtmlEntities(q.texte)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[.,!?;:'"«»()—\-–’]/g, '')
      .replace(/\s+/g, ' ');

    const isGenericPrompt =
      cleanText.startsWith('lisez le document') ||
      cleanText.startsWith('lisez les documents') ||
      cleanText.startsWith('lisez lextrait') ||
      cleanText.startsWith('ecoutez ') ||
      cleanText.startsWith('ecouter ');

    // Texte substantiel non générique
    if (!isGenericPrompt && cleanText.length > 20) {
      fps.push(`text:${cleanText}`);
    }

    // Empreinte discriminante consigne + choix (sauf si les choix sont génériques A/B/C/D)
    if (choicesSig.length > 0 && !isGenericChoiceLabels && !isGenericPrompt) {
      fps.push(`prompt_choices:${cleanText.slice(0, 50)}###${choicesSig}`);
    }
  }

  return fps;
}

/**
 * Vérifie si une question entre en collision avec un ensemble d'empreintes déjà observées.
 */
export function isQuestionDuplicate(q: Partial<Question>, seenFingerprints: Set<string>): boolean {
  const fps = getQuestionFingerprints(q);
  for (const fp of fps) {
    if (seenFingerprints.has(fp)) {
      return true;
    }
  }
  return false;
}

/**
 * Enregistre toutes les empreintes canoniques d'une question dans le registre.
 */
export function registerQuestionFingerprints(q: Partial<Question>, seenFingerprints: Set<string>): void {
  const fps = getQuestionFingerprints(q);
  for (const fp of fps) {
    seenFingerprints.add(fp);
  }
}

/**
 * Déduplique strictement une liste de questions en garantissant l'unicité absolue
 * par ID, référence, audio, image, choix ordonnés, texte et combinaison prompt+choix.
 */
export function deduplicateQuestions<T extends Partial<Question>>(questions: T[]): T[] {
  const seenFingerprints = new Set<string>();
  const result: T[] = [];

  for (const q of questions) {
    if (!q) continue;

    if (isQuestionDuplicate(q, seenFingerprints)) {
      continue;
    }

    registerQuestionFingerprints(q, seenFingerprints);
    result.push(q);
  }

  return result;
}

/**
 * Fetch all active questions for a given epreuve type.
 * Normalise le champ `choix`, décode les entités HTML et déduplique automatiquement chaque question avant retour.
 */
export async function fetchAllQuestions<T = Question>(epreuve: string): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const allRows: Question[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('epreuve', epreuve)
      .eq('actif', true)
      .order('ordre', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Question[];
    allRows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  const normalized = allRows.map(q => ({
    ...q,
    texte: q.texte ? decodeHtmlEntities(q.texte) : q.texte,
    explication: q.explication ? decodeHtmlEntities(q.explication) : q.explication,
    choix: normalizeChoix(q.choix),
  }));
  return deduplicateQuestions(normalized) as unknown as T[];
}

