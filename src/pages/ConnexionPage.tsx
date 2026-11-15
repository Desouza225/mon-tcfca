import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import BrandLogo from '@/components/common/BrandLogo';
import { Eye, EyeOff, Loader2, ShieldCheck, ArrowRight, Lock, Mail, KeyRound, CheckCircle2, Send } from 'lucide-react';
import { toast } from 'sonner';

function getDefaultRoute(role: string): string {
  switch (role) {
    case 'super_admin':
    case 'admin':
    case 'professeur':
      return '/admin';
    case 'etudiant':
      return '/etudiant';
    default:
      return '/';
  }
}

function getSafeRedirectTarget(rawFrom: unknown, role: string): string {
  const defaultRoute = getDefaultRoute(role);
  if (typeof rawFrom !== 'string') return defaultRoute;
  // Prévenir toute redirection ouverte (open redirect) vers un domaine externe
  if (!rawFrom.startsWith('/') || rawFrom.startsWith('//')) return defaultRoute;
  if (rawFrom === '/connexion' || rawFrom === '/inscription') return defaultRoute;
  // Un étudiant ne peut jamais être redirigé vers l'espace admin
  if (role === 'etudiant' && (rawFrom.startsWith('/admin') || rawFrom.startsWith('/professeur'))) {
    return defaultRoute;
  }
  return rawFrom;
}

function getErrorMessage(error: Error): string {
  const msg = error.message.toLowerCase();
  if (msg.includes('bloqué') || msg.includes('suspendu')) {
    return error.message;
  }
  if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
    return "Votre adresse e-mail n'a pas encore été confirmée. Veuillez vérifier votre boîte de réception ou contacter un administrateur.";
  }
  if (msg.includes('database error querying schema') || msg.includes('database error finding user')) {
    return "Une erreur technique est survenue lors de la vérification du compte. Veuillez contacter un administrateur.";
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    return "Adresse e-mail ou mot de passe incorrect. Assurez-vous de saisir votre adresse e-mail complète et vérifiez votre mot de passe.";
  }
  if (msg.includes('user not found')) {
    return "Aucun compte trouvé avec cette adresse e-mail. Vérifiez l'adresse saisie ou contactez un administrateur.";
  }
  if (msg.includes('too many requests') || msg.includes('rate limit')) {
    return "Trop de tentatives de connexion échouées. Veuillez patienter quelques instants avant de réessayer.";
  }
  return error.message || 'Adresse e-mail ou mot de passe incorrect.';
}

export default function ConnexionPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Mot de passe oublié modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const { signIn, resetPassword, profile, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPathname = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      setForgotError('Veuillez saisir votre adresse e-mail.');
      return;
    }
    setForgotLoading(true);
    setForgotError('');

    const { error: err } = await resetPassword(forgotEmail);
    setForgotLoading(false);

    if (err) {
      const msg = err.message.toLowerCase();
      if (msg.includes('rate limit') || msg.includes('too many requests')) {
        setForgotError('Trop de demandes récentes. Veuillez patienter quelques minutes avant de réessayer.');
      } else {
        setForgotError(err.message || "Erreur lors de l'envoi de l'e-mail.");
      }
      return;
    }

    setForgotSuccess(true);
    toast.success('E-mail de réinitialisation envoyé !');
  };

  // Rediriger dès que user + profile sont disponibles
  useEffect(() => {
    if (!authLoading && user && profile) {
      navigate(getSafeRedirectTarget(fromPathname, profile.role), { replace: true });
    }
  }, [authLoading, user, profile, navigate, fromPathname]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setLoading(true);
    setError('');

    const cleanEmail = email.trim().toLowerCase();
    const { error: signInError } = await signIn(cleanEmail, password);

    if (signInError) {
      setLoading(false);
      setError(getErrorMessage(signInError));
      return;
    }

    toast.success('Connexion réussie !');
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex flex-col items-center justify-center p-4 sm:p-6 select-none">
      {/* Brand Header */}
      <Link to="/" className="mb-6 hover:scale-105 transition-transform flex flex-col items-center">
        <BrandLogo size="xl" showSubtitle />
      </Link>

      <Card className="w-full max-w-[calc(100%-1rem)] sm:max-w-md bg-white border border-[#e2e8f0] shadow-lg rounded-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#0d233a] via-[#e53e3e] to-[#d97706]" />

        <CardHeader className="text-center pt-6 pb-4 px-6">
          <div className="inline-flex items-center gap-1.5 mx-auto bg-[#eff4ff] text-[#0d233a] border border-[#d3e4fe] px-3 py-1 rounded-full text-xs font-semibold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#e53e3e]" />
            <span>Portail Officiel Mon TCF CA</span>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-heading font-extrabold text-[#0d233a]">
            Espace Candidat &amp; Enseignant
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-[#475569] mt-1">
            Connectez-vous pour accéder à vos entraînements et corrections
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-0">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-[#ffdad6]/60 border-[#ba1a1a]/30 text-[#93000a] text-xs rounded-xl">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-heading font-bold text-[#0d233a]">
                Identifiant (Adresse e-mail)
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
              <p className="text-[11px] text-[#475569]">
                Saisissez l'e-mail utilisé lors de votre inscription
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-heading font-bold text-[#0d233a]">
                  Mot de passe
                </Label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotSuccess(false);
                    setForgotError('');
                    setShowForgotModal(true);
                  }}
                  className="text-xs font-semibold text-[#e53e3e] hover:text-[#b91c1c] hover:underline transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
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

            <Button
              type="submit"
              className="w-full h-11 bg-[#0d233a] hover:bg-[#1a365d] text-white font-heading font-bold text-sm rounded-xl shadow-md transition-all mt-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connexion en cours...
                </>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <span>Accéder à mon espace</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-5 text-center space-y-2">
            <p className="text-xs text-[#475569]">
              Pas encore de compte ?{' '}
              <Link to="/inscription" className="text-[#e53e3e] font-bold hover:underline">
                Créer un compte candidat
              </Link>
            </p>
            <p className="text-[11px] text-[#64748b]">
              Besoin d'un accès ou question sur votre compte ?{' '}
              <span className="text-[#0d233a] font-semibold">Contactez votre administrateur</span>.
            </p>
          </div>

          <div className="mt-5 pt-4 border-t border-[#e2e8f0]">
            <p className="text-[11px] text-[#475569] text-center leading-relaxed">
              En vous connectant, vous acceptez les conditions d'utilisation de <strong>Mon TCF CA</strong>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Modal Mot de passe oublié */}
      <Dialog open={showForgotModal} onOpenChange={setShowForgotModal}>
        <DialogContent className="max-w-md p-6 rounded-2xl bg-white shadow-2xl border border-[#e2e8f0]">
          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-lg font-heading font-bold text-[#0d233a] flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#e53e3e]" />
              Réinitialiser mon mot de passe
            </DialogTitle>
            <DialogDescription className="text-xs text-[#475569] leading-relaxed">
              Saisissez l'adresse e-mail associée à votre compte Mon TCFCA. Vous recevrez un e-mail automatique contenant un lien sécurisé pour créer votre nouveau mot de passe.
            </DialogDescription>
          </DialogHeader>

          {forgotSuccess ? (
            <div className="py-4 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto border border-green-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#0d233a]">E-mail envoyé avec succès !</h4>
              <p className="text-xs text-[#475569] leading-relaxed">
                Un e-mail de réinitialisation vient d'être envoyé à <strong>{forgotEmail}</strong>. Veuillez cliquer sur le lien reçu pour définir votre nouveau mot de passe.
              </p>
              <p className="text-[11px] text-[#64748b]">
                Pensez à vérifier votre dossier de courriers indésirables (spams) si vous ne le voyez pas dans les 2 minutes.
              </p>
              <Button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-full bg-[#0d233a] hover:bg-[#1a365d] text-white rounded-xl text-xs mt-3 h-10 font-bold"
              >
                Fermer
              </Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4 pt-2">
              {forgotError && (
                <Alert variant="destructive" className="bg-[#ffdad6]/60 border-[#ba1a1a]/30 text-[#93000a] text-xs rounded-xl">
                  <AlertDescription>{forgotError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-xs font-heading font-bold text-[#0d233a]">
                  Adresse e-mail du compte
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="votre@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                    className="pl-10 h-11 rounded-xl border-[#e2e8f0] focus-visible:ring-[#0d233a] text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForgotModal(false)}
                  className="w-1/3 h-10 rounded-xl border-[#e2e8f0] text-xs font-semibold"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-2/3 h-10 bg-[#0d233a] hover:bg-[#1a365d] text-white rounded-xl text-xs font-bold shadow-md transition-all"
                >
                  {forgotLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Envoi en cours...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" /> Envoyer le lien
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
