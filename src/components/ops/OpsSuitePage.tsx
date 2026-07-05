import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useParams, Link } from 'react-router-dom';
import { ArrowUpRight, ShieldCheck, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOps } from '../../contexts/OpsContext';
import SkeletonBlock from '../ui/SkeletonBlock';
import EmptyState from '../ui/EmptyState';
import { getApiErrorMessage } from '../../utils/apiError';
import { IntegrationItem, IntegrationSummary } from '../../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const OpsSuitePage: React.FC = () => {
  const { moduleKey } = useParams<{ moduleKey: string }>();
  const { user } = useAuth();
  const { modules, loading, error } = useOps();

  const module = useMemo(() => {
    if (!moduleKey) {
      return null;
    }
    return modules.find((item) => item.key === moduleKey) || null;
  }, [modules, moduleKey]);

  const isManager = user?.role === 'admin' || user?.role === 'manager';
  const opsAccess = user?.permissions?.ops_access;
  const hasAccess = useMemo(() => {
    if (isManager) return true;
    if (!moduleKey) return false;
    if (!Array.isArray(opsAccess)) return true;
    return opsAccess.includes(moduleKey);
  }, [isManager, moduleKey, opsAccess]);

  const [connections, setConnections] = useState<Record<string, IntegrationItem>>({});
  const [summaries, setSummaries] = useState<Record<string, IntegrationSummary>>({});
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');

  const normalizeProviderKey = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');

  const integrationProviders = useMemo(() => {
    const list = module?.metadata?.integrations || [];
    return list.map((item: string) => normalizeProviderKey(item)).filter(Boolean);
  }, [module]);

  useEffect(() => {
    if (!module || integrationProviders.length === 0) {
      return;
    }

    const load = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/integrations`);
        const map: Record<string, IntegrationItem> = {};
        response.data.forEach((item: IntegrationItem) => {
          if (item.type) {
            map[item.type] = item;
          }
        });
        setConnections(map);

        const summaryMap: Record<string, IntegrationSummary> = {};
        await Promise.all(
          integrationProviders.map(async (providerKey) => {
            const connection = map[providerKey];
            if (!connection?.id) {
              return;
            }
            try {
              const summaryRes = await axios.get(`${API_URL}/api/integrations/${connection.id}/summary`);
              summaryMap[providerKey] = summaryRes.data;
            } catch (err) {
              console.error('Failed to load integration summary:', err);
            }
          })
        );
        setSummaries((prev) => ({ ...prev, ...summaryMap }));
      } catch (err) {
        console.error('Failed to load integrations:', err);
      }
    };

    load();
  }, [module, integrationProviders]);

  const handleSync = async (providerKey: string) => {
    const connection = connections[providerKey];
    if (!connection?.id) {
      setSyncError('Connect this integration to sync data.');
      return;
    }

    setSyncMessage('');
    setSyncError('');
    setSyncing((prev) => ({ ...prev, [providerKey]: true }));
    try {
      const response = await axios.post(`${API_URL}/api/integrations/${connection.id}/sync`);
      setSummaries((prev) => ({ ...prev, [providerKey]: response.data }));
      setConnections((prev) => ({
        ...prev,
        [providerKey]: {
          ...prev[providerKey],
          last_sync: response.data?.last_sync || new Date().toISOString()
        }
      }));
      setSyncMessage('Sync completed.');
    } catch (err) {
      console.error('Integration sync failed:', err);
      setSyncError(getApiErrorMessage(err, 'Failed to sync integration.'));
    } finally {
      setSyncing((prev) => ({ ...prev, [providerKey]: false }));
    }
  };

  if (loading) {
    return (
      <div className="pt-20 min-h-screen">
        <div className="container mx-auto px-6 py-8">
          <SkeletonBlock className="h-10 w-1/3 mb-4" />
          <SkeletonBlock className="h-5 w-2/3 mb-6" />
          <div className="grid gap-6 md:grid-cols-2">
            {[0, 1, 2].map((item) => (
              <SkeletonBlock key={item} className="h-40" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-20 min-h-screen">
        <div className="container mx-auto px-6 py-8">
          <div className="glass rounded-xl p-4 border border-red-500/30 text-red-200">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="pt-20 min-h-screen">
        <div className="container mx-auto px-6 py-8">
          <EmptyState title="Module not found" message="The requested ops module is not available." />
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="pt-20 min-h-screen">
        <div className="container mx-auto px-6 py-8">
          <div className="glass rounded-2xl p-8 border border-white/10">
            <h1 className="text-2xl font-semibold text-white">{module.name}</h1>
            <p className="text-slate-300 mt-2">
              Your account does not have access to this ops module. Please contact an administrator to request access.
            </p>
            <Link to="/collaboration" className="inline-flex items-center gap-2 text-amber-200 mt-4">
              View team access <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!module.enabled && !isManager) {
    return (
      <div className="pt-20 min-h-screen">
        <div className="container mx-auto px-6 py-8">
          <div className="glass rounded-2xl p-8 border border-white/10">
            <h1 className="text-2xl font-semibold text-white">{module.name}</h1>
            <p className="text-slate-300 mt-2">
              This ops suite is not enabled for your organization yet. Ask a manager to enable it in Ops Hub.
            </p>
            <Link to="/ops" className="inline-flex items-center gap-2 text-amber-200 mt-4">
              Go to Ops Hub <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const integrations = module.metadata?.integrations || [];
  const devOpsLinks = module.key === 'aidevops'
    ? [
        { label: 'CI/CD Pipelines', to: '/cicd' },
        { label: 'Infrastructure', to: '/infrastructure' },
        { label: 'Monitoring', to: '/monitoring' }
      ]
    : [];

  return (
    <div className="pt-20 min-h-screen">
      <div className="container mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{module.category}</p>
            <h1 className="text-3xl font-display text-white mt-2">{module.name}</h1>
            <p className="text-slate-300 mt-2 max-w-2xl">{module.description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className={`px-3 py-1 rounded-full text-xs border ${module.enabled ? 'border-emerald-500/40 text-emerald-200' : 'border-white/10 text-slate-300'}`}>
              {module.enabled ? 'Enabled' : 'Not enabled'}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs border ${module.configured ? 'border-amber-500/40 text-amber-200' : 'border-white/10 text-slate-300'}`}>
              {module.configured ? 'Configured' : 'Not configured'}
            </span>
            {module.ai_enabled && (
              <span className="px-3 py-1 rounded-full text-xs border border-amber-500/40 text-amber-200 inline-flex items-center gap-2">
                <Sparkles className="h-3 w-3" />
                AI enabled
              </span>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 glass rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white">Module overview</h2>
            <p className="text-slate-300 mt-2">
              Configure this module to activate workflows, routing, and automation across your operations.
              Use the Ops Hub to enable or disable modules without impacting others.
            </p>
            {devOpsLinks.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-slate-400">Core AI DevOps areas</p>
                <div className="mt-2 flex flex-wrap gap-3">
                  {devOpsLinks.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="text-sm text-amber-200 hover:text-amber-100 inline-flex items-center gap-2"
                    >
                      {item.label} <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 flex items-center gap-3 text-sm text-slate-300">
              <ShieldCheck className="h-4 w-4 text-amber-300" />
              Changes are logged with audit trails.
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/ops"
                className="px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
              >
                Manage in Ops Hub
              </Link>
              {module.enabled && module.metadata?.launch_path && module.metadata.launch_path !== `/ops/${module.key}` && (
                <Link
                  to={module.metadata.launch_path}
                  className="px-4 py-2 rounded-lg bg-white/10 text-slate-200 hover:bg-white/20 transition-colors"
                >
                  Open workspace
                </Link>
              )}
              {module.enabled && (
                <Link
                  to="/app/integrations"
                  className="px-4 py-2 rounded-lg bg-white/10 text-slate-200 hover:bg-white/20 transition-colors"
                >
                  Configure integrations
                </Link>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white">Integration activity</h2>
            {syncMessage && (
              <div className="mt-3 text-sm text-emerald-200">{syncMessage}</div>
            )}
            {syncError && (
              <div className="mt-3 text-sm text-red-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {syncError}
              </div>
            )}
            {integrations.length === 0 ? (
              <p className="text-slate-400 mt-3 text-sm">No integrations listed yet.</p>
            ) : (
              <div className="mt-4 space-y-4 text-sm text-slate-300">
                {integrations.map((item) => {
                  const providerKey = normalizeProviderKey(item);
                  const connection = connections[providerKey];
                  const summary = summaries[providerKey];
                  const connected = Boolean(connection?.is_active);
                  const syncSupported = summary?.supported !== false;
                  return (
                    <div key={item} className="rounded-xl border border-white/10 p-4 bg-white/5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-white font-semibold">{item}</div>
                          <div className="text-xs text-slate-400">
                            {connected ? 'Connected' : 'Not connected'}
                          </div>
                          {connected && (
                            <div className="text-xs text-slate-500 mt-1">
                              Last sync: {connection?.last_sync ? new Date(connection.last_sync).toLocaleString() : 'Not synced yet'}
                            </div>
                          )}
                          {summary?.entities && (
                            <div className="text-xs text-slate-500 mt-1">
                              {Object.entries(summary.entities)
                                .map(([key, value]) => `${key}: ${value}`)
                                .join(' • ')}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {connected ? (
                            syncSupported ? (
                            <button
                              onClick={() => handleSync(providerKey)}
                              disabled={syncing[providerKey]}
                              className="px-3 py-1 rounded-lg border border-white/10 text-white hover:bg-white/10 transition text-xs disabled:opacity-60"
                            >
                              <RefreshCw className={`h-3 w-3 inline mr-2 ${syncing[providerKey] ? 'animate-spin' : ''}`} />
                              {syncing[providerKey] ? 'Syncing' : 'Sync now'}
                            </button>
                            ) : (
                              <span className="text-xs text-slate-500">Sync coming soon</span>
                            )
                          ) : (
                            <Link
                              to="/app/integrations"
                              className="text-xs text-amber-200 hover:text-amber-100"
                            >
                              Connect integration
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {!module.enabled && (
          <div className="mt-8 glass rounded-2xl p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white">Enable this module</h3>
            <p className="text-slate-300 mt-2">
              This module is not enabled for your organization. Enable it in Ops Hub to activate workflows.
            </p>
            {isManager ? (
              <Link to="/ops" className="inline-flex items-center gap-2 text-amber-200 mt-4">
                Open Ops Hub <ArrowUpRight className="h-4 w-4" />
              </Link>
            ) : (
              <p className="text-xs text-slate-400 mt-4">Contact a manager to enable this module.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OpsSuitePage;
