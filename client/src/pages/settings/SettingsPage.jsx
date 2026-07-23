import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/utils/roleUtils';
import UserManagement from '@/components/settings/UserManagement';
import CompanySettings from '@/components/settings/CompanySettings';
import SystemSettings from '@/components/settings/SystemSettings';
import SubscriptionManagement from '@/components/settings/SubscriptionManagement';
import {
  Users,
  Building2,
  Settings as SettingsIcon,
  CreditCard
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('');
  // Phase 25: getCurrentUser() reads the same in-memory cache the rest of
  // the app does — this page only renders behind ProtectedRoute, which
  // already guarantees it's hydrated, so no separate /auth/me fetch here.
  const currentUser = getCurrentUser();

  const hasPermission = (requiredRole) => {
    if (!currentUser) return false;
    
    const roleHierarchy = {
      'platform_admin': 6,
      'lender_admin': 5,
      'lender_officer': 4,
      'employer_admin': 3,
      'employer_hr': 2,
      'borrower': 1
    };
    
    return roleHierarchy[currentUser.role] >= roleHierarchy[requiredRole];
  };

  // Set the first available tab when user is loaded
  useEffect(() => {
    if (currentUser && !activeTab) {
      const available = tabs.filter(tab => hasPermission(tab.requiredRole));
      if (available.length > 0) {
        setActiveTab(available[0].id);
      }
    }
  }, [currentUser, activeTab]);

  const tabs = [
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      description: 'Manage users, roles, and permissions',
      requiredRole: 'employer_hr' // Changed from employer_admin to employer_hr
    },
    {
      id: 'company',
      label: 'Company Settings',
      icon: Building2,
      description: 'Configure company preferences and loan settings',
      requiredRole: 'employer_admin'
    },
    {
      id: 'system',
      label: 'System Settings',
      icon: SettingsIcon,
      description: 'System-wide configurations and preferences',
      requiredRole: 'lender_admin'
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: CreditCard,
      description: 'Manage lender subscription and trial status',
      requiredRole: 'platform_admin'
    }
  ];

  const availableTabs = tabs.filter(tab => hasPermission(tab.requiredRole));

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />;
      case 'company':
        return <CompanySettings />;
      case 'system':
        return <SystemSettings />;
      case 'billing':
        return <SubscriptionManagement />;
      default:
        return <UserManagement />;
    }
  };

  if (!currentUser) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="h-8 w-8 rounded-full border-2 border-border border-t-foreground animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-full">
      <header className="mb-6 md:mb-8">
        <h1 className="text-[22px] font-medium text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-2">Manage your application settings and preferences</p>
      </header>

      {/* Mobile-First: Card Grid Layout */}
      <div className="block lg:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {availableTabs.map((tab) => {
            const Icon = tab.icon;

            return (
              <Card
                key={tab.id}
                className="p-4 cursor-pointer rounded-2xl"
                onClick={() => setActiveTab(tab.id)}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-status-info-bg rounded-lg flex items-center justify-center">
                      <Icon className="w-5 h-5 text-status-info-fg" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground text-sm">{tab.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tab.description}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Mobile Tab Content */}
        {activeTab && (
          <div className="mt-6">
            <div className="flex items-center mb-4">
              <button
                onClick={() => setActiveTab('')}
                className="flex items-center text-foreground hover:text-muted-foreground text-sm font-medium"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to settings
              </button>
            </div>

            <div className="bg-card rounded-2xl">
              {renderTabContent()}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: Traditional Sidebar Layout */}
      <div className="hidden lg:flex gap-6 max-w-full">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <Card className="p-4 rounded-2xl">
            <nav className="space-y-1">
              {availableTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-start px-3 py-3 rounded-[10px] text-left transition-colors ${
                      isActive
                        ? 'bg-[--nh-sage] text-foreground font-medium'
                        : 'text-muted-foreground hover:bg-[--nh-sage]/40'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">{tab.label}</div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{tab.description}</div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {availableTabs.length === 0 ? (
            <Card className="p-8 text-center rounded-2xl">
              <div className="text-muted-foreground">
                <SettingsIcon className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-base font-medium text-foreground mb-2">No settings available</h3>
                <p className="text-sm">You don't have permission to access any settings sections.</p>
              </div>
            </Card>
          ) : (
            renderTabContent()
          )}
        </div>
      </div>
    </div>
  );
}
