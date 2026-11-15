import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Send, CheckCircle2, RefreshCw, Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmailModelItem {
  id: string;
  titre: string;
  categorie: 'auth' | 'paiement' | 'relance';
  description: string;
  defaultData: Record<string, string | number>;
}

interface CronSummary {
  remindersJ7?: number;
  remindersJ1?: number;
  expirations?: number;
  inactivities?: number;
}

interface EmailLogItem {
  id: string;
  created_at: string;
  type: string;
  destinataire: string;
  statut: string;
  resend_id: string | null;
}

const EMAIL_MODELS: EmailModelItem[] = [
  // 1. Authentification
  {
    id: 'auth_verification',
    titre: '1. Vérification d’email',
    categorie: 'auth',
    description: 'Envoyé à l’inscription pour valider l’adresse email du candidat.',
    defaultData: { prenom: 'Alexandre', confirmationUrl: 'https://mon-tcfca.com/confirmation' },
  },
  {
    id: 'auth_password_reset',
    titre: '2. Réinitialisation mot de passe',
    categorie: 'auth',
    description: 'Lien sécurisé à usage unique pour redéfinir son mot de passe.',
    defaultData: { prenom: 'Alexandre', confirmationUrl: 'https://mon-tcfca.com/reset-password?token=sample' },
  },
  {
    id: 'auth_password_changed',
    titre: '3. Confirmation changement mot de passe',
    categorie: 'auth',
    description: 'Alerte de sécurité envoyée après mise à jour réussie des identifiants.',
    defaultData: { prenom: 'Alexandre', dateChangement: new Date().toLocaleString('fr-FR') },
  },
  // 2. Paiement & Souscription
  {
    id: 'subscription_confirmed',
    titre: '4. Confirmation de souscription',
    categorie: 'paiement',
    description: 'Activation du compte et crédit des quotas officiels (EE, EO, Examens).',
    defaultData: { planNom: 'Formule Standard', quotaEe: 20, quotaEo: 12, quotaExamens: 2, dureeJours: 30 },
  },
  {
    id: 'payment_receipt',
    titre: '5. Reçu / Facture de paiement',
    categorie: 'paiement',
    description: 'Document officiel avec n° de reçu, montant, devise, mode et référence.',
    defaultData: {
      numeroRecu: 'REC-2026-89412',
      planNom: 'Formule Standard (30 jours)',
      montant: '18 000',
      devise: 'FCFA',
      methodePaiement: 'Orange Money / Wave',
      reference: 'PAY-TCF-89412567',
      datePaiement: new Date().toLocaleDateString('fr-FR'),
    },
  },
  {
    id: 'payment_failed',
    titre: '6. Notification d’échec de paiement',
    categorie: 'paiement',
    description: 'Alerte en cas de rejet avec motif opérateur et lien direct pour réessayer.',
    defaultData: {
      planNom: 'Formule Intensif',
      motifEchec: 'Solde insuffisant ou délai de validation Mobile Money dépassé',
      actionUrl: 'https://mon-tcfca.com/etudiant/abonnement',
    },
  },
  {
    id: 'renewal_confirmed',
    titre: '9. Confirmation de renouvellement',
    categorie: 'paiement',
    description: 'Confirmation de reconduction mensuelle et réinitialisation des quotas.',
    defaultData: { planNom: 'Formule Standard', dateFin: '30 jours' },
  },
  // 3. Relances & Cycle de vie
  {
    id: 'expiration_reminder',
    titre: '7. Rappel avant expiration (J-7 / J-1)',
    categorie: 'relance',
    description: 'Rappel d’échéance avec décompte des jours et quotas restants.',
    defaultData: {
      joursRestants: 7,
      planNom: 'Formule Standard',
      dateFin: new Date(Date.now() + 7 * 86400000).toLocaleDateString('fr-FR'),
      quotaEe: 5,
      quotaEo: 2,
      quotaExamens: 1,
    },
  },
  {
    id: 'subscription_expired',
    titre: '8. Notification d’expiration',
    categorie: 'relance',
    description: 'Fin de validité de l’abonnement avec invitation à réactiver ses entraînements.',
    defaultData: { planNom: 'Formule Standard' },
  },
  {
    id: 'inactivity_reminder',
    titre: '10. Rappel de reprise d’activité',
    categorie: 'relance',
    description: 'Envoyé après 7 jours d’inactivité pour encourager la constance du travail.',
    defaultData: { prenom: 'Alexandre', joursInactivite: 7 },
  },
];

export default function EmailsTestPage() {
  const { user, isAdmin } = useAuth();
  const [recipientEmail, setRecipientEmail] = useState(user?.email || '');
  const [selectedModel, setSelectedModel] = useState<string>('subscription_confirmed');
  const [sending, setSending] = useState(false);
  const [runningCron, setRunningCron] = useState(false);
  const [cronResult, setCronResult] = useState<CronSummary | null>(null);
  const [logs, setLogs] = useState<EmailLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Charger les logs d'emails récents
  const loadLogs = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const { data, error } = await supabase
        .from('email_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs((data as EmailLogItem[]) || []);
    } catch (e: unknown) {
      console.error('Erreur chargement logs:', e);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Tester l'envoi d'un email
  const handleSendTest = async () => {
    if (!isAdmin) {
      toast.error('Action réservée aux administrateurs.');
      return;
    }
    const cleanEmail = recipientEmail.trim().toLowerCase();
    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      toast.error('Veuillez saisir une adresse email destinataire valide.');
      return;
    }

    const model = EMAIL_MODELS.find((m) => m.id === selectedModel);
    if (!model) return;

    try {
      setSending(true);
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          type: selectedModel,
          email: cleanEmail,
          user_id: user?.id,
          test: true,
          data: model.defaultData,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Email "${model.titre}" envoyé avec succès à ${cleanEmail} !`);
        loadLogs();
      } else {
        toast.error(`Erreur : ${data?.error || 'Échec d’envoi'}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Vérifiez la configuration Resend';
      toast.error(`Échec d’envoi : ${msg}`);
    } finally {
      setSending(false);
    }
  };

  // Déclencher manuellement le cron quotidien
  const handleRunDailyCron = async () => {
    if (!isAdmin) {
      toast.error('Action réservée aux administrateurs.');
      return;
    }
    try {
      setRunningCron(true);
      const { data, error } = await supabase.functions.invoke('cron-daily-emails');
      if (error) throw error;

      setCronResult((data?.summary || data) as CronSummary);
      toast.success('Cron quotidien exécuté avec succès !');
      loadLogs();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      toast.error(`Erreur exécution cron : ${msg}`);
    } finally {
      setRunningCron(false);
    }
  };

  const currentModel = EMAIL_MODELS.find((m) => m.id === selectedModel);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16 fade-in">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#0d233a]">
              Centre d'Emails Automatiques
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gestion, test et supervision des 10 emails transactionnels (Resend + Supabase Edge Functions)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleRunDailyCron}
            disabled={runningCron}
            variant="outline"
            className="rounded-xl border-slate-300 gap-2 text-xs font-heading font-semibold"
          >
            <Play className={cn('w-3.5 h-3.5', runningCron && 'animate-spin')} />
            <span>{runningCron ? 'Exécution...' : 'Tester le cron quotidien'}</span>
          </Button>

          <Button
            onClick={loadLogs}
            variant="ghost"
            size="icon"
            className="rounded-xl text-slate-500 hover:text-[#0d233a]"
          >
            <RefreshCw className={cn('w-4 h-4', loadingLogs && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Résumé du cron si exécuté */}
      {cronResult && (
        <Card className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span className="font-heading font-bold text-sm text-emerald-900">
                Résultat de la vérification quotidienne :
              </span>
            </div>
            <span className="text-xs text-emerald-700">Horodatage : {new Date().toLocaleTimeString()}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs">
            <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
              <span className="text-slate-500 block">Rappels J-7 :</span>
              <span className="font-bold text-sm text-emerald-800">{cronResult.remindersJ7 ?? 0}</span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
              <span className="text-slate-500 block">Rappels J-1 :</span>
              <span className="font-bold text-sm text-emerald-800">{cronResult.remindersJ1 ?? 0}</span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
              <span className="text-slate-500 block">Expirations :</span>
              <span className="font-bold text-sm text-emerald-800">{cronResult.expirations ?? 0}</span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-emerald-100">
              <span className="text-slate-500 block">Inactivité 7j :</span>
              <span className="font-bold text-sm text-emerald-800">{cronResult.inactivities ?? 0}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Grille principale : Testeur & Liste des modèles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne 1 : Liste des 10 modèles */}
        <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white lg:col-span-1 overflow-hidden">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-base font-heading font-bold text-[#0d233a]">
              Les 10 Modèles Officiels
            </CardTitle>
            <CardDescription className="text-xs">
              Sélectionnez un modèle pour le prévisualiser et le tester
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2 divide-y divide-slate-100 max-h-[580px] overflow-y-auto">
            {EMAIL_MODELS.map((model) => {
              const isSelected = selectedModel === model.id;
              return (
                <button
                  type="button"
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={cn(
                    'w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 my-0.5',
                    isSelected
                      ? 'bg-[#eff4ff] border border-[#bcd7fd] shadow-2xs'
                      : 'hover:bg-slate-50 text-slate-700'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold',
                      model.categorie === 'auth' && 'bg-blue-100 text-blue-700',
                      model.categorie === 'paiement' && 'bg-emerald-100 text-emerald-700',
                      model.categorie === 'relance' && 'bg-amber-100 text-amber-700'
                    )}
                  >
                    {model.categorie === 'auth' ? '🔐' : model.categorie === 'paiement' ? '💳' : '⏳'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-bold text-xs text-[#0d233a] truncate">{model.titre}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{model.description}</p>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Colonne 2 & 3 : Formulaire d'envoi de test & Prévisualisation */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
            <CardHeader className="p-5 sm:p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant="outline" className="mb-1 text-[11px] text-blue-700 border-blue-200 bg-blue-50">
                    {currentModel?.categorie.toUpperCase()}
                  </Badge>
                  <CardTitle className="text-lg font-heading font-bold text-[#0d233a]">
                    {currentModel?.titre}
                  </CardTitle>
                </div>
              </div>
              <CardDescription className="text-xs text-slate-600 mt-1">
                {currentModel?.description}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-4">
              <div>
                <Label htmlFor="recipient" className="text-xs font-heading font-semibold text-slate-700">
                  Adresse email destinataire du test :
                </Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    id="recipient"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="ex: votre-adresse@gmail.com"
                    className="h-10 rounded-xl bg-slate-50 border-slate-200 text-sm"
                  />
                  <Button
                    onClick={handleSendTest}
                    disabled={sending}
                    className="rounded-xl bg-[#0d233a] hover:bg-[#1a365d] text-white gap-2 text-xs font-heading font-semibold shrink-0"
                  >
                    <Send className={cn('w-4 h-4', sending && 'animate-spin')} />
                    <span>{sending ? 'Envoi...' : 'Envoyer ce test'}</span>
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  💡 <strong>Astuce :</strong> Durant la phase d'intégration Resend, testez de préférence vers l'adresse associée à votre compte Resend si votre domaine n'est pas encore vérifié.
                </p>
              </div>

              {/* Données simulées envoyées */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <span className="text-xs font-heading font-bold text-slate-700 block mb-2">
                  Variables de simulation incluses :
                </span>
                <pre className="p-3 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono overflow-x-auto max-h-40">
                  {JSON.stringify(currentModel?.defaultData, null, 2)}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Tableau des logs récents */}
          <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white overflow-hidden">
            <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-heading font-bold text-[#0d233a]">
                  Journal des 20 Derniers Envois (email_logs)
                </CardTitle>
                <CardDescription className="text-xs">
                  Historique temps réel des emails transactionnels expédiés
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100/75 text-slate-600 font-heading font-semibold">
                  <tr>
                    <th className="p-3 border-b border-slate-200">Date</th>
                    <th className="p-3 border-b border-slate-200">Type</th>
                    <th className="p-3 border-b border-slate-200">Destinataire</th>
                    <th className="p-3 border-b border-slate-200">Statut</th>
                    <th className="p-3 border-b border-slate-200">ID Resend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400">
                        Aucun email envoyé pour le moment. Réalisez votre premier test ci-dessus.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3 font-semibold text-[#0d233a] whitespace-nowrap">
                          {log.type}
                        </td>
                        <td className="p-3 text-slate-600 truncate max-w-[160px]">
                          {log.destinataire}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                              log.statut === 'sent' && 'bg-emerald-100 text-emerald-800',
                              log.statut === 'failed' && 'bg-rose-100 text-rose-800',
                              log.statut === 'rate_limited' && 'bg-amber-100 text-amber-800'
                            )}
                          >
                            {log.statut}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-slate-400 truncate max-w-[120px]">
                          {log.resend_id || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
