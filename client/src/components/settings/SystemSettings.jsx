import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import api from '@/utils/api';
import { Database, Server, Clock, Mail, Smartphone, Globe, HardDrive } from 'lucide-react';

export default function SystemSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [systemInfo, setSystemInfo] = useState({
    version: '1.0.0',
    uptime: 0,
    dbStatus: 'connected',
    totalUsers: 0,
    totalCompanies: 0,
    totalLoans: 0,
    storageUsed: 0
  });
  
  const [settings, setSettings] = useState({
    system: {
      maintenanceMode: false,
      allowRegistration: true,
      sessionTimeout: 30,
      maxLoginAttempts: 5,
      backupFrequency: 'daily'
    },
    email: {
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
      smtpSecure: true,
      fromEmail: '',
      fromName: 'NdalamaHub'
    },
    notifications: {
      emailEnabled: true,
      smsEnabled: false,
      pushEnabled: true,
      adminEmail: ''
    },
    api: {
      rateLimit: 100,
      enableCors: true,
      allowedOrigins: '',
      apiVersion: 'v1'
    }
  });

  useEffect(() => {
    fetchSystemInfo();
    fetchSystemSettings();
  }, []);

  const fetchSystemInfo = async () => {
    try {
      const response = await api.get('/system/info');
      if (response.data.success) {
        setSystemInfo(response.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch system info:', err);
    }
  };

  const fetchSystemSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/system/settings');
      if (response.data.success) {
        setSettings(prev => ({
          ...prev,
          ...response.data.data
        }));
      }
    } catch (err) {
      setError('Failed to load system settings');
      console.error('System settings fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await api.put('/system/settings', settings);

      if (response.data.success) {
        setSuccess('System settings updated successfully');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update system settings');
      console.error('Save settings error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleNestedChange = (category, field, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  const formatUptime = (seconds) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return <div className="p-6">Loading system settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* System Information */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Server className="w-6 h-6 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">System Information</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Database className="w-5 h-5 text-blue-600" />
              <span className="font-medium text-gray-900">Database</span>
            </div>
            <p className="text-sm text-gray-600">Status: {systemInfo.dbStatus}</p>
            <p className="text-sm text-gray-600">Version: MongoDB 5.0</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="w-5 h-5 text-green-600" />
              <span className="font-medium text-gray-900">Uptime</span>
            </div>
            <p className="text-sm text-gray-600">{formatUptime(systemInfo.uptime)}</p>
            <p className="text-sm text-gray-600">Version: {systemInfo.version}</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <HardDrive className="w-5 h-5 text-orange-600" />
              <span className="font-medium text-gray-900">Storage</span>
            </div>
            <p className="text-sm text-gray-600">Used: {formatBytes(systemInfo.storageUsed)}</p>
            <p className="text-sm text-gray-600">Available: {formatBytes(1024 * 1024 * 1024 * 10)}</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Globe className="w-5 h-5 text-purple-600" />
              <span className="font-medium text-gray-900">Statistics</span>
            </div>
            <p className="text-sm text-gray-600">Users: {systemInfo.totalUsers}</p>
            <p className="text-sm text-gray-600">Companies: {systemInfo.totalCompanies}</p>
            <p className="text-sm text-gray-600">Loans: {systemInfo.totalLoans}</p>
          </div>
        </div>
      </Card>

      {/* System Settings */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Database className="w-6 h-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
          </div>
          <Button 
            onClick={handleSaveSettings}
            disabled={saving}
            className="flex items-center"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Configuration */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">System Configuration</h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Session Timeout (minutes)
              </label>
              <input
                type="number"
                min="5"
                max="480"
                value={settings.system.sessionTimeout}
                onChange={(e) => handleNestedChange('system', 'sessionTimeout', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Login Attempts
              </label>
              <input
                type="number"
                min="3"
                max="10"
                value={settings.system.maxLoginAttempts}
                onChange={(e) => handleNestedChange('system', 'maxLoginAttempts', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Backup Frequency
              </label>
              <select
                value={settings.system.backupFrequency}
                onChange={(e) => handleNestedChange('system', 'backupFrequency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="hourly">Hourly</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.system.maintenanceMode}
                  onChange={(e) => handleNestedChange('system', 'maintenanceMode', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Maintenance Mode</span>
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.system.allowRegistration}
                  onChange={(e) => handleNestedChange('system', 'allowRegistration', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Allow New User Registration</span>
              </label>
            </div>
          </div>

          {/* API Configuration */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">API Configuration</h4>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rate Limit (requests per minute)
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                value={settings.api.rateLimit}
                onChange={(e) => handleNestedChange('api', 'rateLimit', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Version
              </label>
              <input
                type="text"
                value={settings.api.apiVersion}
                onChange={(e) => handleNestedChange('api', 'apiVersion', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Allowed Origins (comma-separated)
              </label>
              <textarea
                value={settings.api.allowedOrigins}
                onChange={(e) => handleNestedChange('api', 'allowedOrigins', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com, https://app.example.com"
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.api.enableCors}
                  onChange={(e) => handleNestedChange('api', 'enableCors', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Enable CORS</span>
              </label>
            </div>
          </div>
        </div>
      </Card>

      {/* Email Configuration */}
      <Card className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Mail className="w-6 h-6 text-red-600" />
          <h3 className="text-lg font-semibold text-gray-900">Email Configuration</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMTP Host
              </label>
              <input
                type="text"
                value={settings.email.smtpHost}
                onChange={(e) => handleNestedChange('email', 'smtpHost', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="smtp.gmail.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMTP Port
              </label>
              <input
                type="number"
                value={settings.email.smtpPort}
                onChange={(e) => handleNestedChange('email', 'smtpPort', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMTP Username
              </label>
              <input
                type="text"
                value={settings.email.smtpUser}
                onChange={(e) => handleNestedChange('email', 'smtpUser', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SMTP Password
              </label>
              <input
                type="password"
                value={settings.email.smtpPassword}
                onChange={(e) => handleNestedChange('email', 'smtpPassword', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Email
              </label>
              <input
                type="email"
                value={settings.email.fromEmail}
                onChange={(e) => handleNestedChange('email', 'fromEmail', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Name
              </label>
              <input
                type="text"
                value={settings.email.fromName}
                onChange={(e) => handleNestedChange('email', 'fromName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={settings.email.smtpSecure}
                  onChange={(e) => handleNestedChange('email', 'smtpSecure', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Use SSL/TLS</span>
              </label>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
