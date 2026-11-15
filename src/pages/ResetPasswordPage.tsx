import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import BrandLogo from '@/components/common/BrandLogo';
import { Eye, EyeOff, Loader2, CheckCircle2, Lock, ArrowRight, KeyRound, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const { updatePassword, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    // 1. Écouter l'événement Supabase de récupération
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || session?.user) {
        setHasRecoverySession(true);
        setCheckingSession(false);
      }
    });

    // 2. Vérifier si un token de récupération est présent dans l'URL ou si une session est active
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (session?.user) {
        setHasRecoverySession(true);
      } else if (
        window.location.hash.includes('type=recovery') ||
        window.location.hash.includes('access_token') ||
        window.location.search.includes('code=') ||
        window.location.search.includes('token_hash=')
      ) {
        setHasRecoverySession(true);
      }

      setCheckingSession(false);
    };

    checkSession();

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password || !confirmPassword) {
      setError('Veuillez remplir tous les champs.');
      return;
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);

    const { error: updateError } = await updatePassword(password);

    if (updateError) {
      setLoading(false);
      setError(updateError.message || 'Impossible de mettre à jour le mot de passe.');
      return;
    }

    // Déclencher l'email transactionnel N°3 (Confirmation de changement de mot de passe)
    try {
      const targetEmail = user?.email;
      if (targetEmail) {
        supabase.functions.invoke('send-email', {
          body: {
            type: 'auth_password_changed',
            destinataire: targetEmail,
            user_id: user?.id,
            data: {
              prenom: user?.user_metadata?.prenom || 'Candidat',
              email: targetEmail,
            },
          },
        }).catch((err) => console.warn('Notification email error:', err));
      }
    } catch {
      // Non-bloquant
    }

    setSuccess(true);
    setLoading(false);
    toast.success('Mot de passe mis à jour avec succès !');

    setTimeout(() => {
      navigate('/connexion', { replace: true });
    }, 2500);
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
            <KeyRound className="w-3.5 h-3.5 text-[#e53e3e]" />
            <span>Sécurité du Compte</span>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-heading font-extrabold text-[#0d233a]">
            Nouveau mot de passe
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-[#475569] mt-1">
            Définissez un mot de passe robuste pour sécuriser votre espace Mon TCFCA
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-0">
          {checkingSession ? (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <Loader2 className="w-7 h-7 text-[#0d233a] animate-spin" />
              <p className="text-xs text-[#475569]">Validation de votre lien sécurisé...</p>
            </div>
          ) : !hasRecoverySession && !user ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto border border-amber-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#0d233a]">Lien invalide ou expiré</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Ce lien de réinitialisation n'est plus actif ou a déjà été utilisé. Veuillez demander un nouveau lien depuis la page de connexion.
              </p>
              <Button
                onClick={() => navigate('/connexion')}
                className="w-full bg-[#0d233a] hover:bg-[#1a365d] text-white rounded-xl mt-4"
              >
                Demander un nouveau lien
              </Button>
            </div>
          ) : success ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto border border-green-200">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-[#0d233a]">Mot de passe modifié avec succès !</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Votre mot de passe a bien été mis à jour. Vous allez être redirigé vers la page de connexion dans quelques secondes...
              </p>
              <Button
                onClick={() => navigate('/connexion')}
                className="w-full bg-[#0d233a] hover:bg-[#1a365d] text-white rounded-xl mt-4"
              >
                Se connecter maintenant
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive" className="bg-[#ffdad6]/60 border-[#ba1a1a]/30 text-[#93000a] text-xs rounded-xl">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs font-heading font-bold text-[#0d233a]">
                  Nouveau mot de passe
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Au moins 8 caractères"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
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
                <Label htmlFor="confirm-password" className="text-xs font-heading font-bold text-[#0d233a]">
                  Confirmer le nouveau mot de passe
                </Label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#475569] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Répétez le mot de passe"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="pl-10 h-11 rounded-xl border-[#e2e8f0] focus-visible:ring-[#0d233a] text-sm"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[#0d233a] hover:bg-[#1a365d] text-white font-heading font-bold text-sm rounded-xl shadow-md transition-all mt-2"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enregistrement...
                  </>
                ) : (
                  <span className="flex items-center justify-center gap-1.5">
                    <span>Valider mon nouveau mot de passe</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>
          )}

          <div className="mt-5 text-center">
            <Link to="/connexion" className="text-xs text-[#0d233a] hover:text-[#e53e3e] font-semibold transition-colors">
              ← Retour à la page de connexion
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
