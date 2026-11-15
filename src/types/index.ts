export interface Option {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  withCount?: boolean;
}

// Types principaux pour Mon TCFCA

export type UserRole = 'admin' | 'etudiant' | 'super_admin' | 'professeur'; // super_admin/professeur maintenus temporairement pour compatibilité runtime
export type EpreuveType = 'comprehension_oral' | 'comprehension_ecrit' | 'expression_ecrite' | 'expression_orale';
export type NiveauCECRL = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type ModeExamen = 'entrainement' | 'examen_blanc';
export type StatutCorrection = 'en_attente' | 'en_cours' | 'corrige' | 'refuse';
export type StatutAbonnement = 'active' | 'expired' | 'cancelled' | 'past_due' | 'actif' | 'expire' | 'annule';
export type PlanId = 'essentiel' | 'standard' | 'intensif' | 'pack_express' | 'basic' | 'premium';
export type StatutPaiement = 'en_attente' | 'confirme' | 'echoue' | 'rembourse' | 'succeeded' | 'failed';
export type MethodePaiement = 'cinetpay' | 'stripe' | 'paystack' | 'pawapay' | 'mobile_money' | 'card';

export interface Profile {
  id: string;
  email: string | null;
  nom: string | null;
  prenom: string | null;
  role: 'admin' | 'etudiant' | 'super_admin' | 'professeur';
  avatar_url: string | null;
  examen_blanc_actif: boolean;
  bloque: boolean;
  cree_par: string | null;
  last_active_at: string | null;
  current_session_token: string | null;
  pays?: string | null;
  telephone?: string | null;
  indicatif_pays?: string | null;
  email_reminders_enabled?: boolean;
  last_activity_reminder_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChoixReponse {
  id: string;
  texte: string;
}

export interface Question {
  id: string;
  epreuve: EpreuveType;
  niveau: NiveauCECRL | null;
  reference?: string | null;
  texte: string | null;
  audio_url: string | null;
  image_url: string | null;
  choix: ChoixReponse[] | null;
  bonne_reponse: string | null;
  explication: string | null;
  ordre: number;
  actif: boolean;
  cree_par: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tache {
  id: string;
  epreuve: EpreuveType;
  numero_tache: number;
  reference?: string | null;
  consigne: string;
  duree_secondes: number | null;
  actif: boolean;
  cree_par: string | null;
  created_at: string;
}

export interface Attribution {
  id: string;
  professeur_id: string;
  etudiant_id: string;
  attribue_par: string | null;
  created_at: string;
  professeur?: Profile;
  etudiant?: Profile;
}

// ══════════════════════════════════════════════════════════════════════════════
// FICHES PÉDAGOGIQUES (COURS)
// ══════════════════════════════════════════════════════════════════════════════

export type CourseEpreuve = 
  | 'DEROULEMENT_TCF'
  | 'CE' 
  | 'CO' 
  | 'EE'
  | 'EE_tache1' 
  | 'EE_tache2' 
  | 'EE_tache3' 
  | 'EO'
  | 'EO_tache1' 
  | 'EO_tache2' 
  | 'EO_tache3'
  | 'OUTILS_CONNECTEURS'
  | 'OUTILS_EXPRESSIONS'
  | 'OUTILS_TEMPS'
  | 'OUTILS_ACCORDS';

export const COURSE_EPREUVE_LABELS: Record<CourseEpreuve, string> = {
  DEROULEMENT_TCF: 'TCF Canada',
  CE: 'Compréhension Écrite',
  CO: 'Compréhension Orale',
  EE: 'Expression Écrite',
  EE_tache1: 'Expression Écrite — Tâche 1',
  EE_tache2: 'Expression Écrite — Tâche 2',
  EE_tache3: 'Expression Écrite — Tâche 3',
  EO: 'Expression Orale',
  EO_tache1: 'Expression Orale — Tâche 1',
  EO_tache2: 'Expression Orale — Tâche 2',
  EO_tache3: 'Expression Orale — Tâche 3',
  OUTILS_CONNECTEURS: 'Connecteurs Logiques',
  OUTILS_EXPRESSIONS: 'Expressions Utiles',
  OUTILS_TEMPS: 'Passé composé & Imparfait',
  OUTILS_ACCORDS: 'Les Accords Essentiels',
};

export const COURSE_EPREUVE_GROUPS: { key: string; label: string; epreuves: CourseEpreuve[] }[] = [
  { key: 'deroulement', label: 'TCF Canada', epreuves: ['DEROULEMENT_TCF'] },
  { key: 'ee', label: 'Expression Écrite', epreuves: ['EE', 'EE_tache1', 'EE_tache2', 'EE_tache3'] },
  { key: 'eo', label: 'Expression Orale', epreuves: ['EO', 'EO_tache1', 'EO_tache2', 'EO_tache3'] },
  { key: 'ce', label: 'Compréhension Écrite', epreuves: ['CE'] },
  { key: 'co', label: 'Compréhension Orale', epreuves: ['CO'] },
  { 
    key: 'outils', 
    label: 'Outils & Grammaire', 
    epreuves: ['OUTILS_CONNECTEURS', 'OUTILS_TEMPS', 'OUTILS_ACCORDS'] 
  },
];

export interface CourseSheet {
  id: string;
  epreuve: CourseEpreuve;
  niveau: NiveauCECRL;
  titre: string;
  contenu: string;
  fichier_pdf_url: string | null;
  ordre_affichage: number;
  created_at: string;
  updated_at?: string;
  is_read?: boolean;
  read_at?: string | null;
}

export interface CourseSheetRead {
  id: string;
  user_id: string;
  sheet_id: string;
  read_at: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// PLANS & ABONNEMENTS
// ══════════════════════════════════════════════════════════════════════════════

export interface Plan {
  id: 'essentiel' | 'standard' | 'intensif' | 'express' | 'pack_express' | string;
  nom: string;
  prix?: string;
  prix_usd: number;
  prix_fcfa?: number;
  duree_jours: number;
  quota_ee: number;
  quota_eo: number;
  quota_examen_blanc: number;
  description: string;
  is_popular?: boolean;
  badge?: string;
  features: string[];
}

export const PLANS_CONFIG: Record<string, Plan> = {
  essentiel: {
    id: 'essentiel',
    nom: 'Essentiel',
    prix: '10 000 FCFA',
    prix_usd: 14.99,
    prix_fcfa: 10000,
    duree_jours: 30,
    quota_ee: 8,
    quota_eo: 4,
    quota_examen_blanc: 1,
    description: 'Idéal pour s’entraîner régulièrement et valider ses acquis.',
    features: [
      'Accès illimité aux 4 320 questions officielles CE & CO',
      'Accès complet à toutes les fiches de cours',
      '8 corrections personnalisées Expression Écrite',
      '4 corrections audio Expression Orale',
      '1 examen blanc complet noté avec barème CECRL',
      'Validité 30 jours',
    ],
  },
  standard: {
    id: 'standard',
    nom: 'Standard',
    prix: '18 000 FCFA',
    prix_usd: 29.99,
    prix_fcfa: 18000,
    duree_jours: 30,
    quota_ee: 20,
    quota_eo: 12,
    quota_examen_blanc: 2,
    description: 'La formule recommandée pour cibler les niveaux C1 et C2.',
    is_popular: true,
    badge: 'Recommandé / Plus populaire',
    features: [
      'Accès illimité à toute la banque officielle CE / CO / EE / EO',
      'Accès prioritaire à toutes les fiches pédagogiques',
      '20 corrections personnalisées Expression Écrite',
      '12 corrections audio Expression Orale avec grille FEI',
      '2 examens blancs complets chronométrés',
      'Suivi de progression et score prédictif NCLC',
      'Validité 30 jours',
    ],
  },
  intensif: {
    id: 'intensif',
    nom: 'Intensif',
    prix: '28 000 FCFA',
    prix_usd: 47.99,
    prix_fcfa: 28000,
    duree_jours: 40,
    quota_ee: 50,
    quota_eo: 30,
    quota_examen_blanc: 5,
    description: 'Préparation d’élite pour viser le C2 et maximiser ses points Entrée Express.',
    badge: 'Score Max Garanti',
    features: [
      'Accès VIP intégral illimité',
      '50 corrections approfondies Expression Écrite',
      '30 corrections audio Expression Orale',
      '5 examens blancs complets notés',
      'Analyse comparative détaillée & retour individualisé',
      'Validité 40 jours',
    ],
  },
  express: {
    id: 'express',
    nom: 'Express',
    prix: '10 000 FCFA',
    prix_usd: 14.99,
    prix_fcfa: 10000,
    duree_jours: 14,
    quota_ee: 20,
    quota_eo: 12,
    quota_examen_blanc: 2,
    description: 'Mêmes avantages que la formule Standard, condensés sur 14 jours.',
    badge: 'Sprint 14 jours',
    features: [
      'Accès complet illimité aux 4 épreuves',
      '20 corrections Expression Écrite',
      '12 corrections Expression Orale',
      '2 examens blancs complets',
      'Idéal avant le jour J',
      'Validité 14 jours',
    ],
  },
};

// Alias pour rétrocompatibilité
PLANS_CONFIG.pack_express = {
  ...PLANS_CONFIG.express,
  id: 'pack_express',
};

export interface Abonnement {
  id: string;
  user_id?: string;
  etudiant_id?: string;
  plan_id: string;
  status: StatutAbonnement;
  statut?: StatutAbonnement;
  provider?: 'stripe' | 'cinetpay' | 'paystack' | 'pawapay' | string | null;
  provider_subscription_id?: string | null;
  methode?: 'mobile_money' | 'card' | string | null;
  auto_renew?: boolean;
  derniere_relance_at?: string | null;
  quota_ee_restant: number;
  quota_eo_restant: number;
  quota_examen_blanc_restant: number;
  current_period_start?: string;
  current_period_end?: string | null;
  date_debut?: string;
  date_fin?: string | null;
  created_at: string;
  updated_at?: string;
  plan?: Plan;
}

export interface Paiement {
  id: string;
  user_id?: string;
  etudiant_id?: string;
  subscription_id?: string | null;
  abonnement_id?: string | null;
  amount: number;
  montant?: number;
  currency: string;
  devise?: string;
  provider: string;
  methode?: MethodePaiement;
  provider_payment_id?: string | null;
  transaction_id?: string | null;
  status: string;
  statut?: StatutPaiement;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// SESSIONS & PRODUCTIONS
// ══════════════════════════════════════════════════════════════════════════════

export interface SessionExamen {
  id: string;
  etudiant_id: string;
  mode: ModeExamen;
  epreuve_actuelle: EpreuveType | null;
  statut: 'en_cours' | 'termine' | 'abandonne';
  score_oral: number | null;
  score_ecrit: number | null;
  score_expression_ecrite: number | null;
  score_expression_orale: number | null;
  score_global: number | null;
  niveau_cecrl: NiveauCECRL | null;
  correction_complete: boolean;
  duree_expression_ecrite: number | null;
  created_at: string;
  termine_at: string | null;
  etudiant?: Profile;
}

export interface ReponseQcm {
  id: string;
  session_id: string;
  question_id: string;
  reponse_choisie: string | null;
  est_correcte: boolean | null;
  created_at: string;
  question?: Question;
}

export interface Production {
  id: string;
  session_id: string;
  etudiant_id: string;
  epreuve: EpreuveType;
  numero_tache: number;
  reference?: string | null;
  ref_code?: string | null;
  consigne?: string | null;
  contenu_texte: string | null;
  audio_url: string | null;
  statut_correction: StatutCorrection;
  professeur_id: string | null;
  score: number | null;
  commentaire: string | null;
  grille_notation: Record<string, number> | null;
  corrige_at: string | null;
  raison_refus: string | null;
  created_at: string;
  updated_at?: string | null;
  etudiant?: Profile;
  professeur?: Profile;
  session?: SessionExamen;
}

export interface Notification {
  id: string;
  utilisateur_id: string;
  titre: string;
  message: string;
  lue: boolean;
  lien: string | null;
  created_at: string;
}

export const EPREUVE_LABELS: Record<EpreuveType, string> = {
  comprehension_oral: 'Compréhension Orale',
  comprehension_ecrit: 'Compréhension Écrite',
  expression_ecrite: 'Expression Écrite',
  expression_orale: 'Expression Orale',
};

export const EPREUVE_DUREES: Record<EpreuveType, number> = {
  comprehension_oral: 35 * 60,
  comprehension_ecrit: 60 * 60,
  expression_ecrite: 60 * 60,
  expression_orale: (2 + 4.5) * 60,
};

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrateur',
  etudiant: 'Étudiant',
  super_admin: 'Administrateur',
  professeur: 'Coach / Formateur',
};

export const CECRL_COLORS: Record<NiveauCECRL, string> = {
  A1: '#EF4444', // rouge — niveau débutant
  A2: '#F87171', // rouge clair — niveau élémentaire
  B1: '#F97316', // orange — niveau intermédiaire
  B2: '#FB923C', // orange clair — niveau indépendant
  C1: '#22C55E', // vert — niveau avancé
  C2: '#16A34A', // vert foncé — niveau maîtrise
};

/**
 * Convertit un pourcentage de réussite en niveau CECRL (barème TCF Canada).
 * < 17 % → A1 | 17–33 % → A2 | 34–49 % → B1 | 50–65 % → B2 | 66–82 % → C1 | > 82 % → C2
 */
export function pctToCECRL(pct: number): NiveauCECRL {
  if (pct < 17) return 'A1';
  if (pct < 34) return 'A2';
  if (pct < 50) return 'B1';
  if (pct < 66) return 'B2';
  if (pct < 83) return 'C1';
  return 'C2';
}

export const CECRL_DESCRIPTIONS: Record<NiveauCECRL, string> = {
  A1: 'Introductif',
  A2: 'Élémentaire',
  B1: 'Intermédiaire',
  B2: 'Indépendant',
  C1: 'Avancé',
  C2: 'Maîtrise',
};

export const NIVEAU_CECRL_LIST: NiveauCECRL[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const CONVERSION_CECRL_EXPRESSION_ECRITE = [
  { score_min: 0, score_max: 3, niveau_cecrl: 'A1' as const, label: 'A1' },
  { score_min: 4, score_max: 5, niveau_cecrl: 'A2' as const, label: 'A2' },
  { score_min: 6, score_max: 9, niveau_cecrl: 'B1' as const, label: 'B1' },
  { score_min: 10, score_max: 13, niveau_cecrl: 'B2' as const, label: 'B2' },
  { score_min: 14, score_max: 15, niveau_cecrl: 'C1' as const, label: 'C1' },
  { score_min: 16, score_max: 20, niveau_cecrl: 'C2' as const, label: 'C1-C2' },
];

export function scoreEeToCECRL(score: number): NiveauCECRL {
  if (score >= 16) return 'C2';
  if (score >= 14) return 'C1';
  if (score >= 10) return 'B2';
  if (score >= 6) return 'B1';
  if (score >= 4) return 'A2';
  return 'A1';
}

export function scoreEeToCECRLLabel(score: number): string {
  if (score >= 16) return 'C1-C2';
  if (score >= 14) return 'C1';
  if (score >= 10) return 'B2';
  if (score >= 6) return 'B1';
  if (score >= 4) return 'A2';
  return 'A1';
}

export const CONVERSION_CECRL_EXPRESSION_ORALE = [
  { score_min: 0, score_max: 0, niveau_cecrl: 'A1' as const, label: 'A1 non atteint' },
  { score_min: 1, score_max: 1, niveau_cecrl: 'A1' as const, label: 'A1' },
  { score_min: 2, score_max: 5, niveau_cecrl: 'A2' as const, label: 'A2' },
  { score_min: 6, score_max: 9, niveau_cecrl: 'B1' as const, label: 'B1' },
  { score_min: 10, score_max: 13, niveau_cecrl: 'B2' as const, label: 'B2' },
  { score_min: 14, score_max: 17, niveau_cecrl: 'C1' as const, label: 'C1' },
  { score_min: 18, score_max: 20, niveau_cecrl: 'C2' as const, label: 'C2' },
];

export function scoreEoToCECRL(score: number): NiveauCECRL {
  if (score >= 18) return 'C2';
  if (score >= 14) return 'C1';
  if (score >= 10) return 'B2';
  if (score >= 6) return 'B1';
  if (score >= 2) return 'A2';
  return 'A1';
}

export function scoreEoToCECRLLabel(score: number): string {
  if (score >= 18) return 'C2';
  if (score >= 14) return 'C1';
  if (score >= 10) return 'B2';
  if (score >= 6) return 'B1';
  if (score >= 2) return 'A2';
  if (score >= 1) return 'A1';
  return 'A1 non atteint';
}
