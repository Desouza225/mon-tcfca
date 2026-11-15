import type { ReactNode } from 'react';
import HomePage from './pages/HomePage';
import ConnexionPage from './pages/ConnexionPage';
import InscriptionPage from './pages/InscriptionPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PromoVideoPage from './pages/PromoVideoPage';

// Étudiant
import EtudiantDashboard from './pages/etudiant/EtudiantDashboard';
import CoursPage from './pages/etudiant/CoursPage';
import CourseDetailPage from './pages/etudiant/CourseDetailPage';
import EntrainementPage from './pages/etudiant/EntrainementPage';
import ExamenBlancPage from './pages/etudiant/ExamenBlancPage';
import AbonnementPage from './pages/etudiant/AbonnementPage';
import AbonnementSuccessPage from './pages/etudiant/AbonnementSuccessPage';
import HistoriquePage from './pages/etudiant/HistoriquePage';
import DetailCorrectionPage from './pages/etudiant/DetailCorrectionPage';
import NotificationsPage from './pages/etudiant/NotificationsPage';
import ProfilPage from './pages/etudiant/ProfilPage';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import CoursAdminPage from './pages/admin/CoursAdminPage';
import CorrectionsPage from './pages/professeur/CorrectionsPage';
import CorrectionInterface from './pages/professeur/CorrectionInterface';
import QuestionsPage from './pages/admin/QuestionsPage';
import UtilisateursPage from './pages/admin/UtilisateursPage';
import SuiviEtudiantsPage from './pages/admin/SuiviEtudiantsPage';
import RetentionPage from './pages/admin/RetentionPage';
import EmailsTestPage from './pages/admin/EmailsTestPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  // Public
  { name: 'Accueil', path: '/', element: <HomePage />, public: true },
  { name: 'Connexion', path: '/connexion', element: <ConnexionPage />, public: true },
  { name: 'Inscription', path: '/inscription', element: <InscriptionPage />, public: true },
  { name: 'Réinitialisation mot de passe', path: '/reinitialisation-mot-de-passe', element: <ResetPasswordPage />, public: true },
  { name: 'Reset Password', path: '/reset-password', element: <ResetPasswordPage />, public: true },
  { name: 'Vidéo Promotionnelle', path: '/promo-video', element: <PromoVideoPage />, public: true },

  // Espace Étudiant
  { name: 'Tableau de bord', path: '/etudiant', element: <EtudiantDashboard /> },
  { name: 'Cours & Fiches', path: '/etudiant/cours', element: <CoursPage /> },
  { name: 'Fiche pédagogique', path: '/etudiant/cours/:id', element: <CourseDetailPage /> },
  { name: 'Entraînement', path: '/etudiant/entrainement', element: <EntrainementPage /> },
  { name: 'Examen blanc', path: '/etudiant/examen-blanc', element: <ExamenBlancPage /> },
  { name: 'Mon abonnement', path: '/etudiant/abonnement', element: <AbonnementPage /> },
  { name: 'Succès Paiement', path: '/etudiant/abonnement/succes', element: <AbonnementSuccessPage /> },
  { name: 'Succès Paiement', path: '/abonnement/succes', element: <AbonnementSuccessPage /> },
  { name: 'Historique', path: '/etudiant/historique', element: <HistoriquePage /> },
  { name: 'Détail correction', path: '/etudiant/historique/:id', element: <DetailCorrectionPage /> },
  { name: 'Détail correction', path: '/etudiant/corrections/:id', element: <DetailCorrectionPage /> },
  { name: 'Notifications', path: '/etudiant/notifications', element: <NotificationsPage /> },
  { name: 'Profil', path: '/etudiant/profil', element: <ProfilPage /> },

  // Espace Admin
  { name: 'Dashboard Admin', path: '/admin', element: <AdminDashboard /> },
  { name: 'Gestion des cours', path: '/admin/cours', element: <CoursAdminPage /> },
  { name: 'Corrections', path: '/admin/corrections', element: <CorrectionsPage /> },
  { name: 'Correction copie', path: '/admin/corrections/:id', element: <CorrectionInterface /> },
  { name: 'Questions', path: '/admin/questions', element: <QuestionsPage /> },
  { name: 'Utilisateurs', path: '/admin/utilisateurs', element: <UtilisateursPage /> },
  { name: 'Suivi des étudiants', path: '/admin/suivi-etudiants', element: <SuiviEtudiantsPage /> },
  { name: 'Rétention des données', path: '/admin/retention', element: <RetentionPage /> },
  { name: 'Emails transactionnels & Logs', path: '/admin/emails', element: <EmailsTestPage /> },
  { name: 'Profil Admin', path: '/admin/profil', element: <ProfilPage /> },
];
