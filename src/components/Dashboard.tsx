import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ShieldCheck, Sparkles, CheckCircle, Circle, Activity, GitBranch, Server, DollarSign, Bot } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOps } from '../contexts/OpsContext';
import MonitoringSnapshot from './dashboard/MonitoringSnapshot';
import PipelineOverview from './dashboard/PipelineOverview';
import InfrastructureMap from './dashboard/InfrastructureMap';
import CostOptimization from './dashboard/CostOptimization';
import AIAssistant from './dashboard/AIAssistant';
import { getApiErrorMessage } from '../utils/apiError';

// Detail tabs shown below the ops suites. `preview: true` widgets render
// illustrative data until live integrations are connected (flagged in the UI).
const DASHBOARD_TABS = [
  { key: 'monitoring', label: 'Monitoring', icon: Activity, preview: false, Component: MonitoringSnapshot },
  { key: 'pipelines', label: 'Pipelines', icon: GitBranch, preview: true, Component: PipelineOverview },
  { key: 'infrastructure', label: 'Infrastructure', icon: Server, preview: true, Component: InfrastructureMap },
  { key: 'cost', label: 'Cost', icon: DollarSign, preview: true, Component: CostOptimization },
  { key: 'assistant', label: 'AI Assistant', icon: Bot, preview: false, Component: AIAssistant },
] as const;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const fallbackFeatureOptions = [
  'AI DevOps',
  'Business Ops',
  'Commerce Ops',
  'Finance Ops',
  'Project Ops',
  'Marketing Ops'
];

const aiProviders = ['OpenAI', 'Anthropic', 'Google AI', 'Azure OpenAI', 'Other'];
const aiMethods = ['API key', 'OAuth', 'Private gateway', 'Custom'];

const fallbackDataSourceOptions = [
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
  'Slack',
  'Gmail',
  'Outlook',
  'HubSpot',
  'Salesforce',
  'Zendesk',
  'Intercom',
  'Twilio',
  'Stripe',
  'Google Sheets'
];

const Dashboard: React.FC = () => {
  const { onboarding, refreshOnboarding, user, token } = useAuth();
  const { modules: opsModules, loading: opsLoading, error: opsError } = useOps();
  const [showGoLive, setShowGoLive] = useState(false);
  const [requirementsNotes, setRequirementsNotes] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
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
  const [activeTab, setActiveTab] = useState<string>(DASHBOARD_TABS[0].key);
  const hasOnboarding = onboarding?.completed;
  const demoMode = onboarding?.demo_mode !== false;
  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const shouldShowGoLive = hasOnboarding;
  const goLiveTitle = demoMode ? 'Ready to enable live data?' : 'Live data mode enabled';
  const goLiveMessage = demoMode
    ? 'Submit your requirements so we can tailor integrations and security for your organization.'
    : 'We will surface real pipeline and infrastructure events as soon as integrations start sending data.';
  const opsAccess = user?.permissions?.ops_access;
  const canAccessModule = (key: string) => {
    if (isManager) {
      return true;
    }
    if (!Array.isArray(opsAccess)) {
      return true;
    }
    return opsAccess.includes(key);
  };

  const featureOptions = useMemo(() => {
    if (opsModules.length === 0) {
      return fallbackFeatureOptions;
    }
    return opsModules.map((module) => module.name);
  }, [opsModules]);

  const dataSourceOptions = useMemo(() => {
    const sources = new Set<string>();
    opsModules.forEach((module) => {
      module.metadata?.integrations?.forEach((integration) => sources.add(integration));
    });
    if (sources.size === 0) {
      return fallbackDataSourceOptions;
    }
    return Array.from(sources).sort();
  }, [opsModules]);

  useEffect(() => {
    if (featureOptions.length === 0) {
      setSelectedFeatures([]);
      return;
    }
    setSelectedFeatures((prev) => {
      if (prev.length === 0) {
        return featureOptions;
      }
      const filtered = prev.filter((item) => featureOptions.includes(item));
      return filtered.length === 0 ? featureOptions : filtered;
    });
  }, [featureOptions]);

  useEffect(() => {
    setDataSources((prev) => prev.filter((item) => dataSourceOptions.includes(item)));
  }, [dataSourceOptions]);

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
        const activeIntegrations = integrationsRes.data?.filter((item: { is_active?: boolean }) => item.is_active).length || 0;
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
      setRequestError('Only managers can submit a live data activation request.');
      return;
    }

    if (!requirementsNotes.trim()) {
      setRequestError('Please add your activation requirements.');
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
    } catch (error) {
      setRequestError(getApiErrorMessage(error, 'Failed to send activation request.'));
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <div className="pt-20 min-h-screen">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display text-white mb-2">Aikya Command Center</h1>
          <p className="text-slate-400">Manage every operation with AI-powered automation and unified oversight.</p>
        </div>

        {!hasOnboarding && (
          <div className="mb-8 glass rounded-2xl p-6 border border-amber-500/30">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-amber-200">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm uppercase tracking-[0.3em]">Demo data mode</span>
                </div>
                <h2 className="text-2xl font-semibold text-white mt-3">Mock data is currently shown</h2>
                <p className="text-slate-300 mt-2">
                  Complete onboarding to unlock live dashboards, team controls, and ops-specific workflows.
                </p>
              </div>
              <Link
                to="/onboarding"
                className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-all text-center"
              >
                Complete onboarding
              </Link>
            </div>
          </div>
        )}

        {shouldShowGoLive && (
          <div id="go-live" className="mb-8 glass rounded-2xl p-6 border border-amber-500/30">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
            <div className="flex items-center gap-2 text-amber-200">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm uppercase tracking-[0.3em]">Live data activation</span>
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
                {showGoLive ? 'Hide form' : 'Request activation'}
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
                  <label className="text-sm text-slate-300">Activation requirements *</label>
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
                  {requestLoading ? 'Sending...' : 'Send activation request'}
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
                <span>Request live data activation</span>
              </div>
            </div>
          </div>
        )}

        <div className="glass rounded-2xl border border-white/10 p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-white">Operational suites</h2>
                <p className="text-sm text-slate-400">
                  Access every ops module from a single workspace. Enable the suites you need and control access by role.
                </p>
              </div>
              {isManager && (
                <Link
                  to="/ops"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                Manage modules <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
          </div>

          {opsError && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {opsError}
            </div>
          )}

          {opsLoading ? (
            <div className="mt-6 text-sm text-slate-400">Loading modules...</div>
          ) : (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {(() => {
                const visibleModules = isManager
                  ? opsModules
                  : opsModules.filter((module) => module.enabled);

                if (visibleModules.length === 0) {
                  return (
                    <div className="md:col-span-2 xl:col-span-3 text-sm text-slate-400">
                      No ops modules are enabled yet. Ask a manager to activate the suites you need.
                    </div>
                  );
                }

                return visibleModules.map((module) => {
                const hasAccess = canAccessModule(module.key);
                return (
                  <div
                    key={module.key}
                    className={`rounded-2xl border border-white/10 bg-white/5 p-5 transition-all ${
                      hasAccess ? 'hover:bg-white/10' : 'opacity-70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{module.category}</p>
                        <h3 className="text-lg font-semibold text-white mt-2">{module.name}</h3>
                        <p className="text-sm text-slate-300 mt-2">{module.description}</p>
                      </div>
                      {module.ai_enabled && (
                        <div className="text-amber-200">
                          <Sparkles className="h-4 w-4" />
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                      <span className={`px-2 py-1 rounded-full border ${
                        module.enabled ? 'border-emerald-500/40 text-emerald-200' : 'border-white/10 text-slate-300'
                      }`}>
                        {module.enabled ? 'Enabled' : 'Not enabled'}
                      </span>
                      <span className={`px-2 py-1 rounded-full border ${
                        module.configured ? 'border-amber-500/40 text-amber-200' : 'border-white/10 text-slate-300'
                      }`}>
                        {module.configured ? 'Configured' : 'Not configured'}
                      </span>
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <ShieldCheck className="h-3 w-3" />
                        Access controlled
                      </span>
                    </div>

                    <div className="mt-4">
                      {!module.enabled && isManager && (
                        <Link
                          to="/ops"
                          className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white"
                        >
                          Enable in Ops Hub <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      )}
                      {!module.enabled && !isManager && (
                        <span className="text-sm text-slate-500">Suite not enabled</span>
                      )}
                      {module.enabled && !hasAccess && (
                        <span className="text-sm text-slate-500">Access restricted</span>
                      )}
                      {module.enabled && hasAccess && (
                        module.metadata?.launch_path ? (
                          <Link
                            to={module.metadata.launch_path}
                            className="inline-flex items-center gap-2 text-sm text-amber-200 hover:text-amber-100"
                          >
                            Open suite <ArrowUpRight className="h-4 w-4" />
                          </Link>
                        ) : (
                          <span className="text-sm text-slate-500">Suite UI pending activation</span>
                        )
                      )}
                    </div>
                  </div>
                );
              });
              })()}
            </div>
          )}
        </div>

        {/* Operations detail — live monitoring & AI assistant, plus preview widgets */}
        <div className="mt-8 glass rounded-2xl border border-white/10 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white">Operations detail</h2>
            <p className="text-sm text-slate-400">
              Live monitoring and the AI assistant, plus previews of pipeline, infrastructure and cost views.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
            {DASHBOARD_TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-100 border border-amber-500/40'
                      : 'text-slate-300 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <TabIcon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            {DASHBOARD_TABS.map((tab) => {
              if (tab.key !== activeTab) {
                return null;
              }
              const ActiveComponent = tab.Component;
              return (
                <div key={tab.key}>
                  {tab.preview && demoMode && (
                    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                      Preview data — connect the relevant integrations to see live metrics here.
                    </div>
                  )}
                  <ActiveComponent />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
