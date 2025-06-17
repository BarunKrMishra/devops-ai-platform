import React, { useState } from 'react';
import { User, Key, Bell, Shield, Github, Gitlab, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const UserSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState({
    name: user?.email?.split('@')[0] || '',
    email: user?.email || '',
    role: user?.role || 'developer'
  });
  const [notifications, setNotifications] = useState({
    deployments: true,
    alerts: true,
    costOptimization: false,
    weeklyReports: true
  });
  const [integrations, setIntegrations] = useState({
    github: false,
    gitlab: false,
    aws: false,
    gcp: false
  });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'integrations', label: 'Integrations', icon: Key }
  ];

  const handleSaveProfile = () => {
    // In production, save to backend
    console.log('Saving profile:', profile);
  };

  const handleSaveNotifications = () => {
    // In production, save to backend
    console.log('Saving notifications:', notifications);
  };

  const handleToggleIntegration = (integration: string) => {
    setIntegrations(prev => ({
      ...prev,
      [integration]: !prev[integration as keyof typeof prev]
    }));
  };

  return (
    <div className="pt-20 min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
            <p className="text-gray-400">Manage your account settings and preferences</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 overflow-hidden">
            <div className="border-b border-white/10">
              <nav className="flex overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-6 py-4 whitespace-nowrap transition-all ${
                      activeTab === tab.id
                        ? 'bg-purple-500/20 text-purple-300 border-b-2 border-purple-400'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
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
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={profile.name}
                        onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={profile.email}
                        onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:border-purple-400 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Role
                      </label>
                      <select
                        value={profile.role}
                        onChange={(e) => setProfile(prev => ({ ...prev, role: e.target.value }))}
                        className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white focus:border-purple-400 focus:outline-none"
                        disabled
                      >
                        <option value="developer">Developer</option>
                        <option value="admin">Admin</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    className="flex items-center space-x-2 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save Changes</span>
                  </button>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Security Settings</h2>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <h3 className="font-semibold text-white mb-2">Change Password</h3>
                      <p className="text-gray-400 text-sm mb-4">Update your password to keep your account secure</p>
                      <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
                        Change Password
                      </button>
                    </div>

                    <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <h3 className="font-semibold text-white mb-2">Two-Factor Authentication</h3>
                      <p className="text-gray-400 text-sm mb-4">Add an extra layer of security to your account</p>
                      <button className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors">
                        Enable 2FA
                      </button>
                    </div>

                    <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                      <h3 className="font-semibold text-white mb-2">API Keys</h3>
                      <p className="text-gray-400 text-sm mb-4">Manage your API keys for integrations</p>
                      <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors">
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
                          <p className="text-gray-400 text-sm">
                            {key === 'deployments' && 'Get notified about deployment status changes'}
                            {key === 'alerts' && 'Receive alerts for system issues and incidents'}
                            {key === 'costOptimization' && 'Get recommendations for cost savings'}
                            {key === 'weeklyReports' && 'Receive weekly summary reports'}
                          </p>
                        </div>
                        <button
                          onClick={() => setNotifications(prev => ({ ...prev, [key]: !value }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            value ? 'bg-purple-500' : 'bg-gray-600'
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
                    className="flex items-center space-x-2 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    <span>Save Preferences</span>
                  </button>
                </div>
              )}

              {activeTab === 'integrations' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-semibold text-white mb-4">Integrations</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <Github className="h-8 w-8 text-white" />
                          <div>
                            <h3 className="font-semibold text-white">GitHub</h3>
                            <p className="text-sm text-gray-400">Connect your GitHub repositories</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleIntegration('github')}
                          className={`px-4 py-2 rounded-lg transition-colors ${
                            integrations.github
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'bg-gray-800 hover:bg-gray-700 text-white'
                          }`}
                        >
                          {integrations.github ? 'Disconnect' : 'Connect'}
                        </button>
                      </div>
                    </div>

                    <div className="p-6 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <Gitlab className="h-8 w-8 text-orange-500" />
                          <div>
                            <h3 className="font-semibold text-white">GitLab</h3>
                            <p className="text-sm text-gray-400">Connect your GitLab repositories</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleIntegration('gitlab')}
                          className={`px-4 py-2 rounded-lg transition-colors ${
                            integrations.gitlab
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'bg-orange-600 hover:bg-orange-700 text-white'
                          }`}
                        >
                          {integrations.gitlab ? 'Disconnect' : 'Connect'}
                        </button>
                      </div>
                    </div>

                    <div className="p-6 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-yellow-500 rounded flex items-center justify-center">
                            <span className="text-black font-bold text-sm">AWS</span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">Amazon Web Services</h3>
                            <p className="text-sm text-gray-400">Connect your AWS account</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleIntegration('aws')}
                          className={`px-4 py-2 rounded-lg transition-colors ${
                            integrations.aws
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                          }`}
                        >
                          {integrations.aws ? 'Disconnect' : 'Connect'}
                        </button>
                      </div>
                    </div>

                    <div className="p-6 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                            <span className="text-white font-bold text-sm">GCP</span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-white">Google Cloud Platform</h3>
                            <p className="text-sm text-gray-400">Connect your GCP account</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleIntegration('gcp')}
                          className={`px-4 py-2 rounded-lg transition-colors ${
                            integrations.gcp
                              ? 'bg-red-500 hover:bg-red-600 text-white'
                              : 'bg-blue-600 hover:bg-blue-700 text-white'
                          }`}
                        >
                          {integrations.gcp ? 'Disconnect' : 'Connect'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSettingsPage;