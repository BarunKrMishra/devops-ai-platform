import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CheckCircle, ShieldCheck, PlugZap, Link2, AlertTriangle, RefreshCw } from 'lucide-react';
import SkeletonBlock from '../ui/SkeletonBlock';
import { providers, ProviderConfig } from './providerCatalog';
import { getApiErrorMessage } from '../../utils/apiError';
import { IntegrationSummary as SummaryPayload } from '../../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  const [syncStatus, setSyncStatus] = useState<Record<string, string>>({});
  const [error, setError] = useState<Record<string, string>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [summaries, setSummaries] = useState<Record<string, SummaryPayload>>({});
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
      const summaryMap: Record<string, SummaryPayload> = {};
      await Promise.all(
        response.data
          .filter((item: IntegrationSummary) => item.is_active)
          .map(async (item: IntegrationSummary) => {
            try {
              const summaryRes = await axios.get(`${API_URL}/api/integrations/${item.id}/summary`);
              summaryMap[item.type] = summaryRes.data;
            } catch (err) {
              console.error('Failed to load integration summary:', err);
            }
          })
      );
      setSummaries((prev) => ({ ...prev, ...summaryMap }));
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
    } catch (err) {
      setError((prev) => ({
        ...prev,
        [providerKey]: getApiErrorMessage(err, 'OAuth setup failed.')
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
    } catch (err) {
      console.error('Integration connect failed:', err);
      setError((prev) => ({
        ...prev,
        [providerKey]: getApiErrorMessage(err, 'Failed to connect integration.')
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
    } catch (err) {
      setError((prev) => ({
        ...prev,
        [providerKey]: getApiErrorMessage(err, 'Failed to disconnect.')
      }));
    }
  };

  const handleSync = async (providerKey: string) => {
    const connection = connections[providerKey];
    if (!connection) {
      return;
    }
    setSyncStatus((prev) => ({ ...prev, [providerKey]: '' }));
    setSyncing((prev) => ({ ...prev, [providerKey]: true }));
    try {
      const response = await axios.post(`${API_URL}/api/integrations/${connection.id}/sync`);
      setSyncStatus((prev) => ({ ...prev, [providerKey]: 'Sync completed.' }));
      setSummaries((prev) => ({ ...prev, [providerKey]: response.data }));
      setConnections((prev) => ({
        ...prev,
        [providerKey]: {
          ...prev[providerKey],
          last_sync: response.data?.last_sync || new Date().toISOString()
        }
      }));
    } catch (err) {
      console.error('Integration sync failed:', err);
      setSyncStatus((prev) => ({
        ...prev,
        [providerKey]: getApiErrorMessage(err, 'Sync failed.')
      }));
    } finally {
      setSyncing((prev) => ({ ...prev, [providerKey]: false }));
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
            const syncSupported = summaries[provider.key]?.supported !== false;

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
                  {isConnected && (
                    <button
                      onClick={() => handleSync(provider.key)}
                      disabled={syncing[provider.key] || !syncSupported}
                      className="px-4 py-2 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-all text-sm disabled:opacity-60"
                    >
                      <RefreshCw className={`h-4 w-4 inline mr-2 ${syncing[provider.key] ? 'animate-spin' : ''}`} />
                      {syncing[provider.key] ? 'Syncing...' : syncSupported ? 'Sync now' : 'Sync coming soon'}
                    </button>
                  )}
                </div>

                {provider.helper && (
                  <p className="text-xs text-slate-400 mt-3">{provider.helper}</p>
                )}

                {providerStatus && (
                  <div className="mt-4 text-green-300 text-sm">{providerStatus}</div>
                )}
                {syncStatus[provider.key] && (
                  <div className="mt-2 text-sm text-slate-200">{syncStatus[provider.key]}</div>
                )}
                {providerError && (
                  <div className="mt-4 text-red-300 text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {providerError}
                  </div>
                )}

                {isConnected && (
                  <div className="mt-4 text-xs text-slate-400">
                    Last sync: {connection?.last_sync ? new Date(connection.last_sync).toLocaleString() : 'Not synced yet'}
                  </div>
                )}

                {isConnected && summaries[provider.key]?.entities && (
                  <div className="mt-2 text-xs text-slate-400">
                    {Object.entries(summaries[provider.key]?.entities ?? {})
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(' • ')}
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
                            aria-label={field.label}
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
