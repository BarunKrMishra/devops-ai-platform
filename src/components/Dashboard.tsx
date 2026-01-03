import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import AIAssistant from './dashboard/AIAssistant';
import PipelineOverview from './dashboard/PipelineOverview';
import InfrastructureMap from './dashboard/InfrastructureMap';
import CostOptimization from './dashboard/CostOptimization';
import MonitoringSnapshot from './dashboard/MonitoringSnapshot';
import { BarChart3, Cloud, MessageSquare, DollarSign, Settings, Sparkles, CheckCircle, Circle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import EmptyState from './ui/EmptyState';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const featureOptions = [
  'CI/CD',
  'Infrastructure',
  'Monitoring',
  'Templates',
  'Team',
  'Analytics',
  'Audit',
  'Settings'
];

const aiProviders = ['OpenAI', 'Anthropic', 'Google AI', 'Azure OpenAI', 'Other'];
const aiMethods = ['API key', 'OAuth', 'Private gateway', 'Custom'];

const dataSourceOptions = [
  'GitHub',
  'GitLab',
  'Bitbucket',
  'AWS',
  'Azure',
  'GCP',
  'Kubernetes',
  'Terraform',
  'Datadog',
  'Grafana',
  'Prometheus',
  'PagerDuty',
  'Slack'
];

const LiveDataPlaceholder: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <EmptyState title={title} message={message} icon={Sparkles} />
);

const Dashboard: React.FC = () => {
  const { onboarding, refreshOnboarding, user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [showGoLive, setShowGoLive] = useState(false);
  const [requirementsNotes, setRequirementsNotes] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(featureOptions);
  const [dataSources, setDataSources] = useState<string[]>([]);
  const [liveDataNotes, setLiveDataNotes] = useState('');
  const [aiIntegration, setAiIntegration] = useState(false);
  const [aiProvider, setAiProvider] = useState('');
  const [aiMethod, setAiMethod] = useState('');
  const [aiNotes, setAiNotes] = useState('');
  const [requestStatus, setRequestStatus] = useState('');
  const [requestError, setRequestError] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [integrationCount, setIntegrationCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [checklistLoading, setChecklistLoading] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'infrastructure', label: 'Infrastructure', icon: Cloud },
    { id: 'assistant', label: 'AI Assistant', icon: MessageSquare },
    { id: 'costs', label: 'Cost Optimization', icon: DollarSign },
    { id: 'monitoring', label: 'Monitoring', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  const hasOnboarding = onboarding?.completed;
  const demoMode = onboarding?.demo_mode !== false;
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const shouldShowGoLive = hasOnboarding;
  const showDemoData = onboarding?.demo_mode !== false;
  const goLiveTitle = demoMode ? 'Ready to unlock live data?' : 'Live data mode enabled';
  const goLiveMessage = demoMode
    ? 'Send your requirements so we can tailor integrations and security for your organization.'
    : 'We will surface real pipeline and infrastructure events as soon as integrations start sending data.';

  const toggleDataSource = (source: string) => {
    setDataSources((prev) => (
      prev.includes(source) ? prev.filter((item) => item !== source) : [...prev, source]
    ));
  };

  useEffect(() => {
    if (onboarding?.profile) {
      setAiIntegration(Boolean(onboarding.profile.ai_integration));
      setAiProvider(onboarding.profile.ai_provider || '');
      setAiMethod(onboarding.profile.ai_integration_method || '');
      setAiNotes(onboarding.profile.ai_integration_notes || '');
      setContactEmail(onboarding.profile.security_contact_email || '');
    }
  }, [onboarding?.profile]);

  useEffect(() => {
    const fetchChecklistData = async () => {
      if (!token) {
        setChecklistLoading(false);
        return;
      }
      setChecklistLoading(true);
      try {
        const [integrationsRes, membersRes] = await Promise.all([
          axios.get(`${API_URL}/api/integrations`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`${API_URL}/api/organizations/members`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        const activeIntegrations = integrationsRes.data?.filter((item: any) => item.is_active).length || 0;
        setIntegrationCount(activeIntegrations);
        setMemberCount(membersRes.data?.length || 0);
      } catch (error) {
        console.error('Failed to load checklist data:', error);
      } finally {
        setChecklistLoading(false);
      }
    };

    fetchChecklistData();
  }, [token]);

  const handleGoLiveRequest = async () => {
    setRequestError('');
    setRequestStatus('');

    if (!isManager) {
      setRequestError('Only managers can submit a go-live request.');
      return;
    }

    if (!requirementsNotes.trim()) {
      setRequestError('Please add your go-live requirements.');
      return;
    }

    if (!contactEmail.trim()) {
      setRequestError('Please provide a contact email.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setRequestError('Contact email is invalid.');
      return;
    }

    if (selectedFeatures.length === 0) {
      setRequestError('Select at least one feature to enable.');
      return;
    }

    if (aiIntegration && (!aiProvider || !aiMethod)) {
      setRequestError('Select an AI provider and integration method.');
      return;
    }

    setRequestLoading(true);
    try {
      await axios.post(`${API_URL}/api/onboarding/request-live`, {
        requirements_notes: requirementsNotes,
        contact_email: contactEmail,
        ai_integration: aiIntegration,
        ai_provider: aiProvider,
        ai_integration_method: aiMethod,
        ai_integration_notes: aiNotes,
        selected_features: selectedFeatures,
        data_sources: dataSources,
        live_data_notes: liveDataNotes
      });
      setRequestStatus('Request sent. Our team will reach out with next steps.');
      setRequirementsNotes('');
      setAiNotes('');
      setSelectedFeatures(featureOptions);
      setDataSources([]);
      setLiveDataNotes('');
      setShowGoLive(false);
      await refreshOnboarding();
    } catch (error: any) {
      setRequestError(error.response?.data?.error || 'Failed to send go-live request.');
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <div className="pt-20 min-h-screen">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display text-white mb-2">Aikya Command Center</h1>
          <p className="text-slate-400">Manage your infrastructure with calm, AI-powered automation</p>
        </div>

        {shouldShowGoLive && (
          <div id="go-live" className="mb-8 glass rounded-2xl p-6 border border-amber-500/30">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-amber-200">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm uppercase tracking-[0.3em]">Go live</span>
                </div>
                <h2 className="text-2xl font-semibold text-white mt-3">{goLiveTitle}</h2>
                <p className="text-slate-300 mt-2">
                  {goLiveMessage}
                </p>
                <div className="mt-3">
                  <Link
                    to="/app/integrations"
                    className="text-sm text-amber-200 hover:text-amber-100 transition-colors"
                  >
                    Open integrations setup
                  </Link>
                </div>
              </div>
              <button
                onClick={() => setShowGoLive(!showGoLive)}
                disabled={!isManager}
                className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {showGoLive ? 'Hide form' : 'Request go-live'}
              </button>
            </div>

            {showGoLive && (
              <div className="mt-6 space-y-4">
                {requestStatus && (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-300">
                    {requestStatus}
                  </div>
                )}
              {requestError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-300">
                  {requestError}
                </div>
              )}

              <div>
                  <label className="text-sm text-slate-300">Go-live requirements *</label>
                  <textarea
                    value={requirementsNotes}
                    onChange={(event) => setRequirementsNotes(event.target.value)}
                    className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                    placeholder="Share deployment goals, compliance needs, and rollout timeline (no credentials needed)."
                    rows={3}
                  />
                </div>

              <div>
                <label className="text-sm text-slate-300">Preferred contact email *</label>
                <input
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                  placeholder="team@company.com"
                />
              </div>

                <div>
                  <h3 className="text-sm text-slate-300">Features to enable *</h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {featureOptions.map((feature) => (
                    <label key={feature} className="flex items-center gap-2 text-slate-200 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedFeatures.includes(feature)}
                        onChange={() => {
                          if (selectedFeatures.includes(feature)) {
                            setSelectedFeatures(selectedFeatures.filter((item) => item !== feature));
                          } else {
                            setSelectedFeatures([...selectedFeatures, feature]);
                          }
                        }}
                        className="accent-amber-400"
                      />
                      {feature}
                    </label>
                  ))}
                </div>
                </div>

                <div>
                  <h3 className="text-sm text-slate-300">Apps & services to integrate (optional)</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Select what you want connected. We never ask for credentials here.
                  </p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {dataSourceOptions.map((source) => (
                      <label key={source} className="flex items-center gap-2 text-slate-200 text-sm">
                        <input
                          type="checkbox"
                          checked={dataSources.includes(source)}
                          onChange={() => toggleDataSource(source)}
                          className="accent-amber-400"
                        />
                        {source}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-slate-300">Live data notes (optional)</label>
                  <textarea
                    value={liveDataNotes}
                    onChange={(event) => setLiveDataNotes(event.target.value)}
                    className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                    placeholder="Share environment count, pipeline volume, or monitoring stack details."
                    rows={3}
                  />
                </div>

                <div className="space-y-3">
                  <p className="text-sm text-slate-300">Integrate your own AI</p>
                  <div className="flex flex-wrap gap-3">
                  {[true, false].map((value) => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => setAiIntegration(value)}
                      className={`px-4 py-2 rounded-xl border transition-all text-sm ${
                        aiIntegration === value
                          ? 'border-amber-400 bg-amber-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {value ? 'Yes, integrate my AI' : 'No, use Aikya AI'}
                    </button>
                  ))}
                </div>
              </div>

                {aiIntegration && (
                  <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-300">AI provider *</label>
                    <select
                      value={aiProvider}
                      onChange={(event) => setAiProvider(event.target.value)}
                      className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                    >
                      <option value="">Select provider</option>
                      {aiProviders.map((provider) => (
                        <option key={provider} value={provider} className="text-slate-100">
                          {provider}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-300">Integration method *</label>
                    <select
                      value={aiMethod}
                      onChange={(event) => setAiMethod(event.target.value)}
                      className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                    >
                      <option value="">Select method</option>
                      {aiMethods.map((method) => (
                        <option key={method} value={method} className="text-slate-100">
                          {method}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-slate-300">AI integration notes</label>
                      <textarea
                        value={aiNotes}
                        onChange={(event) => setAiNotes(event.target.value)}
                        className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                        placeholder="We will coordinate secure integration steps after approval."
                        rows={3}
                      />
                  </div>
                  </div>
                )}

                <button
                  onClick={handleGoLiveRequest}
                  disabled={requestLoading}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-teal-500 text-white hover:from-amber-600 hover:to-teal-600 transition-all disabled:opacity-60"
                >
                  {requestLoading ? 'Sending...' : 'Send go-live request'}
                </button>
              </div>
            )}
            {!showGoLive && requestStatus && (
              <div className="mt-6 bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-300">
                {requestStatus}
              </div>
            )}
          </div>
        )}

        {hasOnboarding && (
          <div className="mb-8 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">What's next</h2>
                <p className="text-slate-400 text-sm">Finish these steps to unlock live data.</p>
              </div>
              {checklistLoading && (
                <span className="text-xs text-slate-500">Updating...</span>
              )}
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                {hasOnboarding ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-slate-500" />}
                <span>Complete onboarding details</span>
              </div>
              <div className="flex items-center gap-3">
                {integrationCount > 0 ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-slate-500" />}
                <span>Connect at least one integration</span>
              </div>
              <div className="flex items-center gap-3">
                {memberCount > 1 ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-slate-500" />}
                <span>Invite your team</span>
              </div>
              <div className="flex items-center gap-3">
                {!demoMode ? <CheckCircle className="h-4 w-4 text-emerald-400" /> : <Circle className="h-4 w-4 text-slate-500" />}
                <span>Request go-live activation</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
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

          <div className="p-6">
            {activeTab === 'overview' && (
              showDemoData
                ? <PipelineOverview />
                : (
                  <LiveDataPlaceholder
                    title="Live pipeline data is ready"
                    message="We have switched you to live mode. As soon as CI/CD events start flowing, your pipelines will appear here."
                  />
                )
            )}
            {activeTab === 'infrastructure' && (
              showDemoData
                ? <InfrastructureMap />
                : (
                  <LiveDataPlaceholder
                    title="Infrastructure data is connecting"
                    message="We will populate this view as your cloud resources stream into Aikya."
                  />
                )
            )}
            {activeTab === 'assistant' && <AIAssistant />}
            {activeTab === 'costs' && (
              showDemoData
                ? <CostOptimization />
                : (
                  <LiveDataPlaceholder
                    title="Cost insights will appear soon"
                    message="Live cost data will populate once billing exports and metrics are connected."
                  />
                )
            )}
            {activeTab === 'monitoring' && (
              <MonitoringSnapshot />
            )}
            {activeTab === 'settings' && (
              <div className="text-center py-12">
                <Settings className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">Settings</h3>
                <p className="text-slate-400">Configuration options coming soon</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
