import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/utils/api';
import UserManagement from '@/components/settings/UserManagement';
import CompanySettings from '@/components/settings/CompanySettings';
import SystemSettings from '@/components/settings/SystemSettings';
import { 
  Users, 
  Building2, 
  Settings as SettingsIcon, 
  Shield, 
  Bell,
  Database,
  Key,
  Globe
} from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const hasPermission = (requiredRole) => {
    if (!currentUser) return false;
    
    const roleHierarchy = {
      'super_user': 6,
      'lender_admin': 5,
      'corporate_admin': 4,
      'corporate_hr': 3,
      'lender_user': 2,
      'corporate_user': 1
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

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem('ndalamahub-token');
      if (!token) {
        // No token, redirect to login
        window.location.href = '/login';
        return;
      }
      
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setCurrentUser(response.data.data.user);
      }
    } catch (err) {
      console.error('Failed to fetch current user:', err);
      // If auth fails, redirect to login
      if (err.response?.status === 401) {
        localStorage.removeItem('ndalamahub-token');
        window.location.href = '/login';
      }
    }
  };

  const tabs = [
    {
      id: 'users',
      label: 'User Management',
      icon: Users,
      description: 'Manage users, roles, and permissions',
      requiredRole: 'corporate_hr' // Changed from corporate_admin to corporate_hr
    },
    {
      id: 'company',
      label: 'Company Settings',
      icon: Building2,
      description: 'Configure company preferences and loan settings',
      requiredRole: 'corporate_admin'
    },
    {
      id: 'system',
      label: 'System Settings',
      icon: SettingsIcon,
      description: 'System-wide configurations and preferences',
      requiredRole: 'lender_admin'
    },
    {
      id: 'security',
      label: 'Security',
      icon: Shield,
      description: 'Security settings and access controls',
      requiredRole: 'corporate_admin'
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      description: 'Configure notification preferences',
      requiredRole: 'corporate_user' // Changed to lower requirement
    },
    {
      id: 'integrations',
      label: 'Integrations',
      icon: Globe,
      description: 'Third-party integrations and API settings',
      requiredRole: 'lender_admin'
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
      case 'security':
        return <SecuritySettings />;
      case 'notifications':
        return <NotificationSettings />;
      case 'integrations':
        return <IntegrationSettings />;
      default:
        return <UserManagement />;
    }
  };

  if (!currentUser) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-full">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-2">Manage your application settings and preferences</p>
      </header>

      {/* Mobile-First: Card Grid Layout */}
      <div className="block lg:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {availableTabs.map((tab) => {
            const Icon = tab.icon;
            
            return (
              <Card 
                key={tab.id}
                className="p-4 cursor-pointer hover:shadow-md transition-all duration-200 border-2 hover:border-blue-200"
                onClick={() => setActiveTab(tab.id)}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm">{tab.label}</h3>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{tab.description}</p>
                  </div>
                  <div className="flex-shrink-0">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                className="flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Settings
              </button>
            </div>
            
            <div className="bg-white rounded-lg">
              {renderTabContent()}
            </div>
          </div>
        )}
      </div>

      {/* Desktop: Traditional Sidebar Layout */}
      <div className="hidden lg:flex gap-6 max-w-full">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <Card className="p-4">
            <nav className="space-y-2">
              {availableTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-start px-3 py-3 rounded-lg text-left transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{tab.label}</div>
                      <div className="text-xs text-gray-500 mt-1 line-clamp-2">{tab.description}</div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}
          
          {availableTabs.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-gray-500">
                <SettingsIcon className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Settings Available</h3>
                <p>You don't have permission to access any settings sections.</p>
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

// Security Settings Component
function SecuritySettings() {
  const [settings, setSettings] = useState({
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    },
    sessionTimeout: 30,
    twoFactorEnabled: false,
    loginAttempts: 5
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Key className="w-5 h-5 mr-2" />
          Password Policy
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Length
            </label>
            <input
              type="number"
              min="6"
              max="32"
              value={settings.passwordPolicy.minLength}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                passwordPolicy: {
                  ...prev.passwordPolicy,
                  minLength: parseInt(e.target.value)
                }
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Session Timeout (minutes)
            </label>
            <input
              type="number"
              min="5"
              max="480"
              value={settings.sessionTimeout}
              onChange={(e) => setSettings(prev => ({
                ...prev,
                sessionTimeout: parseInt(e.target.value)
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="mt-4 space-y-3">
          {Object.entries({
            requireUppercase: 'Require uppercase letters',
            requireLowercase: 'Require lowercase letters',
            requireNumbers: 'Require numbers',
            requireSpecialChars: 'Require special characters'
          }).map(([key, label]) => (
            <label key={key} className="flex items-center">
              <input
                type="checkbox"
                checked={settings.passwordPolicy[key]}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  passwordPolicy: {
                    ...prev.passwordPolicy,
                    [key]: e.target.checked
                  }
                }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
        
        <Button className="mt-4">Save Security Settings</Button>
      </Card>
    </div>
  );
}

// Notification Settings Component
function NotificationSettings() {
  const [notifications, setNotifications] = useState({
    email: {
      loanApplications: true,
      paymentReminders: true,
      overduePayments: true,
      systemUpdates: false
    },
    sms: {
      loanApplications: false,
      paymentReminders: true,
      overduePayments: true,
      systemUpdates: false
    },
    inApp: {
      loanApplications: true,
      paymentReminders: true,
      overduePayments: true,
      systemUpdates: true
    }
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Bell className="w-5 h-5 mr-2" />
          Notification Preferences
        </h3>
        
        <div className="space-y-6">
          {Object.entries({
            email: 'Email Notifications',
            sms: 'SMS Notifications',
            inApp: 'In-App Notifications'
          }).map(([type, title]) => (
            <div key={type}>
              <h4 className="font-medium text-gray-900 mb-3">{title}</h4>
              <div className="space-y-2">
                {Object.entries({
                  loanApplications: 'New loan applications',
                  paymentReminders: 'Payment reminders',
                  overduePayments: 'Overdue payment alerts',
                  systemUpdates: 'System updates and maintenance'
                }).map(([setting, label]) => (
                  <label key={setting} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={notifications[type][setting]}
                      onChange={(e) => setNotifications(prev => ({
                        ...prev,
                        [type]: {
                          ...prev[type],
                          [setting]: e.target.checked
                        }
                      }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <Button className="mt-4">Save Notification Settings</Button>
      </Card>
    </div>
  );
}

// Integration Settings Component
function IntegrationSettings() {
  const [integrations, setIntegrations] = useState({
    paymentGateway: {
      enabled: false,
      provider: '',
      apiKey: ''
    },
    smsProvider: {
      enabled: false,
      provider: '',
      apiKey: ''
    },
    emailProvider: {
      enabled: true,
      provider: 'smtp',
      settings: {}
    }
  });

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Globe className="w-5 h-5 mr-2" />
          Third-Party Integrations
        </h3>
        
        <div className="space-y-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Payment Gateway</h4>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={integrations.paymentGateway.enabled}
                  onChange={(e) => setIntegrations(prev => ({
                    ...prev,
                    paymentGateway: {
                      ...prev.paymentGateway,
                      enabled: e.target.checked
                    }
                  }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable payment gateway integration</span>
              </label>
              
              {integrations.paymentGateway.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Provider
                    </label>
                    <select
                      value={integrations.paymentGateway.provider}
                      onChange={(e) => setIntegrations(prev => ({
                        ...prev,
                        paymentGateway: {
                          ...prev.paymentGateway,
                          provider: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select provider</option>
                      <option value="stripe">Stripe</option>
                      <option value="paypal">PayPal</option>
                      <option value="airtel_money">Airtel Money</option>
                      <option value="mtn_money">MTN Money</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={integrations.paymentGateway.apiKey}
                      onChange={(e) => setIntegrations(prev => ({
                        ...prev,
                        paymentGateway: {
                          ...prev.paymentGateway,
                          apiKey: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter API key"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-3">SMS Provider</h4>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={integrations.smsProvider.enabled}
                  onChange={(e) => setIntegrations(prev => ({
                    ...prev,
                    smsProvider: {
                      ...prev.smsProvider,
                      enabled: e.target.checked
                    }
                  }))}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable SMS notifications</span>
              </label>
              
              {integrations.smsProvider.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Provider
                    </label>
                    <select
                      value={integrations.smsProvider.provider}
                      onChange={(e) => setIntegrations(prev => ({
                        ...prev,
                        smsProvider: {
                          ...prev.smsProvider,
                          provider: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select provider</option>
                      <option value="twilio">Twilio</option>
                      <option value="africas_talking">Africa's Talking</option>
                      <option value="clicksend">ClickSend</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={integrations.smsProvider.apiKey}
                      onChange={(e) => setIntegrations(prev => ({
                        ...prev,
                        smsProvider: {
                          ...prev.smsProvider,
                          apiKey: e.target.value
                        }
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter API key"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <Button className="mt-4">Save Integration Settings</Button>
      </Card>
    </div>
  );
}
