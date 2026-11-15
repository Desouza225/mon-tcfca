import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth, setCachedAvatar } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, User, Lock, Eye, EyeOff, Globe, Phone, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { ROLE_LABELS } from '@/types/index';
import { COUNTRIES, findCountryByName } from '@/data/countries';
import { CountryFlag } from '@/components/ui/CountryFlag';

const AVATAR_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo

function compressImageToSquare(
  file: File,
  maxSize = 200
): Promise<{ blob: Blob; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const minSide = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
        const sx = Math.max(0, Math.floor(((img.naturalWidth || img.width) - minSide) / 2));
        const sy = Math.max(0, Math.floor(((img.naturalHeight || img.height) - minSide) / 2));

        const canvas = document.createElement('canvas');
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Impossible d’initialiser le contexte canvas.'));
          return;
        }

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, maxSize, maxSize);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        canvas.toBlob(
          blob => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              reject(new Error("Erreur lors de la compression de l'image."));
              return;
            }
            resolve({ blob, dataUrl });
          },
          'image/jpeg',
          0.82
        );
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Impossible de lire le fichier image sélectionné."));
    };
    img.src = objectUrl;
  });
}

export default function ProfilPage() {
  const { profile, user, refreshProfile } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Infos personnelles
  const [form, setForm] = useState({
    nom: profile?.nom || '',
    prenom: profile?.prenom || '',
    pays: profile?.pays || '',
    telephone: profile?.telephone || '',
  });
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [errorProfile, setErrorProfile] = useState('');

  useEffect(() => {
    if (profile) {
      setForm({
        nom: profile.nom || '',
        prenom: profile.prenom || '',
        pays: profile.pays || '',
        telephone: profile.telephone || '',
      });
    }
  }, [profile]);

  // Mot de passe
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [loadingPw, setLoadingPw] = useState(false);
  const [errorPw, setErrorPw] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const clearAvatarPickerFlag = () => {
    try {
      sessionStorage.removeItem('avatar_picker_open');
    } catch {
      // Ignorer
    }
  };

  useEffect(() => {
    const handleWindowFocus = () => {
      // Si l'utilisateur annule le sélecteur de fichier, nettoyer le flag après un court délai
      setTimeout(() => {
        if (!uploadingAvatar) {
          clearAvatarPickerFlag();
        }
      }, 1500);
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      clearAvatarPickerFlag();
    };
  }, [uploadingAvatar]);

  const openAvatarPicker = () => {
    try {
      sessionStorage.setItem('avatar_picker_open', 'true');
    } catch {
      // Ignorer
    }
    avatarInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !profile) {
      clearAvatarPickerFlag();
      return;
    }

    if (!AVATAR_ACCEPTED_TYPES.includes(file.type)) {
      clearAvatarPickerFlag();
      toast.error('Format non supporté. Utilisez une image JPEG, PNG, WebP ou GIF.');
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      clearAvatarPickerFlag();
      toast.error('Image trop volumineuse. Taille maximale : 5 Mo.');
      return;
    }

    setUploadingAvatar(true);
    setErrorProfile('');
    try {
      const { blob, dataUrl } = await compressImageToSquare(file, 200);

      let finalAvatarUrl = dataUrl;
      // Enregistrer immédiatement en cache local pour garantir la persistance côté client
      setCachedAvatar(profile.id, dataUrl);

      const filePath = `${profile.id}/avatar_${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
        if (urlData?.publicUrl) {
          finalAvatarUrl = urlData.publicUrl;
          setCachedAvatar(profile.id, finalAvatarUrl);
        }
      } else {
        console.warn('Upload Storage avatars indisponible, repli base64:', uploadErr.message);
      }

      const { data: updatedRow, error: updateErr } = await supabase
        .from('profiles')
        .update({ avatar_url: finalAvatarUrl })
        .eq('id', profile.id)
        .select('id, avatar_url')
        .maybeSingle();

      if (updateErr || !updatedRow) {
        console.warn(
          'Mise à jour directe profiles.avatar_url non confirmée, tentative via RPC:',
          updateErr?.message || '0 ligne affectée'
        );
        try {
          const { error: rpcErr } = await supabase.rpc('update_own_avatar', {
            p_avatar_url: finalAvatarUrl,
          });
          if (rpcErr) {
            console.warn('RPC update_own_avatar indisponible:', rpcErr.message);
          }
        } catch (rpcCatchErr) {
          console.warn('Exception RPC update_own_avatar:', rpcCatchErr);
        }
      }

      await refreshProfile();
      toast.success('Photo de profil mise à jour avec succès !');
    } catch (err: any) {
      console.error('Erreur chargement photo de profil:', err);
      toast.error(err?.message || 'Impossible de charger la photo de profil.');
    } finally {
      clearAvatarPickerFlag();
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setLoadingProfile(true);
    setErrorProfile('');
    const { error: err } = await supabase
      .from('profiles')
      .update({
        nom: form.nom || null,
        prenom: form.prenom || null,
        pays: form.pays || null,
        telephone: form.telephone || null,
      })
      .eq('id', profile.id);
    setLoadingProfile(false);
    if (err) { setErrorProfile('Erreur lors de la mise à jour. Veuillez réessayer.'); return; }
    await refreshProfile();
    toast.success('Profil mis à jour avec succès !');
  };

  const handleChangePassword = async () => {
    setErrorPw('');
    if (!pwForm.current) { setErrorPw('Veuillez saisir votre mot de passe actuel.'); return; }
    if (pwForm.next.length < 6) { setErrorPw('Le nouveau mot de passe doit contenir au moins 6 caractères.'); return; }
    if (pwForm.next !== pwForm.confirm) { setErrorPw('Les deux mots de passe ne correspondent pas.'); return; }
    if (!user?.email) { setErrorPw('Impossible de vérifier votre identité. Reconnectez-vous.'); return; }

    setLoadingPw(true);

    // Vérifier le mot de passe actuel via re-auth
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: pwForm.current,
    });
    if (authError) {
      setLoadingPw(false);
      setErrorPw('Mot de passe actuel incorrect.');
      return;
    }

    // Appliquer le nouveau mot de passe
    const { error: updateError } = await supabase.auth.updateUser({ password: pwForm.next });
    setLoadingPw(false);
    if (updateError) {
      setErrorPw('Erreur lors du changement de mot de passe. Veuillez réessayer.');
      return;
    }

    setPwForm({ current: '', next: '', confirm: '' });
    toast.success('Mot de passe modifié avec succès !');

    // Déclencher l'email de confirmation de changement de mot de passe (Email 3)
    supabase.functions.invoke('send-email', {
      body: {
        type: 'auth_password_changed',
        user_id: user.id,
        email: user.email,
        data: {
          prenom: profile?.prenom || 'Cher candidat',
          dateChangement: new Date().toLocaleString('fr-FR', { timeZone: 'UTC' }),
        },
      },
    }).catch((err) => console.error('⚠️ Échec non-bloquant notification email:', err));
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground text-balance">Mon profil</h1>
        <p className="text-muted-foreground mt-1">Gérez vos informations personnelles et votre sécurité</p>
      </div>

      {/* Informations personnelles */}
      <Card className="h-full">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={openAvatarPicker}
                disabled={uploadingAvatar}
                title="Cliquez pour charger une photo de profil"
                aria-label="Charger une photo de profil"
                className="group relative w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center overflow-hidden border-2 border-primary/20 hover:border-primary/60 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={`${profile.prenom || ''} ${profile.nom || 'Profil'}`.trim()}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  <User className="w-8 h-8 text-primary" />
                )}

                <span
                  className={`absolute inset-0 rounded-full bg-black/50 flex items-center justify-center transition-opacity ${
                    uploadingAvatar ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-white" />
                  )}
                </span>
              </button>

              <span
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm border-2 border-background"
              >
                <Camera className="w-3 h-3" />
              </span>

              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div>
              <p className="font-semibold text-foreground">{profile?.prenom} {profile?.nom}</p>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                {profile?.role && (
                  <Badge variant="outline" className="text-xs">{ROLE_LABELS[profile.role]}</Badge>
                )}
                {profile?.pays && (
                  <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-800">
                    <CountryFlag country={profile.pays} showName />
                  </Badge>
                )}
                {profile?.telephone && (
                  <Badge variant="secondary" className="text-xs bg-slate-100 text-slate-800">
                    <Phone className="w-3 h-3 mr-1" />
                    {profile.telephone}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorProfile && <Alert variant="destructive"><AlertDescription>{errorProfile}</AlertDescription></Alert>}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prenom" className="text-sm font-normal">Prénom</Label>
              <Input
                id="prenom"
                value={form.prenom}
                onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                className="px-3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom" className="text-sm font-normal">Nom</Label>
              <Input
                id="nom"
                value={form.nom}
                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                className="px-3"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-normal">Adresse e-mail</Label>
            <Input value={profile?.email || ''} disabled className="bg-muted px-3" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profil-pays" className="text-sm font-normal">Pays de résidence</Label>
              <div className="relative">
                <select
                  id="profil-pays"
                  value={form.pays}
                  onChange={e => {
                    const val = e.target.value;
                    const country = findCountryByName(val);
                    setForm(f => {
                      // Si le téléphone était vide ou ne contenait qu'un indicatif, proposer le nouvel indicatif
                      if (country && (!f.telephone || f.telephone.startsWith('+'))) {
                        return { ...f, pays: val, telephone: country.dialCode + ' ' };
                      }
                      return { ...f, pays: val };
                    });
                  }}
                  className={`w-full h-10 px-3 ${form.pays ? 'pl-9' : ''} rounded-md border border-input bg-background text-sm cursor-pointer`}
                >
                  <option value="">Sélectionner un pays</option>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.name}>
                      {c.name} ({c.dialCode})
                    </option>
                  ))}
                </select>
                {form.pays && (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center select-none">
                    <CountryFlag country={form.pays} />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="profil-telephone" className="text-sm font-normal">Numéro de téléphone</Label>
              <Input
                id="profil-telephone"
                value={form.telephone}
                placeholder="+225 07 01 23 45 67"
                onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
                className="px-3"
              />
            </div>
          </div>
          <Button onClick={handleSaveProfile} disabled={loadingProfile} className="w-full">
            {loadingProfile
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sauvegarde...</>
              : 'Enregistrer les modifications'}
          </Button>
        </CardContent>
      </Card>

      {/* Changement de mot de passe */}
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-balance">
            <Lock className="w-4 h-4 text-primary shrink-0" />
            Changer le mot de passe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorPw && <Alert variant="destructive"><AlertDescription>{errorPw}</AlertDescription></Alert>}

          <div className="space-y-2">
            <Label htmlFor="current-pw" className="text-sm font-normal">Mot de passe actuel</Label>
            <div className="relative">
              <Input
                id="current-pw"
                type={showCurrent ? 'text' : 'password'}
                value={pwForm.current}
                onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                className="px-3 pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="new-pw" className="text-sm font-normal">Nouveau mot de passe</Label>
            <div className="relative">
              <Input
                id="new-pw"
                type={showNext ? 'text' : 'password'}
                value={pwForm.next}
                onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
                className="px-3 pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNext(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNext ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Minimum 6 caractères</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-pw" className="text-sm font-normal">Confirmer le nouveau mot de passe</Label>
            <div className="relative">
              <Input
                id="confirm-pw"
                type={showConfirm ? 'text' : 'password'}
                value={pwForm.confirm}
                onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                className="px-3 pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={loadingPw || !pwForm.current || !pwForm.next || !pwForm.confirm}
            variant="secondary"
            className="w-full"
          >
            {loadingPw
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Modification...</>
              : 'Modifier le mot de passe'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
