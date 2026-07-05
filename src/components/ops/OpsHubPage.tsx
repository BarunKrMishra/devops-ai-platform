import React, { useEffect, useState } from 'react';
import { Sparkles, ToggleLeft, ToggleRight, ArrowUpRight, CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useOps } from '../../contexts/OpsContext';
import { useBillingStatus } from '../../hooks/useBillingStatus';
import SkeletonBlock from '../ui/SkeletonBlock';
import { getApiErrorMessage } from '../../utils/apiError';
import { PurchaseRequest } from '../../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const OpsHubPage: React.FC = () => {
  const { user, token } = useAuth();
  const { modules, loading, error: opsError, updateModule } = useOps();
  const { status: billingStatus } = useBillingStatus();
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const [purchaseLoading, setPurchaseLoading] = useState<Record<string, boolean>>({});
  const [purchaseRequests, setPurchaseRequests] = useState<Record<string, PurchaseRequest>>({});
  const [purchaseNotice, setPurchaseNotice] = useState('');
  const [purchaseError, setPurchaseError] = useState('');

  const canManage = user?.role === 'admin' || user?.role === 'manager';
  const visibleModules = canManage ? modules : modules.filter((module) => module.enabled);
  const billingActive = billingStatus.enabled;

  const toggleModule = async (module: typeof modules[number]) => {
    if (!canManage) {
      return;
    }
    setUpdating((prev) => ({ ...prev, [module.key]: true }));
    setError('');
    try {
      await updateModule(module.key, { enabled: !module.enabled });
    } catch (err) {
      console.error('Failed to update ops module:', err);
      setError(getApiErrorMessage(err, 'Failed to update module state.'));
    } finally {
      setUpdating((prev) => ({ ...prev, [module.key]: false }));
    }
  };

  const combinedError = error || opsError || purchaseError;

  useEffect(() => {
    if (!billingActive || !token) {
      setPurchaseRequests({});
      return;
    }

    const loadRequests = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/billing/requests`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const map = (response.data || []).reduce((acc: Record<string, PurchaseRequest>, request: PurchaseRequest) => {
          if (request.module_key) {
            acc[request.module_key] = request;
          }
          return acc;
        }, {} as Record<string, PurchaseRequest>);
        setPurchaseRequests(map);
      } catch (err) {
        console.error('Failed to load purchase requests:', err);
      }
    };

    loadRequests();
  }, [billingActive, token]);

  const requestPurchase = async (moduleKey: string) => {
    if (!canManage || !token) {
      return;
    }
    setPurchaseNotice('');
    setPurchaseError('');
    setPurchaseLoading((prev) => ({ ...prev, [moduleKey]: true }));
    try {
      const response = await axios.post(
        `${API_URL}/api/billing/requests`,
        { module_key: moduleKey },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPurchaseRequests((prev) => ({ ...prev, [moduleKey]: response.data }));
      setPurchaseNotice('Purchase request submitted. An admin can approve it to enable the module.');
    } catch (err) {
      console.error('Failed to submit purchase request:', err);
      setPurchaseError(getApiErrorMessage(err, 'Failed to submit purchase request.'));
    } finally {
      setPurchaseLoading((prev) => ({ ...prev, [moduleKey]: false }));
    }
  };

  return (
    <div className="pt-20 min-h-screen">
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display text-white">Ops Hub</h1>
          <p className="text-slate-400 mt-2">
            Choose the operational suites your team needs. Enable only the ops you plan to use and scale by suite.
          </p>
        </div>

        <div className="mb-6 glass rounded-2xl p-5 border border-white/10">
          <div className="flex items-center gap-2 text-amber-200 text-sm uppercase tracking-[0.3em]">
            <CreditCard className="h-4 w-4" />
            Billing readiness
          </div>
          <div className="mt-3 text-sm text-slate-300">
            {billingStatus.loading && 'Checking billing configuration...'}
            {!billingStatus.loading && billingStatus.enabled && (
              <>Billing is active. Charges will be calculated per enabled ops suite.</>
            )}
            {!billingStatus.loading && !billingStatus.enabled && billingStatus.envEnabled && (
              <>
                Billing is disabled on the server. Set <span className="font-mono">BILLING_ENABLED=yes</span> to activate charging.
              </>
            )}
            {!billingStatus.loading && !billingStatus.enabled && !billingStatus.envEnabled && (
              <>
                Billing is disabled. Set <span className="font-mono">VITE_BILLING_ENABLED=yes</span> to activate billing in the UI.
              </>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Currency: {billingStatus.currency || 'USD'} · Charges start only when both frontend and backend flags are enabled.
          </p>
          {billingStatus.error && (
            <p className="mt-2 text-xs text-red-300">{billingStatus.error}</p>
          )}
        </div>

        {purchaseNotice && (
          <div className="glass rounded-xl p-4 border border-emerald-500/30 text-emerald-200 mb-6">
            {purchaseNotice}
          </div>
        )}

        {combinedError && (
          <div className="glass rounded-xl p-4 border border-red-500/30 text-red-200 mb-6">
            {combinedError}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="glass rounded-2xl p-6 border border-white/10">
                <SkeletonBlock className="h-5 w-1/3 mb-3" />
                <SkeletonBlock className="h-4 w-2/3 mb-2" />
                <SkeletonBlock className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {visibleModules.length === 0 && (
              <div className="glass rounded-2xl p-6 border border-white/10 text-slate-300">
                No ops modules are enabled yet. Ask an admin to activate the suites you need.
              </div>
            )}
            {visibleModules.map((module) => (
              <div key={module.key} className="glass rounded-2xl p-6 border border-white/10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{module.category}</p>
                    <h2 className="text-xl font-semibold text-white mt-2">{module.name}</h2>
                    <p className="text-slate-300 mt-2">{module.description}</p>
                  </div>
                  {(() => {
                    const request = purchaseRequests[module.key];
                    const requestStatus = request?.status;
                    const allowToggle = module.enabled || !billingActive || requestStatus === 'approved';

                    if (!module.enabled && billingActive) {
                      const isPending = requestStatus === 'pending';
                      const isApproved = requestStatus === 'approved';
                      return (
                        <button
                          onClick={() => (isApproved ? toggleModule(module) : requestPurchase(module.key))}
                          disabled={!canManage || purchaseLoading[module.key] || isPending}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                            isApproved ? 'bg-emerald-500/20 text-emerald-200' : 'bg-white/10 text-slate-200 hover:bg-white/20'
                          } ${(!canManage || purchaseLoading[module.key] || isPending) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {isApproved ? <ToggleLeft className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                          {isApproved ? 'Enable' : isPending ? 'Request sent' : 'Request purchase'}
                        </button>
                      );
                    }

                    return (
                      <button
                        onClick={() => toggleModule(module)}
                        disabled={!canManage || updating[module.key] || !allowToggle}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                          module.enabled
                            ? 'bg-emerald-500/20 text-emerald-200'
                            : 'bg-white/10 text-slate-200 hover:bg-white/20'
                        } ${(!canManage || updating[module.key] || !allowToggle) ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {module.enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {module.enabled ? 'Enabled' : 'Enable'}
                      </button>
                    );
                  })()}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  {module.ai_enabled && (
                    <span className="inline-flex items-center gap-2 text-amber-200">
                      <Sparkles className="h-4 w-4" />
                      AI enabled
                    </span>
                  )}
                  {billingActive && purchaseRequests[module.key]?.status === 'pending' && (
                    <span className="text-amber-200">Purchase request pending approval</span>
                  )}
                  {billingActive && purchaseRequests[module.key]?.status === 'approved' && (
                    <span className="text-emerald-200">Purchase approved</span>
                  )}
                  {Array.isArray(module.metadata?.integrations) && module.metadata?.integrations.length > 0 && (
                    <span className="text-slate-400">
                      Integrations: {module.metadata.integrations.join(', ')}
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {module.enabled ? (
                    <>
                      <Link
                        to={module.metadata?.launch_path || `/ops/${module.key}`}
                        className="inline-flex items-center gap-2 text-sm text-amber-200 hover:text-amber-100"
                      >
                        Open module <ArrowUpRight className="h-4 w-4" />
                      </Link>
                      <Link
                        to="/app/integrations"
                        className="text-sm text-slate-300 hover:text-white"
                      >
                        Configure integrations
                      </Link>
                    </>
                  ) : (
                    <span className="text-sm text-slate-500">Enable the module to access features</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OpsHubPage;
