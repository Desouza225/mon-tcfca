import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BrandLogo from '@/components/common/BrandLogo';
import {
  LayoutDashboard, BookOpen, ClipboardList, BookMarked,
  Users, LogOut, ChevronLeft, ChevronRight, Bell,
  BarChart3, Settings, Database, Menu, X, LineChart, Shield, CreditCard, Mail
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useNotifications } from '@/hooks/useNotifications';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  badge?: number;
}

function useNavItems() {
  const { isAdmin, isProfesseur, isEtudiant } = useAuth();
  const { unreadCount } = useNotifications();

    const etudiantItems: NavItem[] = [
    { label: 'Tableau de bord', href: '/etudiant', icon: LayoutDashboard },
    { label: 'Cours & Fiches', href: '/etudiant/cours', icon: BookMarked },
    { label: 'Entraînement Ciblé', href: '/etudiant/entrainement', icon: BookOpen },
    { label: 'Examen blanc', href: '/etudiant/examen-blanc', icon: ClipboardList },
    { label: 'Mon abonnement', href: '/etudiant/abonnement', icon: CreditCard },
    { label: 'Historique', href: '/etudiant/historique', icon: BarChart3 },
    { label: 'Notifications', href: '/etudiant/notifications', icon: Bell, badge: unreadCount },
    { label: 'Profil', href: '/etudiant/profil', icon: Settings },
  ];

  const adminItems: NavItem[] = [
    { label: 'Tableau de bord', href: '/admin', icon: LayoutDashboard },
    { label: 'Gestion des cours', href: '/admin/cours', icon: BookMarked },
    { label: 'Corrections devoirs', href: '/admin/corrections', icon: ClipboardList },
    { label: 'Suivi des étudiants', href: '/admin/suivi-etudiants', icon: LineChart },
    { label: 'Banque de questions', href: '/admin/questions', icon: Database },
    { label: 'Utilisateurs', href: '/admin/utilisateurs', icon: Users },
    { label: 'Rétention des données', href: '/admin/retention', icon: Shield },
    { label: 'Emails & Logs', href: '/admin/emails', icon: Mail },
    { label: 'Profil', href: '/admin/profil', icon: Settings },
  ];

  if (isAdmin || isProfesseur) return adminItems;
  if (isEtudiant) return etudiantItems;
  return etudiantItems;
}

function SidebarContent({ collapsed, onClose }: { collapsed?: boolean; onClose?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, isAdmin, signOut } = useAuth();
  const navItems = useNavItems();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="flex flex-col h-full bg-[#0d233a] text-white border-r border-[#1a365d]/50 select-none">
      {/* Logo Section */}
      <div className={cn(
        'flex items-center border-b border-[#1a365d]/60 shrink-0 bg-[#091b2e]/60 backdrop-blur-sm',
        collapsed ? 'justify-center p-3' : 'px-4 py-4'
      )}>
        {collapsed ? (
          <Link to="/" className="flex items-center justify-center p-1">
            <img
              src="/images/logo/logo-icon-sidebar.png"
              alt="Mon TCF CA"
              className="w-9 h-9 object-contain hover:scale-105 transition-transform drop-shadow-sm"
            />
          </Link>
        ) : (
          <Link to="/" className="flex items-center gap-2 min-w-0 flex-1 py-0.5">
            <BrandLogo variant="sidebar" size="md" />
          </Link>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* User Profile Card */}
      {!collapsed && profile && (
        <div className="px-4 py-3 border-b border-[#1a365d]/40 bg-[#091b2e]/30">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1a365d] to-[#2a4d7d] flex items-center justify-center font-heading font-bold text-sm text-white shadow-sm border border-white/10">
                {profile.prenom?.charAt(0) || 'U'}{profile.nom?.charAt(0) || ''}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#0d233a]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-heading font-bold text-sm text-white truncate leading-tight">
                {profile.prenom} {profile.nom}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#d97706]" />
                <span className="text-[11px] text-white/70 uppercase tracking-wider font-medium truncate">
                  {isAdmin ? 'Administrateur' : 'Étudiant'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href ||
              (item.href !== '/etudiant' && item.href !== '/admin' &&
                location.pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 relative',
                    isActive
                      ? 'bg-gradient-to-r from-[#e53e3e] to-[#c53030] text-white shadow-md shadow-[#e53e3e]/20 font-semibold'
                      : 'text-white/80 hover:bg-[#1a365d]/50 hover:text-white'
                  )}
                >
                  <item.icon className={cn(
                    'shrink-0 transition-transform duration-150 group-hover:scale-110',
                    collapsed ? 'w-5 h-5 mx-auto' : 'w-4 h-4',
                    isActive ? 'text-white' : 'text-white/70 group-hover:text-white'
                  )} />
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <Badge className="bg-[#ffdcc3] text-[#6e3900] text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 shadow-sm border-0">
                          {item.badge}
                        </Badge>
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sign Out Button */}
      <div className="p-3 border-t border-[#1a365d]/50 shrink-0 bg-[#091b2e]/40">
        <Button
          variant="ghost"
          className={cn(
            'w-full text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all',
            collapsed ? 'px-2 justify-center' : 'justify-start gap-3'
          )}
          onClick={handleSignOut}
        >
          <LogOut className="w-4 h-4 shrink-0 text-[#e53e3e]" />
          {!collapsed && <span className="font-medium text-sm">Déconnexion</span>}
        </Button>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={cn(
        'hidden md:flex flex-col shrink-0 transition-all duration-300 relative z-30 shadow-lg',
        collapsed ? 'w-16' : 'w-64'
      )}>
        <SidebarContent collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-40 bg-[#0d233a] border border-[#1a365d] rounded-full p-1 text-white hover:bg-[#1a365d] shadow-md transition-transform hover:scale-110"
          aria-label={collapsed ? 'Agrandir le menu' : 'Réduire le menu'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* Mobile hamburger button */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="md:hidden fixed top-4 left-4 z-50 bg-[#0d233a] text-white rounded-xl p-2.5 shadow-lg border border-[#1a365d]"
            aria-label="Ouvrir le menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72 bg-[#0d233a] border-r border-[#1a365d]">
          <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
          <SidebarContent onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
