export interface CountryInfo {
  code: string;       // ISO 3166-1 alpha-2 (ex: 'CI')
  name: string;       // Nom en français (ex: 'Côte d\'Ivoire')
  dialCode: string;   // Indicatif téléphonique (ex: '+225')
  flag: string;       // Drapeau emoji (ex: '🇨🇮')
  placeholder?: string; // Format indicatif du numéro local
}

// Liste complète et ordonnée : pays d'Afrique francophone en priorité, puis Europe, Amérique et reste du monde
export const COUNTRIES: CountryInfo[] = [
  // Afrique de l'Ouest & Centrale (cœur de cible TCF)
  { code: 'CI', name: "Côte d'Ivoire", dialCode: '+225', flag: '🇨🇮', placeholder: '07 01 23 45 67' },
  { code: 'SN', name: 'Sénégal', dialCode: '+221', flag: '🇸🇳', placeholder: '77 123 45 67' },
  { code: 'CM', name: 'Cameroun', dialCode: '+237', flag: '🇨🇲', placeholder: '6 12 34 56 78' },
  { code: 'BJ', name: 'Bénin', dialCode: '+229', flag: '🇧🇯', placeholder: '97 12 34 56' },
  { code: 'TG', name: 'Togo', dialCode: '+228', flag: '🇹🇬', placeholder: '90 12 34 56' },
  { code: 'BF', name: 'Burkina Faso', dialCode: '+226', flag: '🇧🇫', placeholder: '70 12 34 56' },
  { code: 'ML', name: 'Mali', dialCode: '+223', flag: '🇲🇱', placeholder: '70 12 34 56' },
  { code: 'GA', name: 'Gabon', dialCode: '+241', flag: '🇬🇦', placeholder: '07 12 34 56' },
  { code: 'CG', name: 'Congo-Brazzaville', dialCode: '+242', flag: '🇨🇬', placeholder: '06 123 4567' },
  { code: 'CD', name: 'RD Congo', dialCode: '+243', flag: '🇨🇩', placeholder: '81 234 5678' },
  { code: 'GN', name: 'Guinée', dialCode: '+224', flag: '🇬🇳', placeholder: '621 12 34 56' },
  { code: 'NE', name: 'Niger', dialCode: '+227', flag: '🇳🇪', placeholder: '90 12 34 56' },
  { code: 'TD', name: 'Tchad', dialCode: '+235', flag: '🇹🇩', placeholder: '66 12 34 56' },
  { code: 'MG', name: 'Madagascar', dialCode: '+261', flag: '🇲🇬', placeholder: '34 12 345 67' },
  { code: 'MR', name: 'Mauritanie', dialCode: '+222', flag: '🇲🇷', placeholder: '45 12 34 56' },
  { code: 'RW', name: 'Rwanda', dialCode: '+250', flag: '🇷🇼', placeholder: '78 123 4567' },
  { code: 'BI', name: 'Burundi', dialCode: '+257', flag: '🇧🇮', placeholder: '79 12 34 56' },
  { code: 'CF', name: 'Centrafrique', dialCode: '+236', flag: '🇨🇫', placeholder: '75 12 34 56' },
  { code: 'DJ', name: 'Djibouti', dialCode: '+253', flag: '🇩🇯', placeholder: '77 12 34 56' },
  { code: 'KM', name: 'Comores', dialCode: '+269', flag: '🇰🇲', placeholder: '32 12 345' },
  { code: 'GQ', name: 'Guinée Équatoriale', dialCode: '+240', flag: '🇬🇶', placeholder: '222 12 34 56' },

  // Maghreb
  { code: 'MA', name: 'Maroc', dialCode: '+212', flag: '🇲🇦', placeholder: '6 12 34 56 78' },
  { code: 'DZ', name: 'Algérie', dialCode: '+213', flag: '🇩🇿', placeholder: '5 12 34 56 78' },
  { code: 'TN', name: 'Tunisie', dialCode: '+216', flag: '🇹🇳', placeholder: '20 123 456' },

  // Amérique du Nord & Caraïbes (destination TCF Canada)
  { code: 'CA', name: 'Canada', dialCode: '+1', flag: '🇨🇦', placeholder: '514 123 4567' },
  { code: 'US', name: 'États-Unis', dialCode: '+1', flag: '🇺🇸', placeholder: '202 555 0123' },
  { code: 'HT', name: 'Haïti', dialCode: '+509', flag: '🇭🇹', placeholder: '34 12 3456' },

  // Europe
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', placeholder: '06 12 34 56 78' },
  { code: 'BE', name: 'Belgique', dialCode: '+32', flag: '🇧🇪', placeholder: '0470 12 34 56' },
  { code: 'CH', name: 'Suisse', dialCode: '+41', flag: '🇨🇭', placeholder: '079 123 45 67' },
  { code: 'LU', name: 'Luxembourg', dialCode: '+352', flag: '🇱🇺', placeholder: '621 123 456' },
  { code: 'DE', name: 'Allemagne', dialCode: '+49', flag: '🇩🇪', placeholder: '151 12345678' },
  { code: 'GB', name: 'Royaume-Uni', dialCode: '+44', flag: '🇬🇧', placeholder: '7911 123456' },
  { code: 'IT', name: 'Italie', dialCode: '+39', flag: '🇮🇹', placeholder: '320 1234567' },
  { code: 'ES', name: 'Espagne', dialCode: '+34', flag: '🇪🇸', placeholder: '612 34 56 78' },
  { code: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹', placeholder: '912 345 678' },
  { code: 'NL', name: 'Pays-Bas', dialCode: '+31', flag: '🇳🇱', placeholder: '06 12345678' },
  { code: 'TR', name: 'Turquie', dialCode: '+90', flag: '🇹🇷', placeholder: '532 123 45 67' },

  // Autres pays d'Afrique
  { code: 'NG', name: 'Nigéria', dialCode: '+234', flag: '🇳🇬', placeholder: '803 123 4567' },
  { code: 'GH', name: 'Ghana', dialCode: '+233', flag: '🇬🇭', placeholder: '24 123 4567' },
  { code: 'ZA', name: 'Afrique du Sud', dialCode: '+27', flag: '🇿🇦', placeholder: '71 123 4567' },
  { code: 'KE', name: 'Kenya', dialCode: '+254', flag: '🇰🇪', placeholder: '712 345678' },
  { code: 'EG', name: 'Égypte', dialCode: '+20', flag: '🇪🇬', placeholder: '10 1234 5678' },
  { code: 'AO', name: 'Angola', dialCode: '+244', flag: '🇦🇴', placeholder: '923 123 456' },
  { code: 'MZ', name: 'Mozambique', dialCode: '+258', flag: '🇲🇿', placeholder: '84 123 4567' },

  // Moyen-Orient & Asie
  { code: 'AE', name: 'Émirats Arabes Unis', dialCode: '+971', flag: '🇦🇪', placeholder: '50 123 4567' },
  { code: 'SA', name: 'Arabie Saoudite', dialCode: '+966', flag: '🇸🇦', placeholder: '50 123 4567' },
  { code: 'QA', name: 'Qatar', dialCode: '+974', flag: '🇶🇦', placeholder: '33 12 34 56' },
  { code: 'LB', name: 'Liban', dialCode: '+961', flag: '🇱🇧', placeholder: '70 123 456' },
  { code: 'CN', name: 'Chine', dialCode: '+86', flag: '🇨🇳', placeholder: '138 1234 5678' },
  { code: 'IN', name: 'Inde', dialCode: '+91', flag: '🇮🇳', placeholder: '98765 43210' },
  { code: 'BR', name: 'Brésil', dialCode: '+55', flag: '🇧🇷', placeholder: '11 91234-5678' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // Côte d'Ivoire (+225)

export function findCountryByCode(code: string): CountryInfo | undefined {
  if (!code) return undefined;
  const upper = code.trim().toUpperCase();
  return COUNTRIES.find((c) => c.code === upper);
}

export function findCountryByName(name: string): CountryInfo | undefined {
  if (!name) return undefined;
  const lower = name.trim().toLowerCase();
  return COUNTRIES.find((c) => c.name.toLowerCase() === lower);
}

export function findCountryByDialCode(dialCode: string): CountryInfo | undefined {
  if (!dialCode) return undefined;
  const cleaned = dialCode.trim().startsWith('+') ? dialCode.trim() : `+${dialCode.trim()}`;
  return COUNTRIES.find((c) => c.dialCode === cleaned);
}

// Correspondance immédiate sans réseau par fuseau horaire
const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  'Africa/Abidjan': 'CI',
  'Africa/Dakar': 'SN',
  'Africa/Douala': 'CM',
  'Africa/Porto-Novo': 'BJ',
  'Africa/Lome': 'TG',
  'Africa/Ouagadougou': 'BF',
  'Africa/Bamako': 'ML',
  'Africa/Libreville': 'GA',
  'Africa/Brazzaville': 'CG',
  'Africa/Kinshasa': 'CD',
  'Africa/Lubumbashi': 'CD',
  'Africa/Conakry': 'GN',
  'Africa/Niamey': 'NE',
  'Africa/Ndjamena': 'TD',
  'Africa/Bangui': 'CF',
  'Africa/Casablanca': 'MA',
  'Africa/El_Aaiun': 'MA',
  'Africa/Algiers': 'DZ',
  'Africa/Tunis': 'TN',
  'Africa/Kigali': 'RW',
  'Africa/Bujumbura': 'BI',
  'Africa/Lagos': 'NG',
  'Africa/Accra': 'GH',
  'Africa/Johannesburg': 'ZA',
  'Africa/Nairobi': 'KE',
  'Africa/Cairo': 'EG',
  'Europe/Paris': 'FR',
  'Europe/Brussels': 'BE',
  'Europe/Zurich': 'CH',
  'Europe/Luxembourg': 'LU',
  'Europe/London': 'GB',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Berlin': 'DE',
  'Europe/Lisbon': 'PT',
  'Europe/Amsterdam': 'NL',
  'Europe/Istanbul': 'TR',
  'America/Toronto': 'CA',
  'America/Montreal': 'CA',
  'America/Vancouver': 'CA',
  'America/Edmonton': 'CA',
  'America/Halifax': 'CA',
  'America/Winnipeg': 'CA',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Los_Angeles': 'US',
  'America/Port-au-Prince': 'HT',
};

/**
 * Détecte le pays et l'indicatif de l'utilisateur de manière automatique :
 * 1. Analyse instantanée du fuseau horaire (0ms, offline-first)
 * 2. Vérification par IP en arrière-plan avec timeout strict de 2,5s
 * 3. Fallback sur Côte d'Ivoire si indisponible
 */
export async function detectUserCountry(): Promise<{
  country: CountryInfo;
  isAutoDetected: boolean;
  source: 'timezone' | 'ip' | 'default';
}> {
  // 1. Détection rapide par fuseau horaire
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && TIMEZONE_TO_COUNTRY[tz]) {
      const countryCode = TIMEZONE_TO_COUNTRY[tz];
      const match = findCountryByCode(countryCode);
      if (match) {
        // En parallèle, tenter une confirmation par IP rapide si disponible
        tryIpDetection().then((ipCountry) => {
          // IP confirmée en arrière-plan si besoin
          if (ipCountry && ipCountry.code !== match.code) {
            // L'IP a une précision supérieure
          }
        }).catch(() => {});

        return { country: match, isAutoDetected: true, source: 'timezone' };
      }
    }
  } catch (e) {
    console.warn('Erreur détection fuseau horaire:', e);
  }

  // 2. Détection par IP (si fuseau horaire non trouvé)
  const ipCountry = await tryIpDetection();
  if (ipCountry) {
    return { country: ipCountry, isAutoDetected: true, source: 'ip' };
  }

  // 3. Fallback par défaut (Côte d'Ivoire)
  return { country: DEFAULT_COUNTRY, isAutoDetected: false, source: 'default' };
}

/**
 * Essaie de récupérer le code pays par géolocalisation IP
 * Utilise ipapi.co puis api.country.is avec un timeout strict de 2,5s
 */
async function tryIpDetection(): Promise<CountryInfo | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);

  try {
    // Service 1 : country.is (léger et très rapide)
    const res1 = await fetch('https://api.country.is/', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (res1.ok) {
      const data = await res1.json();
      if (data?.country) {
        const found = findCountryByCode(data.country);
        if (found) {
          clearTimeout(timer);
          return found;
        }
      }
    }
  } catch {
    // Si timeout ou bloqueur, essayer le service 2
  }

  try {
    // Service 2 : ipapi.co
    const res2 = await fetch('https://ipapi.co/json/', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (res2.ok) {
      const data = await res2.json();
      if (data?.country_code) {
        const found = findCountryByCode(data.country_code);
        if (found) {
          clearTimeout(timer);
          return found;
        }
      }
    }
  } catch {
    // Échec silencieux
  } finally {
    clearTimeout(timer);
  }

  return null;
}

/**
 * Recherche un pays par son code ISO (ex: 'CI') ou son nom (ex: "Côte d'Ivoire").
 */
export function findCountry(codeOrName?: string | null): CountryInfo | null {
  if (!codeOrName) return null;
  const trimmed = codeOrName.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  const byCode = COUNTRIES.find((c) => c.code.toUpperCase() === upper);
  if (byCode) return byCode;
  const lower = trimmed.toLowerCase();
  const byName = COUNTRIES.find((c) => c.name.toLowerCase() === lower);
  if (byName) return byName;
  return null;
}

/**
 * Formate un code pays ISO (ex: 'CI') ou nom de pays avec son drapeau et son nom complet.
 */
export function formatCountryWithFlag(codeOrName?: string | null): string {
  if (!codeOrName) return '';
  const found = findCountry(codeOrName);
  if (found) return `${found.flag} ${found.name}`;
  return codeOrName.trim();
}

