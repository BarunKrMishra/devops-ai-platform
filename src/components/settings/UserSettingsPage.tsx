
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  User,
  Shield,
  Bell,
  Save,
  Monitor,
  Lock,
  QrCode,
  Key,
  X,
  Copy
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type ApiKey = {
  id: number;
  name: string;
  last_four: string;
  created_at: string;
  last_used?: string | null;
  is_active: boolean;
};

const UserSettingsPage: React.FC = () => {
  const { user, token, onboarding, refreshOnboarding } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState({
    name: user?.name || user?.email?.split('@')[0] || '',
    email: user?.email || '',
    role: user?.role || 'developer'
  });
  const [notifications, setNotifications] = useState({
    deployments: true,
    alerts: true,
    costOptimization: false,
    weeklyReports: true
  });
  const [demoMode, setDemoMode] = useState(true);
  const [demoError, setDemoError] = useState('');
  const [demoSaving, setDemoSaving] = useState(false);

  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{ qr: string; secret: string } | null>(null);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorError, setTwoFactorError] = useState('');
  const [twoFactorStatus, setTwoFactorStatus] = useState('');

  const [showApiKeysModal, setShowApiKeysModal] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [apiKeyError, setApiKeyError] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState('');
  const [apiKeyLoading, setApiKeyLoading] = useState(false);

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'experience', label: 'Experience', icon: Monitor }
  ];

  useEffect(() => {
    if (onboarding?.demo_mode === false) {
      setDemoMode(false);
    } else {
      setDemoMode(true);
    }
  }, [onboarding?.demo_mode]);

  useEffect(() => {
    const loadSettings = async () => {
      if (!token) {
        return;
      }
      try {
        const response = await axios.get(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const { user: userData, settings } = response.data;
        setProfile({
          name: userData?.name || userData?.email?.split('@')[0] || '',
          email: userData?.email || '',
          role: userData?.role || 'developer'
        });
        if (settings?.notifications) {
          setNotifications(settings.notifications);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, [token]);

  const handleSaveProfile = async () => {
    if (!token) return;
    setSavingProfile(true);
    setStatusMessage('');
    setErrorMessage('');
    try {
      const response = await axios.patch(
        `${API_URL}/api/users/me`,
        { name: profile.name, email: profile.email },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const updated = response.data.user;
      setProfile((prev) => ({
        ...prev,
        name: updated.name || prev.name,
        email: updated.email || prev.email
      }));
      setStatusMessage('Profile updated successfully.');
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!token) {
      setErrorMessage('Session expired. Please sign in again.');
      return;
    }
    setSavingNotifications(true);
    setStatusMessage('');
    setErrorMessage('');
    try {
      await axios.patch(
        `${API_URL}/api/users/me/notifications`,
        { notifications },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatusMessage('Notification preferences saved.');
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || 'Failed to save notifications.');
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleToggleDemoMode = async () => {
    if (!token) {
      setDemoError('Session expired. Please sign in again.');
      return;
    }
    const nextValue = !demoMode;
    if (!onboarding?.completed && !nextValue) {
      setDemoError('Complete onboarding before turning off demo data.');
      return;
    }
    setDemoSaving(true);
    setDemoError('');
    setStatusMessage('');
    try {
      await axios.patch(
        `${API_URL}/api/onboarding/settings`,
        { demo_mode: nextValue },
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
      );
      setDemoMode(nextValue);
      await refreshOnboarding();
      setStatusMessage('Experience settings updated.');
    } catch (error: any) {
      setDemoError(error.response?.data?.error || 'Failed to update demo mode.');
    } finally {
      setDemoSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!token) return;
    setPasswordError('');
    setStatusMessage('');

    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      setPasswordError('All password fields are required.');
      return;
    }
    if (passwordForm.next.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      await axios.post(
        `${API_URL}/api/users/me/change-password`,
        { current_password: passwordForm.current, new_password: passwordForm.next },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowPasswordModal(false);
      setPasswordForm({ current: '', next: '', confirm: '' });
      setStatusMessage('Password updated successfully.');
    } catch (error: any) {
      setPasswordError(error.response?.data?.error || 'Failed to change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const openTwoFactorModal = async () => {
    if (!profile.email) {
      setTwoFactorError('Email is required for 2FA setup.');
      return;
    }
    setShowTwoFactorModal(true);
    setTwoFactorLoading(true);
    setTwoFactorError('');
    setTwoFactorStatus('');
    try {
      const response = await axios.post(`${API_URL}/api/auth/enable-2fa`, {
        email: profile.email
      });
      setTwoFactorData({ qr: response.data.qr, secret: response.data.secret });
    } catch (error: any) {
      setTwoFactorError(error.response?.data?.error || 'Failed to start 2FA setup.');
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const verifyTwoFactor = async () => {
    if (!twoFactorToken.trim()) {
      setTwoFactorError('Enter the 2FA code to verify.');
      return;
    }
    try {
      await axios.post(`${API_URL}/api/auth/verify-2fa`, {
        email: profile.email,
        token: twoFactorToken.trim()
      });
      setTwoFactorStatus('Two-factor authentication enabled.');
      setTwoFactorToken('');
    } catch (error: any) {
      setTwoFactorError(error.response?.data?.error || 'Failed to verify 2FA code.');
    }
  };

  const openApiKeysModal = async () => {
    if (!token) return;
    setShowApiKeysModal(true);
    setApiKeyError('');
    setApiKeyStatus('');
    setApiKeyValue('');
    try {
      const response = await axios.get(`${API_URL}/api/users/me/api-keys`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApiKeys(response.data || []);
    } catch (error: any) {
      setApiKeyError(error.response?.data?.error || 'Failed to load API keys.');
    }
  };

  const handleCreateApiKey = async () => {
    if (!token) return;
    setApiKeyLoading(true);
    setApiKeyError('');
    setApiKeyStatus('');
    try {
      const response = await axios.post(
        `${API_URL}/api/users/me/api-keys`,
        { name: apiKeyName.trim() || 'Personal key' },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setApiKeyValue(response.data.key);
      setApiKeyName('');
      setApiKeyStatus('New key generated. Copy it now; it will not be shown again.');
      const refreshed = await axios.get(`${API_URL}/api/users/me/api-keys`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApiKeys(refreshed.data || []);
    } catch (error: any) {
      setApiKeyError(error.response?.data?.error || 'Failed to generate API key.');
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleRevokeApiKey = async (id: number) => {
    if (!token) return;
    setApiKeyError('');
    setApiKeyStatus('');
    try {
      await axios.delete(`${API_URL}/api/users/me/api-keys/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApiKeys((prev) => prev.map((key) => (key.id === id ? { ...key, is_active: false } : key)));
      setApiKeyStatus('API key revoked.');
    } catch (error: any) {
      setApiKeyError(error.response?.data?.error || 'Failed to revoke API key.');
    }
  };

  const handleCopyApiKey = async () => {
    if (!apiKeyValue) return;
    try {
      await navigator.clipboard.writeText(apiKeyValue);
      setApiKeyStatus('Key copied to clipboard.');
    } catch (error) {
      setApiKeyError('Copy failed. Please copy manually.');
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-aikya">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
            <p className="text-slate-400">Manage your account settings and preferences</p>
          </div>

          {statusMessage && (
            <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {statusMessage}
            </div>
          )}
          {errorMessage && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </div>
          )}

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
            <div className="border-b border-white/10">
              <nav className="flex overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-6 py-4 whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? 'bg-amber-500/20 text-amber-300 border-b-2 border-amber-400'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <tab.icon className="h-5 w-5" />
                    <span>{tab.label}</span>
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-8">
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Profile Information</h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile((prev) => ({ ...prev, email: e.target.value }))}
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                      />
                      <p className="text-xs text-slate-500 mt-2">Changing email may require re-login.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Role
                      </label>
                      <select
                        value={profile.role}
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white focus:border-amber-400 focus:outline-none"
                        disabled
                      >
                        <option value="developer" className="bg-slate-900 text-slate-100">Developer</option>
                        <option value="admin" className="bg-slate-900 text-slate-100">Admin</option>
                        <option value="viewer" className="bg-slate-900 text-slate-100">Viewer</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="flex items-center space-x-2 px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    <span>{savingProfile ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Security Settings</h2>

                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <h3 className="font-semibold text-white mb-2">Change Password</h3>
                      <p className="text-slate-400 text-sm mb-4">Update your password to keep your account secure</p>
                      <button
                        onClick={() => setShowPasswordModal(true)}
                        className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                      >
                        Change Password
                      </button>
                    </div>

                    <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <h3 className="font-semibold text-white mb-2">Two-Factor Authentication</h3>
                      <p className="text-slate-400 text-sm mb-4">Add an extra layer of security to your account</p>
                      <button
                        onClick={openTwoFactorModal}
                        className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                      >
                        Enable 2FA
                      </button>
                    </div>

                    <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <h3 className="font-semibold text-white mb-2">API Keys</h3>
                      <p className="text-slate-400 text-sm mb-4">Generate personal API keys for secure access</p>
                      <button
                        onClick={openApiKeysModal}
                        className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                      >
                        Manage API Keys
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Notification Preferences</h2>

                  <div className="space-y-4">
                    {Object.entries(notifications).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                        <div>
                          <h3 className="font-semibold text-white capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </h3>
                          <p className="text-slate-400 text-sm">
                            {key === 'deployments' && 'Get notified about deployment status changes'}
                            {key === 'alerts' && 'Receive alerts for system issues and incidents'}
                            {key === 'costOptimization' && 'Get recommendations for cost savings'}
                            {key === 'weeklyReports' && 'Receive weekly summary reports'}
                          </p>
                        </div>
                        <button
                          onClick={() => setNotifications((prev) => ({ ...prev, [key]: !value }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            value ? 'bg-amber-500' : 'bg-slate-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              value ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={handleSaveNotifications}
                    disabled={savingNotifications}
                    className="flex items-center space-x-2 px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    <span>{savingNotifications ? 'Saving...' : 'Save Preferences'}</span>
                  </button>
                </div>
              )}

              {activeTab === 'experience' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Experience</h2>

                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-white">Demo data mode</h3>
                        <p className="text-slate-400 text-sm mt-1">
                          Keep demo data visible until you connect integrations.
                        </p>
                      </div>
                      <button
                        onClick={handleToggleDemoMode}
                        disabled={demoSaving}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          demoMode ? 'bg-amber-500' : 'bg-slate-600'
                        } ${demoSaving ? 'opacity-60' : ''}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            demoMode ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {demoError && <p className="text-red-300 text-sm mt-2">{demoError}</p>}
                  </div>

                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <h3 className="font-semibold text-white">Release notes</h3>
                    <p className="text-slate-400 text-sm mt-1">
                      We will surface new features and security updates here as we ship them.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-white/20 max-w-lg w-full">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Lock className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Change Password</h2>
              </div>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <input
                type="password"
                value={passwordForm.current}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, current: event.target.value }))}
                className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                placeholder="Current password"
              />
              <input
                type="password"
                value={passwordForm.next}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, next: event.target.value }))}
                className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                placeholder="New password"
              />
              <input
                type="password"
                value={passwordForm.confirm}
                onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm: event.target.value }))}
                className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                placeholder="Confirm new password"
              />
              {passwordError && <p className="text-red-300 text-sm">{passwordError}</p>}
              <button
                onClick={handleChangePassword}
                disabled={passwordSaving}
                className="w-full px-4 py-3 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-60"
              >
                {passwordSaving ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTwoFactorModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-white/20 max-w-xl w-full">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <QrCode className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Enable 2FA</h2>
              </div>
              <button
                onClick={() => setShowTwoFactorModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {twoFactorLoading && <p className="text-slate-400">Preparing your QR code...</p>}
              {twoFactorData?.qr && (
                <div className="flex flex-col items-center gap-3">
                  <img src={twoFactorData.qr} alt="2FA QR code" className="w-40 h-40" />
                  <p className="text-xs text-slate-400">Secret: {twoFactorData.secret}</p>
                </div>
              )}
              <input
                type="text"
                value={twoFactorToken}
                onChange={(event) => setTwoFactorToken(event.target.value)}
                className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                placeholder="Enter 6-digit code"
              />
              {twoFactorError && <p className="text-red-300 text-sm">{twoFactorError}</p>}
              {twoFactorStatus && <p className="text-emerald-300 text-sm">{twoFactorStatus}</p>}
              <button
                onClick={verifyTwoFactor}
                className="w-full px-4 py-3 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                Verify and enable
              </button>
            </div>
          </div>
        </div>
      )}

      {showApiKeysModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 rounded-2xl border border-white/20 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <Key className="h-5 w-5" />
                <h2 className="text-lg font-semibold">API Keys</h2>
              </div>
              <button
                onClick={() => setShowApiKeysModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <label className="text-sm text-slate-300">Key name</label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    value={apiKeyName}
                    onChange={(event) => setApiKeyName(event.target.value)}
                    className="flex-1 min-w-[200px] p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                    placeholder="e.g. CI Automation"
                  />
                  <button
                    onClick={handleCreateApiKey}
                    disabled={apiKeyLoading}
                    className="px-4 py-3 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-60"
                  >
                    {apiKeyLoading ? 'Generating...' : 'Generate key'}
                  </button>
                </div>
                {apiKeyValue && (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                    <p className="text-xs text-slate-400 mb-2">Copy this key now:</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="break-all text-amber-200">{apiKeyValue}</span>
                      <button
                        onClick={handleCopyApiKey}
                        className="flex items-center gap-1 text-xs text-amber-300 hover:text-amber-200"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {apiKeyError && <p className="text-red-300 text-sm">{apiKeyError}</p>}
              {apiKeyStatus && <p className="text-emerald-300 text-sm">{apiKeyStatus}</p>}

              <div className="border-t border-white/10 pt-4">
                <h3 className="text-sm font-semibold text-white mb-3">Active keys</h3>
                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                      <div>
                        <p className="text-sm text-white">{key.name || 'Personal key'}</p>
                        <p className="text-xs text-slate-400">
                          Key ending {key.last_four} | Created {new Date(key.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRevokeApiKey(key.id)}
                        disabled={!key.is_active}
                        className="text-xs px-3 py-1 rounded-lg bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-50"
                      >
                        {key.is_active ? 'Revoke' : 'Revoked'}
                      </button>
                    </div>
                  ))}
                  {apiKeys.length === 0 && (
                    <p className="text-sm text-slate-400">No API keys created yet.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserSettingsPage;
