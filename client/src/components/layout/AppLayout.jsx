import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Banknote,
  Building2,
  Package,
  BarChart3,
  Settings,
  LifeBuoy,
  Shield,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { authService } from '@/services/authService';
import {
  getCurrentUser,
  canAccessCompanies,
  canAccessReports,
  canAccessSettings,
  canAccessProductsNav,
  canAccessCollateralNav,
  ROLES,
} from '@/utils/roleUtils';
import { SubscriptionBanner } from '@/components/layout/SubscriptionBanner';
import { Toaster } from '@/components/ui/sonner';

const ROLE_LABELS = {
  [ROLES.PLATFORM_ADMIN]: 'Platform Admin',
  [ROLES.LENDER_ADMIN]: 'Lender Admin',
  [ROLES.LENDER_OFFICER]: 'Lender Officer',
  [ROLES.EMPLOYER_ADMIN]: 'Employer Admin',
  [ROLES.EMPLOYER_HR]: 'Employer HR',
  [ROLES.BORROWER]: 'Borrower',
};

function getNavItems(role) {
  const isBorrower = role === ROLES.BORROWER;

  if (isBorrower) {
    return [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/loans', label: 'Loans', icon: Banknote },
      { to: '/support', label: 'Support', icon: LifeBuoy },
    ];
  }

  const items = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/loans', label: 'Loans', icon: Banknote },
  ];
  if (canAccessCompanies(role)) items.push({ to: '/companies', label: 'Companies', icon: Building2 });
  if (canAccessProductsNav(role)) items.push({ to: '/products', label: 'Products', icon: Package });
  if (canAccessCollateralNav(role)) items.push({ to: '/collateral', label: 'Collateral', icon: Shield });
  if (canAccessReports(role)) items.push({ to: '/reports', label: 'Reports', icon: BarChart3 });
  if (canAccessSettings(role)) items.push({ to: '/settings', label: 'Settings', icon: Settings });
  items.push({ to: '/support', label: 'Support', icon: LifeBuoy });
  return items;
}

function SidebarNavLink({ to, label, Icon, onClick }) {
  const IconComponent = Icon;
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 text-sm rounded-[10px] ${
          isActive
            ? 'bg-[--nh-sage] text-[--foreground] font-medium'
            : 'text-[--sidebar-foreground] hover:bg-[--nh-sage]/40'
        }`
      }
    >
      <IconComponent className="w-5 h-5 shrink-0" />
      <span>{label}</span>
    </NavLink>
  );
}

function Sidebar({ navItems, currentUser, onLogout }) {
  return (
    <aside className="hidden md:flex md:flex-col w-[220px] shrink-0 bg-[--sidebar] border-r border-[--sidebar-border] h-screen sticky top-0">
      <div className="px-4 py-5">
        <img
          src="/brand/svg/NdalamaHub-lockup-horizontal-light.svg"
          alt="NdalamaHub"
          className="h-8"
        />
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <SidebarNavLink key={item.to} to={item.to} label={item.label} Icon={item.icon} />
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-[--sidebar-border]">
        <p className="text-sm font-medium text-[--foreground] truncate">
          {currentUser.firstName || currentUser.username}
        </p>
        <p className="text-xs text-[--muted-foreground] mb-3">
          {ROLE_LABELS[currentUser.role] || currentUser.role}
        </p>
        <button
          onClick={onLogout}
          className="flex items-center gap-2 text-sm text-[--sidebar-foreground] hover:text-[--foreground]"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </aside>
  );
}

function MobileTopBar({ navItems, currentUser, onLogout }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between h-14 px-4 bg-[--sidebar] border-b border-[--sidebar-border]">
        <div className="flex items-center gap-2">
          <img src="/brand/svg/NdalamaHub-icon.svg" alt="" className="h-6 w-6" />
          <img src="/brand/svg/NdalamaHub-wordmark-only.svg" alt="NdalamaHub" className="h-4" />
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="p-2 -mr-2 text-[--sidebar-foreground]"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      {open && (
        <div className="bg-[--sidebar] border-b border-[--sidebar-border] px-3 py-3 space-y-1">
          <div className="px-3 py-2 text-sm text-[--sidebar-foreground] border-b border-[--sidebar-border] mb-2">
            {currentUser.firstName || currentUser.username} · {ROLE_LABELS[currentUser.role] || currentUser.role}
          </div>
          {navItems.map((item) => (
            <SidebarNavLink
              key={item.to}
              to={item.to}
              label={item.label}
              Icon={item.icon}
              onClick={() => setOpen(false)}
            />
          ))}
          <button
            onClick={onLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[--sidebar-foreground] hover:text-[--foreground]"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function BorrowerBottomNav({ navItems }) {
  return (
    <nav
      aria-label="Bottom navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex z-40 pb-[env(safe-area-inset-bottom)]"
    >
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[44px] ${
              isActive ? 'text-[--nh-accent]' : 'text-muted-foreground'
            }`
          }
        >
          <item.icon className="w-5 h-5" />
          <span className="text-[12px]">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isBorrower = currentUser?.role === ROLES.BORROWER;
  const navItems = getNavItems(currentUser?.role);

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-[--background]">
      <Sidebar navItems={navItems} currentUser={currentUser} onLogout={handleLogout} />
      <div className="flex-1 flex flex-col min-w-0">
        {isBorrower ? (
          <BorrowerBottomNav navItems={navItems} />
        ) : (
          <MobileTopBar navItems={navItems} currentUser={currentUser} onLogout={handleLogout} />
        )}
        <main className={`flex-1 max-w-7xl w-full mx-auto px-4 py-6 ${isBorrower ? 'pb-24 md:pb-6' : ''}`}>
          <SubscriptionBanner />
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}
