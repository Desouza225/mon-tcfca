import type React from 'react';
import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { RouteGuard } from '@/components/layouts/RouteGuard';
import { AppLayout } from '@/components/layouts/AppLayout';
import { ErrorBoundary, RouteErrorBoundary } from '@/components/layouts/ErrorBoundary';
import { SubscriptionGate } from '@/components/common/SubscriptionGate';
import { SupportFloatingButton } from '@/components/common/SupportFloatingButton';
import { trackPageView } from '@/lib/analytics';

// Public
import HomePage from '@/pages/HomePage';
import ConnexionPage from '@/pages/ConnexionPage';
import InscriptionPage from '@/pages/InscriptionPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import PromoVideoPage from '@/pages/PromoVideoPage';

// Étudiant
import EtudiantDashboard from '@/pages/etudiant/EtudiantDashboard';
import CoursPage from '@/pages/etudiant/CoursPage';
import CourseDetailPage from '@/pages/etudiant/CourseDetailPage';
import EntrainementPage from '@/pages/etudiant/EntrainementPage';
import ExamenBlancPage from '@/pages/etudiant/ExamenBlancPage';
import AbonnementPage from '@/pages/etudiant/AbonnementPage';
import AbonnementSuccessPage from '@/pages/etudiant/AbonnementSuccessPage';
import HistoriquePage from '@/pages/etudiant/HistoriquePage';
import BilanHebdomadairePage from '@/pages/etudiant/BilanHebdomadairePage';
import DetailCorrectionPage from '@/pages/etudiant/DetailCorrectionPage';
import NotificationsPage from '@/pages/etudiant/NotificationsPage';
import ProfilPage from '@/pages/etudiant/ProfilPage';

// Admin
import AdminDashboard from '@/pages/admin/AdminDashboard';
import CoursAdminPage from '@/pages/admin/CoursAdminPage';
import QuestionsPage from '@/pages/admin/QuestionsPage';
import UtilisateursPage from '@/pages/admin/UtilisateursPage';
import SuiviEtudiantsPage from '@/pages/admin/SuiviEtudiantsPage';
import RetentionPage from '@/pages/admin/RetentionPage';
import EmailsTestPage from '@/pages/admin/EmailsTestPage';
import CorrectionsPage from '@/pages/professeur/CorrectionsPage';
import CorrectionInterface from '@/pages/professeur/CorrectionInterface';

// Tracker automatique d'analytics de visites
function PageTracker() {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    trackPageView(location.pathname, document.title, user?.id);
  }, [location.pathname, user?.id]);

  return null;
}

// Wrapper pour routes protégées avec AppLayout + ErrorBoundary par page
function Protected({ children, roles }: { children: React.ReactNode; roles: ('admin' | 'etudiant' | 'super_admin' | 'professeur')[] }) {
  return (
    <RouteGuard allowedRoles={roles}>
      <AppLayout>
        <RouteErrorBoundary>
          {children}
        </RouteErrorBoundary>
      </AppLayout>
    </RouteGuard>
  );
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <PageTracker />
          <Routes>
            {/* ═══ Routes publiques ═══ */}
            <Route path="/" element={<HomePage />} />
            <Route path="/connexion" element={<ConnexionPage />} />
            <Route path="/inscription" element={<InscriptionPage />} />
            <Route path="/reinitialisation-mot-de-passe" element={<ResetPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/promo-video" element={<PromoVideoPage />} />

            {/* ═══ Espace Étudiant ═══ */}
            <Route path="/etudiant" element={<Protected roles={['etudiant', 'admin', 'super_admin']}><EtudiantDashboard /></Protected>} />
            <Route path="/etudiant/cours" element={<Protected roles={['etudiant', 'admin', 'super_admin']}><CoursPage /></Protected>} />
            <Route path="/etudiant/cours/:id" element={<Protected roles={['etudiant', 'admin', 'super_admin']}><CourseDetailPage /></Protected>} />
            <Route
              path="/etudiant/entrainement"
              element={
                <Protected roles={['etudiant', 'admin', 'super_admin']}>
                  <SubscriptionGate
                    fallbackTitle="Abonnement requis pour l'entraînement ciblé"
                    fallbackDescription="Votre compte ne dispose pas d'un abonnement actif. Souscrivez ou renouvelez votre formule pour accéder aux sessions d'entraînement ciblé et aux corrections IA."
                  >
                    <EntrainementPage />
                  </SubscriptionGate>
                </Protected>
              }
            />
            <Route path="/etudiant/examen-blanc" element={<Protected roles={['etudiant', 'admin', 'super_admin']}><ExamenBlancPage /></Protected>} />
            <Route path="/etudiant/bilan-hebdomadaire" element={<Protected roles={['etudiant', 'admin', 'super_admin']}><BilanHebdomadairePage /></Protected>} />
            <Route path="/etudiant/abonnement" element={<Protected roles={['etudiant', 'admin', 'super_admin']}><AbonnementPage /></Protected>} />
            <Route path="/etudiant/abonnement/succes" element={<Protected roles={['etudiant', 'admin', 'super_admin']}><AbonnementSuccessPage /></Protected>} />
            <Route path="/abonnement/succes" element={<Protected roles={['etudiant', 'admin', 'super_admin']}><AbonnementSuccessPage /></Protected>} />
            <Route path="/etudiant/historique" element={<Protected roles={['etudiant', 'admin', 'super_admin']}><HistoriquePage /></Protected>} />
            <Route path="/etudiant/historique/:id" element={<Protected roles={['etudiant', 'admin', 'super_admin']}><DetailCorrectionPage /></Protected>} />
            <Route path="/etudiant/corrections/:id" element={<Protected roles={['etudiant', 'admin', 'super_admin']}><DetailCorrectionPage /></Protected>} />
            <Route path="/etudiant/notifications" element={<Protected roles={['etudiant', 'admin', 'super_admin']}><NotificationsPage /></Protected>} />
            <Route path="/etudiant/profil" element={<Protected roles={['etudiant', 'admin', 'super_admin']}><ProfilPage /></Protected>} />

            {/* ═══ Espace Admin (Gestionnaire & Coach) ═══ */}
            <Route path="/admin" element={<Protected roles={['admin', 'super_admin']}><AdminDashboard /></Protected>} />
            <Route path="/admin/cours" element={<Protected roles={['admin', 'super_admin']}><CoursAdminPage /></Protected>} />
            <Route path="/admin/corrections" element={<Protected roles={['admin', 'super_admin']}><CorrectionsPage /></Protected>} />
            <Route path="/admin/corrections/:id" element={<Protected roles={['admin', 'super_admin']}><CorrectionInterface /></Protected>} />
            <Route path="/admin/questions" element={<Protected roles={['admin', 'super_admin']}><QuestionsPage /></Protected>} />
            <Route path="/admin/utilisateurs" element={<Protected roles={['admin', 'super_admin']}><UtilisateursPage /></Protected>} />
            <Route path="/admin/suivi-etudiants" element={<Protected roles={['admin', 'super_admin']}><SuiviEtudiantsPage /></Protected>} />
            <Route path="/admin/retention" element={<Protected roles={['admin', 'super_admin']}><RetentionPage /></Protected>} />
            <Route path="/admin/emails" element={<Protected roles={['admin', 'super_admin']}><EmailsTestPage /></Protected>} />
            <Route path="/admin/profil" element={<Protected roles={['admin', 'super_admin']}><ProfilPage /></Protected>} />

            {/* ═══ Redirections de compatibilité ═══ */}
            <Route path="/professeur" element={<Navigate to="/admin" replace />} />
            <Route path="/professeur/*" element={<Navigate to="/admin" replace />} />

            {/* ═══ Fallback ═══ */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <SupportFloatingButton />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
