import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CheckCircle, ShieldCheck, PlugZap, Link2, AlertTriangle } from 'lucide-react';
import SkeletonBlock from '../ui/SkeletonBlock';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type IntegrationField = {
  key: string;
  label: string;
  type: 'text' | 'password' | 'textarea' | 'select';
  required?: boolean;
  secret?: boolean;
  options?: string[];
  placeholder?: string;
};

type ProviderConfig = {
  key: string;
  name: string;
  description: string;
  category: string;
  oauth?: boolean;
  fields: IntegrationField[];
  helper?: string;
};

const providers: ProviderConfig[] = [
  {
    key: 'github',
    name: 'GitHub',
    description: 'Sync repositories, pipelines, and deploy events.',
    category: 'Source Control',
    oauth: true,
    helper: 'Use a fine-grained token with repo and read:org scopes.',
    fields: [
      { key: 'token', label: 'Access token', type: 'password', required: true, secret: true },
      { key: 'organization', label: 'Organization (optional)', type: 'text', placeholder: 'acme-org' }
    ]
  },
  {
    key: 'gitlab',
    name: 'GitLab',
    description: 'Connect CI/CD pipelines and merge activity.',
    category: 'Source Control',
    oauth: true,
    helper: 'Use a personal access token with read_api scope.',
    fields: [
      { key: 'token', label: 'Access token', type: 'password', required: true, secret: true },
      { key: 'group', label: 'Group (optional)', type: 'text', placeholder: 'team-platform' }
    ]
  },
  {
    key: 'jenkins',
    name: 'Jenkins',
    description: 'Pull pipeline runs and job statuses.',
    category: 'CI/CD',
    helper: 'Use a Jenkins API token with read access.',
    fields: [
      { key: 'base_url', label: 'Jenkins URL', type: 'text', required: true, placeholder: 'https://jenkins.company.com' },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'api_token', label: 'API token', type: 'password', required: true, secret: true },
      { key: 'job_prefix', label: 'Job folder (optional)', type: 'text', placeholder: 'team-folder/' }
    ]
  },
  {
    key: 'aws',
    name: 'AWS',
    description: 'Stream infrastructure, cost, and deployment signals.',
    category: 'Cloud',
    helper: 'Use least-privilege IAM credentials or role ARN.',
    fields: [
      { key: 'access_key_id', label: 'Access key ID', type: 'text', required: true, secret: true },
      { key: 'secret_access_key', label: 'Secret access key', type: 'password', required: true, secret: true },
      { key: 'region', label: 'Primary region', type: 'text', placeholder: 'ap-south-1' },
      { key: 'role_arn', label: 'Role ARN (optional)', type: 'text' }
    ]
  },
  {
    key: 'azure',
    name: 'Azure',
    description: 'Connect subscriptions and monitor resource health.',
    category: 'Cloud',
    helper: 'Create an app registration and paste tenant/client details.',
    fields: [
      { key: 'tenant_id', label: 'Tenant ID', type: 'text', required: true, secret: true },
      { key: 'client_id', label: 'Client ID', type: 'text', required: true, secret: true },
      { key: 'client_secret', label: 'Client secret', type: 'password', required: true, secret: true },
      { key: 'subscription_id', label: 'Subscription ID', type: 'text' }
    ]
  },
  {
    key: 'gcp',
    name: 'GCP',
    description: 'Ingest project metrics and infra inventory.',
    category: 'Cloud',
    helper: 'Paste a service account JSON with viewer access.',
    fields: [
      { key: 'project_id', label: 'Project ID', type: 'text', required: true, secret: true },
      { key: 'service_account_json', label: 'Service account JSON', type: 'textarea', required: true, secret: true }
    ]
  },
  {
    key: 'datadog',
    name: 'Datadog',
    description: 'Stream metrics and incident alerts.',
    category: 'Monitoring',
    helper: 'Provide API + application keys from Datadog.',
    fields: [
      { key: 'api_key', label: 'API key', type: 'password', required: true, secret: true },
      { key: 'app_key', label: 'Application key', type: 'password', required: true, secret: true },
      { key: 'site', label: 'Site', type: 'select', options: ['us1', 'us3', 'us5', 'eu1'] }
    ]
  },
  {
    key: 'grafana',
    name: 'Grafana',
    description: 'Pull dashboards and alert rules.',
    category: 'Monitoring',
    helper: 'Use a Grafana API token with read access.',
    fields: [
      { key: 'url', label: 'Grafana URL', type: 'text', required: true, secret: true },
      { key: 'api_token', label: 'API token', type: 'password', required: true, secret: true }
    ]
  },
  {
    key: 'prometheus',
    name: 'Prometheus',
    description: 'Stream metrics endpoints into Aikya.',
    category: 'Monitoring',
    helper: 'Provide the Prometheus endpoint and optional token.',
    fields: [
      { key: 'endpoint', label: 'Prometheus URL', type: 'text', required: true, secret: true },
      { key: 'bearer_token', label: 'Bearer token (optional)', type: 'password', secret: true }
    ]
  },
  {
    key: 'slack',
    name: 'Slack',
    description: 'Route alerts and release updates to channels.',
    category: 'Collaboration',
    oauth: true,
    helper: 'Use a bot token from your Slack app.',
    fields: [
      { key: 'bot_token', label: 'Bot token', type: 'password', required: true, secret: true },
      { key: 'workspace', label: 'Workspace', type: 'text', placeholder: 'acme' }
    ]
  },
  {
    key: 'pagerduty',
    name: 'PagerDuty',
    description: 'Wire incidents and escalation policies.',
    category: 'Collaboration',
    helper: 'Provide a REST API key to sync services.',
    fields: [
      { key: 'api_token', label: 'API token', type: 'password', required: true, secret: true },
      { key: 'service_id', label: 'Service ID (optional)', type: 'text' }
    ]
  }
];

type IntegrationSummary = {
  id: number;
  type: string;
  name: string;
  is_active: boolean;
  last_sync?: string | null;
  has_credentials?: boolean;
};

const IntegrationsHubPage: React.FC = () => {
  const [connections, setConnections] = useState<Record<string, IntegrationSummary>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [formState, setFormState] = useState<Record<string, Record<string, string>>>({});
  const [status, setStatus] = useState<Record<string, string>>({});
  const [error, setError] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const providerMap = useMemo(() => {
    const map: Record<string, ProviderConfig> = {};
    providers.forEach((provider) => {
      map[provider.key] = provider;
    });
    return map;
  }, []);

  useEffect(() => {
    const initial: Record<string, Record<string, string>> = {};
    providers.forEach((provider) => {
      initial[provider.key] = {};
      provider.fields.forEach((field) => {
        initial[provider.key][field.key] = '';
      });
    });
    setFormState(initial);
  }, []);

  const fetchConnections = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/integrations`);
      const map: Record<string, IntegrationSummary> = {};
      response.data.forEach((item: IntegrationSummary) => {
        map[item.type] = item;
      });
      setConnections(map);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const handleOAuth = async (providerKey: string) => {
    setError((prev) => ({ ...prev, [providerKey]: '' }));
    setStatus((prev) => ({ ...prev, [providerKey]: 'Redirecting to OAuth...' }));
    try {
      const response = await axios.get(`${API_URL}/api/integrations/oauth/${providerKey}/start`);
      if (response.data?.url) {
        window.location.href = response.data.url;
        return;
      }
      setError((prev) => ({ ...prev, [providerKey]: 'OAuth URL not returned.' }));
    } catch (err: any) {
      setError((prev) => ({
        ...prev,
        [providerKey]: err.response?.data?.error || 'OAuth setup failed.'
      }));
      setStatus((prev) => ({ ...prev, [providerKey]: '' }));
    }
  };

  const handleToggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
    setStatus((prev) => ({ ...prev, [key]: '' }));
    setError((prev) => ({ ...prev, [key]: '' }));
  };

  const updateField = (providerKey: string, fieldKey: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [providerKey]: {
        ...(prev[providerKey] || {}),
        [fieldKey]: value
      }
    }));
  };

  const handleConnect = async (providerKey: string) => {
    const provider = providerMap[providerKey];
    const values = formState[providerKey] || {};
    setStatus((prev) => ({ ...prev, [providerKey]: '' }));
    setError((prev) => ({ ...prev, [providerKey]: '' }));

    const missing = provider.fields.filter((field) => field.required && !values[field.key]);
    if (missing.length > 0) {
      setError((prev) => ({
        ...prev,
        [providerKey]: `Please fill: ${missing.map((field) => field.label).join(', ')}.`
      }));
      return;
    }

    const credentials: Record<string, string> = {};
    const metadata: Record<string, string> = {};

    provider.fields.forEach((field) => {
      const value = values[field.key];
      if (!value) {
        return;
      }
      if (field.secret || field.type === 'password' || field.type === 'textarea') {
        credentials[field.key] = value;
      } else {
        metadata[field.key] = value;
      }
    });

    if (Object.keys(credentials).length === 0) {
      setError((prev) => ({ ...prev, [providerKey]: 'Credentials are required to connect.' }));
      return;
    }

    try {
      await axios.post(`${API_URL}/api/integrations/connect`, {
        provider: provider.key,
        display_name: provider.name,
        connection_method: 'api',
        credentials,
        metadata
      });

      setStatus((prev) => ({ ...prev, [providerKey]: 'Connected successfully.' }));
      setExpanded((prev) => ({ ...prev, [providerKey]: false }));
      setFormState((prev) => ({
        ...prev,
        [providerKey]: Object.keys(prev[providerKey] || {}).reduce((acc, key) => {
          acc[key] = '';
          return acc;
        }, {} as Record<string, string>)
      }));
      fetchConnections();
    } catch (err: any) {
      console.error('Integration connect failed:', err);
      setError((prev) => ({
        ...prev,
        [providerKey]: err.response?.data?.error || 'Failed to connect integration.'
      }));
    }
  };

  const handleDisconnect = async (providerKey: string) => {
    const connection = connections[providerKey];
    if (!connection) {
      return;
    }
    setError((prev) => ({ ...prev, [providerKey]: '' }));
    try {
      await axios.post(`${API_URL}/api/integrations/${connection.id}/disconnect`);
      setStatus((prev) => ({ ...prev, [providerKey]: 'Disconnected.' }));
      fetchConnections();
    } catch (err: any) {
      setError((prev) => ({
        ...prev,
        [providerKey]: err.response?.data?.error || 'Failed to disconnect.'
      }));
    }
  };

  return (
    <div className="pt-20 min-h-screen bg-aikya">
      <div className="container mx-auto px-6 py-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-sm text-amber-200">
            <ShieldCheck className="h-4 w-4 text-amber-300" />
            Secure integrations
          </div>
          <h1 className="text-3xl md:text-4xl font-display text-white mt-4">Integrations</h1>
          <p className="text-slate-300 mt-2">
            Connect your tools to unlock live data. Credentials are encrypted.
          </p>
        </div>

        {loading && (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <SkeletonBlock key={idx} className="h-40" />
            ))}
          </div>
        )}

        <div className={`mt-8 grid gap-6 lg:grid-cols-2 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
          {providers.map((provider) => {
            const connection = connections[provider.key];
            const isConnected = Boolean(connection?.is_active);
            const isExpanded = expanded[provider.key];
            const providerStatus = status[provider.key];
            const providerError = error[provider.key];

            return (
              <div key={provider.key} className="glass rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{provider.category}</p>
                    <h3 className="text-xl font-semibold text-white mt-2">{provider.name}</h3>
                    <p className="text-sm text-slate-400 mt-2">{provider.description}</p>
                  </div>
                  {isConnected ? (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-300 text-xs">
                      <CheckCircle className="h-4 w-4" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-slate-300 text-xs">
                      <Link2 className="h-4 w-4" />
                      Not connected
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {provider.oauth && (
                    <button
                      onClick={() => handleOAuth(provider.key)}
                      className="px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-all text-sm"
                    >
                      Connect via OAuth
                    </button>
                  )}
                  <button
                    onClick={() => handleToggle(provider.key)}
                    className={`px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-all text-sm ${
                      provider.oauth ? '' : 'bg-amber-500/20 text-amber-200'
                    }`}
                  >
                    {isExpanded ? 'Hide form' : isConnected ? 'Update credentials' : 'Manual setup'}
                  </button>
                  {isConnected && (
                    <button
                      onClick={() => handleDisconnect(provider.key)}
                      className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-all text-sm"
                    >
                      Disconnect
                    </button>
                  )}
                </div>

                {provider.helper && (
                  <p className="text-xs text-slate-400 mt-3">{provider.helper}</p>
                )}

                {providerStatus && (
                  <div className="mt-4 text-green-300 text-sm">{providerStatus}</div>
                )}
                {providerError && (
                  <div className="mt-4 text-red-300 text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {providerError}
                  </div>
                )}

                {isExpanded && (
                  <div className="mt-6 space-y-4">
                    {provider.fields.map((field) => (
                      <div key={field.key}>
                        <label className="text-xs text-slate-300">
                          {field.label}
                          {field.required ? ' *' : ''}
                        </label>
                        {field.type === 'select' ? (
                          <select
                            value={formState[provider.key]?.[field.key] || ''}
                            onChange={(event) => updateField(provider.key, field.key, event.target.value)}
                            className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white focus:border-amber-400 focus:outline-none"
                          >
                            <option value="">Select</option>
                            {field.options?.map((option) => (
                              <option key={option} value={option} className="text-slate-100">
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'textarea' ? (
                          <textarea
                            value={formState[provider.key]?.[field.key] || ''}
                            onChange={(event) => updateField(provider.key, field.key, event.target.value)}
                            className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                            placeholder={field.placeholder}
                            rows={3}
                          />
                        ) : (
                          <input
                            type={field.type}
                            value={formState[provider.key]?.[field.key] || ''}
                            onChange={(event) => updateField(provider.key, field.key, event.target.value)}
                            className="mt-2 w-full p-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-slate-400 focus:border-amber-400 focus:outline-none"
                            placeholder={field.placeholder}
                          />
                        )}
                      </div>
                    ))}

                    <button
                      onClick={() => handleConnect(provider.key)}
                      className="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-teal-500 text-white hover:from-amber-600 hover:to-teal-600 transition-all"
                    >
                      <PlugZap className="h-4 w-4 inline mr-2" />
                      Save connection
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default IntegrationsHubPage;
