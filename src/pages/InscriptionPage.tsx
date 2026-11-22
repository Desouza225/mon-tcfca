import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import BrandLogo from '@/components/common/BrandLogo';
import {
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  ArrowRight,
  Lock,
  Mail,
  User,
  Globe,
  Phone,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { PLANS_CONFIG } from '@/types/index';
import {
  COUNTRIES,
  DEFAULT_COUNTRY,
  detectUserCountry,
  findCountryByCode,
  type CountryInfo,
} from '@/data/countries';
import { CountryFlag } from '@/components/ui/CountryFlag';

export default function InscriptionPage() {
  const [searchParams] = useSearchParams();
  const rawPlanParam = searchParams.get('plan') || 'standard';
  const planParam = rawPlanParam in PLANS_CONFIG ? rawPlanParam : 'standard';
  const planDetails = PLANS_CONFIG[planParam] || PLANS_CONFIG.standard;

  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Pays et téléphone avec auto-détection intelligente
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(DEFAULT_COUNTRY);
  const [indicatif, setIndicatif] = useState<string>(DEFAULT_COUNTRY.dialCode);
  const [telephone, setTelephone] = useState<string>('');
  const [autoDetected, setAutoDetected] = useState<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signUp, signIn, user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Détection automatique du pays au chargement (0ms via timezone, puis confirmation IP)
  useEffect(() => {
    let active = true;
    detectUserCountry().then((result) => {
      if (!active) return;
      setSelectedCountry(result.country);
      setIndicatif(result.country.dialCode);
      setAutoDetected(result.isAutoDetected);
    });
    return () => {
      active = false;
    };
  }, []);

  // Si déjà connecté, rediriger directement vers la page abonnement
  useEffect(() => {
    if (!authLoading && user && profile) {
      navigate(`/etudiant/abonnement?plan=${planParam}`, { replace: true });
    }
  }, [authLoading, user, profile, navigate, planParam]);

  // Changement manuel de pays : met à jour automatiquement l'indicatif associé
  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.value;
    const match = findCountryByCode(code);
    if (match) {
      setSelectedCountry(match);
      setIndicatif(match.dialCode);
      setAutoDetected(false); // Sélection manuelle par le candidat
    }
  };

  // Saisie du numéro de téléphone : uniquement des chiffres (avec nettoyage si l'indicatif est collé)
  const handleTelephoneChange = (value: string) => {
    let clean = value.trim();
    const dialDigits = indicatif.replace(/\D/g, '');
    if (indicatif && clean.startsWith(indicatif)) {
      clean = clean.slice(indicatif.length);
    } else if (dialDigits && clean.startsWith('00' + dialDigits)) {
      clean = clean.slice(('00' + dialDigits).length);
    }
    // Ne conserver strictement que les chiffres (0-9)
    setTelephone(clean.replace(/\D/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !nom || !prenom) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    if (!telephone.trim()) {
      setError('Veuillez renseigner votre numéro de téléphone.');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanNom = nom.trim();
      const cleanPrenom = prenom.trim();
      const cleanIndicatif = indicatif.trim().startsWith('+') ? indicatif.trim() : `+${indicatif.trim()}`;
      const fullTelephone = `${cleanIndicatif} ${telephone.trim()}`;

      const { error: signUpError } = await signUp(cleanEmail, password, cleanNom, cleanPrenom, {
        pays: selectedCountry.name,
        telephone: fullTelephone,
        indicatif_pays: cleanIndicatif,
      });

      if (signUpError) {
        throw signUpError;
      }

      // Connexion automatique après inscription
      const { error: signInError } = await signIn(cleanEmail, password);
      if (signInError) {
        // En cas de validation d'email requise par Supabase
        if (signInError.message.toLowerCase().includes('not confirmed')) {
          toast.success('Compte créé ! Veuillez confirmer votre email pour vous connecter.');
          navigate('/connexion');
          return;
        }
        throw signInError;
      }

      toast.success('Compte créé avec succès ! Bienvenue sur Mon TCF CA.');
      navigate(`/etudiant/abonnement?plan=${planParam}`, { replace: true });
    } catch (err: unknown) {
      console.error('Erreur inscription:', err);
      const msg = err instanceof Error ? err.message : '';
      if (
        msg.includes('already registered') ||
        msg.includes('unique constraint') ||
        msg.includes('User already registered')
      ) {
        setError('Cette adresse e-mail possède déjà un compte. Veuillez vous connecter.');
      } else {
        setError(msg || 'Une erreur est survenue lors de la création de votre compte.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      {/* Brand Header */}
      <Link to="/" className="mb-6 hover:scale-105 transition-transform flex flex-col items-center">
        <BrandLogo size="xl" showSubtitle />
      </Link>

      <Card className="w-full max-w-[calc(100%-1rem)] sm:max-w-lg bg-white border border-[#e2e8f0] shadow-lg rounded-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#0d233a] via-[#e53e3e] to-[#d97706]" />

        <CardHeader className="text-center pt-6 pb-4 px-6">
          <div className="inline-flex items-center gap-1.5 mx-auto bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe] px-3 py-1 rounded-full text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#e53e3e]" />
            <span>Inscription Candidat TCF Canada</span>
          </div>

          <CardTitle className="text-xl sm:text-2xl font-heading font-extrabold text-[#0d233a]">
            Créer votre compte
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-[#475569] mt-1">
            Accédez à la plateforme d'entraînement et préparez votre score NCLC 7+
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-[#ffdad6]/60 border-[#ba1a1a]/30 text-[#93000a] text-xs rounded-xl">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prenom" className="text-xs font-heading font-bold text-[#0d233a]">
                  Prénom
                </Label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="prenom"
                    type="text"
                    placeholder="Alexandre"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    required
                    className="pl-10 h-11 rounded-xl border-[#e2e8f0] focus-visible:ring-[#0d233a] text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nom" className="text-xs font-heading font-bold text-[#0d233a]">
                  Nom
                </Label>
                <Input
                  id="nom"
                  type="text"
                  placeholder="Dubois"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                  className="h-11 rounded-xl border-[#e2e8f0] focus-visible:ring-[#0d233a] text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-heading font-bold text-[#0d233a]">
                Adresse e-mail
              </Label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="votre@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="pl-10 h-11 rounded-xl border-[#e2e8f0] focus-visible:ring-[#0d233a] text-sm"
                />
              </div>
            </div>

            {/* Pays de résidence */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pays" className="text-xs font-heading font-bold text-[#0d233a] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#0d233a]" />
                  <span>Pays de résidence</span>
                </Label>
                {autoDetected && (
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium border border-emerald-200/60 inline-flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                    Détecté automatiquement
                  </span>
                )}
              </div>
              <div className="relative">
                <select
                  id="pays"
                  value={selectedCountry.code}
                  onChange={handleCountryChange}
                  className="w-full h-11 px-3 pl-10 pr-9 rounded-xl border border-[#e2e8f0] bg-white text-sm text-[#0d233a] font-medium focus:outline-none focus:ring-2 focus:ring-[#0d233a] focus:border-transparent cursor-pointer appearance-none shadow-sm"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.dialCode})
                    </option>
                  ))}
                </select>
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center select-none">
                  <CountryFlag country={selectedCountry.code} />
                </div>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#64748b]">
                  <ChevronDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Numéro de téléphone avec indicatif modifiable */}
            <div className="space-y-1.5">
              <Label htmlFor="telephone" className="text-xs font-heading font-bold text-[#0d233a] flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#0d233a]" />
                <span>Numéro de téléphone</span>
              </Label>
              <div className="flex gap-2">
                {/* Indicatif du pays (adapté automatiquement, modifiable manuellement) */}
                <div className="relative w-28 shrink-0">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={indicatif}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setIndicatif(digits ? `+${digits}` : '+');
                    }}
                    placeholder="+225"
                    className="h-11 rounded-xl border-[#e2e8f0] focus-visible:ring-[#0d233a] text-sm text-center font-bold text-[#0d233a] bg-slate-50"
                    title="Indicatif pays (ex: +225)"
                  />
                </div>

                {/* Numéro de téléphone local (chiffres uniquement) */}
                <div className="relative flex-1">
                  <Input
                    id="telephone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={15}
                    placeholder={(selectedCountry.placeholder || '0701234567').replace(/\D/g, '')}
                    value={telephone}
                    onChange={(e) => handleTelephoneChange(e.target.value)}
                    required
                    className="h-11 rounded-xl border-[#e2e8f0] focus-visible:ring-[#0d233a] text-sm"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#64748b]">
                L'indicatif s'adapte au pays choisi. Vous pouvez aussi le modifier si vous utilisez un numéro international.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-heading font-bold text-[#0d233a]">
                Mot de passe (6 caractères min.)
              </Label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="pl-10 pr-10 h-11 rounded-xl border-[#e2e8f0] focus-visible:ring-[#0d233a] text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#0d233a] p-1"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="confirmPassword" className="text-xs font-heading font-bold text-[#0d233a]">
                  Confirmer le mot de passe
                </Label>
                {confirmPassword.length > 0 && (
                  <span
                    className={`text-[11px] font-semibold ${
                      password === confirmPassword ? 'text-emerald-600' : 'text-[#e53e3e]'
                    }`}
                  >
                    {password === confirmPassword ? '✓ Identique' : '✗ Ne correspond pas'}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className={`pl-10 pr-10 h-11 rounded-xl text-sm ${
                    confirmPassword.length > 0 && password !== confirmPassword
                      ? 'border-[#e53e3e] focus-visible:ring-[#e53e3e]'
                      : confirmPassword.length > 0 && password === confirmPassword
                      ? 'border-emerald-500 focus-visible:ring-emerald-600'
                      : 'border-[#e2e8f0] focus-visible:ring-[#0d233a]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#475569] hover:text-[#0d233a] p-1"
                  aria-label={showConfirmPassword ? 'Masquer la confirmation' : 'Afficher la confirmation'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-[#0d233a] hover:bg-[#1a365d] text-white font-heading font-bold text-sm rounded-xl shadow-md transition-all mt-3"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Inscription en cours...
                </>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <span>Créer mon compte et continuer</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-xs text-[#475569]">
              Vous possédez déjà un compte ?{' '}
              <Link to="/connexion" className="text-[#e53e3e] font-bold hover:underline">
                Se connecter
              </Link>
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-[#e2e8f0]">
            <p className="text-[11px] text-[#475569] text-center leading-relaxed">
              En créant votre compte, vous acceptez les conditions d'utilisation de <strong>Mon TCF CA</strong>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
