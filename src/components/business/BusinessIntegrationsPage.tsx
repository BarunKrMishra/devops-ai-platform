import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CheckCircle, ShieldCheck, PlugZap, Link2, AlertTriangle, RefreshCw } from 'lucide-react';
import SkeletonBlock from '../ui/SkeletonBlock';
import { businessCategories, providers, ProviderConfig } from '../integrations/providerCatalog';
import BusinessNav from './BusinessNav';
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

const BusinessIntegrationsPage: React.FC = () => {
  const businessProviders = useMemo(
    () => providers.filter((provider) => businessCategories.includes(provider.category)),
    []
  );
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
    businessProviders.forEach((provider) => {
      map[provider.key] = provider;
    });
    return map;
  }, [businessProviders]);

  useEffect(() => {
    const initial: Record<string, Record<string, string>> = {};
    businessProviders.forEach((provider) => {
      initial[provider.key] = {};
      provider.fields.forEach((field) => {
        initial[provider.key][field.key] = '';
      });
    });
    setFormState(initial);
  }, [businessProviders]);

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
        [providerKey]: 'Please fill in required fields.'
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
      setError((prev) => ({
        ...prev,
        [providerKey]: 'Credentials are required to connect.'
      }));
      return;
    }

    try {
      await axios.post(`${API_URL}/api/integrations/connect`, {
        provider: providerKey,
        display_name: provider.name,
        connection_method: provider.oauth ? 'oauth' : 'api',
        credentials,
        metadata
      });
      setStatus((prev) => ({ ...prev, [providerKey]: 'Connected successfully.' }));
      fetchConnections();
    } catch (err) {
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
    try {
      await axios.post(`${API_URL}/api/integrations/${connection.id}/disconnect`);
      setStatus((prev) => ({ ...prev, [providerKey]: 'Disconnected.' }));
      fetchConnections();
    } catch (err) {
      setError((prev) => ({
        ...prev,
        [providerKey]: getApiErrorMessage(err, 'Failed to disconnect integration.')
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
    <div className="pt-20 min-h-screen">
      <div className="container mx-auto px-6 py-8">
        <BusinessNav />

        <div className="glass rounded-2xl p-6 mb-8 border border-white/10">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-500/20 text-amber-200">
              <PlugZap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-3xl font-display text-white">Business Integrations</h1>
              <p className="text-slate-300 mt-2">
                Connect CRMs, inboxes, and messaging tools so your automations can act on live business data.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Encrypted credentials
                </div>
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-sky-400" />
                  Connect in minutes
                </div>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {businessProviders.map((provider) => (
              <div key={provider.key} className="glass rounded-2xl p-6 border border-white/10">
                <SkeletonBlock className="h-6 w-1/3 mb-4" />
                <SkeletonBlock className="h-4 w-2/3 mb-2" />
                <SkeletonBlock className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {businessProviders.map((provider) => {
              const connection = connections[provider.key];
              const isExpanded = expanded[provider.key];
              const hasCredentials = Boolean(connection?.has_credentials);
              const syncSupported = summaries[provider.key]?.supported !== false;
              return (
                <div key={provider.key} className="glass rounded-2xl p-6 border border-white/10">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{provider.category}</p>
                      <h2 className="text-xl font-semibold text-white mt-2">{provider.name}</h2>
                      <p className="text-slate-300 mt-2">{provider.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {connection?.is_active && (
                        <span className="flex items-center gap-1 text-emerald-300 text-sm">
                          <CheckCircle className="h-4 w-4" />
                          Connected
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => handleToggle(provider.key)}
                      className="text-sm px-4 py-2 rounded-lg bg-white/10 text-slate-200 hover:bg-white/20 transition"
                    >
                      {isExpanded ? 'Hide setup' : 'Configure'}
                    </button>
                    {connection?.is_active && (
                      <button
                        onClick={() => handleSync(provider.key)}
                        disabled={syncing[provider.key] || !syncSupported}
                        className="text-sm px-4 py-2 rounded-lg bg-white/10 text-slate-200 hover:bg-white/20 transition disabled:opacity-60"
                      >
                        <RefreshCw className={`h-4 w-4 inline mr-2 ${syncing[provider.key] ? 'animate-spin' : ''}`} />
                        {syncing[provider.key] ? 'Syncing...' : syncSupported ? 'Sync now' : 'Sync coming soon'}
                      </button>
                    )}
                    {connection?.is_active && (
                      <button
                        onClick={() => handleDisconnect(provider.key)}
                        className="text-sm px-4 py-2 rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/30 transition"
                      >
                        Disconnect
                      </button>
                    )}
                  </div>

                  {provider.helper && (
                    <p className="text-xs text-slate-400 mt-3">{provider.helper}</p>
                  )}

                  {syncStatus[provider.key] && (
                    <div className="mt-2 text-sm text-slate-200">{syncStatus[provider.key]}</div>
                  )}

                  {connection?.is_active && (
                    <div className="mt-3 text-xs text-slate-400">
                      Last sync: {connection?.last_sync ? new Date(connection.last_sync).toLocaleString() : 'Not synced yet'}
                    </div>
                  )}

                  {connection?.is_active && summaries[provider.key]?.entities && (
                    <div className="mt-2 text-xs text-slate-400">
                      {Object.entries(summaries[provider.key]?.entities ?? {})
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(' • ')}
                    </div>
                  )}

                  {isExpanded && (
                    <div className="mt-5 space-y-3">
                      {provider.fields.map((field) => (
                        <div key={field.key}>
                          <label className="text-sm text-slate-300">{field.label}</label>
                          {field.type === 'textarea' ? (
                            <textarea
                              className="w-full mt-2 p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
                              rows={4}
                              placeholder={field.placeholder}
                              value={formState[provider.key]?.[field.key] || ''}
                              onChange={(event) => updateField(provider.key, field.key, event.target.value)}
                            />
                          ) : field.type === 'select' ? (
                            <select
                              aria-label={field.label}
                              className="w-full mt-2 p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
                              value={formState[provider.key]?.[field.key] || ''}
                              onChange={(event) => updateField(provider.key, field.key, event.target.value)}
                            >
                              <option value="">Select {field.label}</option>
                              {field.options?.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              className="w-full mt-2 p-3 rounded-lg bg-slate-900/70 border border-white/10 text-slate-100"
                              type={field.type === 'password' ? 'password' : 'text'}
                              placeholder={field.placeholder}
                              value={formState[provider.key]?.[field.key] || ''}
                              onChange={(event) => updateField(provider.key, field.key, event.target.value)}
                            />
                          )}
                        </div>
                      ))}

                      <div className="flex flex-wrap items-center gap-3">
                        {provider.oauth ? (
                          <button
                            onClick={() => handleOAuth(provider.key)}
                            className="px-4 py-2 bg-amber-500/30 text-amber-100 rounded-lg hover:bg-amber-500/40 transition"
                          >
                            Connect via OAuth
                          </button>
                        ) : (
                          <button
                            onClick={() => handleConnect(provider.key)}
                            className="px-4 py-2 bg-emerald-500/30 text-emerald-100 rounded-lg hover:bg-emerald-500/40 transition"
                          >
                            {hasCredentials ? 'Update connection' : 'Connect'}
                          </button>
                        )}
                        {status[provider.key] && (
                          <span className="text-sm text-emerald-200">{status[provider.key]}</span>
                        )}
                        {error[provider.key] && (
                          <span className="text-sm text-red-200 flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" />
                            {error[provider.key]}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessIntegrationsPage;
