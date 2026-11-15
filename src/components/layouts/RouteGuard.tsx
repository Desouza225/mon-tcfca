import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/types/index';

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  redirectTo?: string;
}

export function RouteGuard({ children, allowedRoles, redirectTo = '/connexion' }: RouteGuardProps) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  // Attendre la fin du chargement de l'auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile || profile.bloque) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  const role = profile.role;
  const isAuthorized = allowedRoles.includes(role) || 
    (allowedRoles.includes('admin') && (role === 'admin' || role === 'super_admin' || role === 'professeur'));

  if (!isAuthorized) {
    // Rediriger vers l'espace approprié selon le rôle
    if (role === 'admin' || role === 'super_admin' || role === 'professeur') {
      return <Navigate to="/admin" replace />;
    }
    return <Navigate to="/etudiant" replace />;
  }

  return <>{children}</>;
}
